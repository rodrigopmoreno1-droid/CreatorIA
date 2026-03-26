import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { buildScriptMetadata, parseScriptMetadata, toProductItem } from '@/lib/platform-data';
import {
  generateSchedulePlan,
  type GeneratedPlannerPost,
  type PlannerConfig
} from '@/lib/post-schedule-planner';
import { buildScriptSavePayloads } from '@/lib/script-drafts';
import { generateScriptVariants } from '@/services/ai';
import type { PlannerBatchSummary, ProductItem } from '@/types/platform';

type PlannerBatchRecord = {
  id: string;
  company_id: string;
  config: unknown;
  summary: unknown;
  reason: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  benefits: string | null;
  audience: string | null;
  price: number | string | null;
  restrictions: string | null;
  metadata: unknown;
  created_at: string;
};

const batchStatuses = new Set(['queued', 'running', 'completed', 'error']);

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizePlannerConfig(value: unknown): PlannerConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  return {
    mode: normalizeString(raw.mode) === 'replan' ? 'replan' : 'create',
    periodPreset:
      normalizeString(raw.periodPreset) === '1' ||
      normalizeString(raw.periodPreset) === '15' ||
      normalizeString(raw.periodPreset) === '30' ||
      normalizeString(raw.periodPreset) === 'custom'
        ? (normalizeString(raw.periodPreset) as PlannerConfig['periodPreset'])
        : '7',
    startDate: normalizeString(raw.startDate),
    endDate: normalizeString(raw.endDate),
    feedPerDay: typeof raw.feedPerDay === 'number' ? raw.feedPerDay : Number.parseInt(normalizeString(raw.feedPerDay), 10) || 0,
    reason: normalizeString(raw.reason),
    templateId: normalizeString(raw.templateId) || undefined,
    productRules: Array.isArray(raw.productRules)
      ? raw.productRules
          .filter((rule): rule is PlannerConfig['productRules'][number] => Boolean(rule && typeof rule === 'object'))
          .map((rule) => {
            const item = rule as Record<string, unknown>;
            return {
              productId: normalizeString(item.productId),
              productName: normalizeString(item.productName),
              enabled: Boolean(item.enabled),
              paused: Boolean(item.paused),
              appearancesInPeriod:
                typeof item.appearancesInPeriod === 'number'
                  ? item.appearancesInPeriod
                  : Number.parseInt(normalizeString(item.appearancesInPeriod), 10) || 0,
              storiesInPeriod:
                typeof item.storiesInPeriod === 'number'
                  ? item.storiesInPeriod
                  : Number.parseInt(normalizeString(item.storiesInPeriod), 10) || 0,
              fixedWeekdays: Array.isArray(item.fixedWeekdays)
                ? item.fixedWeekdays.filter((day): day is number => typeof day === 'number')
                : [],
              consecutiveRule:
                normalizeString(item.consecutiveRule) === 'force'
                  ? 'force'
                  : normalizeString(item.consecutiveRule) === 'allow'
                    ? 'allow'
                    : 'avoid',
              allDays: Boolean(item.allDays),
              priority:
                typeof item.priority === 'number'
                  ? item.priority
                  : Number.parseInt(normalizeString(item.priority), 10) || 0
            };
          })
      : []
  };
}

function serializeSummary(summary: PlannerBatchSummary, extra?: { generatedScripts?: number; failedScripts?: number }) {
  return {
    ...summary,
    generatedScripts: extra?.generatedScripts ?? summary.generatedScripts ?? 0,
    failedScripts: extra?.failedScripts ?? summary.failedScripts ?? 0
  };
}

function formatDateShort(isoDate: string) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function shouldUseTrendMode(reason: string) {
  return /\b(trend|viral|alcance|campanha|lancamento|lançamento|promo)\b/i.test(reason);
}

function resolveGenerationStrategy(slot: GeneratedPlannerPost, reason: string) {
  const trend = shouldUseTrendMode(reason);

  switch (slot.contentType) {
    case 'stories':
      return {
        tones: ['natural', 'storytelling'],
        objectives: ['relacionamento', 'vender'],
        referenceContext: 'Transforme o plano do cronograma em uma sequência de stories conectada, com progressão de slides e CTA de resposta.',
      };
    case 'carrossel':
      return {
        tones: ['educativo', 'autoridade'],
        objectives: ['educar', 'engajar', 'vender'],
        referenceContext: 'Transforme o plano do cronograma em um carrossel de feed com alto salvamento e compartilhamento.',
      };
    case 'post':
      return {
        tones: ['natural', 'autoridade'],
        objectives: ['relacionamento', 'vender'],
        referenceContext: 'Transforme o plano do cronograma em um post estático com conceito visual forte e legenda útil.',
      };
    case 'video_curto':
      return {
        tones: trend ? ['natural', 'trend'] : ['natural', 'storytelling'],
        objectives: ['alcance', 'engajar'],
        referenceContext: 'Transforme o plano do cronograma em um vídeo curto rápido, falável e com cara de conteúdo nativo.',
      };
    default:
      return {
        tones: trend ? ['natural', 'storytelling', 'trend'] : ['natural', 'storytelling'],
        objectives: ['alcance', 'engajar', 'vender'],
        referenceContext: 'Transforme o plano do cronograma em um Reels com gancho forte, retenção e CTA claro.',
      };
  }
}

