import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PRODUCT_IMPORT_BUCKET } from '@/lib/product-import-storage';

type IdeaInput = {
  topic: string;
  audience?: string;
  product?: string;
  count?: number;
};

type ScriptInput = {
  topic: string;
  goal?: string;
  tone?: string;
};

type ScriptVariantInput = {
  prompt: string;
  productName?: string;
  productContext?: string;
  referenceContext?: string;
};

type ProductImportInput = {
  prompt?: string;
  sourceText?: string;
  file?: {
    mimeType: string;
    base64?: string;
    storagePath?: string;
    bucket?: string;
    name?: string;
    sizeBytes?: number;
  };
  maxItems?: number;
};

type StoryInput = {
  theme: string;
  count?: number;
};

type MetricsInput = {
  summary: string;
  series?: Array<{ name: string; value: number }>;
};

type CompetitorInput = {
  competitors: string[];
  niche?: string;
};

type CalendarInput = {
  month: string;
  product?: string;
};

type ChatInput = {
  prompt: string;
  workspace?: string;
  context?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

type Provider = 'anthropic' | 'gemini';

type AnthropicCitation = {
  type?: string;
  title?: string;
  url?: string;
  cited_text?: string;
  encrypted_index?: string;
};

type AnthropicTextBlock = {
  type?: string;
  text?: string;
  citations?: AnthropicCitation[];
  content?: unknown;
};

type AnthropicMessagesPayload = {
  content?: AnthropicTextBlock[];
  error?: {
    message?: string;
  };
};

type WebSource = {
  title: string;
  url: string;
  citedText?: string;
  pageAge?: string;
};

type ResolvedProductImportFile = {
  mimeType: string;
  name: string;
  text?: string;
  base64?: string;
};

function getCurrentDateLabel() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date());
}

function supportsAnthropicWebSearch(model: string) {
  const normalized = model.toLowerCase();
  return normalized.includes('4-6') || normalized.includes('4.6');
}

function resolveAnthropicWebSearchToolType() {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
  return supportsAnthropicWebSearch(model) ? 'web_search_20260209' : 'web_search_20250305';
}

function formatWebSources(sources: WebSource[]) {
  if (!sources.length) {
    return '';
  }

  return [
    'Fontes atuais:',
    ...sources.map((source, index) => {
      const age = source.pageAge ? ` (${source.pageAge})` : '';
      return `${index + 1}. ${source.title} — ${source.url}${age}`;
    })
  ].join('\n');
}

function extractAnthropicResponse(payload: AnthropicMessagesPayload) {
  const sources = new Map<string, WebSource>();
  const textParts: string[] = [];

  for (const block of payload.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      textParts.push(block.text);

      for (const citation of block.citations ?? []) {
        if (!citation.url || !citation.title) {
          continue;
        }

        if (!sources.has(citation.url)) {
          sources.set(citation.url, {
            title: citation.title,
            url: citation.url,
            citedText: citation.cited_text
          });
        }
      }
    }

    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const item of block.content as Array<{ title?: string; url?: string; page_age?: string }>) {
        if (!item?.url || !item.title) {
          continue;
        }

        if (!sources.has(item.url)) {
          sources.set(item.url, {
            title: item.title,
            url: item.url,
            pageAge: item.page_age
          });
        }
      }
    }
  }

  return {
    text: textParts.join('\n').trim(),
    sources: [...sources.values()]
  };
}

function isTextLikeImportFile(mimeType: string, fileName: string) {
  return (
    mimeType.startsWith('text/') ||
    ['application/json', 'application/xml'].includes(mimeType) ||
    /\.(csv|tsv|txt|md|json|xml|rtf)$/i.test(fileName)
  );
}

