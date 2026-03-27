import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { buildCompetitorAnalysisFallback, summarizeCompetitorAnalysisInput, type CompetitorAnalysisInput } from '@/lib/competitor-intelligence';
import { buildGenerationPlan, formatGenerationPlanForPrompt } from '@/lib/content-engine/planner';
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
  contentType?: string;
  subOption?: string;
  duration?: string;
  tones?: string[];
  tone?: string;
  objectives?: string[];
  objective?: string;
  pain?: string;
  benefit?: string;
  targetAudience?: string;
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
    text?: string;
    pageTexts?: string[];
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

type AnthropicBinarySource = {
  type: 'base64';
  media_type: string;
  data: string;
};

type AnthropicInputContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: AnthropicBinarySource }
  | { type: 'document'; source: AnthropicBinarySource };

type AnthropicMessageContent = string | AnthropicInputContentBlock[];

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

type WebContextResult = {
  summary: string;
  sources: WebSource[];
};

type TrendResearchResult = {
  windowLabel: string;
  summary: string;
  viralFormats: string[];
  hookPatterns: string[];
  storytellingPatterns: string[];
  executionNotes: string[];
};

const TREND_RESEARCH_TTL_MS = 1000 * 60 * 60 * 6;
const trendResearchCache = new Map<string, { expiresAt: number; result: TrendResearchResult }>();

type ChatIntent = 'hooks' | 'trend' | 'script' | 'stories' | 'metrics' | 'competitors' | 'calendar' | 'products' | 'general';

type ResolvedProductImportFile = {
  mimeType: string;
  name: string;
  text?: string;
  pageTexts?: string[];
  pageCount?: number;
  base64?: string;
};

import type { CarrosselSlide, PostFields, StorySlide } from '@/types/platform';
import type { CompetitorAnalysis } from '@/types/competitor-intelligence';
import type { GenerationPlan as ContentGenerationPlan } from '@/lib/content-engine/types';

type ScriptDraftResponse = {
  title: string;
  hook: string;
  spoken: string;
  takes: string[];
  cta: string;
  caption: string;
  storySlides?: StorySlide[];
  carrosselSlides?: CarrosselSlide[];
  postFields?: PostFields;
};

type ProductImportRecord = {
  name: string;
  benefits: string;
  audience: string;
  price: string;
  discountPrice: string;
  restrictions: string;
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

function trimWebContextSummary(text: string) {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/https?:\/\/\S+/gi, '').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^(fontes?|sources?|references?)\s*:?/i.test(line))
    .slice(0, 6)
    .join('\n')
    .trim();
}

function shouldShowSources(prompt: string) {
  return [
    /mostrar?\s+fontes?/i,
    /quais?\s+fontes?/i,
    /com\s+fontes?/i,
    /mostre.*links?/i,
    /cita[cç][aã]o(?:es)?/i,
    /bibliograf/i,
    /source(?:s)?/i,
    /de onde veio/i,
    /mostre\s+as\s+fontes/i
  ].some((pattern) => pattern.test(prompt));
}

function detectChatIntent(prompt: string, context?: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const combined = [prompt, context, history?.map((message) => message.content).join(' ') ?? ''].join(' ').toLowerCase();

  if (/gancho|ganchos|hook|hooks|viral|viralizar/.test(combined)) {
    return 'hooks';
  }

  if (/roteiro|script|storyboard|falado|legenda|caption/.test(combined)) {
    return 'script';
  }

  if (/story|stories|sequ[eê]nci|enquete|caixinha|pergunta|link na bio/.test(combined)) {
    return 'stories';
  }

  if (/m[eé]tric|alcance|engaj|crescimento|salvament|compartilh|views?/.test(combined)) {
    return 'metrics';
  }

  if (/concorr|competidor|benchmark|perfil/i.test(combined)) {
    return 'competitors';
  }

  if (/calend[aá]rio|agenda|planejamento|programa[cç][aã]o/.test(combined)) {
    return 'calendar';
  }

  if (/produto|oferta|benef[ií]ci|pre[cç]o|restri/.test(combined)) {
    return 'products';
  }

  if (/tendenc|trend|atual|agora|hoje|recent|novidade|referenc|pesquis|not[ií]ci|latest|current|window temporal/.test(combined)) {
    return 'trend';
  }

  return 'general';
}

function buildChatStyleInstructions(intent: ChatIntent, includeSources: boolean) {
  const common = [
    'Responda em portugues do Brasil.',
    includeSources
      ? 'Se o usuario pediu fontes, mostre uma secao final curta com links atuais.'
      : 'Nao liste fontes, links ou bibliografia a menos que o usuario peça explicitamente.',
    'Use negrito apenas para os pontos realmente importantes.',
    'Se fizer sentido, feche com um proximo passo curto e pratico.'
  ];

  switch (intent) {
    case 'hooks':
      return [
        ...common,
        'O pedido e sobre ganchos para redes sociais.',
        'Entregue apenas ganchos prontos para usar, sem introducao longa e sem analise extensa.',
        'Se houver contexto atual, transforme isso em um angulo de abertura nativo para Reels, carrossel ou Stories.',
        'Se o contexto falar de Reels, carrossel ou Stories, adapte o formato ao meio sugerido.'
      ];
    case 'trend':
      return [
        ...common,
        'O pedido e sobre tendencias ou referencias atuais.',
        'Resuma a janela temporal em uma linha curta e converta o achado em ideias acionaveis para video, carrossel ou stories.',
        'Em vez de relatorio longo, devolva 3 a 5 angulos ou ganchos prontos para Reels, carrossel ou Stories.',
        'Nao transforme a resposta em noticia solta; traduza tudo para marketing e criacao de conteudo.'
      ];
    case 'script':
      return [
        ...common,
        'O pedido e sobre roteiro, legenda ou copy.',
        'Entregue hook, estrutura principal, CTA e legenda em formato enxuto.',
        'Evite explicar demais o processo.'
      ];
    case 'stories':
      return [
        ...common,
        'O pedido e sobre stories.',
        'Entregue uma sequencia curta e pronta para publicar, com abertura, progressao e CTA.',
        'Se couber, inclua enquete, pergunta ou link.'
      ];
    case 'metrics':
      return [
        ...common,
        'O pedido e sobre metricas.',
        'Traduza os numeros em leitura pratica, destaque o que importa e diga o que fazer agora.',
        'Evite analise longa demais.'
      ];
    case 'competitors':
      return [
        ...common,
        'O pedido e sobre concorrentes.',
        'Mostre padroes, oportunidades e riscos em formato executivo e acionavel.'
      ];
    case 'calendar':
      return [
        ...common,
        'O pedido e sobre calendario editorial.',
        'Sugira datas, formatos e prioridades de conteudo com clareza visual.'
      ];
    case 'products':
      return [
        ...common,
        'O pedido e sobre produto ou oferta.',
        'Transforme em conteudo, angulos de venda e CTA de forma objetiva.'
      ];
    default:
      return [
        ...common,
        'O foco da plataforma e criacao de conteudo.',
        'Priorize ideias, roteiros, ganchos, legendas e proximos passos praticos.'
      ];
  }
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanTextValue(value: unknown) {
  if (typeof value === 'string') {
    return value.replace(/\r/g, '').trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  return '';
}

function stripListMarkerPrefix(text: string) {
  return text.replace(/^([*\-•>]+|\d+[.)])\s+/, '');
}

function cleanSingleLineText(value: unknown, maxLength = 220) {
  return stripListMarkerPrefix(cleanTextValue(value).replace(/\s+/g, ' ')).slice(0, maxLength);
}

function cleanParagraphText(value: unknown, maxLength = 1200) {
  const raw = cleanTextValue(value);

  if (!raw) {
    return '';
  }

  const paragraphs = raw
    .split(/\n{2,}/)
    .map((part) => stripListMarkerPrefix(part.replace(/\s+/g, ' ').trim()))
    .filter(Boolean);

  const normalized = paragraphs.length > 1 ? paragraphs.join('\n\n') : raw.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, maxLength);
}

function normalizeCaptionText(value: unknown, maxLength = 1600) {
  const raw = cleanTextValue(value);

  if (!raw) {
    return '';
  }

  let text = raw.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => stripListMarkerPrefix(part.trim()))
    .filter(Boolean);

  if (paragraphs.length > 1) {
    text = paragraphs.join('\n\n');
  } else {
    text = paragraphs[0] ?? text;
    const hashtagIndex = text.search(/\s#/);

    if (hashtagIndex > 0) {
      const lead = text.slice(0, hashtagIndex).trim();
      const tags = text.slice(hashtagIndex).trim();

      if (lead && tags) {
        text = `${lead}\n\n${tags}`;
      }
    } else {
      const sentenceSplit = text.match(/^(.+?[.!?])\s+(.+)$/);
      if (sentenceSplit) {
        text = `${sentenceSplit[1].trim()}\n\n${sentenceSplit[2].trim()}`;
      }
    }
  }

  return text.slice(0, maxLength);
}

function uniqueNonEmptyStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => cleanSingleLineText(value, 120)).filter(Boolean))];
}

function clipWords(value: string, maxWords: number, maxLength = 80) {
  const words = cleanTextValue(value)
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, maxWords);

  return words.join(' ').slice(0, maxLength).trim();
}

function tightenHookLine(value: string, fallback: string, maxWords = 12, maxLength = 100) {
  const cleaned = cleanSingleLineText(value, maxLength).replace(/[?]+/g, '').trim();
  if (!cleaned) {
    return fallback;
  }

  const stopwords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'com', 'sem', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'sobre']);
  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);

  while (words.length > 3 && stopwords.has(normalizeMatchText(words[words.length - 1]))) {
    words.pop();
  }

  const tightened = words.join(' ').replace(/[,:;.-]+$/g, '').trim();
  return tightened || fallback;
}

function lowerFirst(value: string) {
  const text = cleanTextValue(value);
  return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : '';
}

function hasEnoughLetters(value: string, minimum = 6) {
  return (value.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? []).length >= minimum;
}

function isPlaceholderText(value: unknown) {
  const text = cleanTextValue(value);

  if (!text) {
    return true;
  }

  if (/\[[^\]]+\]/.test(text) || /\{[^}]+\}/.test(text)) {
    return true;
  }

  const normalized = normalizeMatchText(text).replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return true;
  }

  return [
    /^frase de gancho$/,
    /^gancho aqui$/,
    /^texto falado(?: do story)?(?: \d+)?$/,
    /^conteudo(?: da pagina)?(?: \d+)?$/,
    /^conteudo do slide(?: \d+)?$/,
    /^legenda(?: aqui)?$/,
    /^cta(?: aqui)?$/,
    /^titulo(?: da capa| da peca| impactante| curto e impactante)?$/,
    /^subtitulo(?: \d+)?$/,
    /^direcao visual(?: do designer)?$/,
    /^conceito do post$/,
    /^abertura forte$/,
    /^promessa especifica$/,
    /^story \d+$/,
    /^slide \d+$/,
    /^pagina \d+$/,
    /^take \d+$/,
    /^roteiro \d+$/,
    /^produto \d+$/,
    /^conteudo \d+$/
  ].some((pattern) => pattern.test(normalized));
}

function chooseSingleLine(
  value: unknown,
  fallback: string,
  maxLength = 220,
  minimumLetters = 6
) {
  const candidate = cleanSingleLineText(value, maxLength);
  if (candidate && !isPlaceholderText(candidate) && hasEnoughLetters(candidate, minimumLetters)) {
    return candidate;
  }

  return fallback;
}

function chooseParagraph(
  value: unknown,
  fallback: string,
  maxLength = 1200,
  minimumLetters = 12
) {
  const candidate = cleanParagraphText(value, maxLength);
  if (candidate && !isPlaceholderText(candidate) && hasEnoughLetters(candidate, minimumLetters)) {
    return candidate;
  }

  return fallback;
}

function chooseCaption(value: unknown, fallback: string) {
  const candidate = normalizeCaptionText(value);
  if (candidate && !isPlaceholderText(candidate) && hasEnoughLetters(candidate, 12)) {
    return candidate;
  }

  return fallback;
}

function buildBriefSeed(input: ScriptVariantInput) {
  const topic = cleanSingleLineText(input.benefit || input.pain || input.prompt || input.productName || 'seu tema principal', 120);
  const problem = cleanSingleLineText(input.pain || input.prompt || 'esse problema', 120);
  const benefit = cleanSingleLineText(input.benefit || input.prompt || 'um resultado real', 120);
  const product = cleanSingleLineText(input.productName || '', 80);
  const audience = cleanSingleLineText(input.targetAudience || 'quem vive isso na pratica', 120);

  return {
    topic,
    problem,
    benefit,
    product,
    audience,
    shortProblem: clipWords(problem, 5, 52) || 'esse problema',
    shortBenefit: clipWords(benefit, 5, 52) || 'resultado real',
    shortProduct: clipWords(product || 'essa solucao', 4, 42) || 'essa solucao'
  };
}

function getScriptStyleFlags(input: ScriptVariantInput) {
  const tones = resolveActiveTones(input.tones, input.tone);
  const objectives = resolveActiveObjectives(input.objectives, input.objective);

  return {
    tones,
    objectives,
    storytelling: tones.includes('storytelling'),
    trend: tones.includes('trend'),
    authority: tones.includes('autoridade'),
    educational: tones.includes('educativo'),
    natural: tones.includes('natural'),
    relationship: objectives.includes('relacionamento'),
    reach: objectives.includes('alcance'),
    sell: objectives.includes('vender')
  };
}

function buildHashtags(...parts: Array<string | null | undefined>) {
  const stopwords = new Set(['com', 'para', 'sem', 'por', 'nao', 'mais', 'muito', 'muita', 'uma', 'umas', 'uns', 'seu', 'sua', 'isso', 'esse', 'essa', 'de', 'da', 'do']);
  const tags = uniqueNonEmptyStrings(parts)
    .map((part) =>
      normalizeDiacritics(part)
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((item) => item.length >= 3 && !stopwords.has(item))
        .slice(0, 2)
        .join('')
    )
    .filter((item) => item.length >= 5)
    .slice(0, 4)
    .map((item) => `#${item}`);

  return [...new Set(['#creatorai', '#conteudostrategico', ...tags])].slice(0, 5).join(' ');
}