function buildSlotPrompt(slot: GeneratedPlannerPost, product?: ProductItem, reason = '') {
  const pieces = [
    `Planejado para ${formatDateShort(slot.scheduledFor)}.`,
    slot.title,
    product?.name ? `Produto foco: ${product.name}.` : '',
    product?.benefit ? `Benefício central: ${product.benefit}.` : '',
    product?.pain ? `Dor central: ${product.pain}.` : '',
    reason.trim() ? `Contexto do cronograma: ${reason.trim()}.` : '',
    slot.contentType === 'stories'
      ? `Crie uma sequência de ${slot.subOption || '3'} slides conectados.`
      : 'O conteúdo precisa nascer pronto para revisão como rascunho.'
  ].filter(Boolean);

  return pieces.join(' ');
}

function buildProductContext(product?: ProductItem) {
  if (!product) {
    return '';
  }

  return [
    product.benefits ? `Benefícios: ${product.benefits}` : '',
    product.audience ? `Público: ${product.audience}` : '',
    product.restrictions ? `Restrições: ${product.restrictions}` : '',
    product.price ? `Preço: ${product.price}` : '',
    product.discountPrice ? `Preço promocional: ${product.discountPrice}` : ''
  ]
    .filter(Boolean)
    .join(' | ');
}

function buildLocalFallbackPayload(slot: GeneratedPlannerPost, product?: ProductItem) {
  const productName = product?.name ?? slot.productName ?? 'produto';
  const benefit = product?.benefit || product?.benefits || 'resultado visível';
  const pain = product?.pain || 'uma dor que trava a rotina';

  if (slot.contentType === 'stories') {
    const count = Math.max(1, Math.min(10, Number.parseInt(slot.subOption || '3', 10) || 3));
    return [
      {
        title: slot.title,
        hook: `Se isso pega em você, olha isso`,
        spoken: '',
        takes: [],
        cta: 'Responde "quero" que eu te explico o melhor caminho.',
        caption: '',
        storySlides: Array.from({ length: count }, (_, index) => ({
          objetivo: index === 0 ? 'Gancho' : index === count - 1 ? 'CTA' : 'Desenvolvimento',
          textoTela:
            index === 0
              ? `Se ${pain.toLowerCase()}`
              : index === count - 1
                ? `Quer ajuda com ${productName}?`
                : `${productName} pode ajudar`,
          falado:
            index === 0
              ? `Muita gente acha normal conviver com ${pain.toLowerCase()}, mas nem sempre precisa ser assim.`
              : index === count - 1
                ? `Se quiser que eu te mostre como usar ${productName} dentro da sua rotina, me chama no direct.`
                : `${productName} entra aqui para apoiar ${benefit.toLowerCase()} sem complicar sua rotina.`,
          visual:
            index === 0
              ? 'Selfie com texto grande na tela e expressão de identificação.'
              : index === count - 1
                ? 'Tela limpa com CTA e gesto apontando para a caixa de resposta.'
                : 'Take curto mostrando produto, contexto de uso e texto de apoio.'
        }))
      }
    ];
  }

  if (slot.contentType === 'carrossel') {
    const count = Math.max(2, Math.min(10, Number.parseInt(slot.subOption || '5', 10) || 5));
    return [
      {
        title: slot.title,
        hook: `O erro que atrasa ${benefit.toLowerCase()}`,
        spoken: '',
        takes: [],
        cta: `Salva este carrossel e me chama se quiser entender como ${productName} entra na rotina.`,
        caption: `Se ${pain.toLowerCase()} parece normal por aí, salva este conteúdo.\n\n${productName} pode entrar como apoio para ${benefit.toLowerCase()}.\n\n#conteudo #carrossel #instagram`,
        carrosselSlides: Array.from({ length: count }, (_, index) => ({
          numero: index + 1,
          titulo:
            index === 0
              ? `O erro sobre ${benefit.toLowerCase()}`
              : index === count - 1
                ? `Como levar isso pra rotina`
                : `${productName} em foco`,
          subtitulo:
            index === 0
              ? `Nem todo mundo percebe isso`
              : index === count - 1
                ? `Resumo prático`
                : `Ponto ${index}`,
          conteudo:
            index === 0
              ? `Muita gente tenta resolver ${pain.toLowerCase()} do jeito errado e isso só prolonga o problema.`
              : index === count - 1
                ? `${productName} faz sentido quando a ideia é apoiar ${benefit.toLowerCase()} com constância e intenção.`
                : `Explique um ponto simples sobre ${pain.toLowerCase()} e conecte com o benefício ${benefit.toLowerCase()}.`,
          visual: 'Layout limpo com título forte, apoio curto e um elemento visual que destaque a leitura.'
        }))
      }
    ];
  }

  if (slot.contentType === 'post') {
    return [
      {
        title: slot.title,
        hook: `Nem sempre o problema é o que parece`,
        spoken: '',
        takes: [],
        cta: `Comenta "${productName}" se quiser que eu aprofunde isso.`,
        caption: `Tem coisa que a gente normaliza até perceber que existe um caminho mais inteligente.\n\n${productName} pode ser uma boa ponte para ${benefit.toLowerCase()}.\n\nComenta "${productName}" que eu te explico.\n\n#post #conteudo #instagram`,
        postFields: {
          conceito: `Post de identificação conectando ${pain.toLowerCase()} com a busca por ${benefit.toLowerCase()}.`,
          tituloPeca: `Nem sempre o problema é o que parece`,
          textoApoio: `${productName} entra como apoio para quem quer ${benefit.toLowerCase()} com mais constância.`,
          direcaoVisual: 'Peça limpa com título grande, área de respiro e imagem/produto como ponto de foco.'
        }
      }
    ];
  }

  return [
    {
      title: slot.title,
      hook: `O erro que trava ${benefit.toLowerCase()}`,
      spoken: `Muita gente convive com ${pain.toLowerCase()} e acha que isso faz parte. Só que quando você organiza a rotina e entende onde ${productName} entra, fica muito mais simples buscar ${benefit.toLowerCase()} com constância.`,
      takes: [
        'Abertura em selfie com expressão de identificação.',
        `Corte mostrando o contexto do problema: ${pain.toLowerCase()}.`,
        `Demonstre ${productName} entrando como apoio real.`,
        `Mostre o benefício central: ${benefit.toLowerCase()}.`,
        'Fechamento olhando para a câmera com CTA direto.'
      ],
      cta: `Se quiser que eu te mostre como usar ${productName} na prática, me chama no direct.`,
      caption: `Se ${pain.toLowerCase()} parece normal, talvez você esteja olhando para o lugar errado.\n\n${productName} pode apoiar ${benefit.toLowerCase()} quando entra com intenção na rotina.\n\nMe chama no direct se quiser entender melhor.\n\n#reels #instagram #conteudo`
    }
  ];
}