function trimImportedText(text: string, maxLength = 120_000) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[Conteudo truncado para caber na analise.]`;
}

async function resolveProductImportFile(file?: ProductImportInput['file']): Promise<ResolvedProductImportFile | null> {
  if (!file) {
    return null;
  }

  if (file.base64) {
    return {
      mimeType: file.mimeType,
      name: file.name ?? 'arquivo-importado',
      base64: file.base64
    };
  }

  if (!file.storagePath) {
    return null;
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    return null;
  }

  const bucket = file.bucket ?? PRODUCT_IMPORT_BUCKET;
  const { data, error } = await admin.storage.from(bucket).download(file.storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? 'Nao foi possivel acessar o arquivo importado.');
  }

  const fileName = file.name ?? file.storagePath;

  if (isTextLikeImportFile(file.mimeType, fileName)) {
    const text = await data.text();
    return {
      mimeType: file.mimeType,
      name: fileName,
      text: trimImportedText(text)
    };
  }

  const arrayBuffer = await data.arrayBuffer();
  return {
    mimeType: file.mimeType,
    name: fileName,
    base64: Buffer.from(arrayBuffer).toString('base64')
  };
}

async function callAnthropicMessages(
  prompt: string,
  options?: {
    webSearch?: boolean;
    temperature?: number;
    maxTokens?: number;
  }
) {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
  const tools = options?.webSearch
    ? [
        {
          type: resolveAnthropicWebSearchToolType(),
          name: 'web_search'
        }
      ]
    : undefined;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: options?.maxTokens ?? 1400,
      temperature: options?.temperature ?? 0.5,
      tools,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  const payload = (await response.json().catch(() => null)) as AnthropicMessagesPayload | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Anthropic error ${response.status}`);
  }

  return payload ?? {};
}

function getProviderCandidates(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push('anthropic');
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push('gemini');
  }

  return providers;
}

async function callAnthropic(prompt: string) {
  const payload = await callAnthropicMessages(prompt);
  return extractAnthropicResponse(payload).text || null;
}

async function callAnthropicWithWebSearch(
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
) {
  const payload = await callAnthropicMessages(prompt, {
    webSearch: true,
    temperature: options?.temperature ?? 0.35,
    maxTokens: options?.maxTokens ?? 1800
  });

  const extracted = extractAnthropicResponse(payload);
  if (!extracted.text && !extracted.sources.length) {
    return null;
  }

  return extracted;
}