function applyFormulaTemplate(
  template: string,
  values: {
    dor?: string;
    beneficio?: string;
    tema?: string;
    produto?: string;
    palavra?: string;
  }
) {
  return template
    .replace(/\[dor\]/gi, values.dor ?? '')
    .replace(/\[beneficio\]/gi, values.beneficio ?? '')
    .replace(/\[tema\]/gi, values.tema ?? '')
    .replace(/\[produto\]/gi, values.produto ?? '')
    .replace(/\[palavra\]/gi, values.palavra ?? 'quero')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildSocialTrendQuery(...parts: Array<string | null | undefined>) {
  return [...parts, 'instagram reels tiktok marketing de conteudo social media hooks copywriting tendencias virais']
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ');
}

function normalizeIdeaResult(
  payload: unknown,
  fallback: Array<{ title: string; hook: string; format: string; angle: string }>
) {
  if (!Array.isArray(payload)) {
    return fallback;
  }

  return fallback.map((item, index) => {
    const raw = payload[index];

    if (!raw || typeof raw !== 'object') {
      return item;
    }

    const source = raw as Record<string, unknown>;

    return {
      title: cleanSingleLineText(source.title ?? item.title, 80) || item.title,
      hook: cleanSingleLineText(source.hook ?? item.hook, 180) || item.hook,
      format: cleanSingleLineText(source.format ?? item.format, 40) || item.format,
      angle: cleanSingleLineText(source.angle ?? item.angle, 40) || item.angle
    };
  });
}

function normalizeHookList(payload: unknown, fallback: string[]) {
  if (!Array.isArray(payload)) {
    return fallback;
  }

  const items = payload
    .map((item) => cleanSingleLineText(item, 140))
    .filter(Boolean);

  if (!items.length) {
    return fallback;
  }

  const normalized = items.slice(0, fallback.length || items.length);

  if (normalized.length < fallback.length) {
    normalized.push(...fallback.slice(normalized.length));
  }

  return normalized;
}

function normalizeScriptOutput(payload: unknown, fallback: ScriptDraftResponse): ScriptDraftResponse {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const raw = payload as Record<string, unknown>;
  const takes = Array.isArray(raw.takes)
    ? raw.takes.map((take) => cleanSingleLineText(take, 160))
    : [];

  const normalizedTakes = fallback.takes.map((fallbackTake, index) => {
    const candidate = takes[index];
    return chooseSingleLine(candidate, fallbackTake, 160, 6);
  });

  return {
    title: chooseSingleLine(raw.title, fallback.title, 80, 4),
    hook: chooseSingleLine(raw.hook, fallback.hook, 220, 8),
    spoken: chooseParagraph(raw.spoken, fallback.spoken, 1200, 20),
    takes: normalizedTakes,
    cta: chooseSingleLine(raw.cta, fallback.cta, 220, 8),
    caption: chooseCaption(raw.caption, fallback.caption)
  };
}

function isPdfImportFile(mimeType: string, fileName: string) {
  return mimeType === 'application/pdf' || /\.pdf$/i.test(fileName);
}

function isImageImportFile(mimeType: string) {
  return mimeType.startsWith('image/');
}

function isDocxImportFile(mimeType: string, fileName: string) {
  return (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.docx$/i.test(fileName)
  );
}

function normalizeDiacritics(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeMatchText(text: string) {
  return normalizeDiacritics(text)
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/^[*•>\s]+/, '')
    .trim()
    .toLowerCase();
}

function normalizePdfPageText(text: string) {
  return text
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isCatalogNoiseLine(line: string) {
  const normalized = normalizeMatchText(line);
  return (
    !normalized ||
    /^--\s*\d+\s+of\s+\d+\s*--$/.test(normalized) ||
    /^catalogo$/.test(normalized) ||
    /^varejo\/\d{4}$/.test(normalized) ||
    /^c\s*e\s*\d{3,}$/.test(normalized) ||
    /^c\s*2024\s*viver\s*bem\s*suplementos$/.test(normalized) ||
    /^consulte a disponibilidade/.test(normalized) ||
    /^consultar verso da embalagem/.test(normalized) ||
    /^time viver bem$/.test(normalized)
  );
}

function isCatalogLabelLine(line: string) {
  const normalized = normalizeMatchText(line);
  return (
    /^beneficios$/.test(normalized) ||
    /^composicao$/.test(normalized) ||
    /^modo de uso$/.test(normalized) ||
    /^contra indicacao$/.test(normalized) ||
    /^contraindicacao$/.test(normalized)
  );
}

function isPriceLabelLine(line: string) {
  const normalized = normalizeMatchText(line).replace(/\s+/g, '');
  return normalized === 'r$' || normalized === 'avista' || normalized === 'cartao';
}

function isPriceAmountLine(line: string) {
  return /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(normalizeMatchText(line).replace(/\s+/g, ''));
}

function isLikelyProductNameLine(line: string) {
  const normalized = normalizeMatchText(line);
  if (!normalized || isCatalogLabelLine(line) || isPriceLabelLine(line) || isCatalogNoiseLine(line)) {
    return false;
  }

  if (/^[0-9.,/()]+$/.test(normalized)) {
    return false;
  }

  if (/[^a-z0-9áàâãéêíóôõúç\-\s]/i.test(line) && !/[&+]/.test(line)) {
    return false;
  }

  return normalized.length <= 90;
}

function extractFieldText(lines: string[], label: string, endLabels: string[]) {
  const labelIndex = lines.findIndex((line) => normalizeMatchText(line) === label);

  if (labelIndex < 0) {
    return '';
  }

  const endIndex = lines.findIndex((line, index) => index > labelIndex && endLabels.some((endLabel) => normalizeMatchText(line) === endLabel));
  const slice = lines.slice(labelIndex + 1, endIndex >= 0 ? endIndex : undefined);

  return cleanParagraphText(slice.join('\n'), 1200);
}

function extractPageSharedBenefits(lines: string[], clusterEndIndex: number) {
  const tailLines = lines.slice(clusterEndIndex).filter((line) => !isCatalogNoiseLine(line) && !isPriceLabelLine(line));
  if (!tailLines.length) {
    return '';
  }

  const labelIndex = tailLines.findIndex((line) => isCatalogLabelLine(line) && normalizeMatchText(line) === 'beneficios');
  if (labelIndex >= 0) {
    const untilLabel = tailLines.slice(labelIndex + 1);
    const stopIndex = untilLabel.findIndex((line) => isCatalogLabelLine(line));
    const benefitsLines = untilLabel.slice(0, stopIndex >= 0 ? stopIndex : undefined);
    return cleanParagraphText(benefitsLines.join('\n'), 1200);
  }

  const paragraphLines = tailLines.filter((line) => !/^r\$$/i.test(normalizeMatchText(line)) && !isPriceAmountLine(line));
  const paragraph = cleanParagraphText(paragraphLines.join('\n'), 1200);

  if (paragraph && paragraphLines.length >= 2) {
    return paragraph;
  }

  return '';
}

function isLikelyCatalogParagraphLine(line: string) {
  const normalized = normalizeMatchText(line);
  if (!normalized || isCatalogLabelLine(line) || isPriceLabelLine(line) || isCatalogNoiseLine(line)) {
    return false;
  }

  const words = normalized.split(' ').filter(Boolean);
  return line.length > 90 || words.length > 12 || /[.!?]$/.test(line.trim()) || (line.includes(',') && words.length > 8);
}

function isLikelyCatalogTitleLine(line: string) {
  const normalized = normalizeMatchText(line);
  const words = normalized.split(' ').filter(Boolean);

  if (
    !isLikelyProductNameLine(line) ||
    words.length === 0 ||
    words.length > 4 ||
    line.length > 70 ||
    line.includes(',') ||
    !/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9]/.test(line.trim())
  ) {
    return false;
  }

  return !/^(melhora|ajuda|acelera|reduz|promove|inibe|auxilia|regula|fortalece|combate|hidrata|estimula|elimina|nossa|nosso|nossos|nossas|consulte)\b/i.test(normalized);
}

export function collectTrailingTitleLines(lines: string[], stopIndex: number) {
  const titleLines: string[] = [];

  for (let index = stopIndex - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? '';

    if (!line || isCatalogNoiseLine(line) || isPriceLabelLine(line)) {
      continue;
    }

    if (isCatalogLabelLine(line)) {
      if (titleLines.length) {
        break;
      }

      continue;
    }

    if (isLikelyCatalogTitleLine(line)) {
      titleLines.unshift(line);
      continue;
    }

    if (titleLines.length) {
      break;
    }

    if (isLikelyCatalogParagraphLine(line)) {
      break;
    }
  }

  return titleLines;
}

export function collectLeadingTitleLines(lines: string[]) {
  const titleLines: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (!line || isCatalogNoiseLine(line) || isPriceLabelLine(line)) {
      index += 1;
      continue;
    }

    if (isCatalogLabelLine(line)) {
      if (titleLines.length) {
        break;
      }

      index += 1;
      continue;
    }

    if (isLikelyCatalogTitleLine(line)) {
      titleLines.push(line);
      index += 1;
      continue;
    }

    if (titleLines.length || isLikelyCatalogParagraphLine(line)) {
      break;
    }

    index += 1;
  }

  return { titleLines, endIndex: index };
}

export function buildCatalogProductName(titleLines: string[]) {
  const names = titleLines.map((line) => cleanSingleLineText(line, 120)).filter(Boolean);

  if (!names.length) {
    return '';
  }

  if (names.length === 1) {
    return names[0];
  }

  const primary = names[names.length - 1];
  const prefix = names[names.length - 2];
  const primaryWords = normalizeMatchText(primary).split(' ').filter(Boolean);
  const prefixWords = normalizeMatchText(prefix).split(' ').filter(Boolean);

  if (!primaryWords.length) {
    return prefix;
  }

  const overlap = prefixWords.filter((word) => primaryWords.includes(word)).length / Math.max(1, Math.min(prefixWords.length, primaryWords.length));
  const primaryContainsPrefix = normalizeMatchText(primary).includes(normalizeMatchText(prefix));
  const prefixContainsPrimary = normalizeMatchText(prefix).includes(normalizeMatchText(primary));

  if (primaryContainsPrefix || prefixContainsPrimary || overlap >= 0.66) {
    return primary.length >= prefix.length ? primary : prefix;
  }

  if (names.length === 2) {
    if (prefixWords.length >= 3 && primaryWords.length <= 4) {
      return `${prefix} - ${primary}`;
    }

    if (prefixWords.length <= 2 && primaryWords.length >= 3) {
      return primary;
    }

    return `${prefix} - ${primary}`;
  }

  return primary;
}

function extractTrailingNameOnlyProduct(lines: string[], clusterEndIndex: number, sharedBenefits: string) {
  const tailLines = lines.slice(clusterEndIndex).filter((line) => !isCatalogNoiseLine(line) && !isPriceLabelLine(line));
  if (tailLines.length < 2) {
    return null;
  }

  const { titleLines, endIndex } = collectLeadingTitleLines(tailLines);
  const name = buildCatalogProductName(titleLines);

  if (!name) {
    return null;
  }

  const remainder = tailLines.slice(endIndex).filter((line) => !isCatalogNoiseLine(line) && !isPriceLabelLine(line));
  const description = cleanParagraphText(remainder.join('\n'), 1200) || sharedBenefits;

  if (!description || description.length < 20) {
    return null;
  }

  return {
    name,
    benefits: description,
    audience: '',
    price: '',
    discountPrice: '',
    restrictions: ''
  };
}

export function splitCatalogPageLines(pageText: string) {
  return pageText
    .split('\n')
    .flatMap((line) =>
      line
        .split(/\t+/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !isCatalogNoiseLine(line));
}

function matchInlinePrice(line: string) {
  const match = line.match(/R\$\s?([\d.]+,\d{2})/i);
  return match ? match[1] : null;
}

export function findPriceClusters(lines: string[]) {
  const clusters: Array<{ start: number; end: number; price: string; discountPrice: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const currentNormalized = normalizeMatchText(lines[index] ?? '');

    // Strategy 1: Multi-line structured format (R$ / amount / à vista / R$ / discount / cartão)
    if (/^r\$$/i.test(currentNormalized)) {
      const price = lines[index + 1];
      const vista = lines[index + 2];
      const discountPrefix = lines[index + 3];
      const discount = lines[index + 4];
      const cartao = lines[index + 5];

      if (price && vista && discountPrefix && discount && cartao && isPriceAmountLine(price)) {
        const vistaLabel = normalizeMatchText(vista).replace(/\s+/g, '');
        const cartaoLabel = normalizeMatchText(cartao).replace(/\s+/g, '');

        if (vistaLabel === 'avista' && /^r\$$/i.test(normalizeMatchText(discountPrefix)) && isPriceAmountLine(discount) && cartaoLabel === 'cartao') {
          clusters.push({
            start: index,
            end: index + 6,
            price: cleanSingleLineText(price, 80),
            discountPrice: cleanSingleLineText(discount, 80)
          });
          index += 5;
          continue;
        }
      }
    }

    // Strategy 2: Inline price on a single line (e.g. "R$ 99,90" or "R$ 149,90 à vista")
    const line = lines[index] ?? '';
    const inlinePrices = line.match(/R\$\s?[\d.]+,\d{2}/gi);
    if (inlinePrices && inlinePrices.length >= 1 && !isCatalogLabelLine(line) && !isCatalogNoiseLine(line) && !isLikelyProductNameLine(line)) {
      const amounts = inlinePrices.map((p) => p.replace(/R\$\s?/i, '').trim());
      const price = amounts[0];
      const discountPrice = amounts.length >= 2 ? amounts[1] : '';

      // Only treat as a price cluster if the line looks like a price line (not a product description that mentions a price)
      const textWithoutPrices = line.replace(/R\$\s?[\d.]+,\d{2}/gi, '').replace(/[àa]\s*vista|cart[aã]o|desconto|promo[cç][aã]o|por|de/gi, '').trim();
      if (textWithoutPrices.split(/\s+/).filter(Boolean).length <= 3) {
        clusters.push({
          start: index,
          end: index + 1,
          price,
          discountPrice
        });
        continue;
      }
    }

    // Strategy 3: "R$" on one line followed by amount on the next (without the full 6-line pattern)
    if (/^r\$$/i.test(currentNormalized) && lines[index + 1] && isPriceAmountLine(lines[index + 1])) {
      const price = cleanSingleLineText(lines[index + 1], 80);
      let discountPrice = '';
      let end = index + 2;

      // Check if there's a second price nearby
      if (lines[index + 2] && /^r\$$/i.test(normalizeMatchText(lines[index + 2])) && lines[index + 3] && isPriceAmountLine(lines[index + 3])) {
        discountPrice = cleanSingleLineText(lines[index + 3], 80);
        end = index + 4;
      }

      clusters.push({ start: index, end, price, discountPrice });
      index = end - 1;
      continue;
    }
  }

  return clusters;
}

export function extractCatalogProductsFromPage(pageText: string) {
  const lines = splitCatalogPageLines(normalizePdfPageText(pageText));
  if (!lines.length) {
    return [];
  }

  const clusters = findPriceClusters(lines);
  if (!clusters.length) {
    return [];
  }

  const products: ProductImportRecord[] = [];
  let pageFamilyName: string | null = null;

  clusters.forEach((cluster, clusterIndex) => {
    const previousEnd = clusters[clusterIndex - 1]?.end ?? 0;
    const blockLines = lines.slice(previousEnd, cluster.start);
    const benefits = extractFieldText(blockLines, 'beneficios', ['composicao', 'modo de uso', 'contra indicacao']);
    const titleLines = collectTrailingTitleLines(blockLines, blockLines.length);
    let name = buildCatalogProductName(titleLines);

    if (!name) {
      return;
    }

    if (!pageFamilyName) {
      pageFamilyName = name;
    }

    if (/^\d+\s+Barbatanas$/i.test(name) && pageFamilyName) {
      name = `${pageFamilyName} - ${name}`;
    }

    const nameLength = titleLines.length;
    const restrictionsLabelIndex = blockLines.findIndex((line) => normalizeMatchText(line) === 'contra indicacao');
    const restrictions =
      restrictionsLabelIndex >= 0 && nameLength > 0
        ? cleanParagraphText(blockLines.slice(restrictionsLabelIndex + 1, Math.max(restrictionsLabelIndex + 1, blockLines.length - nameLength)).join('\n'), 1200)
        : '';

    products.push({
      name,
      benefits,
      audience: '',
      price: cluster.price,
      discountPrice: cluster.discountPrice,
      restrictions
    });
  });

  const trailingProduct = extractTrailingNameOnlyProduct(lines, clusters[clusters.length - 1]?.end ?? lines.length, '');
  const pageSharedBenefits =
    trailingProduct?.benefits || extractPageSharedBenefits(lines, clusters[clusters.length - 1]?.end ?? lines.length);

  const normalizedProducts: ProductImportRecord[] = products.map((product) => ({
    ...product,
    benefits: product.benefits || pageSharedBenefits
  }));

  if (trailingProduct) {
    let trailingName = trailingProduct.name;

    if (/^\d+\s+Barbatanas$/i.test(trailingName) && pageFamilyName) {
      trailingName = `${pageFamilyName} - ${trailingName}`;
    }

    normalizedProducts.push({
      ...trailingProduct,
      name: trailingName,
      benefits: trailingProduct.benefits || pageSharedBenefits
    });
  }

  return normalizedProducts;
}

export function extractCatalogProductsFromPages(pageTexts: string[], maxItems: number) {
  const products: ProductImportRecord[] = [];

  for (const pageText of pageTexts) {
    const pageProducts = extractCatalogProductsFromPage(pageText);

    for (const product of pageProducts) {
      products.push({
        name: product.name,
        benefits: product.benefits,
        audience: product.audience,
        price: product.price,
        discountPrice: product.discountPrice,
        restrictions: product.restrictions
      });

      if (products.length >= maxItems) {
        return products.slice(0, maxItems);
      }
    }
  }

  return products.slice(0, maxItems);
}

function buildAnthropicImportContent(file: ResolvedProductImportFile, prompt: string) {
  if (!file.base64) {
    return null;
  }

  if (isPdfImportFile(file.mimeType, file.name)) {
    return [
      {
        type: 'text' as const,
        text: prompt
      },
      {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf',
          data: file.base64
        }
      }
    ];
  }

  if (isImageImportFile(file.mimeType)) {
    return [
      {
        type: 'text' as const,
        text: prompt
      },
      {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: file.mimeType,
          data: file.base64
        }
      }
    ];
  }

  return null;
}