async function updateBatchProgress(batchId: string, input: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error('Supabase admin client indisponível.');
  }

  const { error } = await admin
    .from('content_planner_batches')
    .update(input)
    .eq('id', batchId);

  if (error) {
    throw new Error(error.message);
  }
}

async function loadCompanyProducts(companyId: string) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error('Supabase admin client indisponível.');
  }

  const { data, error } = await admin
    .from('products')
    .select('id,name,benefits,audience,price,restrictions,metadata,created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toProductItem(row as ProductRow));
}

async function deletePlannerScriptsInRange(companyId: string, startDate: string, endDate: string) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error('Supabase admin client indisponível.');
  }

  const { data, error } = await admin
    .from('scripts')
    .select('id,storyboard')
    .eq('company_id', companyId);

  if (error) {
    throw new Error(error.message);
  }

  const idsToDelete = (data ?? [])
    .filter((row) => {
      const meta = parseScriptMetadata((row as { storyboard: unknown }).storyboard);
      return (
        meta.plannerMeta?.source === 'planner' &&
        !!meta.scheduledFor &&
        meta.scheduledFor >= startDate &&
        meta.scheduledFor <= endDate
      );
    })
    .map((row) => (row as { id: string }).id);

  if (!idsToDelete.length) {
    return;
  }

  const { error: deleteError } = await admin
    .from('scripts')
    .delete()
    .eq('company_id', companyId)
    .in('id', idsToDelete);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

