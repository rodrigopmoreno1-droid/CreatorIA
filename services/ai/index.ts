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

async function callProvider(prompt: string, options?: { maxTokens?: number }) {
  const providers = getProviderCandidates();

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
      // Fallback to the light web search scraper below.
    }
  }

  const results = await searchWeb(prompt);

  if (!results.length) {
    return null;
  }

  return {
    summary: results
      .slice(0, 4)
      .map((result) => `- ${result.title}: ${result.snippet}`)
      .join('\n'),
    sources: results.map((result) => ({
      title: result.title,
      url: result.url
    }))
  };
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

function buildVideoFallback(input: ScriptVariantInput): ScriptDraftResponse {
  const brief = buildBriefSeed(input);
  const theme = lowerFirst(brief.topic || brief.problem || brief.benefit || 'esse tema');
  const productMention = brief.product || 'a solucao certa';
  const audienceMention = lowerFirst(brief.audience || 'quem vive isso');

  return {
    title: `${input.contentType === 'video_curto' ? 'Video curto' : 'Reels'} - ${brief.product || brief.shortBenefit}`,
    hook: chooseSingleLine(
      `Se voce quer ${brief.shortBenefit}, talvez esteja insistindo no caminho errado.`,
      `Se voce quer ${theme}, talvez esteja insistindo no caminho errado.`,
      120,
      10
    ),
    spoken: `Se ${lowerFirst(brief.problem)}, o ponto nao costuma ser falta de esforco. Normalmente o bloqueio esta em repetir uma estrategia que nao conversa com a sua rotina. Quando voce entende isso, fica mais facil buscar ${lowerFirst(brief.benefit)} com mais clareza e menos excesso. Foi exatamente por isso que ${productMention} entrou como apoio real para ${audienceMention}.`,
    takes: [
      'Close no rosto, olhando direto para a camera com expressao de alerta',
      `Texto na tela destacando o erro mais comum sobre ${theme}`,
      `Corte mostrando o momento em que ${productMention} entra na rotina`,
      `B-roll com prova visual ligada a ${brief.shortBenefit}`,
      'Fechamento com CTA direto, olho na camera e gesto chamando para a acao'
    ],
    cta: `Se isso fez sentido para voce, me chama no direct e eu te mostro como aplicar isso com ${productMention}.`,
    caption: `O problema quase nunca e querer demais. O problema e repetir uma estrategia que nao conversa com a sua rotina.\n\nSe ${lowerFirst(brief.problem)}, vale ajustar a base antes de desistir.\n\nMe chama no direct se quiser entender como ${productMention} entra nisso de forma pratica.\n\n${buildHashtags(brief.product, brief.benefit, brief.problem)}`
  };
}