async function extractPdfImportData(buffer: Buffer) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });

  try {
    const data = await parser.getText();
    const pageTexts = data.pages
      .map((page) => normalizePdfPageText(page.text || ''))
      .filter(Boolean);

    if (!pageTexts.length) {
      return null;
    }

    return {
      pageTexts,
      pageCount: pageTexts.length,
      text: trimImportedText(pageTexts.join('\n\n'))
    };
  } finally {
    await parser.destroy().catch(() => null);
  }
}

async function downloadProductImportFileWithRetry(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, bucket: string, storagePath: string) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.storage.from(bucket).download(storagePath);

    if (data && !error) {
      return data;
    }

    lastError = new Error(error?.message ?? 'Nao foi possivel acessar o arquivo importado.');

    if (attempt < 2) {
      await sleep(250 * (attempt + 1));
    }
  }

  throw lastError ?? new Error('Nao foi possivel acessar o arquivo importado.');
}

async function resolveProductImportFile(file?: ProductImportInput['file']): Promise<ResolvedProductImportFile | null> {
  if (!file) {
    return null;
  }

  if (file.pageTexts?.length) {
    const pageTexts = file.pageTexts.map((pageText) => trimImportedText(pageText)).filter(Boolean);

    if (pageTexts.length) {
      return {
        mimeType: file.mimeType,
        name: file.name ?? 'arquivo-importado',
        pageTexts,
        text: trimImportedText(pageTexts.join('\n\n'))
      };
    }
  }

  if (file.text?.trim()) {
    return {
      mimeType: file.mimeType,
      name: file.name ?? 'arquivo-importado',
      text: trimImportedText(file.text)
    };
  }

  if (file.base64) {
    const buffer = Buffer.from(file.base64, 'base64');

    if (isPdfImportFile(file.mimeType, file.name ?? 'arquivo-importado')) {
      const pdfData = await extractPdfImportData(buffer).catch(() => null);

      if (pdfData) {
        return {
          mimeType: file.mimeType,
          name: file.name ?? 'arquivo-importado',
          ...pdfData,
          base64: file.base64
        };
      }
    }

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

  try {
    const bucket = file.bucket ?? PRODUCT_IMPORT_BUCKET;
    const data = await downloadProductImportFileWithRetry(admin, bucket, file.storagePath);

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
    const buffer = Buffer.from(arrayBuffer);

    if (isPdfImportFile(file.mimeType, fileName)) {
      const pdfData = await extractPdfImportData(buffer).catch(() => null);

      if (pdfData) {
        return {
          mimeType: file.mimeType,
          name: fileName,
          ...pdfData,
          base64: buffer.toString('base64')
        };
      }
    }

    if (isDocxImportFile(file.mimeType, fileName)) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });

      if (result.value?.trim()) {
        return {
          mimeType: file.mimeType,
          name: fileName,
          text: trimImportedText(result.value)
        };
      }
    }

    return {
      mimeType: file.mimeType,
      name: fileName,
      base64: buffer.toString('base64')
    };
  } catch {
    return null;
  }
}

async function callAnthropicMessages(
  content: AnthropicMessageContent,
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
          content
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

function orderProviders(providers: Provider[], mode?: 'balanced' | 'cost') {
  if (mode !== 'cost') {
    return providers;
  }

  const rank: Record<Provider, number> = {
    gemini: 0,
    anthropic: 1
  };

  return [...providers].sort((left, right) => rank[left] - rank[right]);
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

async function callGemini(prompt: string, options?: { maxTokens?: number }) {
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
          maxOutputTokens: options?.maxTokens ?? 1400
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

async function callGeminiWithParts(parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>, options?: { maxTokens?: number }) {
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
          maxOutputTokens: options?.maxTokens ?? 1800
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

async function callProvider(prompt: string, options?: { maxTokens?: number; providerMode?: 'balanced' | 'cost' }) {
  const providers = orderProviders(getProviderCandidates(), options?.providerMode);

  for (const provider of providers) {
    try {
      let response: string | null;

      if (provider === 'anthropic') {
        const payload = await callAnthropicMessages(prompt, { maxTokens: options?.maxTokens });
        response = extractAnthropicResponse(payload).text || null;
      } else {
        response = await callGemini(prompt, options);
      }

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

async function buildWebContextResult(prompt: string): Promise<WebContextResult | null> {
  if (!shouldUseWebSearch(prompt)) {
    return null;
  }

  const directResults = await searchWeb(prompt);

  if (directResults.length) {
    return {
      summary: directResults
        .slice(0, 4)
        .map((result) => `- ${result.title}: ${result.snippet}`)
        .join('\n'),
      sources: directResults.map((result) => ({
        title: result.title,
        url: result.url
      }))
    };
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
          'Responda em portugues do Brasil com um breve resumo, 3 a 6 achados atuais e sem listar fontes no texto.',
          `Tema de pesquisa: ${prompt}`
        ].join('\n\n'),
        {
          temperature: 0.2,
          maxTokens: 1100
        }
      );

      if (response && (response.text || response.sources.length)) {
        return {
          summary: trimWebContextSummary(response.text || ''),
          sources: response.sources
        };
      }
    } catch {
      // Fall back to no context below.
    }
  }

  return null;
}

async function buildWebContext(prompt: string) {
  const context = await buildWebContextResult(prompt);

  if (!context?.summary) {
    return '';
  }

  return [
    'Contexto web atual coletado para apoiar a resposta. Use apenas como suporte, sem inventar alem do que estiver aqui.',
    context.summary
  ].join('\n\n');
}

function buildTrendResearchQuery(input: ScriptVariantInput) {
  return buildSocialTrendQuery(
    input.productName ?? '',
    input.pain ?? '',
    input.benefit ?? '',
    input.targetAudience ?? '',
    input.contentType ?? 'reels',
    resolveActiveObjectives(input.objectives, input.objective).join(' '),
    resolveActiveTones(input.tones, input.tone).join(' '),
    'instagram tiktok reels hooks storytelling formato viral conteudo que performa agora'
  );
}

function buildTrendResearchFallback(input: ScriptVariantInput): TrendResearchResult {
  const contentType = input.contentType ?? 'reels';

  const byFormat: Record<string, TrendResearchResult> = {
    reels: {
      windowLabel: 'Sem pesquisa web disponivel, usando heuristicas atuais de creator',
      summary: 'Videos curtos seguem performando melhor quando abrem com quebra de expectativa, situacao real ou erro comum em linguagem de creator.',
      viralFormats: ['POV com virada rapida', 'Erro comum + descoberta', 'Antes e depois com prova visual', '3 coisas que quase ninguem percebe'],
      hookPatterns: ['Tem um erro que esta travando isso', 'Ninguem fala disso sobre esse problema', 'Eu achei que era normal viver assim', 'Se voce faz isso, talvez esteja piorando tudo'],
      storytellingPatterns: ['situacao -> frustacao -> descoberta -> virada -> CTA', 'rotina real -> erro invisivel -> ajuste -> resultado', 'mini-historia em primeira pessoa com revelacao no meio'],
      executionNotes: ['Abrir com frase curta em tom humano', 'Entrar no problema em ate 2 frases', 'Virada antes da metade do video', 'CTA curto, acionavel e sem cara de anuncio']
    },
    video_curto: {
      windowLabel: 'Sem pesquisa web disponivel, usando heuristicas atuais de creator',
      summary: 'Video curto precisa ter progressao rapida, cortes claros e uma unica promessa central, sem texto institucional.',
      viralFormats: ['POV + texto na tela', 'Lista curta com 3 pontos', 'Expectativa vs realidade', 'Erro comum narrado em primeira pessoa'],
      hookPatterns: ['A maioria tenta resolver isso errado', 'Isso aqui me fez perceber um erro', 'Se voce anda assim, presta atencao nisso', 'Eu demorei para entender isso'],
      storytellingPatterns: ['abertura em primeira pessoa -> problema -> virada -> solucao', 'situacao real -> contraste -> descoberta -> CTA'],
      executionNotes: ['Hook nos primeiros 2 segundos', 'Frases ainda mais curtas que em reels', 'Cada bloco precisa servir a retencao', 'Produto entra so depois da descoberta']
    },
    stories: {
      windowLabel: 'Sem pesquisa web disponivel, usando heuristicas atuais de creator',
      summary: 'Stories performam quando parecem bastidor real, com selfie, texto curto na tela e progressao de curiosidade ate o CTA.',
      viralFormats: ['Selfie + texto forte', 'Sequencia tipo bastidor', 'Pergunta + revelacao + CTA', 'POV rapido em 3 telas'],
      hookPatterns: ['O erro que trava seu resultado', 'Eu achei que era normal sentir isso', 'Ninguem me falou essa parte', 'Foi aqui que eu percebi o problema'],
      storytellingPatterns: ['gancho -> problema -> revelacao', 'situacao do dia a dia -> descoberta -> CTA', 'quebra de crenca -> ajuste -> convite para responder'],
      executionNotes: ['Texto na tela com poucas palavras', 'Fala oral, simples e cortada', 'Cada story precisa dar motivo para ver o proximo', 'CTA no final com resposta facil']
    },
    carrossel: {
      windowLabel: 'Sem pesquisa web disponivel, usando heuristicas atuais de creator',
      summary: 'Carrosseis continuam performando quando a capa promete um erro, mito ou virada e cada slide entrega um passo claro.',
      viralFormats: ['Erro comum em sequencia', 'Lista de mitos e correcoes', 'Passo a passo curto', 'Antes vs depois com contraste'],
      hookPatterns: ['O erro que trava seu resultado', 'Ninguem te conta isso sobre esse tema', '3 sinais de que voce esta fazendo errado', 'Se voce quer melhorar isso, leia ate o fim'],
      storytellingPatterns: ['capa -> problema -> descoberta -> solucao -> CTA', 'mito -> correcao -> prova -> CTA'],
      executionNotes: ['Capa precisa forcar o swipe', 'Um insight por slide', 'Texto enxuto e facil de salvar', 'Ultimo slide sempre com CTA claro']
    },
    post: {
      windowLabel: 'Sem pesquisa web disponivel, usando heuristicas atuais de creator',
      summary: 'Post estatico performa quando a frase principal para o scroll e a legenda continua a tensao com linguagem humana.',
      viralFormats: ['Frase forte na arte', 'Crenca quebrada', 'Dado curto + contexto', 'Mini-lista visual'],
      hookPatterns: ['Nao e falta de disciplina', 'O problema pode estar aqui', 'Tem uma parte que ninguem fala', 'Voce nao precisa de mais, precisa disso'],
      storytellingPatterns: ['frase principal -> contexto -> virada na legenda -> CTA', 'crenca comum -> quebra -> direcionamento'],
      executionNotes: ['Titulo da peca em ate 7 palavras', 'Legenda com abertura forte e curta', 'Tom de creator, nao de anuncio', 'CTA para salvar, comentar ou chamar']
    }
  };

  return byFormat[contentType] ?? byFormat.reels;
}

function normalizeTrendResearch(payload: unknown, fallback: TrendResearchResult): TrendResearchResult {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const raw = payload as Record<string, unknown>;

  const normalizeList = (value: unknown, backup: string[], maxItems = backup.length) => {
    if (!Array.isArray(value)) {
      return backup;
    }

    const list = value
      .map((item) => cleanSingleLineText(item, 180))
      .filter((item) => item && !isPlaceholderText(item))
      .slice(0, maxItems);

    return list.length ? list : backup;
  };

  return {
    windowLabel: chooseSingleLine(raw.windowLabel ?? raw.window ?? raw.timeWindow, fallback.windowLabel, 120, 8),
    summary: chooseParagraph(raw.summary, fallback.summary, 420, 20),
    viralFormats: normalizeList(raw.viralFormats ?? raw.formats, fallback.viralFormats, 4),
    hookPatterns: normalizeList(raw.hookPatterns ?? raw.hooks, fallback.hookPatterns, 4),
    storytellingPatterns: normalizeList(raw.storytellingPatterns ?? raw.storyPatterns, fallback.storytellingPatterns, 4),
    executionNotes: normalizeList(raw.executionNotes ?? raw.notes, fallback.executionNotes, 4)
  };
}

function getTrendResearchCacheKey(plan: ContentGenerationPlan) {
  return [plan.brief.contentType, plan.brief.seed, plan.brief.tones.join(','), plan.brief.objectives.join(',')].join(':');
}

function readTrendResearchCache(key: string) {
  const cached = trendResearchCache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    trendResearchCache.delete(key);
    return null;
  }

  return cached.result;
}

function writeTrendResearchCache(key: string, result: TrendResearchResult) {
  trendResearchCache.set(key, {
    expiresAt: Date.now() + TREND_RESEARCH_TTL_MS,
    result
  });
}

function resolveGenerationMaxTokens(plan: ContentGenerationPlan, contentType: string) {
  if (contentType === 'carrossel') {
    const units = Math.max(2, plan.brief.unitCount);
    return plan.costProfile === 'trend'
      ? Math.min(4200, 2400 + units * 220)
      : Math.min(3200, 1800 + units * 170);
  }

  if (contentType === 'stories') {
    return plan.costProfile === 'trend' ? 2600 : 2100;
  }

  if (contentType === 'post') {
    return plan.costProfile === 'trend' ? 2200 : 1800;
  }

  return plan.costProfile === 'trend' ? 3000 : 2400;
}

function resolvePolishMaxTokens(plan: ContentGenerationPlan, contentType: string) {
  if (contentType === 'carrossel') {
    return plan.costProfile === 'trend' ? 3000 : 2200;
  }

  return plan.costProfile === 'trend' ? 2400 : 1800;
}

async function researchContentTrends(input: ScriptVariantInput, plan: ContentGenerationPlan): Promise<TrendResearchResult> {
  const fallback = buildTrendResearchFallback(input);

  if (!plan.useTrendResearch) {
    return {
      ...fallback,
      windowLabel: 'Pesquisa externa nao acionada; usando biblioteca interna e heuristicas do produto'
    };
  }

  const cacheKey = getTrendResearchCacheKey(plan);
  const cached = readTrendResearchCache(cacheKey);

  if (cached) {
    return cached;
  }

  const webContext = await buildWebContextResult(buildTrendResearchQuery(input));

  if (!webContext?.summary || !getProviderCandidates().length) {
    return fallback;
  }

  const prompt = [
    'Voce e uma IA de pesquisa de tendencias para criacao de conteudo.',
    'Sua funcao aqui NAO e escrever o roteiro. Sua funcao e resumir o que esta performando agora para esse briefing.',
    'Foque em Instagram, TikTok, Reels, Stories, carrossel e formatos de creator.',
    'Responda somente JSON valido.',
    'Formato esperado: {"windowLabel":"","summary":"","viralFormats":["","",""],"hookPatterns":["","",""],"storytellingPatterns":["","",""],"executionNotes":["","",""]}.',
    'Procure formatos, hooks e estruturas que realmente ajudem a gerar um roteiro mais gravavel e mais nativo.',
    'Nao liste links na resposta final. Nao escreva o roteiro.',
    '',
    '=== BRIEFING ===',
    `Formato alvo: ${resolveContentTypeLabel(input.contentType)}`,
    formatGenerationPlanForPrompt(plan),
    ...buildBriefingLines(input),
    '',
    '=== PESQUISA WEB RESUMIDA ===',
    webContext.summary
  ]
    .filter(Boolean)
    .join('\n\n');

  const parsed = parseStructuredResponse(await callProvider(prompt, { maxTokens: 1400, providerMode: 'cost' }), fallback);
  const normalized = normalizeTrendResearch(parsed, fallback);
  writeTrendResearchCache(cacheKey, normalized);
  return normalized;
}

function formatTrendResearchForPrompt(research: TrendResearchResult) {
  return [
    `Janela observada: ${research.windowLabel}`,
    `Leitura geral: ${research.summary}`,
    'Formatos em alta:',
    ...research.viralFormats.map((item) => `- ${item}`),
    'Hooks que estao funcionando:',
    ...research.hookPatterns.map((item) => `- ${item}`),
    'Estruturas de storytelling observadas:',
    ...research.storytellingPatterns.map((item) => `- ${item}`),
    'Notas de execucao:',
    ...research.executionNotes.map((item) => `- ${item}`)
  ].join('\n');
}

function getCreatorAiBaseRules() {
  return [
    'Voce e o Creator AI, o assistente oficial de conteudo, estrategia e operacao da plataforma Creator AI.',
    `Data atual: ${getCurrentDateLabel()}. Use essa data como referencia quando o usuario pedir tendencias, novidades ou recortes temporais.`,
    'Se o pedido envolver pesquisas atuais, referencias recentes, tendencias, noticias ou algo de "hoje", use contexto web e diga claramente a janela temporal usada.',
    'Evite respostas genericas, velhas ou pouco acionaveis. Nunca invente ano ou tendencia antiga quando o pedido pedir atualidade.',
    'Responda com foco em criacao de conteudo: seja curto, direto e pratico.',
    'Normalmente use 3 a 5 bullets ou uma lista curta. Se o pedido for de ganchos, entregue apenas ganchos prontos para postar.',
    'Nao despeje fontes, links ou bibliografia a menos que o usuario peça explicitamente.',
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

function repairTruncatedJson(text: string) {
  let repaired = text.trim();

  // Close any open strings
  const quoteCount = (repaired.match(/(?<!\\)"/g) ?? []).length;
  if (quoteCount % 2 !== 0) {
    repaired += '"';
  }

  // Remove trailing commas before closing brackets
  repaired = repaired.replace(/,\s*$/, '');

  // Count open/close brackets and close any unclosed ones
  const opens = { '{': 0, '[': 0 };
  const closes: Record<string, string> = { '{': '}', '[': ']' };
  const closeOrder: string[] = [];

  for (const char of repaired) {
    if (char === '{' || char === '[') {
      opens[char] += 1;
      closeOrder.push(closes[char]);
    } else if (char === '}' || char === ']') {
      closeOrder.pop();
      opens[char === '}' ? '{' : '['] -= 1;
    }
  }

  // Close unclosed brackets in reverse order
  while (closeOrder.length > 0) {
    repaired += closeOrder.pop();
  }

  return repaired;
}

function tryParseJsonFragment(response: string | null) {
  if (!response) {
    return null;
  }

  const fragment = extractJsonFragment(response);
  if (!fragment) {
    return null;
  }

  // Try direct parse first
  try {
    return JSON.parse(fragment);
  } catch {
    // JSON might be truncated — try to repair it
  }

  // Try repairing truncated JSON
  try {
    return JSON.parse(repairTruncatedJson(fragment));
  } catch {
    return null;
  }
}

function normalizeProductImportRecord(item: unknown, index: number): ProductImportRecord | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const name = cleanSingleLineText(raw.name ?? raw.title ?? raw.product ?? raw.nome ?? raw.productName, 120);
  const benefits = cleanParagraphText(raw.benefits ?? raw.description ?? raw.descricao ?? raw.summary ?? raw.details, 1200);
  const audience = cleanSingleLineText(
    raw.audience ?? raw.publico ?? raw.publicoAlvo ?? raw.publico_alvo ?? raw.targetAudience ?? raw.segment,
    220
  );
  const price = cleanSingleLineText(raw.price ?? raw.preco ?? raw.valor ?? raw.value ?? raw.estimate, 80);
  const discountPrice = cleanSingleLineText(
    raw.discountPrice ?? raw.discount ?? raw.precoDe ?? raw.priceBefore ?? raw.priceBeforeDiscount,
    80
  );
  const restrictions = cleanParagraphText(
    raw.restrictions ?? raw.limitations ?? raw.observations ?? raw.notes ?? raw.obs,
    600
  );

  if (![name, benefits, audience, price, discountPrice, restrictions].some(Boolean)) {
    return null;
  }

  return {
    name: name || `Produto ${index + 1}`,
    benefits,
    audience,
    price,
    discountPrice,
    restrictions
  };
}

function extractProductImportRecordsFromJsonLike(payload: unknown, maxItems: number) {
  if (!payload) {
    return [];
  }

  const arrays: unknown[][] = [];

  if (Array.isArray(payload)) {
    arrays.push(payload);
  } else if (typeof payload === 'object') {
    const raw = payload as Record<string, unknown>;
    for (const key of ['products', 'items', 'catalog', 'data']) {
      if (Array.isArray(raw[key])) {
        arrays.push(raw[key] as unknown[]);
      }
    }

    if (!arrays.length && raw.product && typeof raw.product === 'object') {
      arrays.push([raw.product]);
    }
  }

  for (const array of arrays) {
    const products = array
      .map((item, index) => normalizeProductImportRecord(item, index))
      .filter((item): item is ProductImportRecord => Boolean(item));

    if (products.length) {
      return products.slice(0, maxItems);
    }
  }

  return [];
}

function splitProductImportBlocks(text: string) {
  const normalized = text.replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs;
  }

  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    return [];
  }

  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length) {
      blocks.push(current.join('\n'));
      current = [];
    }
  };

  for (const line of lines) {
    const itemLine = line.replace(/^([-*•]|\d+[.)])\s+/, '');
    const startsItem = /^([-*•]|\d+[.)])\s+/.test(line) || /^(?:nome|produto|item)\s*[:\-]/i.test(line);

    if (startsItem && current.length) {
      flush();
      current.push(itemLine);
      continue;
    }

    current.push(itemLine);

    if (current.length >= 5) {
      flush();
    }
  }

  flush();
  return blocks;
}