async function callGemini(prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1400
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}`);
  }

  const payload = await response.json();
  return payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callGeminiWithParts(parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1800
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}`);
  }

  const payload = await response.json();
  return payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callProvider(prompt: string) {
  const providers = getProviderCandidates();

  for (const provider of providers) {
    try {
      const response = provider === 'anthropic' ? await callAnthropic(prompt) : await callGemini(prompt);
      if (response) {
        return response;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function shouldUseWebSearch(prompt: string) {
  const text = prompt.toLowerCase();

  return [
    /tendenc/i,
    /trend/i,
    /recent/i,
    /atualiz/i,
    /atual/i,
    /hoje/i,
    /agora/i,
    /(?:últim|ultim)[ao]s?\s+(?:7|15|30)\s+dias/i,
    /(?:últim|ultim)[ao]s?\s+semana/i,
    /semana passada/i,
    /referenc/i,
    /pesquis/i,
    /fonte/i,
    /not[ií]ci/i,
    /current/i,
    /latest/i,
    /google trends/i
  ].some((pattern) => pattern.test(text));
}

async function searchWeb(query: string) {
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (CreatorAI; +https://creator-ia.vercel.app)'
      }
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    const pattern = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) && results.length < 5) {
      const title = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const snippet = match[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const url = match[1].startsWith('//') ? `https:${match[1]}` : match[1];
      results.push({ title, url, snippet });
    }

    return results;
  } catch {
    return [];
  }
}

async function buildWebContext(prompt: string) {
  if (!shouldUseWebSearch(prompt)) {
    return '';
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const currentDate = getCurrentDateLabel();
      const response = await callAnthropicWithWebSearch(
        [
          'Voce e um pesquisador web para apoiar uma plataforma de conteudo e estrategia.',
          `Data atual: ${currentDate}.`,
          'Busque apenas informacoes recentes e confiaveis.',
          'Se a resposta envolver tendencias, diga a janela temporal usada e sinalize se a fonte parecer antiga.',
          'Responda em portugues do Brasil com um breve resumo, 3 a 6 achados atuais e uma lista de fontes.',
          `Tema de pesquisa: ${prompt}`
        ].join('\n\n'),
        {
          temperature: 0.2,
          maxTokens: 1100
        }
      );

      if (response && (response.text || response.sources.length)) {
        return [
          'Contexto web atual coletado para apoiar a resposta. Use apenas como suporte, sem inventar alem do que estiver aqui.',
          response.text,
          formatWebSources(response.sources)
        ]
          .filter(Boolean)
          .join('\n\n');
      }
    } catch {
      // Fallback to the light web search scraper below.
    }
  }

  const results = await searchWeb(prompt);

  if (!results.length) {
    return '';
  }

  return [
    'Contexto web atual coletado para apoiar a resposta. Use apenas como suporte, sem inventar além do que estiver aqui.',
    ...results.map((result, index) => `${index + 1}. ${result.title} — ${result.snippet} — Fonte: ${result.url}`)
  ].join('\n');
}

function getCreatorAiBaseRules() {
  return [
    'Voce e o Creator AI, o assistente oficial de conteudo, estrategia e operacao da plataforma Creator AI.',
    `Data atual: ${getCurrentDateLabel()}. Use essa data como referencia quando o usuario pedir tendencias, novidades ou recortes temporais.`,
    'Se o pedido envolver pesquisas atuais, referencias recentes, tendencias, noticias ou algo de "hoje", use contexto web e diga claramente a janela temporal usada.',
    'Evite respostas genericas, velhas ou pouco acionaveis. Nunca invente ano ou tendencia antiga quando o pedido pedir atualidade.',
    'Responda em markdown leve, com negrito nos pontos-chave, subtitulos curtos, listas objetivas e um proximo passo claro.',
    'Quando houver contexto web, priorize-o. Se nao houver contexto suficiente, diga isso com honestidade e siga com a melhor alternativa segura.',
    'Mantenha a linguagem humana, direta e pratica.'
  ];
}

async function buildCreatorAiPrompt(lines: Array<string | null | undefined>, webQuery?: string) {
  const webContext = webQuery ? await buildWebContext(webQuery) : '';

  return [
    ...getCreatorAiBaseRules(),
    webContext ? `Contexto web:\n${webContext}` : null,
    ...lines
  ]
    .filter(Boolean)
    .join('\n\n');
}

function extractJsonFragment(input: string) {
  const fencedMatch = input.match(/```json\s*([\s\S]*?)```/i) ?? input.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const arrayStart = input.indexOf('[');
  const objectStart = input.indexOf('{');
  const start = [arrayStart, objectStart].filter((value) => value >= 0).sort((a, b) => a - b)[0];

  if (typeof start !== 'number') {
    return null;
  }

  const candidate = input.slice(start).trim();
  return candidate;
}

function parseStructuredResponse<T>(response: string | null, fallback: T): T {
  if (!response) {
    return fallback;
  }

  const fragment = extractJsonFragment(response);
  if (!fragment) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(fragment);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function fallbackIdea(topic: string, index: number) {
  return {
    title: `${topic} - ideia ${index + 1}`,
    hook: `Mostre como ${topic.toLowerCase()} resolve um problema real sem parecer vendedor.`,
    format: index % 2 === 0 ? 'Reels' : 'Carrossel',
    angle: index % 2 === 0 ? 'educacao' : 'prova_social'
  };
}

export async function generateIdeas(input: IdeaInput) {
  const fallback = Array.from({ length: input.count ?? 5 }, (_, index) => fallbackIdea(input.topic, index));
  const prompt = await buildCreatorAiPrompt([
    'Voce e um estrategista de conteudo.',
    'Responda somente JSON valido.',
    `Retorne um array com ${fallback.length} objetos no formato [{"title":"", "hook":"", "format":"", "angle":""}].`,
    `Tema: ${input.topic}`,
    input.product ? `Produto: ${input.product}` : null,
    input.audience ? `Publico: ${input.audience}` : null
  ], `${input.topic} instagram reels tiktok trends`);

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateHooks(input: { topic: string; count?: number }) {
  const fallback = Array.from({ length: input.count ?? 7 }, (_, index) => `Gancho ${index + 1} sobre ${input.topic}`);
  const prompt = await buildCreatorAiPrompt([
    'Voce e um copywriter de videos curtos.',
    'Responda somente JSON valido.',
    `Retorne um array com ${fallback.length} strings curtas e fortes.`,
    `Tema: ${input.topic}`
  ], `${input.topic} instagram reels tiktok trends`);

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateScript(input: ScriptInput) {
  const fallback = {
    title: `Roteiro sobre ${input.topic}`,
    hook: `Se voce quer ${input.topic.toLowerCase()}, faca isso sem complicar.`,
    spoken: `Hoje eu vou te mostrar como ${input.topic.toLowerCase()} de forma simples.`,
    takes: ['abertura com dor', 'prova visual', 'passo a passo', 'resultado', 'CTA'],
    cta: 'Comente "quero" para receber o material.',
    caption: `Legenda pronta sobre ${input.topic}`
  };
  const prompt = await buildCreatorAiPrompt([
    'Voce cria roteiros de conteudo em portugues do Brasil.',
    'Responda somente JSON valido.',
    'Formato esperado: {"title":"","hook":"","spoken":"","takes":["","",""],"cta":"","caption":""}.',
    `Tema: ${input.topic}`,
    input.goal ? `Objetivo: ${input.goal}` : null,
    input.tone ? `Tom: ${input.tone}` : null
  ], `${input.topic} instagram reels tiktok trends`);

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateScriptVariants(input: ScriptVariantInput) {
  const fallback = Array.from({ length: 3 }, (_, index) => ({
    title: `Roteiro ${index + 1} - ${input.productName ?? 'Creator AI'}`,
    hook:
      index === 0
        ? 'Comece pela dor principal do cliente e entregue a virada logo nos primeiros segundos.'
        : index === 1
          ? 'Abra com uma situacao real, puxe curiosidade e entregue um passo pratico no meio.'
          : 'Use uma provocacao curta, um exemplo atual e termine com CTA objetivo.',
    spoken:
      index === 0
        ? `Hoje eu quero te mostrar um jeito direto de transformar ${input.prompt.toLowerCase()} em conteudo que gera conversa e desejo.`
        : index === 1
          ? `Se voce sente que ${input.prompt.toLowerCase()} ainda fica generico, esse roteiro resolve isso com contexto, prova e CTA.`
          : `Tem um jeito mais inteligente de abordar ${input.prompt.toLowerCase()} sem parecer repetitivo, e e isso que eu vou te mostrar agora.`,
    takes: [
      'Abertura com enquadramento rapido da dor',
      'Contexto visual ou noticia recente',
      'Explicacao objetiva em linguagem humana',
      'Prova, exemplo ou quebra de objecao',
      'CTA para comentario, direct ou clique'
    ],
    cta: 'Comente "quero" para eu te enviar a proxima ideia dessa serie.',
    caption: `Legenda enxuta sobre ${input.prompt}, conectando contexto atual, beneficio pratico e CTA.`
  }));

  const prompt = await buildCreatorAiPrompt([
    'Voce cria roteiros de Instagram e videos curtos em portugues do Brasil.',
    'Responda somente JSON valido.',
    'Retorne exatamente um array com 3 objetos.',
    'Formato esperado: [{"title":"","hook":"","spoken":"","takes":["","",""],"cta":"","caption":""}]',
    `Pedido principal: ${input.prompt}`,
    input.productName ? `Produto principal: ${input.productName}` : null,
    input.productContext ? `Contexto do produto: ${input.productContext}` : null,
    input.referenceContext ? `Contexto e referencias para aproveitar: ${input.referenceContext}` : null,
    'Cada roteiro deve ter um angulo diferente, parecer pronto para gravacao e evitar frases genericas.'
  ], `${input.prompt} ${input.referenceContext ?? ''} ${input.productContext ?? ''} instagram reels tiktok trends`);

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateStoryboard(input: ScriptInput) {
  const fallback = {
    frames: [
      `Abertura forte sobre ${input.topic}`,
      'Cena de prova visual',
      'Explicacao do processo',
      'Fechamento com CTA'
    ]
  };
  const prompt = await buildCreatorAiPrompt([
    'Voce cria storyboards simples para videos curtos.',
    'Responda somente JSON valido.',
    'Formato esperado: {"frames":["","","",""]}.',
    `Tema: ${input.topic}`
  ], `${input.topic} instagram reels tiktok trends`);

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateStories(input: StoryInput) {
  const fallback = {
    sequence: Array.from({ length: input.count ?? 5 }, (_, index) => ({
      title: `Story ${index + 1}`,
      hook: `${input.theme} com foco em retencao e CTA.`,
      cta: index === (input.count ?? 5) - 1 ? 'Responder DM' : 'Continuar vendo',
      time: `${String(8 + index).padStart(2, '0')}:00`
    }))
  };
  const prompt = await buildCreatorAiPrompt([
    'Voce cria sequencias de stories para Instagram.',
    'Responda somente JSON valido.',
    'Formato esperado: {"sequence":[{"title":"","hook":"","cta":"","time":""}]}.',
    `Tema: ${input.theme}`,
    `Quantidade: ${input.count ?? 5}`
  ], `${input.theme} instagram reels tiktok trends`);

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateCaption(input: { topic: string; tone?: string }) {
  const fallback = { caption: `Legenda humana sobre ${input.topic}.` };
  const prompt = await buildCreatorAiPrompt([
    'Voce escreve legendas em portugues do Brasil.',
    'Responda somente JSON valido.',
    'Formato esperado: {"caption":""}.',
    `Tema: ${input.topic}`,
    `Tom: ${input.tone ?? 'natural'}`
  ], `${input.topic} instagram reels tiktok trends`);

  const parsed = parseStructuredResponse(await callProvider(prompt), fallback);
  return parsed.caption;
}

export async function rewriteHumanTone(input: { text: string }) {
  const fallback = { text: input.text };
  const prompt = [
    'Reescreva o texto com tom humano, claro e natural.',
    'Responda somente JSON valido.',
    'Formato esperado: {"text":""}.',
    input.text
  ].join('\n\n');

  const parsed = parseStructuredResponse(await callProvider(prompt), fallback);
  return parsed.text;
}

export async function extractProductsFromSource(input: ProductImportInput) {
  const maxItems = input.maxItems ?? 20;
  const fallback = { products: [] as Array<Record<string, string>> };
  const uploadedFile = await resolveProductImportFile(input.file);
  const prompt = await buildCreatorAiPrompt([
    'Voce organiza catalogos de produtos para um SaaS de operacao de conteudo.',
    'Responda somente JSON valido.',
    `Formato esperado: {"products":[{"name":"","benefits":"","audience":"","price":"","discountPrice":"","restrictions":""}]}.`,
    `Retorne no maximo ${maxItems} produtos.`,
    'Se algum campo nao aparecer com clareza, deixe a string vazia.',
    input.prompt ? `Pedido do usuario: ${input.prompt}` : null,
    input.sourceText ? `Texto base: ${input.sourceText}` : null,
    uploadedFile?.name ? `Arquivo analisado: ${uploadedFile.name}` : input.file?.name ? `Arquivo analisado: ${input.file.name}` : null,
    uploadedFile?.text ? `Conteudo do arquivo:\n${uploadedFile.text}` : null
  ], input.sourceText ?? uploadedFile?.text ?? input.prompt ?? uploadedFile?.name ?? input.file?.name);

  if (uploadedFile?.base64 && process.env.GEMINI_API_KEY) {
    const response = await callGeminiWithParts([
      {
        text: prompt
      },
      {
        inline_data: {
          mime_type: uploadedFile.mimeType,
          data: uploadedFile.base64
        }
      }
    ]);

    return parseStructuredResponse(response, fallback);
  }

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function analyzeMetrics(input: MetricsInput) {
  const fallback = {
    summary: 'Alcance e engajamento estao crescendo com posts de bastidor e prova social.',
    insights: ['Aumentar reels', 'Postar mais stories interativos', 'Refinar CTA'],
    risks: ['Muito conteudo generico', 'Pouca repeticao de formatos vencedores']
  };
  const prompt = await buildCreatorAiPrompt([
    'Voce analisa metricas de conteudo.',
    'Responda somente JSON valido.',
    'Formato esperado: {"summary":"","insights":[""],"risks":[""]}.',
    `Resumo: ${input.summary}`,
    input.series ? `Series: ${JSON.stringify(input.series)}` : null
  ], `${input.summary} instagram reels tiktok trends`);

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function analyzeCompetitors(input: CompetitorInput) {
  const fallback = {
    summary: 'Concorrentes fortes usam bastidores, prova social e CTAs de DM.',
    opportunities: ['Reels de bastidor', 'Stories com enquete', 'Carrosseis educacionais'],
    watchouts: ['Postar muito institucional', 'Ignorar comentarios e respostas']
  };
  const prompt = await buildCreatorAiPrompt([
    'Voce analisa concorrentes digitais.',
    'Responda somente JSON valido.',
    'Formato esperado: {"summary":"","opportunities":[""],"watchouts":[""]}.',
    `Concorrentes: ${input.competitors.join(', ')}`,
    `Nicho: ${input.niche ?? 'geral'}`
  ], `${input.competitors.join(' ')} ${input.niche ?? ''} instagram reels tiktok trends`);

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function suggestCalendar(input: CalendarInput) {
  const fallback = {
    month: input.month,
    items: [
      { date: `${input.month}-03`, title: 'Reels de bastidor', channel: 'Reels' },
      { date: `${input.month}-07`, title: 'Stories de enquete', channel: 'Stories' },
      { date: `${input.month}-11`, title: 'Carrossel educativo', channel: 'Feed' }
    ]
  };
  const prompt = await buildCreatorAiPrompt([
    'Voce planeja calendarios editoriais.',
    'Responda somente JSON valido.',
    'Formato esperado: {"month":"","items":[{"date":"","title":"","channel":""}]}.',
    `Mes: ${input.month}`,
    `Produto: ${input.product ?? 'crescimento de marca'}`
  ], `${input.month} ${input.product ?? ''} instagram reels tiktok trends`);

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function chatWithAi(input: ChatInput) {
  const useWebSearch = shouldUseWebSearch([input.prompt, input.context, input.history?.map((message) => message.content).join(' ') ?? ''].join(' '));
  const promptContext = [
    input.workspace ? `Workspace atual: ${input.workspace}` : null,
    input.context ? `Contexto: ${input.context}` : null,
    input.history?.length
      ? `Historico recente da conversa:\n${input.history
          .slice(-12)
          .map((message) => `${message.role === 'user' ? 'Usuario' : 'Creator AI'}: ${message.content}`)
          .join('\n')}`
      : null,
    `Pedido do usuario: ${input.prompt}`,
    useWebSearch ? 'Use o web_search para validar referencias atuais, datas e fontes recentes antes de responder.' : null,
    'Objetivo: ajudar a criar conteudo, organizar operacao, revisar ideias e sugerir proximos passos acionaveis.'
  ];

  const prompt = await buildCreatorAiPrompt(promptContext);

  if (useWebSearch && process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await callAnthropicWithWebSearch(prompt, {
        temperature: 0.35,
        maxTokens: 1800
      });

      if (response && (response.text || response.sources.length)) {
        const sources = formatWebSources(response.sources);
        return [response.text?.trim() ?? '', sources].filter(Boolean).join('\n\n') || sources;
      }
    } catch {
      // Fall back to the regular provider chain below.
    }
  }

  const fallbackPrompt = useWebSearch
    ? await buildCreatorAiPrompt(promptContext, `${input.prompt} ${input.context ?? ''} ${input.history?.map((message) => message.content).join(' ') ?? ''}`)
    : prompt;

  const response = await callProvider(fallbackPrompt);

  return (
    response ??
    `Posso ajudar com ideias, roteiros, stories, metricas, concorrentes e calendario. Para: ${input.prompt}`
  );
}