function buildStoriesFallback(input: ScriptVariantInput, count: number): ScriptDraftResponse {
  const brief = buildBriefSeed(input);
  const productMention = brief.product || 'essa solucao';
  const slides: StorySlide[] = [];

  const templates: StorySlide[] = [
    {
      objetivo: 'gancho',
      textoTela: 'O erro que trava seu resultado',
      falado: `Se ${lowerFirst(brief.problem)}, tem um ponto que quase sempre passa batido e trava seu resultado.`,
      visual: 'Selfie olhando direto para a camera, com texto forte ocupando o centro da tela'
    },
    {
      objetivo: 'contexto',
      textoTela: 'Nao e falta de esforco',
      falado: `Na maioria das vezes, o problema nao e disciplina. E insistir em um caminho que nao conversa com a sua rotina.`,
      visual: 'Plano medio, corte limpo, com apoio de texto curto reforcando a quebra de crenca'
    },
    {
      objetivo: 'revelacao',
      textoTela: clipWords(`${brief.shortProduct} entra aqui`, 5, 34) || 'A solucao entra aqui',
      falado: `Quando voce organiza a base e usa ${productMention} com intencao, fica muito mais facil buscar ${lowerFirst(brief.benefit)} sem complicar tudo.`,
      visual: `B-roll do produto ${brief.product ? 'em uso' : 'ou da rotina'} com detalhes bem proximos`
    },
    {
      objetivo: 'prova',
      textoTela: clipWords(`Mais clareza para ${brief.shortBenefit}`, 6, 40) || 'Mais clareza no processo',
      falado: `O ganho aqui e ter mais consistencia, mais clareza e um processo que voce realmente consegue manter.`,
      visual: 'Mistura de selfie com apoio visual simples mostrando rotina, resultado ou anotacoes'
    },
    {
      objetivo: 'cta',
      textoTela: 'Me chama no direct',
      falado: `Se quiser, me chama e eu te explico como aplicar isso no seu caso com ${productMention}.`,
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
    hook: slides[0]?.textoTela || 'Story com gancho forte',
    spoken: '',
    takes: [],
    cta: `Responde "quero" que eu te explico como ${productMention} entra nisso.`,
    caption: '',
    storySlides: slides
  };
}

function buildCarrosselFallback(input: ScriptVariantInput, count: number): ScriptDraftResponse {
  const brief = buildBriefSeed(input);
  const productMention = brief.product || 'essa solucao';
  const slides = Array.from({ length: count }, (_, index): CarrosselSlide => {
    if (index === 0) {
      return {
        numero: 1,
        titulo: 'O erro que trava seu resultado',
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
        conteudo: `Salva este carrossel e me chama se quiser aplicar isso com ${productMention} de forma pratica.`,
        visual: 'Slide final com CTA visivel, destaque para salvar, compartilhar ou chamar no direct'
      };
    }

    const middleBlocks = [
      {
        titulo: 'O problema real',
        subtitulo: 'Nao e o que parece',
        conteudo: `Na maior parte dos casos, o bloqueio vem de insistir em um caminho que nao conversa com a sua rotina.`,
        visual: 'Layout limpo com um contraste entre erro comum e causa real'
      },
      {
        titulo: 'A virada pratica',
        subtitulo: `${clipWords(productMention, 4, 28)} entra aqui`,
        conteudo: `Quando voce ajusta a base e usa ${productMention}, fica mais facil buscar ${lowerFirst(brief.benefit)} com consistencia.`,
        visual: 'Foto ou detalhe do produto apoiando a explicacao, com destaque visual para a mudanca'
      },
      {
        titulo: 'O que isso destrava',
        subtitulo: brief.shortBenefit,
        conteudo: `O ganho real e ter mais clareza, menos excesso e um processo que voce consegue sustentar no dia a dia.`,
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
    hook: slides[0]?.titulo || 'Carrossel com capa forte',
    spoken: '',
    takes: [],
    cta: `Salva esse carrossel e me chama para entender como ${productMention} entra na estrategia.`,
    caption: `Tem coisa que parece falta de disciplina, mas na pratica e estrategia errada repetida por tempo demais.\n\nEste carrossel mostra onde costuma estar o travamento e como ajustar isso com mais clareza.\n\nSalva e manda para quem precisa ver isso hoje.\n\n${buildHashtags(brief.product, brief.problem, brief.benefit)}`,
    carrosselSlides: slides
  };
}

function buildPostFallback(input: ScriptVariantInput): ScriptDraftResponse {
  const brief = buildBriefSeed(input);
  const productMention = brief.product || 'essa solucao';

  return {
    title: `Post - ${brief.product || brief.shortBenefit}`,
    hook: clipWords(`Nao e falta de disciplina`, 5, 36) || 'Nao e falta de disciplina',
    spoken: '',
    takes: [],
    cta: `Salva esse post e me chama se quiser aplicar isso com ${productMention}.`,
    caption: `O ponto nem sempre e fazer mais. Muitas vezes e ajustar o caminho para buscar ${lowerFirst(brief.benefit)} com mais estrategia.\n\nSe ${lowerFirst(brief.problem)}, talvez o travamento esteja na abordagem, nao na sua vontade.\n\nSalva e me chama se quiser destravar isso com mais clareza.\n\n${buildHashtags(brief.product, brief.problem, brief.benefit)}`,
    postFields: {
      conceito: `Quebra de crenca mostrando que ${lowerFirst(brief.problem)} nao se resolve com excesso, e sim com ajuste inteligente.`,
      tituloPeca: 'Nao e falta de disciplina',
      textoApoio: `O travamento pode estar no metodo, nao em voce.`,
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
  const n = Math.max(1, Math.min(10, parseInt(input.subOption ?? '3', 10) || 3));
  const toneLabel = resolveTonesLabel(input.tones, input.tone);
  const objectiveLabel = resolveObjectivesLabel(input.objectives, input.objective);
  const slidesTemplate = Array.from({ length: n }, () => `{"objetivo":"","textoTela":"","falado":"","visual":""}`).join(',');
  const fallback = buildStoriesFallback(input, n);

  const webQuery = buildSocialTrendQuery(input.productName ?? input.prompt, input.pain ?? '', input.benefit ?? '', 'stories instagram viral');

  const prompt = await buildCreatorAiPrompt([
    '=== PAPEL ===',
    'Voce e um creator especialista em Stories do Instagram com altissimo engajamento.',
    'Stories sao slides curtos, diretos, com progressao narrativa que prende o usuario.',
    '',
    '=== FORMATO DE RESPOSTA ===',
    'Responda somente JSON valido. Array com exatamente 1 sequencia de stories.',
    `Cada sequencia: {"title":"","stories":[${slidesTemplate}],"cta":""}`,
    `A sequencia deve ter exatamente ${n} story(ies).`,
    'Preencha todos os campos com conteudo final. Nunca use placeholders, colchetes, instrucoes ou textos genericos como "frase de gancho", "texto falado" ou "CTA aqui".',
    '',
    '=== REGRAS DOS STORIES ===',
    'textoTela: texto escrito na tela do story. Max 8 palavras. Deve ser MUITO impactante. Sem pontuacao excessiva.',
    'falado: o que o creator fala nesse slide. Max 2 frases curtas. Linguagem oral, conversa real.',
    'objetivo: papel do slide (opcoes: gancho, contexto, tensao, revelacao, prova, solucao, CTA).',
    'visual: instrucao para o editor (ex: "selfie falando", "fundo escuro texto branco", "video de produto em uso").',
    `Story 1: gancho visual forte que faz a pessoa querer ver o proximo.`,
    `Stories 2 a ${n - 1}: progressao com valor real. Cada slide = 1 ideia.`,
    `Story ${n}: CTA especifico e alinhado ao objetivo.`,
    'Stories NAO tem legenda. CTA vai no campo "cta", nao no ultimo slide.',
    '',
    `=== ESTILO E OBJETIVO ===`,
    `${toneLabel}`,
    `${objectiveLabel}`,
    '',
    '=== BRIEFING ===',
    ...buildBriefingLines(input),
    '',
    '=== ANGULO DA SEQUENCIA ===',
    'Escolha o angulo mais forte para o briefing dado: REVELACAO (primeiro story faz promessa ou dado surpreendente), POV/HISTORIA (começa com POV que o publico se identifica) ou LISTA/ENSINO (entrega valor direto em passos).',
    'Use o angulo que melhor serve o objetivo e o publico descrito no briefing.'
  ], webQuery);

  const parsed = parseStructuredResponse<unknown[]>(await callProvider(prompt, { maxTokens: 3200 }), []);
  return [0].map((i) => {
    const fb = fallback;
    const raw = parsed[i];
    if (!raw || typeof raw !== 'object') {
      assertDraftUsability(fb, 'stories');
      return fb;
    }
    const r = raw as Record<string, unknown>;
    const storySlides = sanitizeStorySlides(parseStoriesArray(r.stories), fb.storySlides ?? []);
    const draft = {
      ...fb,
      title: chooseSingleLine(r.title, fb.title, 80, 4),
      hook: chooseSingleLine(storySlides[0]?.textoTela || r.hook, fb.hook, 120, 4),
      cta: chooseSingleLine(r.cta, fb.cta, 180, 8),
      storySlides
    };

    assertDraftUsability(draft, 'stories');
    return draft;
  });
}

async function generateCarrosselVariants(input: ScriptVariantInput): Promise<ScriptDraftResponse[]> {
  const n = Math.max(2, Math.min(15, parseInt(input.subOption ?? '5', 10) || 5));
  const toneLabel = resolveTonesLabel(input.tones, input.tone);
  const objectiveLabel = resolveObjectivesLabel(input.objectives, input.objective);
  const slideTemplate = Array.from({ length: n }, (_, i) => `{"numero":${i + 1},"titulo":"","subtitulo":"","conteudo":"","visual":""}`).join(',');
  const fallback = buildCarrosselFallback(input, n);

  const webQuery = buildSocialTrendQuery(input.productName ?? input.prompt, input.pain ?? '', input.benefit ?? '', 'carrossel instagram viral');

  const maxTokens = n > 6 ? 5000 : 3200;

  const prompt = await buildCreatorAiPrompt([
    '=== PAPEL ===',
    'Voce e um especialista em carrosseis de alta performance para Instagram.',
    'Seus carrosseis tem altissimo rate de salvamento e compartilhamento.',
    '',
    '=== FORMATO DE RESPOSTA ===',
    'Responda somente JSON valido. Array com exatamente 1 carrossel.',
    `Cada carrossel: {"title":"","hook":"","slides":[${slideTemplate}],"cta":"","caption":""}`,
    `O carrossel deve ter exatamente ${n} slides.`,
    'Preencha todos os campos com conteudo final. Nunca use placeholders, colchetes ou textos genericos como "titulo da capa", "subtitulo 2", "conteudo da pagina" ou "CTA aqui".',
    '',
    '=== REGRAS DO CARROSSEL ===',
    'titulo: texto curto da pagina. Max 6 palavras. Impacto imediato.',
    'subtitulo: complemento do titulo. Max 10 palavras. Promessa ou contexto.',
    'conteudo: texto principal da pagina. 2 a 3 linhas diretas. Valor concreto.',
    'visual: instrucao para o designer (ex: "fundo azul, icone de check", "foto de resultado", "numero em destaque").',
    `Slide 1 (capa): titulo que FORCA o swipe. Hook que cria curiosidade irresistivel.`,
    `Slides 2 a ${n - 1}: cada slide entrega 1 insight ou passo especifico. Sem repeticao.`,
    `Slide ${n}: CTA especifico — salvar, compartilhar, DM, link.`,
    'caption: legenda da publicacao com abertura forte (diferente do hook), valor resumido, CTA e hashtags.',
    '',
    `=== ESTILO E OBJETIVO ===`,
    `${toneLabel}`,
    `${objectiveLabel}`,
    '',
    '=== BRIEFING ===',
    ...buildBriefingLines(input),
    '',
    '=== ANGULO DO CARROSSEL ===',
    'Escolha o angulo mais forte para o briefing dado: LISTA DE ERROS/MITOS (desmonta crencas erradas, cada slide = 1 mito + correcao), PASSO A PASSO (guia pratico do problema a solucao) ou COMPARATIVO (antes vs depois, contraste visual).',
    'Use o angulo que melhor serve o objetivo e o publico descrito no briefing.'
  ], webQuery);

  const parsed = parseStructuredResponse<unknown[]>(await callProvider(prompt, { maxTokens }), []);
  return [0].map((i) => {
    const fb = fallback;
    const raw = parsed[i];
    if (!raw || typeof raw !== 'object') {
      assertDraftUsability(fb, 'carrossel');
      return fb;
    }
    const r = raw as Record<string, unknown>;
    const carrosselSlides = sanitizeCarrosselSlides(parseCarrosselArray(r.slides), fb.carrosselSlides ?? []);
    const draft = {
      ...fb,
      title: chooseSingleLine(r.title, fb.title, 80, 4),
      hook: chooseSingleLine(r.hook ?? carrosselSlides[0]?.titulo, fb.hook, 120, 4),
      cta: chooseSingleLine(r.cta, fb.cta, 180, 8),
      caption: chooseCaption(r.caption, fb.caption),
      carrosselSlides
    };

    assertDraftUsability(draft, 'carrossel');
    return draft;
  });
}

async function generatePostVariants(input: ScriptVariantInput): Promise<ScriptDraftResponse[]> {
  const toneLabel = resolveTonesLabel(input.tones, input.tone);
  const objectiveLabel = resolveObjectivesLabel(input.objectives, input.objective);
  const fallback = buildPostFallback(input);

  const webQuery = buildSocialTrendQuery(input.productName ?? input.prompt, input.pain ?? '', input.benefit ?? '', 'post estatico instagram viral');

  const prompt = await buildCreatorAiPrompt([
    '=== PAPEL ===',
    'Voce e um especialista em posts estaticos de alto impacto para Instagram.',
    'Seus posts param o scroll e geram salvamentos.',
    '',
    '=== FORMATO DE RESPOSTA ===',
    'Responda somente JSON valido. Array com exatamente 1 conceito de post.',
    'Cada post: {"title":"","conceito":"","tituloPeca":"","textoApoio":"","direcaoVisual":"","cta":"","caption":""}',
    'Preencha todos os campos com conteudo final. Nunca use placeholders, colchetes ou textos genericos como "titulo impactante", "legenda aqui" ou "conceito do post".',
    '',
    '=== REGRAS DO POST ESTATICO ===',
    'conceito: a ideia central em 1 frase. Para briefing do designer.',
    'tituloPeca: texto principal da imagem. Max 7 palavras. MUITO impactante. Deve parar o scroll.',
    'textoApoio: texto secundario da peca. Max 12 palavras. Complementa o titulo, nao repete.',
    'direcaoVisual: instrucao detalhada para o designer. Inclui: paleta, composicao, foto ou ilustracao, mood.',
    'cta: chamada para acao na legenda (salvar, compartilhar, comentar, etc).',
    'caption: legenda completa. Abertura forte (diferente do tituloPeca), 2-4 linhas de valor, CTA, hashtags.',
    '',
    `=== ESTILO E OBJETIVO ===`,
    `${toneLabel}`,
    `${objectiveLabel}`,
    '',
    '=== BRIEFING ===',
    ...buildBriefingLines(input),
    '',
    '=== ANGULO DO POST ===',
    'Escolha o angulo mais forte para o briefing dado: DADO/ESTATISTICA (numero ou fato surpreendente como titulo), FRASE/CRENCA (frase que quebra uma crenca ou valida uma experiencia) ou LISTA VISUAL (mini-ranking ou lista com valor imediato).',
    'Use o angulo que melhor serve o objetivo e o publico descrito no briefing.'
  ], webQuery);

  const parsed = parseStructuredResponse<unknown[]>(await callProvider(prompt, { maxTokens: 2500 }), []);
  return [0].map((i) => {
    const fb = fallback;
    const raw = parsed[i];
    if (!raw || typeof raw !== 'object') {
      assertDraftUsability(fb, 'post');
      return fb;
    }
    const r = raw as Record<string, unknown>;
    const postFields = sanitizePostFields(
      {
        conceito: typeof r.conceito === 'string' ? r.conceito : '',
        tituloPeca: typeof r.tituloPeca === 'string' ? r.tituloPeca : '',
        textoApoio: typeof r.textoApoio === 'string' ? r.textoApoio : '',
        direcaoVisual: typeof r.direcaoVisual === 'string' ? r.direcaoVisual : ''
      },
      fb.postFields!
    );
    const draft = {
      ...fb,
      title: chooseSingleLine(r.title, fb.title, 80, 4),
      hook: chooseSingleLine(postFields.tituloPeca, fb.hook, 80, 4),
      cta: chooseSingleLine(r.cta, fb.cta, 180, 8),
      caption: chooseCaption(r.caption, fb.caption),
      postFields
    };

    assertDraftUsability(draft, 'post');
    return draft;
  });
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
  const contentTypeLabel = resolveContentTypeLabel(input.contentType);
  const durationLabel = resolveDurationLabel(input.duration ?? input.subOption);
  const toneLabel = resolveTonesLabel(input.tones, input.tone);
  const objectiveLabel = resolveObjectivesLabel(input.objectives, input.objective);
  const isTrend = input.tones?.includes('trend') || input.tone === 'trend';

  const fallback = [buildVideoFallback(input)];

  const webQuery = buildSocialTrendQuery(
    input.productName ?? input.prompt,
    input.pain ?? '',
    input.benefit ?? '',
    isTrend ? 'formato viral trend reels tiktok POV antes depois expectativa realidade rotina' : 'reels virais tiktok tendencias conteudo'
  );

  const prompt = await buildCreatorAiPrompt([
    '=== PAPEL ===',
    'Voce e um creator brasileiro com mais de 1 milhao de seguidores.',
    'Voce sabe fazer videos que as pessoas assistem ate o final, salvam e compartilham.',
    'Voce NUNCA escreve propaganda. Voce cria conteudo que as pessoas querem ver.',
    'Voce pensa como creator, storyteller e social media — nao como redator de publicidade.',
    '',
    '=== FORMATO DE RESPOSTA ===',
    'Responda somente JSON valido. Array com exatamente 1 objeto.',
    'Formato: [{"title":"","hook":"","spoken":"","takes":["","","","",""],"cta":"","caption":""}]',
    'Preencha tudo com conteudo final. Nunca use placeholders, colchetes ou marcadores como "gancho aqui", "[X]", "texto falado" ou "CTA aqui".',
    '',
    '=== MENTALIDADE AO ESCREVER ===',
    'Antes de escrever, pergunte: "Uma pessoa real assistiria esse video ate o final?" Se a resposta nao for SIM imediato, reescreva.',
    'O produto e a solucao natural da historia — nunca o centro dela.',
    'A historia vem primeiro. O produto entra como revelacao, nao como apresentacao.',
    'Seja especifico. "Perdi 6kg em 8 semanas sem cortar carboidrato" e melhor que "emagreci".',
    'Crie tensao. Use "mas entao aconteceu algo que eu nao esperava" ou equivalente.',
    '',
    '=== REGRAS DO HOOK (PRIMEIROS 3 SEGUNDOS) ===',
    'O hook e a unica frase que decide se a pessoa fica ou vai embora.',
    'NUNCA comece com: pergunta ("Voce ja tentou?"), "Ola", "Hoje vou falar", saudacao ou apresentacao.',
    'Formatos que funcionam (escolha um diferente por variacao):',
    '  - Statement contrariante curto: "A maioria das pessoas faz isso errado."',
    '  - Inicio de historia especifica: "Fiz [X] por [tempo] sem resultado. Ate descobrir [Y]."',
    '  - Curiosity gap: "O que ninguem te conta sobre [tema]."',
    '  - Dado surpreendente: "[numero ou fato inesperado] — e isso muda tudo."',
    '  - Contraste/virada: "Parei de fazer [coisa obvia]. Resultado: [resultado inesperado]."',
    '  - POV especifico: "POV: [situacao exata que o publico vive]"',
    'Maximo 12 palavras. Sem ponto de interrogacao.',
    '',
    '=== REGRAS DO SPOKEN ===',
    'Linguagem oral pura. Virgulas para pausas naturais. Ponto para parada completa.',
    'Zero bullets, headers ou linguagem escrita.',
    'PROIBIDO usar: "eu sei como e", "ja passei por isso", "o que mudou tudo foi quando", "produto incrivel".',
    'Frases curtas. Ritmo de conversa. Como se estivesse contando para um amigo, nao gravando.',
    'Respeite o limite de palavras da duracao.',
    '',
    '=== REGRAS DOS TAKES ===',
    'Takes sao instrucoes VISUAIS para o editor, nao texto falado.',
    'Cada take descreve o que a camera ve ou o que aparece na tela.',
    'Exemplos: "Close no rosto, expressao de surpresa", "Corte para tela do celular com resultado", "Texto na tela: [frase]", "B-roll: produto em uso no dia a dia".',
    '',
    '=== REGRAS DA CAPTION ===',
    'Abertura forte que complementa (nao repete) o hook.',
    '2 a 4 linhas curtas de valor real.',
    'CTA alinhado ao objetivo.',
    'Hashtags relevantes ao nicho — especificas, nao genericas.',
    '',
    '=== BRIEFING ===',
    `Tipo de conteudo: ${contentTypeLabel}`,
    input.subOption ? `Especificacao: ${input.subOption}` : null,
    `Duracao alvo: ${durationLabel}`,
    `Estilo e tom: ${toneLabel}`,
    `Objetivo: ${objectiveLabel}`,
    isTrend
      ? 'MODO TREND ATIVO: identifique 3 formatos virais diferentes do momento (POV, antes/depois filmado, rotina revelada, expectativa vs realidade, ranking ironico, dueto imaginario, etc). Cada variacao usa um formato trend diferente. O formato define a ESTRUTURA — o produto entra naturalmente dentro dele. Priorize alcance e compartilhamento.'
      : null,
    input.pain ? `Dor central do publico: ${input.pain}` : null,
    input.benefit ? `Transformacao que o produto entrega: ${input.benefit}` : null,
    input.targetAudience ? `Publico-alvo: ${input.targetAudience}` : null,
    input.productName ? `Produto: ${input.productName}` : null,
    input.productContext ? `Contexto do produto: ${input.productContext}` : null,
    input.referenceContext ? `Referencias adicionais: ${input.referenceContext}` : null,
    input.prompt ? `Instrucao extra: ${input.prompt}` : null,
    '',
    '=== ANGULO DO ROTEIRO ===',
    isTrend
      ? 'MODO TREND: escolha o formato viral mais relevante para o briefing (ex: POV, antes/depois filmado, rotina revelada, expectativa vs realidade, ranking ironico). O formato define a estrutura — o produto entra naturalmente dentro dele.'
      : 'Escolha o angulo mais forte para o briefing: HISTORIA PESSOAL (situacao especifica e real, produto como revelacao no meio), DADO E CONTRASTE (fato surpreendente ou contraste inesperado, produto como prova) ou CURIOSIDADE E EDUCACAO (curiosity gap, ensina algo util, produto como ferramenta).',
    'Use dados e formatos virais captados na busca web quando fortalecerem o gancho.',
    'Se nao houver dados reais disponiveis, invente uma historia verossimil especifica — nao generica.'
  ], webQuery);

  const parsed = parseStructuredResponse(await callProvider(prompt, { maxTokens: 3200 }), fallback);
  return fallback.map((item, index) => {
    const draft = normalizeScriptOutput(parsed[index], item);
    assertDraftUsability(draft, input.contentType ?? 'reels');
    return draft;
  });
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