function parseProductImportBlock(block: string, index: number): ProductImportRecord | null {
  const normalizedBlock = block.replace(/\r/g, '').trim();

  if (!normalizedBlock) {
    return null;
  }

  const lines = normalizedBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const joined = lines.join(' ');
  const pipeParts = joined
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const nameFromLabel = joined.match(/(?:^|\b)(?:nome|produto|item|titulo|título)\s*[:\-]\s*([^|]+)/i)?.[1];
  const priceMatch = joined.match(/(?:preço|preco|valor|price)\s*[:\-]?\s*(R\$\s?[\d.]+(?:,\d{2})?)/i) ?? joined.match(/(R\$\s?[\d.]+(?:,\d{2})?)/i);
  const discountMatch =
    joined.match(/(?:de|antes)\s*(R\$\s?[\d.]+(?:,\d{2})?)\s*(?:por|agora|a partir de)\s*(R\$\s?[\d.]+(?:,\d{2})?)/i) ??
    joined.match(/(?:desconto|promoc[aã]o)\s*[:\-]?\s*(R\$\s?[\d.]+(?:,\d{2})?)/i);
  const audienceMatch =
    joined.match(
      /(?:público|publico|público-alvo|publico-alvo|audiência|audiencia|para|indicado para)\s*[:\-]\s*([^|]+?)(?=$|\s+(?:benef[ií]cios?|vantagens?|restri[cç][oõ]es?|pre[cç]o|valor|price)\b)/i
    ) ?? joined.match(/(?:público|publico|para)\s*[:\-]\s*([^|]+)/i);
  const restrictionsMatch =
    joined.match(
      /(?:restri[cç][oõ]es?|limita[cç][oõ]es?|contraindicado(?:s)?|nao recomendado|não recomendado)\s*[:\-]\s*([^|]+)$/i
    ) ?? joined.match(/(?:restri[cç][oõ]es?|limita[cç][oõ]es?)\s*[:\-]\s*([^|]+)/i);

  let name = cleanSingleLineText(nameFromLabel ?? pipeParts[0] ?? lines[0], 120);
  if (!name) {
    name = `Produto ${index + 1}`;
  }

  const benefitsSource =
    lines.length > 1
      ? lines.slice(1).join('\n')
      : joined.replace(name, '').replace(/^\s*[:\-–—]\s*/, '');
  let benefits = cleanParagraphText(benefitsSource, 1200);

  if (!benefits && pipeParts[1]) {
    benefits = cleanParagraphText(pipeParts.slice(1).join('\n'), 1200);
  }

  if (benefits && name && benefits.toLowerCase().startsWith(name.toLowerCase())) {
    benefits = cleanParagraphText(benefits.slice(name.length).trim(), 1200);
  }

  const audience = cleanSingleLineText(audienceMatch?.[1] ?? pipeParts[2], 220);
  const price = cleanSingleLineText(priceMatch?.[1] ?? pipeParts[3], 80);
  const discountPrice = cleanSingleLineText(discountMatch?.[2] ?? discountMatch?.[1] ?? pipeParts[4], 80);
  const restrictions = cleanParagraphText(restrictionsMatch?.[1] ?? pipeParts[5], 600);

  if (![name, benefits, audience, price, discountPrice, restrictions].some(Boolean)) {
    return null;
  }

  return {
    name,
    benefits,
    audience,
    price,
    discountPrice,
    restrictions
  };
}

function extractProductImportRecordsFromText(text: string, maxItems: number) {
  const blocks = splitProductImportBlocks(text);
  const products = blocks
    .map((block, index) => parseProductImportBlock(block, index))
    .filter((item): item is ProductImportRecord => Boolean(item));

  if (products.length) {
    return products.slice(0, maxItems);
  }

  const lineProducts = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseProductImportBlock(line, index))
    .filter((item): item is ProductImportRecord => Boolean(item));

  return lineProducts.slice(0, maxItems);
}

function looksLikeJsonResponse(text: string) {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[') || /^```json/i.test(trimmed);
}

function extractProductImportRecordsFromResponse(response: string | null, maxItems: number) {
  if (!response) {
    return [];
  }

  const structured = extractProductImportRecordsFromJsonLike(tryParseJsonFragment(response), maxItems);
  if (structured.length) {
    return structured;
  }

  // If the response looks like JSON but parsing failed, do NOT fall back to text parsing
  // because the text parser will treat JSON fragments as product names/descriptions
  if (looksLikeJsonResponse(response)) {
    return [];
  }

  return extractProductImportRecordsFromText(response, maxItems);
}

function scoreProductImportRecords(products: ProductImportRecord[]) {
  return products.reduce((score, item) => score + scoreProductImportRecord(item), 0);
}

function scoreProductImportRecord(item: ProductImportRecord) {
  const normalizedName = normalizeMatchText(item.name);
  const words = normalizedName.split(' ').filter(Boolean);
  let score = 0;

  if (!normalizedName) {
    score -= 12;
  } else {
    if (/^(beneficios|composicao|modo de uso|contra indicacao|catalogo|varejo|time viver bem)/.test(normalizedName)) {
      score -= 14;
    }

    if (normalizedName.length > 90) {
      score -= 10;
    } else if (normalizedName.length > 60) {
      score -= 6;
    } else if (normalizedName.length <= 50) {
      score += 6;
    } else {
      score += 2;
    }

    if (words.length >= 1 && words.length <= 6) {
      score += 5;
    } else if (words.length <= 8) {
      score += 2;
    } else {
      score -= 4;
    }

    if (/[\.\:\;]/.test(item.name)) {
      score -= 2;
    }
  }

  if (item.benefits) {
    score += Math.min(4, Math.max(1, Math.ceil(item.benefits.length / 250)));
  } else {
    score -= 2;
  }

  if (item.price) {
    score += 3;
  }

  if (item.discountPrice) {
    score += 1;
  }

  if (item.restrictions) {
    score += 1;
  }

  if (item.audience) {
    score += 1;
  }

  return score;
}

function isProductGroundedInSource(product: ProductImportRecord, sourceText: string) {
  if (!sourceText) {
    return true; // No source text to validate against — allow through
  }

  const normalizedSource = normalizeMatchText(sourceText);
  const nameWords = normalizeMatchText(product.name)
    .split(' ')
    .filter((word) => word.length >= 3);

  if (!nameWords.length) {
    return false;
  }

  // Count how many significant words from the product name appear in the source
  const matchedWords = nameWords.filter((word) => normalizedSource.includes(word));
  const matchRatio = matchedWords.length / nameWords.length;

  // Require at least 50% of the significant words to appear in the source
  return matchRatio >= 0.5;
}

function filterGroundedProducts(products: ProductImportRecord[], sourceText: string) {
  if (!sourceText || !products.length) {
    return products;
  }

  const grounded = products.filter((product) => isProductGroundedInSource(product, sourceText));
  return grounded;
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
    'Voce e um estrategista de conteudo para social media.',
    'Responda somente JSON valido.',
    `Retorne um array com ${fallback.length} objetos no formato [{"title":"", "hook":"", "format":"", "angle":""}].`,
    'As ideias devem nascer para Reels, carrossel ou Stories.',
    'O hook deve parecer pronto para abrir um video ou carrossel, sem texto institucional ou genérico.',
    `Tema: ${input.topic}`,
    input.product ? `Produto: ${input.product}` : null,
    input.audience ? `Publico: ${input.audience}` : null
  ], buildSocialTrendQuery(input.topic, input.product, input.audience));

  return normalizeIdeaResult(parseStructuredResponse(await callProvider(prompt), fallback), fallback);
}