async function createScriptDraftFromSlot(companyId: string, slot: GeneratedPlannerPost, product?: ProductItem, reason = '') {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error('Supabase admin client indisponível.');
  }

  const strategy = resolveGenerationStrategy(slot, reason);
  const prompt = buildSlotPrompt(slot, product, reason);
  const referenceContext = [
    strategy.referenceContext,
    reason.trim() ? `Contexto operacional: ${reason.trim()}.` : '',
    `Agendado para ${formatDateShort(slot.scheduledFor)}.`
  ]
    .filter(Boolean)
    .join(' ');

  let variants: unknown;

  try {
    variants = await generateScriptVariants({
      prompt,
      productName: product?.name ?? slot.productName,
      productContext: buildProductContext(product),
      referenceContext,
      contentType: slot.contentType,
      subOption: slot.subOption || undefined,
      tones: strategy.tones,
      objectives: strategy.objectives,
      pain: product?.pain ?? '',
      benefit: product?.benefit ?? '',
      targetAudience: product?.audience ?? ''
    });
  } catch {
    variants = buildLocalFallbackPayload(slot, product);
  }

  const payloads = buildScriptSavePayloads(variants, {
    prompt,
    product,
    contentType: slot.contentType,
    subOption: slot.subOption,
    referenceContext,
    scheduledFor: slot.scheduledFor,
    plannerMeta: slot.plannerMeta
  });

  const firstPayload = payloads[0];

  if (!firstPayload) {
    throw new Error('A geração do cronograma retornou vazio.');
  }

  const insertPayload = {
    company_id: companyId,
    title: firstPayload.title,
    hook: firstPayload.hook.trim() || null,
    spoken_text: firstPayload.spoken.trim() || null,
    cta: firstPayload.cta.trim() || null,
    status: 'draft',
    storyboard: buildScriptMetadata({
      caption: firstPayload.caption,
      prompt: firstPayload.prompt,
      referenceContext: firstPayload.referenceContext,
      takes: firstPayload.takes,
      productId: firstPayload.productId,
      productName: firstPayload.productName,
      contentType: firstPayload.contentType,
      subOption: firstPayload.subOption,
      storySlides: Array.isArray(firstPayload.storySlides) ? firstPayload.storySlides as never[] : [],
      carrosselSlides: Array.isArray(firstPayload.carrosselSlides) ? firstPayload.carrosselSlides as never[] : [],
      postFields: firstPayload.postFields as never,
      notes: slot.notes,
      dueDate: slot.scheduledFor,
      category: 'Cronograma',
      labels: ['Cronograma'],
      blockType: slot.contentType,
      scheduledFor: slot.scheduledFor,
      plannerMeta: slot.plannerMeta
    })
  };

  const { error } = await admin.from('scripts').insert(insertPayload);

  if (error) {
    throw new Error(error.message);
  }
}

export async function processContentPlannerBatch(input: { batchId: string; companyId: string }) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error('Supabase admin client indisponível.');
  }

  const { data, error } = await admin
    .from('content_planner_batches')
    .select('id,company_id,config,summary,reason,status')
    .eq('id', input.batchId)
    .eq('company_id', input.companyId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Batch de cronograma não encontrado.');
  }

  if (batchStatuses.has(String((data as { status?: string }).status)) && (data as { status?: string }).status === 'running') {
    return;
  }

  const batch = data as PlannerBatchRecord & { status?: string };
  const config = normalizePlannerConfig(batch.config);

  if (!config) {
    await updateBatchProgress(input.batchId, {
      status: 'error',
      error_message: 'Configuração do cronograma inválida.',
      completed_at: new Date().toISOString()
    });
    return;
  }

  await updateBatchProgress(input.batchId, {
    status: 'running',
    started_at: new Date().toISOString(),
    error_message: ''
  });

  try {
    const products = await loadCompanyProducts(input.companyId);
    const plan = generateSchedulePlan(config, products);
    const productMap = new Map(products.map((product) => [product.id, product]));

    await deletePlannerScriptsInRange(input.companyId, config.startDate, config.endDate);

    let generatedScripts = 0;
    let failedScripts = 0;

    for (const slot of plan.posts) {
      try {
        await createScriptDraftFromSlot(input.companyId, slot, slot.productId ? productMap.get(slot.productId) : undefined, batch.reason ?? config.reason);
        generatedScripts += 1;
      } catch {
        failedScripts += 1;
      }

      await updateBatchProgress(input.batchId, {
        progress_completed: generatedScripts + failedScripts,
        summary: serializeSummary(plan.summary, { generatedScripts, failedScripts })
      });
    }

    await updateBatchProgress(input.batchId, {
      status: failedScripts === plan.posts.length ? 'error' : 'completed',
      progress_total: plan.posts.length,
      progress_completed: generatedScripts + failedScripts,
      summary: serializeSummary(plan.summary, { generatedScripts, failedScripts }),
      error_message:
        failedScripts > 0
          ? `${failedScripts} item(ns) do cronograma não puderam ser gerados automaticamente.`
          : '',
      completed_at: new Date().toISOString()
    });
  } catch (processError) {
    await updateBatchProgress(input.batchId, {
      status: 'error',
      error_message: processError instanceof Error ? processError.message : 'Erro ao processar o cronograma.',
      completed_at: new Date().toISOString()
    });
  }
}