export async function generateHooks(input: { topic: string; count?: number }) {
  const cleanTopic = input.topic.trim().replace(/\s+/g, ' ');
  const fallbackHooks = [
    `Voce ainda esta errando em ${cleanTopic}.`,
    `O que ninguém te conta sobre ${cleanTopic}.`,
    `3 sinais de que ${cleanTopic} precisa mudar agora.`,
    `Se eu começasse ${cleanTopic} hoje, faria isso.`,
    `Pare de complicar ${cleanTopic}.`
  ];
  const fallback = Array.from({ length: input.count ?? 5 }, (_, index) => fallbackHooks[index % fallbackHooks.length]);
  const prompt = await buildCreatorAiPrompt([
    'Voce e um copywriter de videos curtos e posts de alto engajamento.',
    'Responda somente JSON valido.',
    `Retorne um array com ${fallback.length} strings curtas, fortes e prontas para Reels, carrossel ou Stories.`,
    'Use formatos que soem nativos de rede social: quebra de crença, curiosidade, dor, prova, lista curta e provocacao.',
    'Cada item deve caber como gancho de abertura, sem explicacao extra.',
    `Tema: ${input.topic}`
  ], buildSocialTrendQuery(input.topic));

  return normalizeHookList(parseStructuredResponse(await callProvider(prompt), fallback), fallback);
}

export async function generateScript(input: ScriptInput) {
  const fallback = {
    title: `Roteiro sobre ${input.topic}`,
    hook: `Se voce quer ${input.topic.toLowerCase()}, faca isso sem complicar.`,
    spoken: `Se ${input.topic.toLowerCase()} ainda parece complicado, vale simplificar o caminho antes de desistir. Quando voce entende o ajuste certo, fica mais facil sair da tentativa aleatoria e entrar em um processo que realmente faz sentido.`,
    takes: ['abertura com dor', 'prova visual', 'passo a passo', 'resultado', 'CTA'],
    cta: 'Comente "quero" para receber o material.',
    caption: `Se voce quer ${input.topic.toLowerCase()}, esse roteiro e o caminho mais simples.\n\nUse como base, adapte para a sua oferta e feche com uma chamada clara.\n\n#reels #marketingdigital #conteudopararedes #instagram`
  };
  const prompt = await buildCreatorAiPrompt([
    'Voce cria roteiros de conteudo em portugues do Brasil para social media.',
    'Responda somente JSON valido.',
    'Formato esperado: {"title":"","hook":"","spoken":"","takes":["","","","",""],"cta":"","caption":""}.',
    'Deixe o roteiro curto, visual e pronto para gravacao.',
    'Hook: uma frase curta, forte e nativa de rede social.',
    'Spoken: fala natural, com pontuacao, paragrafo curto e ritmo de video. Mire em 70 a 130 palavras.',
    'Takes: 5 blocos curtos e sequenciais, sem frases longas.',
    'CTA: uma chamada objetiva, alinhada ao conteudo e sem parecer genérica.',
    'Caption: legenda pronta com abertura, valor, CTA e hashtags no final. Mantenha em 3 a 6 linhas curtas.',
    `Tema: ${input.topic}`,
    input.goal ? `Objetivo: ${input.goal}` : null,
    input.tone ? `Tom: ${input.tone}` : null
  ], buildSocialTrendQuery(input.topic, input.goal, input.tone));

  const draft = normalizeScriptOutput(parseStructuredResponse(await callProvider(prompt), fallback), fallback);
  assertDraftUsability(draft, 'reels');
  return draft;
}

function resolveContentTypeLabel(contentType?: string) {
  const map: Record<string, string> = {
    reels: 'Reels (video curto vertical, corte rapido, gancho visual nos primeiros 3 segundos)',
    stories: 'Sequencia de Stories (cada take e um slide independente, linguagem direta, CTA no ultimo slide)',
    video_curto: 'Video curto (estrutura linear: entrada, desenvolvimento e saida em menos de 1 minuto)',
    carrossel: 'Carrossel (cada take e um slide, capa com gancho forte, ultimos slides com CTA)',
    post: 'Post estatico (hook na primeira linha da legenda, visual precisa prender atencao antes do texto)'
  };
  return map[contentType ?? ''] ?? 'Reels (padrao)';
}

function resolveDurationLabel(duration?: string) {
  const map: Record<string, string> = {
    '15s': '15 segundos — spoken com no maximo 35 palavras. Ultra direto. So o essencial.',
    '30s': '30 segundos — spoken com 65 a 80 palavras. Uma ideia clara, sem enrolacao.',
    '45s': '45 segundos — spoken com 95 a 115 palavras. Da para desenvolver um exemplo curto.',
    '60s': '60 segundos — spoken com 130 a 150 palavras. Historia rapida ou passo a passo.',
    '90s': '90 segundos — spoken com 180 a 220 palavras. Mini-historia com situacao, virada e revelacao.',
    '3min': '3 minutos — spoken com 400 a 500 palavras. Estrutura completa: situacao → tentativas → problema real → solucao → resultado → CTA.'
  };
  return map[duration ?? ''] ?? '30 segundos — spoken com 65 a 80 palavras.';
}

function resolveActiveTones(tones?: string[], tone?: string) {
  return uniqueNonEmptyStrings(tones?.length ? tones : tone ? [tone] : ['natural']);
}

function resolveActiveObjectives(objectives?: string[], objective?: string) {
  return uniqueNonEmptyStrings(objectives?.length ? objectives : objective ? [objective] : ['vender']);
}

function resolveToneChipLabel(tone?: string) {
  const map: Record<string, string> = {
    natural: 'Natural',
    autoridade: 'Autoridade',
    emocional: 'Emocional',
    engracado: 'Engracado',
    storytelling: 'Storytelling',
    genz: 'Gen Z',
    educativo: 'Educativo',
    trend: 'Trend'
  };

  return map[tone ?? ''] ?? 'Natural';
}

function resolveObjectiveChipLabel(objective?: string) {
  const map: Record<string, string> = {
    vender: 'Vender',
    engajar: 'Engajar',
    educar: 'Educar',
    autoridade: 'Autoridade',
    prova_social: 'Prova social',
    alcance: 'Alcance',
    relacionamento: 'Relacionamento'
  };

  return map[objective ?? ''] ?? 'Vender';
}

function resolveToneLabel(tone?: string) {
  const map: Record<string, string> = {
    natural: 'Tom natural: primeira pessoa, como uma conversa real, sem termos de marketing, como se fosse um amigo contando algo que descobriu. Sem "ola pessoal".',
    autoridade: 'Tom de autoridade: firme, dados concretos, linguagem de especialista. Sem ser arrogante, mas sem hesitar. Usa numeros e resultados reais.',
    emocional: 'Tom emocional: comeca com uma situacao real de dor ou frustração, cria conexao antes de apresentar qualquer solucao. Vai do sentimento para a transformacao.',
    engracado: 'Tom engracado: usa humor, auto-ironia ou situacoes absurdas do cotidiano. O produto aparece como solucao natural sem forcar.',
    storytelling: 'Tom de storytelling: estrutura de antes/depois ou conflito/resolucao. Conta uma historia real especifica, depois revela o produto ou aprendizado.',
    genz: 'Tom Gen Z: curto, cru, sem filtro, como TikTok raiz. Direto ao ponto, sem apresentacao. Pode usar linguagem atual mas sem forcar girias.',
    educativo: 'Tom educativo: ensina algo especifico e util antes de mencionar o produto. Entrega valor primeiro, depois conecta com a solucao.',
    trend: 'Tom Trend: adapta o produto a um formato viral do momento (POV, antes/depois, expectativa vs realidade, dueto imaginario, rotina, etc). O formato define a estrutura, o produto entra naturalmente dentro dele. Prioriza alcance, compartilhamento e identificacao. Soa atual e nativo da plataforma.'
  };
  return map[tone ?? ''] ?? map['natural'];
}

function resolveTonesLabel(tones?: string[], tone?: string): string {
  const active = resolveActiveTones(tones, tone);
  const isTrend = active.includes('trend');
  const others = active.filter((t) => t !== 'trend');

  const parts: string[] = [];
  const comboLabel = active.map((item) => resolveToneChipLabel(item)).join(' + ');

  parts.push(`Tons ativos combinados: ${comboLabel}.`);
  parts.push(
    active.length > 1
      ? 'Todos esses tons precisam aparecer juntos na mesma peca. Nao escolha um e ignore o resto.'
      : 'Mantenha esse tom de forma consistente do inicio ao fim.'
  );
  parts.push('Pense em camadas: voz, ritmo, estrutura e fechamento devem refletir os tons ao mesmo tempo.');

  if (isTrend) {
    parts.push(resolveToneLabel('trend'));
  }
  others.forEach((t) => {
    const label = resolveToneLabel(t);
    if (label) parts.push(label);
  });

  return parts.join('\n');
}

function resolveObjectiveLabel(objective?: string) {
  const map: Record<string, string> = {
    vender: 'Objetivo vender: destaca o resultado, urgencia ou o que o cliente perde sem agir. CTA direto para compra, link ou DM.',
    engajar: 'Objetivo engajar: termina com pergunta ou provocacao que gera comentario, salvamento ou compartilhamento. NAO faz CTA de venda.',
    educar: 'Objetivo educar: foca em entregar um aprendizado pratico. O produto e solucao natural do problema ensinado, nao o centro.',
    autoridade: 'Objetivo autoridade: posiciona o criador ou marca como referencia. Usa dados, resultados ou credenciais de forma implicita e natural.',
    prova_social: 'Objetivo prova social: usa depoimento, caso real ou transformacao visivel. Estrutura: "meu cliente fez X e aconteceu Y" ou "eu mesma testei e...".',
    alcance: 'Objetivo alcance: maximiza compartilhamento e viralidade. Termina com CTA de salvar, compartilhar ou marcar alguem. Conteudo e universalmente identificavel.',
    relacionamento: 'Objetivo relacionamento: constrói conexao com a audiencia. Primeira pessoa, vulnerabilidade controlada, historia proxima do seguidor. Sem CTA de venda, apenas convite para continuar junto.'
  };
  return map[objective ?? ''] ?? map['vender'];
}

function resolveObjectivesLabel(objectives?: string[], objective?: string): string {
  const active = resolveActiveObjectives(objectives, objective);
  const parts = [
    `Objetivos combinados: ${active.map((item) => resolveObjectiveChipLabel(item)).join(' + ')}.`,
    active.length > 1
      ? 'Esses objetivos sao cumulativos. O conteudo precisa equilibrar todos ao mesmo tempo, sem tratar como escolhas exclusivas.'
      : 'Toda a peca deve servir a esse objetivo de forma clara.',
    'Distribua a estrategia pela estrutura: o hook pode puxar alcance, o desenvolvimento pode gerar conexao ou valor, e o CTA pode converter sem parecer forcado.',
    ...active.map((o) => resolveObjectiveLabel(o))
  ];

  return parts.join('\n');
}

function buildBriefingLines(input: ScriptVariantInput, extras: string[] = []): (string | null)[] {
  return [
    input.pain ? `Dor central do publico: ${input.pain}` : null,
    input.benefit ? `Transformacao que o produto entrega: ${input.benefit}` : null,
    input.targetAudience ? `Publico-alvo: ${input.targetAudience}` : null,
    input.productName ? `Produto: ${input.productName}` : null,
    input.productContext ? `Contexto do produto: ${input.productContext}` : null,
    input.referenceContext ? `Referencias adicionais: ${input.referenceContext}` : null,
    input.prompt ? `Instrucao extra: ${input.prompt}` : null,
    ...extras
  ];
}

function buildPlanSeedValues(brief: ReturnType<typeof buildBriefSeed>) {
  return {
    dor: lowerFirst(brief.problem || 'esse problema'),
    beneficio: lowerFirst(brief.benefit || 'esse resultado'),
    tema: lowerFirst(brief.topic || brief.problem || brief.benefit || 'esse tema'),
    produto: brief.product || 'essa solucao',
    palavra: 'quero'
  };
}

function resolvePlannedHook(plan: ContentGenerationPlan, brief: ReturnType<typeof buildBriefSeed>) {
  const values = buildPlanSeedValues(brief);
  const template = plan.hookPatterns[0]?.formula;

  return tightenHookLine(
    template ? applyFormulaTemplate(template, values) : '',
    `Se voce quer ${brief.shortBenefit}, talvez esteja insistindo no caminho errado.`,
    12,
    100
  );
}

function resolvePlannedCta(plan: ContentGenerationPlan, brief: ReturnType<typeof buildBriefSeed>) {
  const values = buildPlanSeedValues(brief);
  const template = plan.ctaPattern?.formula;

  return chooseSingleLine(
    template ? applyFormulaTemplate(template, values) : '',
    `Me chama no direct e eu te mostro como aplicar isso com ${brief.product || 'essa solucao'}.`,
    180,
    8
  );
}

function buildVideoFallback(input: ScriptVariantInput, plan: ContentGenerationPlan): ScriptDraftResponse {
  const brief = buildBriefSeed(input);
  const theme = lowerFirst(brief.topic || brief.problem || brief.benefit || 'esse tema');
  const productMention = brief.product || 'a solucao certa';
  const hook = resolvePlannedHook(plan, brief);
  const cta = resolvePlannedCta(plan, brief);
  const arc = plan.storytellingPattern.stages;
  const trendLabel = plan.trendPatterns[0]?.label ?? 'creator-first';
  const nicheAngle = plan.nichePatterns[0]?.contentAngles[0] ?? 'erro comum';
  const proofPoint = lowerFirst(plan.nichePatterns[0]?.proofPoints[0] ?? brief.shortBenefit);
  const styleDirection = plan.communicationStyles[0]?.notes[0] ?? 'Fala como creator, nao como marca';
  const objectiveDirection = lowerFirst(plan.objectiveStrategies[0]?.ctaDirection ?? 'levar para o proximo passo');

  return {
    title: `${input.contentType === 'video_curto' ? 'Video curto' : 'Reels'} - ${brief.product || brief.shortBenefit}`,
    hook,
    spoken: `Se ${lowerFirst(brief.problem)}, comeca por ${nicheAngle}, nao por prometer milagre. Eu achei que era so uma fase, mas percebi que o problema estava em repetir o mesmo caminho sem notar a causa real. Quando entrou ${arc[2] ?? 'a descoberta certa'}, ${productMention} virou apoio para buscar ${lowerFirst(brief.benefit)} com mais ${proofPoint}. ${styleDirection}.`,
    takes: [
      `Abrir em close com expressao de alerta, usando o hook "${hook}" na tela`,
      `Mostrar a situacao real de ${theme} em linguagem visual simples e nativa do formato ${trendLabel}`,
      `Inserir a virada quando ${productMention} aparece como apoio ligado a ${proofPoint}`,
      `B-roll com prova visual do antes e depois percebido em ${brief.shortBenefit}`,
      `Fechamento com CTA direto, olho na camera e gesto chamando para a acao (${objectiveDirection})`
    ],
    cta,
    caption: `Tem uma diferenca enorme entre insistir mais e ajustar o que realmente trava ${lowerFirst(brief.problem)}.\n\nSe esse tema bateu em voce, olha para ${nicheAngle} antes de achar que o problema e falta de esforco.\n\n${cta}\n\n${buildHashtags(brief.product, brief.benefit, brief.problem)}`
  };
}

function buildStoriesFallback(input: ScriptVariantInput, count: number, plan: ContentGenerationPlan): ScriptDraftResponse {
  const brief = buildBriefSeed(input);
  const productMention = brief.product || 'essa solucao';
  const hook = resolvePlannedHook(plan, brief);
  const cta = resolvePlannedCta(plan, brief);
  const nicheAngle = plan.nichePatterns[0]?.contentAngles[0] ?? 'erro comum';
  const proofPoint = lowerFirst(plan.nichePatterns[0]?.proofPoints[0] ?? brief.shortBenefit);
  const slides: StorySlide[] = [];

  const templates: StorySlide[] = [
    {
      objetivo: 'gancho',
      textoTela: clipWords(hook, 7, 42) || 'O erro que trava seu resultado',
      falado: `Se ${lowerFirst(brief.problem)}, presta atencao porque esse e o ponto que quase sempre trava seu resultado.`,
      visual: 'Selfie olhando direto para a camera, com texto forte ocupando o centro da tela'
    },
    {
      objetivo: 'contexto',
      textoTela: 'Nao e falta de esforco',
      falado: `Na maioria das vezes, o problema nao e disciplina. E insistir em ${nicheAngle} sem perceber o que realmente trava a sua rotina.`,
      visual: 'Plano medio, corte limpo, com apoio de texto curto reforcando a quebra de crenca'
    },
    {
      objetivo: 'revelacao',
      textoTela: 'Foi aqui que virou o jogo',
      falado: `Foi aqui que ${productMention} entrou como apoio para eu buscar ${lowerFirst(brief.benefit)} sem cair no mesmo ciclo de sempre.`,
      visual: `B-roll do produto ${brief.product ? 'em uso' : 'ou da rotina'} com detalhes bem proximos`
    },
    {
      objetivo: 'prova',
      textoTela: clipWords(`Mais ${proofPoint} no processo`, 6, 40) || 'Mais clareza no processo',
      falado: `O ganho aqui e sentir mais ${proofPoint}, com consistencia e um processo que voce realmente consegue manter.`,
      visual: 'Mistura de selfie com apoio visual simples mostrando rotina, resultado ou anotacoes'
    },
    {
      objetivo: 'cta',
      textoTela: 'Me chama no direct',
      falado: cta,
      visual: 'Tela final limpa, dedo apontando para o direct ou para a caixa de resposta'
    }
  ];

  for (let index = 0; index < count; index += 1) {
    if (count === 1) {
      slides.push({
        objetivo: 'gancho',
        textoTela: templates[0].textoTela,
        falado: `${templates[0].falado} ${templates[4].falado}`,
        visual: templates[0].visual
      });
      break;
    }

    if (count === 2) {
      slides.push(index === 0 ? templates[0] : templates[4]);
      continue;
    }

    if (count === 3) {
      slides.push(index === 0 ? templates[0] : index === 1 ? templates[2] : templates[4]);
      continue;
    }

    slides.push(templates[index] ?? templates[templates.length - 1]);
  }

  return {
    title: `Stories - ${brief.product || brief.shortBenefit}`,
    hook: hook || slides[0]?.textoTela || 'Story com gancho forte',
    spoken: '',
    takes: [],
    cta,
    caption: '',
    storySlides: slides
  };
}

function buildCarrosselFallback(input: ScriptVariantInput, count: number, plan: ContentGenerationPlan): ScriptDraftResponse {
  const brief = buildBriefSeed(input);
  const productMention = brief.product || 'essa solucao';
  const hook = resolvePlannedHook(plan, brief);
  const cta = resolvePlannedCta(plan, brief);
  const nicheAngle = plan.nichePatterns[0]?.contentAngles[0] ?? 'erro comum';
  const proofPoint = lowerFirst(plan.nichePatterns[0]?.proofPoints[0] ?? brief.shortBenefit);
  const slides = Array.from({ length: count }, (_, index): CarrosselSlide => {
    if (index === 0) {
      return {
        numero: 1,
        titulo: clipWords(hook, 6, 40) || 'O erro que trava seu resultado',
        subtitulo: 'E o ajuste que muda o jogo',
        conteudo: `Se ${lowerFirst(brief.problem)}, este carrossel vai direto ao ponto.`,
        visual: 'Capa limpa com tipografia grande, contraste forte e um elemento visual de tensao'
      };
    }

    if (index === count - 1) {
      return {
        numero: index + 1,
        titulo: 'Agora faz o seguinte',
        subtitulo: 'Salva e me chama',
        conteudo: cta,
        visual: 'Slide final com CTA visivel, destaque para salvar, compartilhar ou chamar no direct'
      };
    }

    const middleBlocks = [
      {
        titulo: 'O problema real',
        subtitulo: 'Nao e o que parece',
        conteudo: `Na maior parte dos casos, o bloqueio vem de insistir em ${nicheAngle} sem ajustar a base da rotina.`,
        visual: 'Layout limpo com um contraste entre erro comum e causa real'
      },
      {
        titulo: 'A virada pratica',
        subtitulo: `${clipWords(productMention, 4, 28)} entra aqui`,
        conteudo: `Quando voce muda o ponto certo e usa ${productMention}, fica mais facil buscar ${lowerFirst(brief.benefit)} com mais ${proofPoint}.`,
        visual: 'Foto ou detalhe do produto apoiando a explicacao, com destaque visual para a mudanca'
      },
      {
        titulo: 'O que isso destrava',
        subtitulo: brief.shortBenefit,
        conteudo: `O ganho real e ter mais ${proofPoint}, menos excesso e um processo que voce consegue sustentar no dia a dia.`,
        visual: 'Slide com poucos elementos, numero em destaque e apoio visual de rotina ou resultado'
      },
      {
        titulo: 'Como aplicar hoje',
        subtitulo: 'Sem complicar',
        conteudo: `Comece pelo ajuste mais simples, acompanhe a resposta do corpo e refine o processo antes de mudar tudo de uma vez.`,
        visual: 'Passo a passo visual com setas, blocos ou numeracao curta'
      }
    ];

    const template = middleBlocks[(index - 1) % middleBlocks.length];

    return {
      numero: index + 1,
      ...template
    };
  });

  return {
    title: `Carrossel - ${brief.product || brief.shortBenefit}`,
    hook: hook || slides[0]?.titulo || 'Carrossel com capa forte',
    spoken: '',
    takes: [],
    cta,
    caption: `Esse carrossel nasceu para transformar um erro comum em ajuste claro.\n\nSe ${lowerFirst(brief.problem)}, usa essas paginas como mapa rapido antes de repetir o mesmo ciclo.\n\n${cta}\n\n${buildHashtags(brief.product, brief.problem, brief.benefit)}`,
    carrosselSlides: slides
  };
}

function buildPostFallback(input: ScriptVariantInput, plan: ContentGenerationPlan): ScriptDraftResponse {
  const brief = buildBriefSeed(input);
  const hook = resolvePlannedHook(plan, brief);
  const cta = resolvePlannedCta(plan, brief);
  const nicheFocus = plan.nichePatterns[0]?.focus[0] ?? 'gancho claro';
  const nicheAngle = plan.nichePatterns[0]?.contentAngles[0] ?? 'erro comum';

  return {
    title: `Post - ${brief.product || brief.shortBenefit}`,
    hook: tightenHookLine(hook, 'Nao e falta de disciplina', 7, 60),
    spoken: '',
    takes: [],
    cta,
    caption: `Esse post nao existe para soar bonito. Existe para te fazer parar no feed e enxergar o erro com clareza.\n\nSe ${lowerFirst(brief.problem)}, talvez o travamento esteja no metodo, nao em voce.\n\n${cta}\n\n${buildHashtags(brief.product, brief.problem, brief.benefit)}`,
    postFields: {
      conceito: `Quebra de crenca mostrando que ${lowerFirst(brief.problem)} nao se resolve com excesso, e sim com ${nicheFocus}.`,
      tituloPeca: tightenHookLine(hook, 'Nao e falta de disciplina', 7, 60),
      textoApoio: `Talvez o problema esteja em ${nicheAngle}, nao em voce.`,
      direcaoVisual: 'Post minimalista com tipografia forte, contraste elegante e um elemento visual que transmita pausa, clareza e reposicionamento'
    }
  };
}

const storyObjectiveKeys = new Set(['gancho', 'contexto', 'tensao', 'revelacao', 'prova', 'solucao', 'cta']);

function sanitizeStorySlides(rawSlides: StorySlide[] | undefined, fallbackSlides: StorySlide[]) {
  return fallbackSlides.map((fallbackSlide, index) => {
    const rawSlide = rawSlides?.[index];
    const rawObjective = cleanSingleLineText(rawSlide?.objetivo, 40);
    const normalizedObjective = normalizeMatchText(rawObjective);

    return {
      objetivo: storyObjectiveKeys.has(normalizedObjective) ? rawObjective : fallbackSlide.objetivo,
      textoTela: chooseSingleLine(rawSlide?.textoTela, fallbackSlide.textoTela, 90, 4),
      falado: chooseParagraph(rawSlide?.falado, fallbackSlide.falado, 320, 16),
      visual: chooseSingleLine(rawSlide?.visual, fallbackSlide.visual, 180, 8)
    };
  });
}

function sanitizeCarrosselSlides(rawSlides: CarrosselSlide[] | undefined, fallbackSlides: CarrosselSlide[]) {
  return fallbackSlides.map((fallbackSlide, index) => {
    const rawSlide = rawSlides?.[index];

    return {
      numero: index + 1,
      titulo: chooseSingleLine(rawSlide?.titulo, fallbackSlide.titulo, 80, 4),
      subtitulo: chooseSingleLine(rawSlide?.subtitulo, fallbackSlide.subtitulo, 120, 4),
      conteudo: chooseParagraph(rawSlide?.conteudo, fallbackSlide.conteudo, 420, 16),
      visual: chooseSingleLine(rawSlide?.visual, fallbackSlide.visual, 180, 8)
    };
  });
}

function sanitizePostFields(rawFields: PostFields | null | undefined, fallbackFields: PostFields) {
  return {
    conceito: chooseParagraph(rawFields?.conceito, fallbackFields.conceito, 320, 16),
    tituloPeca: chooseSingleLine(rawFields?.tituloPeca, fallbackFields.tituloPeca, 80, 4),
    textoApoio: chooseParagraph(rawFields?.textoApoio, fallbackFields.textoApoio, 220, 12),
    direcaoVisual: chooseParagraph(rawFields?.direcaoVisual, fallbackFields.direcaoVisual, 260, 14)
  };
}

function assertDraftUsability(draft: ScriptDraftResponse, contentType: string) {
  if (!draft.title || isPlaceholderText(draft.title)) {
    throw new Error('Nao foi possivel gerar um titulo utilizavel.');
  }

  if (contentType === 'stories') {
    if (!draft.storySlides?.length || draft.storySlides.some((slide) => [slide.textoTela, slide.falado, slide.visual].some(isPlaceholderText))) {
      throw new Error('Nao foi possivel gerar stories completos e preenchidos.');
    }
    return;
  }

  if (contentType === 'carrossel') {
    if (!draft.carrosselSlides?.length || draft.carrosselSlides.some((slide) => [slide.titulo, slide.subtitulo, slide.conteudo, slide.visual].some(isPlaceholderText))) {
      throw new Error('Nao foi possivel gerar um carrossel completo e preenchido.');
    }
    return;
  }

  if (contentType === 'post') {
    if (!draft.postFields || [draft.postFields.conceito, draft.postFields.tituloPeca, draft.postFields.textoApoio, draft.postFields.direcaoVisual, draft.caption, draft.cta].some(isPlaceholderText)) {
      throw new Error('Nao foi possivel gerar um post estatico completo e preenchido.');
    }
    return;
  }

  if ([draft.hook, draft.spoken, draft.cta, draft.caption].some(isPlaceholderText) || draft.takes.some(isPlaceholderText)) {
    throw new Error('Nao foi possivel gerar um roteiro completo e preenchido.');
  }
}

function sanitizeVariantDraft(raw: unknown, fallback: ScriptDraftResponse, contentType: string) {
  if (!raw || typeof raw !== 'object') {
    assertDraftUsability(fallback, contentType);
    return fallback;
  }

  const record = raw as Record<string, unknown>;

  if (contentType === 'stories') {
    const storySlides = sanitizeStorySlides(
      parseStoriesArray(record.stories ?? record.storySlides),
      fallback.storySlides ?? []
    );

    const draft = {
      ...fallback,
      title: chooseSingleLine(record.title, fallback.title, 80, 4),
      hook: chooseSingleLine(record.hook ?? storySlides[0]?.textoTela, fallback.hook, 120, 4),
      cta: chooseSingleLine(record.cta, fallback.cta, 180, 8),
      storySlides
    };

    assertDraftUsability(draft, contentType);
    return draft;
  }

  if (contentType === 'carrossel') {
    const carrosselSlides = sanitizeCarrosselSlides(
      parseCarrosselArray(record.slides ?? record.carrosselSlides),
      fallback.carrosselSlides ?? []
    );

    const draft = {
      ...fallback,
      title: chooseSingleLine(record.title, fallback.title, 80, 4),
      hook: chooseSingleLine(record.hook ?? carrosselSlides[0]?.titulo, fallback.hook, 120, 4),
      cta: chooseSingleLine(record.cta, fallback.cta, 180, 8),
      caption: chooseCaption(record.caption, fallback.caption),
      carrosselSlides
    };

    assertDraftUsability(draft, contentType);
    return draft;
  }

  if (contentType === 'post') {
    const postFields = sanitizePostFields(
      record.postFields && typeof record.postFields === 'object'
        ? (record.postFields as PostFields)
        : {
            conceito: typeof record.conceito === 'string' ? record.conceito : '',
            tituloPeca: typeof record.tituloPeca === 'string' ? record.tituloPeca : '',
            textoApoio: typeof record.textoApoio === 'string' ? record.textoApoio : '',
            direcaoVisual: typeof record.direcaoVisual === 'string' ? record.direcaoVisual : ''
          },
      fallback.postFields!
    );

    const draft = {
      ...fallback,
      title: chooseSingleLine(record.title, fallback.title, 80, 4),
      hook: chooseSingleLine(postFields.tituloPeca, fallback.hook, 80, 4),
      cta: chooseSingleLine(record.cta, fallback.cta, 180, 8),
      caption: chooseCaption(record.caption, fallback.caption),
      postFields
    };

    assertDraftUsability(draft, contentType);
    return draft;
  }

  const draft = normalizeScriptOutput(record, fallback);
  assertDraftUsability(draft, contentType);
  return draft;
}

function buildRewriteSchema(contentType: string, fallback: ScriptDraftResponse) {
  if (contentType === 'stories') {
    const slides = Array.from({ length: fallback.storySlides?.length ?? 3 }, () => `{"objetivo":"","textoTela":"","falado":"","visual":""}`).join(',');
    return `{"title":"","hook":"","stories":[${slides}],"cta":""}`;
  }

  if (contentType === 'carrossel') {
    const slides = Array.from({ length: fallback.carrosselSlides?.length ?? 5 }, (_, index) => `{"numero":${index + 1},"titulo":"","subtitulo":"","conteudo":"","visual":""}`).join(',');
    return `{"title":"","hook":"","slides":[${slides}],"cta":"","caption":""}`;
  }

  if (contentType === 'post') {
    return `{"title":"","conceito":"","tituloPeca":"","textoApoio":"","direcaoVisual":"","cta":"","caption":""}`;
  }

  return `{"title":"","hook":"","spoken":"","takes":["","","","",""],"cta":"","caption":""}`;
}

const roboticPhrasePatterns = [
  /organiza a base/i,
  /com intencao/i,
  /sem complicar/i,
  /de forma pratica/i,
  /solucao natural/i,
  /fica muito mais facil/i,
  /entra na rotina/i,
  /apoio concreto/i
];

function shouldPolishDraft(draft: ScriptDraftResponse, plan: ContentGenerationPlan) {
  let risk = 0;

  const fields = [
    draft.hook,
    draft.spoken,
    draft.cta,
    draft.caption,
    ...(draft.storySlides?.flatMap((slide) => [slide.textoTela, slide.falado]) ?? []),
    ...(draft.carrosselSlides?.flatMap((slide) => [slide.titulo, slide.conteudo]) ?? []),
    ...(draft.postFields ? [draft.postFields.conceito, draft.postFields.tituloPeca, draft.postFields.textoApoio] : [])
  ];

  if (fields.some((field) => roboticPhrasePatterns.some((pattern) => pattern.test(field)))) {
    risk += 2;
  }

  if ((draft.hook?.length ?? 0) > 100) {
    risk += 1;
  }

  if ((draft.spoken?.length ?? 0) > 600) {
    risk += 1;
  }

  if (plan.brief.tones.includes('storytelling') && !/(ate|quando|foi ai|foi aqui|eu achei|eu achava)/i.test(draft.spoken || draft.storySlides?.map((slide) => slide.falado).join(' ') || '')) {
    risk += 1;
  }

  if (plan.brief.tones.includes('trend') && !plan.trendPatterns.some((pattern) => draft.hook.toLowerCase().includes(pattern.label.toLowerCase()) || (draft.storySlides?.[0]?.textoTela ?? '').toLowerCase().includes(pattern.label.toLowerCase()))) {
    risk += 1;
  }

  return risk >= 2;
}

async function polishScriptVariantDraft(
  input: ScriptVariantInput,
  draft: ScriptDraftResponse,
  research: TrendResearchResult,
  plan: ContentGenerationPlan
) {
  if (!getProviderCandidates().length || !shouldPolishDraft(draft, plan)) {
    return draft;
  }

  const contentType = input.contentType ?? 'reels';
  const isTrend = resolveActiveTones(input.tones, input.tone).includes('trend');
  const isStorytelling = resolveActiveTones(input.tones, input.tone).includes('storytelling');
  const schema = buildRewriteSchema(contentType, draft);

  const prompt = [
    'Voce e um head writer brasileiro de Reels, Stories, TikTok, carrossel e copy de creator.',
    'Seu trabalho aqui nao e corrigir gramatica. Seu trabalho e transformar um rascunho em conteudo que da vontade de gravar e postar.',
    'Reescreva o material abaixo para soar como creator de verdade, nao como texto institucional ou propaganda antiga.',
    'Pense em retencao, curiosidade, ritmo, identificacao e potencial real de postagem.',
    'Se uma frase parecer escrita demais, reescreva em linguagem falada.',
    'Use frases curtas, cortes naturais, palavras simples e ritmo de video curto.',
    'O gancho precisa fazer a pessoa pensar "isso e comigo" ou "quero entender isso".',
    'Evite qualquer frase generica de IA, corporativa ou engessada.',
    'PROIBIDO usar expressoes como: "organiza a base", "com intencao", "sem complicar tudo", "de forma pratica", "solucao natural", "fica muito mais facil buscar", "entra na rotina".',
    isStorytelling
      ? 'Storytelling e obrigatorio: comece em uma situacao especifica, mostre o problema, revele a descoberta, crie uma virada clara, encaixe a solucao e feche com CTA.'
      : 'Mesmo sem storytelling explicito, mantenha micro-narrativa e progressao real de tensao.',
    isTrend
      ? `Trend e obrigatorio: escolha um formato nativo que mude de verdade a execucao do conteudo em ${resolveContentTypeLabel(contentType)}. Opcoes: POV, expectativa vs realidade, antes e depois, texto na tela + expressao, lista rapida, 3 coisas que..., ninguem fala isso sobre..., rotina revelada.`
      : 'Nao transforme em texto institucional. Mesmo fora de trend, precisa soar nativo de Instagram e TikTok.',
    'O produto entra como parte da virada ou da solucao, nunca como abertura de venda fria.',
    'Mantenha o conteudo gravavel, falavel e postavel.',
    'Nao use placeholders. Nao deixe campos vazios. Nao mude a quantidade de blocos/slides.',
    'Responda somente JSON valido.',
    `Formato de saida: ${schema}.`,
    '',
    '=== PESQUISA DE TENDENCIAS ===',
    formatTrendResearchForPrompt(research),
    '',
    '=== PLANO E BIBLIOTECAS ===',
    formatGenerationPlanForPrompt(plan),
    '',
    '=== BRIEFING ===',
    `Tipo de conteudo: ${resolveContentTypeLabel(contentType)}`,
    input.subOption ? `Subopcao: ${input.subOption}` : null,
    resolveTonesLabel(input.tones, input.tone),
    resolveObjectivesLabel(input.objectives, input.objective),
    ...buildBriefingLines(input),
    '',
    '=== RASCUNHO ATUAL PARA MELHORAR ===',
    JSON.stringify(draft, null, 2)
  ]
    .filter(Boolean)
    .join('\n\n');

  const refined = parseStructuredResponse(
    await callProvider(prompt, { maxTokens: resolvePolishMaxTokens(plan, contentType), providerMode: 'balanced' }),
    draft
  );
  return sanitizeVariantDraft(refined, draft, contentType);
}

function parseStoriesArray(raw: unknown): StorySlide[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      objetivo: typeof item.objetivo === 'string' ? item.objetivo : '',
      textoTela: typeof item.textoTela === 'string' ? item.textoTela : '',
      falado: typeof item.falado === 'string' ? item.falado : '',
      visual: typeof item.visual === 'string' ? item.visual : ''
    }));
}

function parseCarrosselArray(raw: unknown): CarrosselSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, i) => ({
      numero: typeof item.numero === 'number' ? item.numero : i + 1,
      titulo: typeof item.titulo === 'string' ? item.titulo : '',
      subtitulo: typeof item.subtitulo === 'string' ? item.subtitulo : '',
      conteudo: typeof item.conteudo === 'string' ? item.conteudo : '',
      visual: typeof item.visual === 'string' ? item.visual : ''
    }));
}

async function generateStoriesVariants(input: ScriptVariantInput): Promise<ScriptDraftResponse[]> {
  const plan = buildGenerationPlan(input);
  const n = Math.max(1, Math.min(10, parseInt(input.subOption ?? '3', 10) || 3));
  const slidesTemplate = Array.from({ length: n }, () => `{"objetivo":"","textoTela":"","falado":"","visual":""}`).join(',');
  const fallback = buildStoriesFallback(input, n, plan);
  const research = await researchContentTrends(input, plan);

  const prompt = [
    'Voce finaliza roteiros de Stories como creator brasileiro com foco em retencao e resposta.',
    'Escreva como story maker e social media, nao como anuncio ou texto institucional.',
    'Use linguagem falada, direta e nativa de Instagram.',
    'Responda somente JSON valido. Array com exatamente 1 sequencia de stories.',
    `Cada sequencia: {"title":"","stories":[${slidesTemplate}],"cta":""}`,
    `A sequencia deve ter exatamente ${n} story(ies).`,
    'Preencha todos os campos com conteudo final. Nunca use placeholders, colchetes, instrucoes ou textos genericos como "frase de gancho", "texto falado" ou "CTA aqui".',
    'Texto na tela com no maximo 8 palavras e impacto real.',
    'Falado em ate 2 frases por slide, com ritmo de selfie e cortes naturais.',
    `Story 1 precisa prender. Story ${n} precisa preparar a resposta ou direct.`,
    'Stories nao tem legenda. CTA vai no campo "cta".',
    '',
    '=== PLANO DA APLICACAO ===',
    formatGenerationPlanForPrompt(plan),
    '',
    '=== PESQUISA EXTERNA ===',
    formatTrendResearchForPrompt(research),
    '',
    '=== BRIEFING ===',
    ...buildBriefingLines(input)
  ].filter(Boolean).join('\n\n');

  const parsed = parseStructuredResponse<unknown[]>(
    await callProvider(prompt, { maxTokens: resolveGenerationMaxTokens(plan, 'stories'), providerMode: 'cost' }),
    []
  );
  const initialDraft = sanitizeVariantDraft(parsed[0], fallback, 'stories');
  return [await polishScriptVariantDraft(input, initialDraft, research, plan)];
}

async function generateCarrosselVariants(input: ScriptVariantInput): Promise<ScriptDraftResponse[]> {
  const plan = buildGenerationPlan(input);
  const n = Math.max(2, Math.min(15, parseInt(input.subOption ?? '5', 10) || 5));
  const slideTemplate = Array.from({ length: n }, (_, i) => `{"numero":${i + 1},"titulo":"","subtitulo":"","conteudo":"","visual":""}`).join(',');
  const fallback = buildCarrosselFallback(input, n, plan);
  const research = await researchContentTrends(input, plan);

  const prompt = [
    'Voce finaliza carrosseis como social media e copywriter de feed.',
    'Escreva carrosseis com cara de conteudo que gera swipe, salvamento e compartilhamento.',
    'Nada de texto institucional ou generico.',
    'Responda somente JSON valido. Array com exatamente 1 carrossel.',
    `Cada carrossel: {"title":"","hook":"","slides":[${slideTemplate}],"cta":"","caption":""}`,
    `O carrossel deve ter exatamente ${n} slides.`,
    'Preencha todos os campos com conteudo final. Nunca use placeholders, colchetes ou textos genericos como "titulo da capa", "subtitulo 2", "conteudo da pagina" ou "CTA aqui".',
    'Titulo com no maximo 6 palavras. Subtitulo com no maximo 10. Conteudo em 2 ou 3 linhas por pagina.',
    `Slide 1 precisa forcar o swipe. Slide ${n} precisa fechar com CTA claro.`,
    '',
    '=== PLANO DA APLICACAO ===',
    formatGenerationPlanForPrompt(plan),
    '',
    '=== PESQUISA EXTERNA ===',
    formatTrendResearchForPrompt(research),
    '',
    '=== BRIEFING ===',
    ...buildBriefingLines(input)
  ].filter(Boolean).join('\n\n');

  const parsed = parseStructuredResponse<unknown[]>(
    await callProvider(prompt, { maxTokens: resolveGenerationMaxTokens(plan, 'carrossel'), providerMode: 'cost' }),
    []
  );
  const initialDraft = sanitizeVariantDraft(parsed[0], fallback, 'carrossel');
  return [await polishScriptVariantDraft(input, initialDraft, research, plan)];
}

async function generatePostVariants(input: ScriptVariantInput): Promise<ScriptDraftResponse[]> {
  const plan = buildGenerationPlan(input);
  const fallback = buildPostFallback(input, plan);
  const research = await researchContentTrends(input, plan);

  const prompt = [
    'Voce finaliza posts estaticos de Instagram como social media e copywriter de creator.',
    'Seu trabalho e transformar uma estrutura pronta da aplicacao em uma peca que para o scroll e uma legenda que sustenta a tensao.',
    'Escreva com cara de conteudo atual, nao de campanha institucional.',
    'Responda somente JSON valido. Array com exatamente 1 post.',
    'Cada post: {"title":"","conceito":"","tituloPeca":"","textoApoio":"","direcaoVisual":"","cta":"","caption":""}',
    'Preencha todos os campos com conteudo final. Nunca use placeholders, colchetes ou textos genericos.',
    'tituloPeca: maximo 7 palavras e impacto imediato.',
    'textoApoio: maximo 12 palavras, complementa o titulo sem repetir.',
    'direcaoVisual: orientar o designer com composicao, tipografia, foto/ilustracao e mood.',
    'caption: abertura forte, 2 a 4 linhas curtas de valor, CTA e hashtags quando ajudarem.',
    'Se storytelling estiver ativo, o conceito nasce de uma situacao ou virada percebida.',
    'Se trend estiver ativo, adapte a linguagem visual e verbal para um formato que pareca nativo do feed agora.',
    '',
    '=== PLANO DA APLICACAO ===',
    formatGenerationPlanForPrompt(plan),
    '',
    '=== PESQUISA EXTERNA ===',
    formatTrendResearchForPrompt(research),
    '',
    '=== BRIEFING ===',
    ...buildBriefingLines(input),
    '',
    '=== ANGULO DO POST ===',
    'Escolha o angulo que melhor serve o briefing: crenca quebrada, frase de identificacao, dado curto ou mini-lista visual.'
  ].filter(Boolean).join('\n\n');

  const parsed = parseStructuredResponse<unknown[]>(
    await callProvider(prompt, { maxTokens: resolveGenerationMaxTokens(plan, 'post'), providerMode: 'cost' }),
    []
  );
  const initialDraft = sanitizeVariantDraft(parsed[0], fallback, 'post');
  return [await polishScriptVariantDraft(input, initialDraft, research, plan)];
}

export async function generateScriptVariants(input: ScriptVariantInput) {
  const contentType = input.contentType ?? 'reels';

  if (contentType === 'stories') return generateStoriesVariants(input);
  if (contentType === 'carrossel') return generateCarrosselVariants(input);
  if (contentType === 'post') return generatePostVariants(input);

  // Reels + video_curto — existing high-quality generator below
  return generateReelsVariants(input);
}

async function generateReelsVariants(input: ScriptVariantInput) {
  const plan = buildGenerationPlan(input);
  const contentTypeLabel = resolveContentTypeLabel(input.contentType);
  const durationLabel = resolveDurationLabel(input.duration ?? input.subOption);
  const fallback = [buildVideoFallback(input, plan)];
  const research = await researchContentTrends(input, plan);

  const prompt = [
    'Voce finaliza roteiros de Reels e video curto como creator, social media e copywriter de video curto.',
    'Seu trabalho e transformar a estrutura pronta da aplicacao em um roteiro gravavel, falavel e com cara de conteudo nativo.',
    'Nao escreva propaganda. Nao escreva texto institucional. Escreva para retencao, curiosidade e ritmo.',
    'Responda somente JSON valido. Array com exatamente 1 objeto.',
    'Formato: [{"title":"","hook":"","spoken":"","takes":["","","","",""],"cta":"","caption":""}]',
    'Preencha tudo com conteudo final. Nunca use placeholders, colchetes ou marcadores genericos.',
    'hook: maximo 12 palavras, sem saudacao, sem pergunta generica e sem abertura morna.',
    'spoken: linguagem oral pura, frases curtas, cortes naturais e ritmo de video curto.',
    'takes: instrucoes visuais para camera e edicao, nao texto falado.',
    'caption: abertura forte, 2 a 4 linhas curtas, CTA alinhado ao objetivo e hashtags especificas.',
    `Duracao alvo: ${durationLabel}.`,
    `Formato alvo: ${contentTypeLabel}.`,
    '',
    '=== PLANO DA APLICACAO ===',
    formatGenerationPlanForPrompt(plan),
    '',
    '=== PESQUISA EXTERNA ===',
    formatTrendResearchForPrompt(research),
    '',
    '=== BRIEFING ===',
    ...buildBriefingLines(input),
    '',
    '=== ANGULO DO ROTEIRO ===',
    plan.brief.tones.includes('trend')
      ? 'MODO TREND: escolha um formato nativo do momento e deixe esse formato mudar de verdade a estrutura do video.'
      : 'Escolha o melhor angulo entre historia real, contraste forte, erro comum ou curiosidade educativa.'
  ].filter(Boolean).join('\n\n');

  const parsed = parseStructuredResponse(
    await callProvider(prompt, { maxTokens: resolveGenerationMaxTokens(plan, input.contentType ?? 'reels'), providerMode: 'cost' }),
    fallback
  );
  const initialDraft = sanitizeVariantDraft(parsed[0], fallback[0], input.contentType ?? 'reels');
  return [await polishScriptVariantDraft(input, initialDraft, research, plan)];
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
  ], buildSocialTrendQuery(input.topic));

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
  ], buildSocialTrendQuery(input.theme));

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateCaption(input: { topic: string; tone?: string }) {
  const fallback = {
    caption: `Se voce quer ${input.topic.toLowerCase()}, comece por aqui.\n\nCompartilhe esta ideia com quem precisa de um caminho mais simples.\n\n#reels #instagram #marketingdigital #conteudo`
  };
  const prompt = await buildCreatorAiPrompt([
    'Voce escreve legendas em portugues do Brasil.',
    'Responda somente JSON valido.',
    'Formato esperado: {"caption":""}.',
    'A legenda precisa soar como post real de rede social, com abertura forte, quebra de linha, CTA e hashtags.',
    'Mantenha a legenda curta: 3 a 6 linhas, com hashtags no final.',
    `Tema: ${input.topic}`,
    `Tom: ${input.tone ?? 'natural'}`
  ], buildSocialTrendQuery(input.topic, input.tone));

  const parsed = parseStructuredResponse(await callProvider(prompt), fallback);
  return normalizeCaptionText(parsed.caption, 1400) || fallback.caption;
}

export async function rewriteHumanTone(input: { text: string }) {
  const fallback = { text: input.text };
  const prompt = [
    'Reescreva o texto abaixo como uma transcricao limpa para briefing, mantendo a intencao original.',
    'Corrija pontuacao, virgulas, quebras de linha, repeticoes e muletas de fala.',
    'Nao invente informacao nova e nao mude o sentido.',
    'Mantenha nomes, numeros, marcas e termos tecnicos.',
    'Responda somente JSON valido.',
    'Formato esperado: {"text":""}.',
    input.text
  ].join('\n\n');

  const parsed = parseStructuredResponse(await callProvider(prompt), fallback);
  return cleanParagraphText(parsed.text, 1800) || fallback.text;
}

export async function extractProductsFromSource(input: ProductImportInput) {
  const maxItems = input.maxItems ?? 80;
  const uploadedFile = await resolveProductImportFile(input.file);

  // Collect the full source text for grounding validation later
  const groundingText = [
    uploadedFile?.text,
    uploadedFile?.pageTexts?.join('\n\n'),
    input.sourceText,
    input.prompt
  ]
    .filter(Boolean)
    .join('\n\n');

  // Stage 1: Local structured parsing (no AI — fastest and most reliable)
  const localCandidates = uploadedFile?.pageTexts?.length
    ? extractCatalogProductsFromPages(uploadedFile.pageTexts, maxItems)
    : uploadedFile?.text
      ? extractProductImportRecordsFromText(uploadedFile.text, maxItems)
      : [];

  if (localCandidates.length) {
    return {
      products: localCandidates.slice(0, maxItems),
      _stage: 'local-parser'
    };
  }

  // Guard: If we have a file but extracted no text and no base64, report clearly
  if (input.file && !uploadedFile?.text && !uploadedFile?.pageTexts?.length && !uploadedFile?.base64 && !input.sourceText?.trim()) {
    return {
      products: [],
      _stage: 'extraction-failed',
      _error: 'Nao foi possivel extrair texto do arquivo enviado. O PDF pode conter apenas imagens ou estar protegido. Tente um PDF com texto selecionavel ou cole o conteudo no campo de texto.'
    };
  }

  // Stage 2: AI-based extraction with strict grounding prompt
  const prompt = await buildCreatorAiPrompt([
    'Voce organiza catalogos de produtos para um SaaS de operacao de conteudo.',
    'Responda somente JSON valido.',
    `Formato esperado: {"products":[{"name":"","benefits":"","audience":"","price":"","discountPrice":"","restrictions":""}]}.`,
    `Retorne no maximo ${maxItems} produtos.`,
    'REGRA CRITICA: Extraia SOMENTE produtos cujos nomes aparecem explicitamente no texto fornecido.',
    'NAO invente, deduza ou crie nomes de produtos que nao estejam no conteudo.',
    'Se um campo (beneficios, preco, etc.) nao estiver claro no texto, deixe-o vazio em vez de inventar.',
    'Se o conteudo nao contiver produtos identificaveis, retorne {"products":[]}.',
    'Prefira uma saida curta e util em vez de um relatorio longo.',
    input.prompt ? `Pedido do usuario: ${input.prompt}` : null,
    input.sourceText ? `Texto base: ${input.sourceText}` : null,
    uploadedFile?.name ? `Arquivo analisado: ${uploadedFile.name}` : input.file?.name ? `Arquivo analisado: ${input.file.name}` : null,
    uploadedFile?.text ? `Conteudo do arquivo:\n${uploadedFile.text}` : null,
    uploadedFile?.pageTexts?.length
      ? `Paginas extraidas:\n${uploadedFile.pageTexts
          .map((pageText, index) => `--- PAGINA ${index + 1} ---\n${pageText}`)
          .join('\n\n')}`
      : null
  ]);

  const anthropicContent =
    uploadedFile && !uploadedFile.pageTexts?.length && !uploadedFile.text ? buildAnthropicImportContent(uploadedFile, prompt) : null;
  const candidates: Array<{ provider: string; products: ProductImportRecord[] }> = [];

  // Token budget: ~300 tokens per product in JSON, so for maxItems products we need headroom
  const importMaxTokens = Math.min(8000, Math.max(3200, maxItems * 300));

  // Strategy A: Text-based AI extraction (only if we have text content)
  if ((uploadedFile?.text || uploadedFile?.pageTexts?.length) && (process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY)) {
    try {
      const textResponse = await callProvider(prompt, { maxTokens: importMaxTokens });
      if (textResponse) {
        candidates.push({
          provider: 'ai-text',
          products: extractProductImportRecordsFromResponse(textResponse, maxItems)
        });
      }
    } catch {
      // Keep going with the remaining strategies.
    }
  }

  // Strategy B: Vision-based Anthropic extraction (for image-only PDFs)
  if (anthropicContent && process.env.ANTHROPIC_API_KEY) {
    try {
      const payload = await callAnthropicMessages(anthropicContent, {
        temperature: 0.1,
        maxTokens: importMaxTokens
      });

      candidates.push({
        provider: 'anthropic',
        products: extractProductImportRecordsFromResponse(extractAnthropicResponse(payload).text || null, maxItems)
      });
    } catch {
      // Fallback to the other providers below.
    }
  }

  // Strategy C: Vision-based Gemini extraction
  if (uploadedFile?.base64 && process.env.GEMINI_API_KEY) {
    try {
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
      ], { maxTokens: importMaxTokens });

      candidates.push({
        provider: 'gemini',
        products: extractProductImportRecordsFromResponse(response, maxItems)
      });
    } catch {
      // Fall back below.
    }
  }

  // Strategy D: Only run fallback if no candidates produced results
  const hasAnyCandidateProducts = candidates.some((c) => c.products.length > 0);
  if (!hasAnyCandidateProducts) {
    try {
      const response = await callProvider(prompt, { maxTokens: importMaxTokens });
      candidates.push({
        provider: 'fallback',
        products: extractProductImportRecordsFromResponse(response, maxItems)
      });
    } catch {
      // No more strategies available.
    }
  }

  // Apply grounding validation to ALL AI candidates — remove hallucinated products
  const groundedCandidates = candidates.map((candidate) => ({
    ...candidate,
    products: filterGroundedProducts(candidate.products, groundingText)
  }));

  // Rank candidates — vision providers get higher bonus since they see the actual document
  const rankedCandidates = groundedCandidates
    .map((candidate) => ({
      ...candidate,
      score:
        scoreProductImportRecords(candidate.products) +
        (candidate.provider === 'anthropic' ? 6 : candidate.provider === 'gemini' ? 4 : candidate.provider === 'ai-text' ? 3 : 0)
    }))
    .sort((left, right) => right.score - left.score || right.products.length - left.products.length);

  const bestCandidate = rankedCandidates[0]?.products ?? [];
  if (bestCandidate.length) {
    return {
      products: bestCandidate.slice(0, maxItems),
      _stage: `ai-${rankedCandidates[0]?.provider ?? 'unknown'}`
    };
  }

  // Last resort: text-based parsing of whatever content we have
  const fallbackText = uploadedFile?.text ?? input.sourceText ?? input.prompt ?? '';
  const fallbackProducts = extractProductImportRecordsFromText(fallbackText, maxItems);

  return {
    products: fallbackProducts,
    _stage: fallbackProducts.length ? 'text-fallback' : 'no-products-found',
    _error: fallbackProducts.length ? undefined : 'Nenhum produto identificado no conteudo enviado. Verifique se o arquivo contem nomes de produtos, precos ou descricoes.'
  };
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

function isStructuredCompetitorAnalysis(value: unknown): value is CompetitorAnalysis {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.model === 'string' &&
    !!candidate.overview &&
    Array.isArray(candidate.sections) &&
    !!candidate.practicalSuggestions &&
    !!candidate.sourceSnapshot
  );
}

export async function organizeCompetitorAnalysis(input: CompetitorAnalysisInput): Promise<CompetitorAnalysis> {
  const fallback = buildCompetitorAnalysisFallback(input);
  const summary = summarizeCompetitorAnalysisInput(input);
  const validatedSignals = input.signalReview
    ? [
        `Signal review validado: ${JSON.stringify({
          status: input.signalReview.status,
          transcriptCoverage: input.signalReview.transcriptCoverage,
          reelsTotal: input.signalReview.reelsTotal,
          reelsTranscribed: input.signalReview.reelsTranscribed,
          hooks: input.signalReview.hooks.slice(0, 10),
          ctas: input.signalReview.ctas.slice(0, 10),
          themes: input.signalReview.themes.slice(0, 10),
          actions: input.signalReview.actions.slice(0, 6)
        })}`
      ]
    : [];

  const prompt = [
    ...getCreatorAiBaseRules(),
    'Voce organiza inteligencia competitiva para social media e creator economy.',
    'Nao invente fatos. Use apenas os sinais capturados e inferencias prudentes.',
    'Priorize transcript, screen text e legenda na ordem de confianca. Se a confidenceLevel vier baixa, use linguagem de hipotese e evite conclusoes fortes.',
    'Se houver signalReview validado, priorize hooks, CTAs, themes e actions vindos dele. Nao transforme legenda em gancho se o transcript nao sustentar essa leitura.',
    'Quero analise utilizavel para producao de conteudo, nao um texto generico.',
    'Responda somente JSON valido.',
    'Formato esperado:',
    '{"generatedAt":"","model":"","overview":{"toneOfVoice":"","positioning":"","apparentAudience":"","visualStyle":""},"sections":[{"id":"","title":"","description":"","items":[{"id":"","kind":"","title":"","summary":"","rationale":"","tags":[""],"hookType":"","ctaType":"","format":"","sample":"","sourceUrl":"","confidenceLevel":"medium"}]}],"practicalSuggestions":{"toContent":[""],"toCreatorAi":[""],"toReferenceBank":[""]},"sourceSnapshot":{"fetchedAt":"","instagram":null,"website":null,"postsAnalyzed":0,"reelsAnalyzed":0,"feedAnalyzed":0,"captureNotes":[""],"topPosts":[]}}',
    'Crie secoes exatamente com estes ids: actions, ideas, engineering, overview, patterns, adaptation.',
    'A ordem final de prioridade deve ser: actions, ideas, engineering, overview, patterns, adaptation.',
    'Cada secao deve ter de 2 a 5 itens realmente acionaveis.',
    'A secao actions deve priorizar chamadas praticas como gerar conteudos, salvar no banco, enviar para Creator AI e adicionar ao repertorio.',
    'A secao engineering deve ser um resumo operacional rapido com duracao media, cadencia, abertura, CTA, gravacao, prova social, cenarios, formatos e sinais de trend. Se nao houver dado, use "Dados insuficientes" compactamente, nao como card grande.',
    'A secao ideas deve ser concreta e separada por tipo, com linguagem de creator, sem texto de relatorio e sem conclusoes infladas.',
    'Cada item deve trazer confidenceLevel como high, medium ou low para deixar claro o peso da evidência.',
    'Os itens de ideas, hook, cta, engineering e action devem soar como algo que um social media usaria na pratica.',
    'Se houver sourceUrl no sample, preserve.',
    ...validatedSignals,
    `Dados capturados:\n${JSON.stringify(summary)}`
  ].join('\n\n');

  const response = await callProvider(prompt, {
    maxTokens: 2200,
    providerMode: 'balanced'
  });

  const parsed = parseStructuredResponse<CompetitorAnalysis>(response, fallback);

  if (!isStructuredCompetitorAnalysis(parsed)) {
    return fallback;
  }

  return {
    ...parsed,
    generatedAt: parsed.generatedAt || fallback.generatedAt,
    model: parsed.model || 'hybrid-ai',
    signalReview: input.signalReview ?? null,
    sections: parsed.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        confidenceLevel:
          item.confidenceLevel || (input.facts.confidenceLevel === 'high' ? 'high' : 'low')
      }))
    }))
  };
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
  const conversationText = [input.prompt, input.context, input.history?.map((message) => message.content).join(' ') ?? ''].join(' ');
  const useWebSearch = shouldUseWebSearch(conversationText);
  const includeSources = shouldShowSources(conversationText);
  const intent = detectChatIntent(input.prompt, input.context, input.history);
  const historyText = input.history?.length
    ? `Historico recente da conversa:\n${input.history
        .slice(-12)
        .map((message) => `${message.role === 'user' ? 'Usuario' : 'Creator AI'}: ${message.content}`)
        .join('\n')}`
    : null;

  const promptContext = [
    input.workspace ? `Workspace atual: ${input.workspace}` : null,
    input.context ? `Contexto: ${input.context}` : null,
    historyText,
    `Pedido do usuario: ${input.prompt}`,
    useWebSearch ? 'Use o web_search para validar referencias atuais, datas e contexto recente antes de responder.' : null,
    'Objetivo: ajudar a criar conteudo, organizar operacao, revisar ideias e sugerir proximos passos acionaveis.'
  ];

  const prompt = [
    ...getCreatorAiBaseRules(),
    ...promptContext,
    ...buildChatStyleInstructions(intent, includeSources)
  ]
    .filter(Boolean)
    .join('\n\n');

  if (useWebSearch && process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await callAnthropicWithWebSearch(prompt, {
        temperature: intent === 'hooks' ? 0.25 : 0.35,
        maxTokens: intent === 'hooks' ? 700 : intent === 'trend' ? 1000 : 1200
      });

      if (response && (response.text || response.sources.length)) {
        const answer = response.text?.trim() ?? '';
        const sources = includeSources ? formatWebSources(response.sources) : '';
        const combined = [answer, sources].filter(Boolean).join('\n\n');

        if (combined) {
          return combined;
        }

        if (includeSources && response.sources.length) {
          return formatWebSources(response.sources);
        }

        return 'Posso refinar isso com mais contexto.';
      }
    } catch {
      // Fall back to the regular provider chain below.
    }
  }

  const webContext = useWebSearch ? await buildWebContextResult(conversationText) : null;
  const fallbackPrompt = [
    ...getCreatorAiBaseRules(),
    webContext?.summary ? `Contexto web:\n${webContext.summary}` : null,
    ...promptContext,
    ...buildChatStyleInstructions(intent, includeSources)
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await callProvider(fallbackPrompt);

  if (response) {
    if (includeSources && webContext?.sources.length) {
      return [response.trim(), formatWebSources(webContext.sources)].join('\n\n');
    }

    return response;
  }

  return `Posso ajudar com ideias, roteiros, stories, metricas, concorrentes e calendario. Para: ${input.prompt}`;
}
