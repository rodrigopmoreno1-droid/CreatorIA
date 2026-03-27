import type {
  CompetitorAnalysis,
  CompetitorCapturedPost,
  CompetitorCaptureSource,
  CompetitorConfidenceLevel,
  CompetitorContentFormat,
  CompetitorDataQuality,
  CompetitorInsight,
  CompetitorRecord,
  CompetitorSourceSnapshot,
  ContentReferenceRecord
} from '@/types/competitor-intelligence';
import { fetchApifyInstagramCapture } from '@/services/integrations/apify';
import { transcribeMediaFromUrl } from '@/services/integrations/media-transcription';

type RawInstagramNode = Record<string, unknown>;

export type CompetitorAnalysisFacts = {
  recurringThemes: string[];
  formatMix: Array<{ format: CompetitorContentFormat; count: number; share: number }>;
  hookPatterns: string[];
  ctaPatterns: string[];
  storytellingPatterns: string[];
  toneHints: string[];
  visualHints: string[];
  cadenceLabel: string;
  averageVideoDuration: number | null;
  transcriptCount: number;
  captionCount: number;
  screenTextCount: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  topAngles: string[];
  topCaptions: string[];
};

export type CompetitorAnalysisInput = {
  competitor: Pick<CompetitorRecord, 'id' | 'name' | 'handle' | 'website' | 'type' | 'niche' | 'notes' | 'logoUrl' | 'tags'>;
  snapshot: CompetitorSourceSnapshot;
  facts: CompetitorAnalysisFacts;
};

type InstagramSnapshotData = {
  handle: string;
  bio: string;
  fullName: string;
  followers: number;
  following: number;
  postsCount: number;
  reelsCount: number;
  verified: boolean;
  externalUrl: string;
  profilePicUrl: string;
  posts: CompetitorCapturedPost[];
  captureNotes?: string[];
};

export type CompetitorDataQualityAssessment = {
  quality: CompetitorDataQuality;
  enoughForAi: boolean;
  reason: string;
  stats: {
    posts: number;
    captions: number;
    transcripts: number;
    screenTexts: number;
    reels: number;
    feed: number;
    characters: number;
  };
};

const INSTAGRAM_APP_ID = '936619743392459';
const WEBSITE_USER_AGENT = 'Mozilla/5.0 (CreatorAI; +https://creator-ia.vercel.app)';
const WORD_STOPLIST = new Set([
  'a', 'o', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com',
  'sem', 'uma', 'um', 'umas', 'uns', 'que', 'isso', 'essa', 'esse', 'esta', 'este', 'mais', 'menos', 'muito',
  'muita', 'sobre', 'como', 'quando', 'onde', 'porque', 'entre', 'pra', 'pro', 'se', 'ao', 'aos', 'ou', 'the',
  'and', 'for', 'with', 'your', 'you', 'this', 'that', 'from', 'are', 'our', 'their', 'its', 'just', 'into'
]);
const MIN_COMPETITOR_POSTS_FOR_AI = 2;
const MIN_COMPETITOR_CAPTIONS_FOR_AI = 2;
const MIN_COMPETITOR_TEXT_LENGTH_FOR_AI = 280;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function buildInsightId(prefix: string, seed: string) {
  return `${prefix}_${slugify(seed) || Math.random().toString(36).slice(2, 8)}`;
}

function normalizeConfidenceLevel(value: unknown): CompetitorConfidenceLevel {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium';
}

function deriveInsightConfidenceLevel(
  facts: CompetitorAnalysisFacts,
  sourceUrl: string,
  summary: string,
  kind: CompetitorInsight['kind']
): CompetitorConfidenceLevel {
  const normalizedSummary = normalizeText(summary).toLowerCase();

  if (/nao observavel|nao ficou evidente|sem volume suficiente|a captura ja foi persistida/i.test(normalizedSummary)) {
    return 'low';
  }

  if (facts.confidenceLevel === 'high') {
    return sourceUrl ? 'high' : kind === 'overview' || kind === 'engineering' ? 'medium' : 'high';
  }

  if (facts.confidenceLevel === 'medium') {
    return sourceUrl ? 'medium' : 'low';
  }

  return sourceUrl ? 'medium' : 'low';
}

export function normalizeInstagramHandle(handle: string) {
  return handle.replace(/^@/, '').trim().toLowerCase();
}

export function normalizeWebsiteUrl(website: string) {
  const trimmed = website.trim();

  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getObject(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getNestedArray(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(key, 10);
      current = Number.isNaN(index) ? undefined : current[index];
      continue;
    }

    current = getObject(current)?.[key];
  }

  return Array.isArray(current) ? current : [];
}

function getNestedString(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(key, 10);
      current = Number.isNaN(index) ? undefined : current[index];
      continue;
    }

    current = getObject(current)?.[key];
  }

  return normalizeText(current);
}

function parseInstagramHeaders(handle: string) {
  return {
    'user-agent': 'Mozilla/5.0',
    'x-ig-app-id': INSTAGRAM_APP_ID,
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    referer: `https://www.instagram.com/${handle}/`,
    origin: 'https://www.instagram.com',
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty'
  };
}

function firstCaptionLine(caption: string) {
  return normalizeWhitespace(
    caption
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  ).slice(0, 160);
}

function firstTranscriptLine(text: string) {
  return normalizeWhitespace(
    text
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  ).slice(0, 240);
}

function buildPostEvidenceText(post: CompetitorCapturedPost) {
  return normalizeWhitespace(
    [
      post.transcriptText,
      post.screenTextLead,
      post.caption,
      post.accessibilityCaption,
      post.captionLead
    ]
      .filter(Boolean)
      .join('\n')
  );
}

function buildPostUrl(shortcode: string, format: CompetitorContentFormat) {
  if (!shortcode) {
    return '';
  }

  if (format === 'reels') {
    return `https://www.instagram.com/reel/${shortcode}/`;
  }

  if (format === 'video') {
    return `https://www.instagram.com/tv/${shortcode}/`;
  }

  return `https://www.instagram.com/p/${shortcode}/`;
}

function inferFormat(node: RawInstagramNode): CompetitorContentFormat {
  const productType = normalizeText(node.product_type).toLowerCase();
  const typename = normalizeText(node.__typename).toLowerCase();
  const isVideo = Boolean(node.is_video);

  if (productType === 'clips') {
    return 'reels';
  }

  if (productType === 'igtv') {
    return 'video';
  }

  if (typename === 'graphsidecar') {
    return 'carrossel';
  }

  if (isVideo) {
    return 'video';
  }

  if (typename === 'graphimage') {
    return 'image';
  }

  return 'unknown';
}

function detectHookPattern(text: string) {
  const lead = firstCaptionLine(text).toLowerCase();

  if (!lead) {
    return 'abertura direta';
  }

  if (/^pov[:\s-]/i.test(lead)) {
    return 'POV';
  }

  if (/^\d+/.test(lead)) {
    return 'lista numerada';
  }

  if (/\?/.test(lead)) {
    return 'pergunta';
  }

  if (/(ningu[eé]m|quase ningu[eé]m|pouca gente)/i.test(lead)) {
    return 'segredo';
  }

  if (/(erro|errado|pare de)/i.test(lead)) {
    return 'erro comum';
  }

  if (/(antes|depois)/i.test(lead)) {
    return 'antes e depois';
  }

  if (/^(como|how to|guia)/i.test(lead)) {
    return 'tutorial';
  }

  if (/(eu |meu |minha |achei que|descobri|quando eu)/i.test(lead)) {
    return 'relato pessoal';
  }

  return 'abertura direta';
}

function detectCtaPatterns(text: string) {
  const source = text.toLowerCase();
  const patterns = new Set<string>();

  if (/(comenta|coment[eá]|deixa aqui nos comentarios|me conta)/i.test(source)) {
    patterns.add('comentarios');
  }
  if (/(salva|guarda|save this|salve)/i.test(source)) {
    patterns.add('salvar');
  }
  if (/(compartilha|manda para|envie para|share)/i.test(source)) {
    patterns.add('compartilhar');
  }
  if (/(segue|follow|acompanha)/i.test(source)) {
    patterns.add('seguir');
  }
  if (/(direct|dm|me chama|manda mensagem|whatsapp|link na bio)/i.test(source)) {
    patterns.add('dm');
  }
  if (/(site|compre|garanta|reserve|saiba mais|acesse)/i.test(source)) {
    patterns.add('conversao');
  }

  return [...patterns];
}

function detectStorytellingPatterns(text: string) {
  const source = text.toLowerCase();
  const patterns = new Set<string>();

  if (/(eu |meu |minha |quando eu|ate que|descobri)/i.test(source)) {
    patterns.add('historia pessoal');
  }

  if (/(antes|depois|mudou|transformou)/i.test(source)) {
    patterns.add('transformacao');
  }

  if (/(problema|solucao|resultado|funcionou)/i.test(source)) {
    patterns.add('problema-solucao');
  }

  if (/(bastidor|behind the scenes|por tras)/i.test(source)) {
    patterns.add('bastidor');
  }

  if (/(cliente|prova|depoimento|resultado real)/i.test(source)) {
    patterns.add('prova social');
  }

  return [...patterns];
}

function computeEngagementScore(metrics: { likes: number; comments: number; views: number }) {
  return metrics.likes + metrics.comments * 12 + metrics.views * 0.03;
}

function mapInstagramNode(node: RawInstagramNode) {
  const format = inferFormat(node);
  const caption = getNestedString(node, ['edge_media_to_caption', 'edges', '0', 'node', 'text']);
  const likes = toNumber(getObject(node.edge_media_preview_like)?.count || getObject(node.edge_liked_by)?.count);
  const comments = toNumber(getObject(node.edge_media_to_comment)?.count);
  const views = toNumber(node.video_view_count);
  const durationSeconds = pickApifyDurationSeconds(
    node,
    ['video_duration', 'videoDuration', 'duration', 'duration_seconds', 'durationSeconds'],
    ['video_duration_ms', 'videoDurationMs', 'duration_ms', 'durationMs']
  );
  const metrics = {
    likes,
    comments,
    views,
    engagementScore: computeEngagementScore({ likes, comments, views }),
    durationSeconds
  };
  const accessibilityCaption = normalizeText(node.accessibility_caption);
  const screenTextLead = firstTranscriptLine(accessibilityCaption);
  const transcriptText = '';
  const transcriptStatus: CompetitorCapturedPost['transcriptStatus'] = 'missing';
  const transcriptSource: CompetitorCapturedPost['transcriptSource'] = 'none';
  const transcriptConfidence = null;
  const transcriptError = 'Sem transcript disponivel na captura direta.';
  const evidenceText = normalizeWhitespace([transcriptText, screenTextLead, caption, accessibilityCaption].filter(Boolean).join('\n'));

  const mapped: CompetitorCapturedPost = {
    id: normalizeText(node.id),
    shortcode: normalizeText(node.shortcode),
    sourceUrl: buildPostUrl(normalizeText(node.shortcode), format),
    format,
    caption,
    captionLead: firstCaptionLine(caption),
    thumbnailUrl: normalizeText(node.thumbnail_src) || normalizeText(node.display_url),
    mediaUrl: normalizeText(node.video_url) || normalizeText(node.display_url),
    postedAt: (() => {
      const timestamp = toNumber(node.taken_at_timestamp);
      return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
    })(),
    metrics,
    accessibilityCaption,
    transcriptText,
    transcriptStatus,
    transcriptSource,
    transcriptConfidence,
    transcriptError,
    screenTextLead,
    hookPattern: detectHookPattern(evidenceText),
    ctaPatterns: detectCtaPatterns(evidenceText),
    storytellingPatterns: detectStorytellingPatterns(evidenceText)
  };

  return mapped;
}

function uniquePosts(posts: CompetitorCapturedPost[]) {
  const seen = new Set<string>();
  const unique: CompetitorCapturedPost[] = [];

  for (const post of posts) {
    const key = post.id || post.shortcode || post.sourceUrl;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(post);
  }

  return unique;
}

function resolveRelativeUrl(value: string, baseUrl: string) {
  if (!value) {
    return '';
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function extractMetaContent(html: string, key: string, attribute = 'property') {
  const pattern = new RegExp(`<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const alternate = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${key}["'][^>]*>`, 'i');
  const match = html.match(pattern) ?? html.match(alternate);
  return normalizeText(match?.[1] ?? '');
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return normalizeWhitespace(match?.[1] ?? '');
}

function extractFirstMatch(html: string, regex: RegExp) {
  const match = html.match(regex);
  return normalizeText(match?.[1] ?? '');
}

function firstNonEmptyText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return normalizeText(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function pickApifyField(node: RawInstagramNode, keys: string[]) {
  for (const key of keys) {
    const value = node[key];
    if (typeof value === 'string' && value.trim()) {
      return normalizeText(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function pickApifyNumber(node: RawInstagramNode, keys: string[]) {
  for (const key of keys) {
    const value = node[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function pickApifyDurationSeconds(node: RawInstagramNode, secondsKeys: string[], millisecondsKeys: string[] = []) {
  for (const key of secondsKeys) {
    const value = node[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  for (const key of millisecondsKeys) {
    const value = node[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value / 1000;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed / 1000;
      }
    }
  }

  return null;
}

function pickApifyArray(node: RawInstagramNode, keys: string[]) {
  for (const key of keys) {
    const value = node[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function collectApifyText(node: RawInstagramNode) {
  const texts: string[] = [];

  const caption = firstNonEmptyText(
    pickApifyField(node, ['caption', 'text', 'description', 'fullDescription', 'mediaCaption', 'title']),
    getNestedString(node, ['edge_media_to_caption', 'edges', '0', 'node', 'text'])
  );

  if (caption) {
    texts.push(caption);
  }

  const transcript = firstNonEmptyText(
    pickApifyField(node, ['transcript', 'transcriptText', 'subtitle', 'accessibilityCaption', 'altText']),
    getNestedString(node, ['accessibility_caption'])
  );

  if (transcript && transcript !== caption) {
    texts.push(transcript);
  }

  const hashtags = pickApifyArray(node, ['hashtags', 'tags']);
  hashtags.forEach((tag) => {
    if (typeof tag === 'string' && tag.trim()) {
      texts.push(tag);
    }
  });

  return texts.join('\n');
}

function inferApifyFormat(node: RawInstagramNode): CompetitorContentFormat {
  const explicit = normalizeText(
    pickApifyField(node, ['format', 'postType', 'mediaType', 'contentType', 'type'])
  ).toLowerCase();
  const isVideo = Boolean(node.is_video || node.isVideo || node.video_url || node.videoUrl);
  const shortcode = normalizeText(
    pickApifyField(node, ['shortcode', 'shortCode', 'code'])
  );

  if (/(reel|reels|clip|video)/i.test(explicit)) {
    return explicit.includes('reel') ? 'reels' : 'video';
  }
  if (/(carousel|carrossel)/i.test(explicit)) {
    return 'carrossel';
  }
  if (/(image|photo|post|feed)/i.test(explicit)) {
    return 'image';
  }
  if (isVideo) {
    return shortcode.startsWith('C') ? 'reels' : 'video';
  }
  return 'unknown';
}

function buildApifyPostUrl(shortcode: string, format: CompetitorContentFormat) {
  if (!shortcode) {
    return '';
  }

  if (format === 'reels') {
    return `https://www.instagram.com/reel/${shortcode}/`;
  }

  if (format === 'video') {
    return `https://www.instagram.com/tv/${shortcode}/`;
  }

  return `https://www.instagram.com/p/${shortcode}/`;
}

function mapApifyPost(node: RawInstagramNode, overrideFormat?: CompetitorContentFormat): CompetitorCapturedPost | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const format = overrideFormat ?? inferApifyFormat(node);
  const shortcode = normalizeText(
    pickApifyField(node, ['shortcode', 'shortCode', 'code', 'id', 'mediaCode'])
  );
  const caption = normalizeWhitespace(
    firstNonEmptyText(
      pickApifyField(node, ['caption', 'text', 'description', 'fullDescription', 'mediaCaption', 'title']),
      getNestedString(node, ['edge_media_to_caption', 'edges', '0', 'node', 'text'])
    )
  );
  const likes = pickApifyNumber(node, ['likes', 'likeCount', 'likesCount', 'likes_count', 'edge_media_preview_like_count', 'edge_media_preview_like']);
  const comments = pickApifyNumber(node, ['comments', 'commentCount', 'commentsCount', 'comments_count', 'edge_media_to_comment_count', 'edge_media_to_comment']);
  const views = pickApifyNumber(node, ['views', 'viewCount', 'video_view_count', 'videoViewCount', 'playCount']);
  const durationSeconds = pickApifyDurationSeconds(
    node,
    ['video_duration', 'videoDuration', 'duration', 'duration_seconds', 'durationSeconds'],
    ['video_duration_ms', 'videoDurationMs', 'duration_ms', 'durationMs']
  );
  const timestampRaw = pickApifyField(node, ['taken_at_timestamp', 'timestamp', 'takenAtTimestamp', 'createdAt', 'publishedAt', 'date']);
  const timestamp = Number(timestampRaw);
  const postedAt = Number.isFinite(timestamp)
    ? new Date(timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000).toISOString()
    : new Date().toISOString();
  const thumbnailUrl = normalizeText(
    pickApifyField(node, ['thumbnailUrl', 'thumbnail_url', 'thumbnail', 'displayUrl', 'display_url', 'imageUrl', 'image_url'])
  );
  const mediaUrl = normalizeText(
    pickApifyField(node, ['videoUrl', 'video_url', 'url', 'mediaUrl', 'media_url'])
  );
  const transcriptText = normalizeWhitespace(
    firstNonEmptyText(
      pickApifyField(node, ['transcript', 'transcriptText', 'subtitle', 'speechText', 'spokenText']),
      getNestedString(node, ['transcript'])
    )
  );
  const screenTextLead = firstTranscriptLine(
    normalizeWhitespace(
      firstNonEmptyText(
        pickApifyField(node, ['onScreenText', 'screenText', 'visualText', 'textOnScreen', 'overlayText']),
        getNestedString(node, ['accessibility_caption'])
      )
    )
  );
  const sourceUrl = normalizeText(
    pickApifyField(node, ['url', 'postUrl', 'permalink', 'sourceUrl'])
  ) || buildApifyPostUrl(shortcode, format);
  const accessibilityCaption = normalizeWhitespace(
    firstNonEmptyText(
      pickApifyField(node, ['transcript', 'transcriptText', 'subtitle', 'accessibilityCaption', 'altText', 'caption']),
      getNestedString(node, ['accessibility_caption'])
    )
  );
  const transcriptStatus: CompetitorCapturedPost['transcriptStatus'] = transcriptText ? 'success' : 'missing';
  const transcriptSource: CompetitorCapturedPost['transcriptSource'] = transcriptText ? 'apify' : 'none';
  const transcriptConfidence = transcriptText ? 0.9 : null;
  const transcriptError = transcriptText ? '' : 'Sem transcript disponivel neste item.';
  const evidenceText = normalizeWhitespace([transcriptText, screenTextLead, caption, accessibilityCaption].filter(Boolean).join('\n'));

  return {
    id: normalizeText(pickApifyField(node, ['id', 'mediaId', 'pk'])) || shortcode || sourceUrl || buildInsightId('apify', `post-${caption}`),
    shortcode,
    sourceUrl,
    format,
    caption,
    captionLead: firstCaptionLine(caption),
    thumbnailUrl,
    mediaUrl,
    postedAt,
    metrics: {
      likes,
      comments,
      views,
      engagementScore: computeEngagementScore({ likes, comments, views }),
      durationSeconds
    },
    accessibilityCaption,
    transcriptText,
    transcriptStatus,
    transcriptSource,
    transcriptConfidence,
    transcriptError,
    screenTextLead,
    hookPattern: detectHookPattern(evidenceText),
    ctaPatterns: detectCtaPatterns(evidenceText),
    storytellingPatterns: detectStorytellingPatterns(evidenceText)
  };
}

function mapApifyProfileItem(profile: RawInstagramNode) {
  const latestPosts = pickApifyArray(profile, ['latest_posts', 'posts', 'latestPosts', 'media']);
  const nestedPosts = latestPosts
    .map((entry) => (entry && typeof entry === 'object' ? mapApifyPost(entry as RawInstagramNode) : null))
    .filter((post): post is CompetitorCapturedPost => Boolean(post));

  return {
    handle: normalizeText(
      firstNonEmptyText(
        pickApifyField(profile, ['username', 'handle']),
        getNestedString(profile, ['username'])
      )
    ),
    bio: normalizeText(pickApifyField(profile, ['bio', 'biography', 'description'])),
    fullName: normalizeText(pickApifyField(profile, ['name', 'full_name', 'fullName'])),
    followers: pickApifyNumber(profile, ['followers', 'follower_count', 'followerCount']),
    following: pickApifyNumber(profile, ['follows', 'following', 'following_count', 'followingCount']),
    postsCount: pickApifyNumber(profile, ['posts_count', 'post_count', 'image_count', 'video_count', 'edge_owner_to_timeline_media_count']),
    reelsCount: pickApifyNumber(profile, ['reels_count', 'reel_count', 'reelsCount']),
    verified: Boolean(profile.is_verified ?? profile.isVerified),
    externalUrl: normalizeText(pickApifyField(profile, ['homepage', 'external_url', 'website', 'url'])),
    profilePicUrl: normalizeText(pickApifyField(profile, ['profile_image', 'profile_pic_url_hd', 'profile_pic_url', 'profilePictureUrl'])),
    posts: nestedPosts
  };
}

async function fetchWebsiteSnapshot(website: string) {
  const normalized = normalizeWebsiteUrl(website);

  if (!normalized) {
    return null;
  }

  try {
    const response = await fetch(normalized, {
      headers: { 'user-agent': WEBSITE_USER_AGENT },
      redirect: 'follow',
      cache: 'no-store'
    });

    if (!response.ok) {
      return null;
    }

    const finalUrl = response.url || normalized;
    const html = await response.text();
    const iconHref =
      extractFirstMatch(html, /<link[^>]+rel=["'][^"']*(?:icon|shortcut icon)[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
      extractFirstMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:icon|shortcut icon)[^"']*["']/i);
    const ogImage = extractMetaContent(html, 'og:image');
    const description = extractMetaContent(html, 'description', 'name') || extractMetaContent(html, 'og:description');
    const title = extractTitle(html) || extractMetaContent(html, 'og:title');

    return {
      url: finalUrl,
      title,
      description,
      iconUrl: resolveRelativeUrl(iconHref, finalUrl) || resolveRelativeUrl('/favicon.ico', finalUrl),
      logoUrl: resolveRelativeUrl(ogImage, finalUrl) || resolveRelativeUrl(iconHref, finalUrl)
    };
  } catch {
    return null;
  }
}

async function fetchInstagramSnapshot(handle: string): Promise<InstagramSnapshotData | null> {
  const normalized = normalizeInstagramHandle(handle);

  if (!normalized) {
    return null;
  }

  try {
    const response = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalized)}`,
      {
        headers: parseInstagramHeaders(normalized),
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = JSON.parse(await response.text()) as { data?: { user?: Record<string, unknown> } };
    const user = payload.data?.user;

    if (!user || normalizeText(user.username).toLowerCase() !== normalized) {
      return null;
    }

    const timelinePosts = getNestedArray(user, ['edge_owner_to_timeline_media', 'edges'])
      .map((entry) => getObject(entry)?.node)
      .map((node) => (getObject(node) ? mapInstagramNode(getObject(node) as RawInstagramNode) : null))
      .filter((post): post is CompetitorCapturedPost => Boolean(post));

    const reelPosts = getNestedArray(user, ['edge_felix_video_timeline', 'edges'])
      .map((entry) => getObject(entry)?.node)
      .map((node) => (getObject(node) ? mapInstagramNode(getObject(node) as RawInstagramNode) : null))
      .filter((post): post is CompetitorCapturedPost => Boolean(post));

    const posts = uniquePosts([...timelinePosts, ...reelPosts]).sort((left, right) => right.postedAt.localeCompare(left.postedAt));

    return {
      handle: normalized,
      bio: normalizeText(user.biography),
      fullName: normalizeText(user.full_name),
      followers: toNumber(getObject(user.edge_followed_by)?.count),
      following: toNumber(getObject(user.edge_follow)?.count),
      postsCount: toNumber(getObject(user.edge_owner_to_timeline_media)?.count),
      reelsCount: toNumber(getObject(user.edge_felix_video_timeline)?.count),
      verified: Boolean(user.is_verified),
      externalUrl: normalizeText(user.external_url),
      profilePicUrl: normalizeText(user.profile_pic_url_hd) || normalizeText(user.profile_pic_url),
      posts
    };
  } catch {
    return null;
  }
}

async function fetchInstagramSnapshotFromApify(handle: string, deep = false): Promise<InstagramSnapshotData | null> {
  const capture = await fetchApifyInstagramCapture(handle, { deep });

  if (!capture) {
    return null;
  }

  const profile = capture.profile ? mapApifyProfileItem(capture.profile) : null;
  const profilePosts = profile?.posts ?? [];
  const actorPosts = deep
    ? capture.posts.map((item) => mapApifyPost(item)).filter((post): post is CompetitorCapturedPost => Boolean(post))
    : [];
  const reelPosts = deep
    ? capture.reels.map((item) => mapApifyPost(item, 'reels')).filter((post): post is CompetitorCapturedPost => Boolean(post))
    : [];
  const mergedPosts = uniquePosts([...profilePosts, ...actorPosts, ...reelPosts])
    .sort((left, right) => right.postedAt.localeCompare(left.postedAt));

  if (!profile && !mergedPosts.length) {
    return null;
  }

  const followers = profile?.followers ?? 0;
  const following = profile?.following ?? 0;
  const postsCount = Math.max(
    profile?.postsCount ?? 0,
    profilePosts.length,
    actorPosts.length,
    mergedPosts.length
  );
  const reelsCount = Math.max(
    profile?.reelsCount ?? 0,
    reelPosts.length,
    mergedPosts.filter((post) => post.format === 'reels' || post.format === 'video').length
  );

  return {
    handle: profile?.handle ?? normalizeInstagramHandle(handle),
    bio: profile?.bio ?? '',
    fullName: profile?.fullName ?? '',
    followers,
    following,
    postsCount,
    reelsCount,
    verified: profile?.verified ?? false,
    externalUrl: profile?.externalUrl ?? '',
    profilePicUrl: profile?.profilePicUrl ?? '',
    posts: mergedPosts,
    captureNotes: [
      'Captura realizada com Apify.',
      deep
        ? 'Instagram Profile Scraper, Instagram Post Scraper e Instagram Reel Scraper usados na coleta.'
        : 'Instagram Profile Scraper usado na captura leve.',
      ...capture.notes
    ]
  };
}

function mergeInstagramSnapshots(primary: InstagramSnapshotData | null, fallback: InstagramSnapshotData | null): InstagramSnapshotData | null {
  if (!primary && !fallback) {
    return null;
  }

  if (!primary) {
    return fallback;
  }

  if (!fallback) {
    return primary;
  }

  const mergedPosts = uniquePosts([...primary.posts, ...fallback.posts]).sort((left, right) => right.postedAt.localeCompare(left.postedAt));

  return {
    handle: primary.handle || fallback.handle,
    bio: primary.bio || fallback.bio,
    fullName: primary.fullName || fallback.fullName,
    followers: Math.max(primary.followers, fallback.followers),
    following: Math.max(primary.following, fallback.following),
    postsCount: Math.max(primary.postsCount, fallback.postsCount, mergedPosts.length),
    reelsCount: Math.max(primary.reelsCount, fallback.reelsCount, mergedPosts.filter((post) => post.format === 'reels' || post.format === 'video').length),
    verified: primary.verified || fallback.verified,
    externalUrl: primary.externalUrl || fallback.externalUrl,
    profilePicUrl: primary.profilePicUrl || fallback.profilePicUrl,
    posts: mergedPosts,
    captureNotes: [...(primary.captureNotes ?? []), ...(fallback.captureNotes ?? [])]
  };
}

function tokenize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 4 && !WORD_STOPLIST.has(token));
}

function topRepeatedTerms(texts: string[], limit = 8) {
  const frequency = new Map<string, number>();

  texts.forEach((text) => {
    const uniqueTokens = new Set(tokenize(text));
    uniqueTokens.forEach((token) => frequency.set(token, (frequency.get(token) ?? 0) + 1));
  });

  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'pt-BR'))
    .slice(0, limit)
    .map(([token]) => token);
}

function topCounts(items: string[], limit = 5) {
  const frequency = new Map<string, number>();

  items.forEach((item) => {
    const normalized = normalizeText(item);
    if (!normalized) {
      return;
    }
    frequency.set(normalized, (frequency.get(normalized) ?? 0) + 1);
  });

  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'pt-BR'))
    .slice(0, limit)
    .map(([item]) => item);
}

function formatMix(posts: CompetitorCapturedPost[]) {
  const counts = new Map<CompetitorContentFormat, number>();
  posts.forEach((post) => counts.set(post.format, (counts.get(post.format) ?? 0) + 1));

  return [...counts.entries()]
    .map(([format, count]) => ({
      format,
      count,
      share: posts.length ? count / posts.length : 0
    }))
    .sort((left, right) => right.count - left.count);
}

function cadenceLabel(posts: CompetitorCapturedPost[]) {
  if (posts.length < 2) {
    return 'cadencia ainda insuficiente para leitura confiavel';
  }

  const sorted = [...posts]
    .map((post) => new Date(post.postedAt).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left);

  let totalDiff = 0;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    totalDiff += Math.abs(sorted[index] - sorted[index + 1]);
  }

  const avgDays = totalDiff / Math.max(1, sorted.length - 1) / (1000 * 60 * 60 * 24);

  if (avgDays <= 1.5) {
    return 'publicacao praticamente diaria';
  }
  if (avgDays <= 3.5) {
    return 'ritmo consistente de 2 a 4 publicacoes por semana';
  }
  if (avgDays <= 7) {
    return 'cadencia semanal moderada';
  }
  return 'publicacao mais espaçada';
}

function averageVideoDurationSeconds(posts: CompetitorCapturedPost[]) {
  const durations = posts
    .filter((post) => post.format === 'reels' || post.format === 'video')
    .map((post) => post.metrics.durationSeconds)
    .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration > 0);

  if (!durations.length) {
    return null;
  }

  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return total / durations.length;
}

function toneHintsFromTexts(texts: string[]) {
  const source = texts.join('\n').toLowerCase();
  const hints = new Set<string>();

  if (/(aprenda|descubra|guia|passo a passo|dicas|como)/i.test(source)) {
    hints.add('educativo');
  }
  if (/(eu |meu |minha |voce |voces |a gente)/i.test(source)) {
    hints.add('conversacional');
  }
  if (/(resultado|estrategia|metodo|especialista|estudo)/i.test(source)) {
    hints.add('autoridade');
  }
  if (/(😂|🤣|meme|pov)/i.test(source)) {
    hints.add('humor/trend');
  }
  if (/(sonho|transforma|mudou|minha vida|emocion)/i.test(source)) {
    hints.add('emocional');
  }
  if (!hints.size) {
    hints.add('direto');
  }

  return [...hints];
}

function visualHintsFromFormats(mix: Array<{ format: CompetitorContentFormat; count: number; share: number }>) {
  const hints: string[] = [];
  const dominant = mix[0];

  if (!dominant) {
    return ['sem volume suficiente para ler o estilo visual'];
  }

  if (dominant.format === 'reels' || dominant.format === 'video') {
    hints.push('forte foco em video vertical');
  }
  if (mix.some((item) => item.format === 'carrossel' && item.share >= 0.2)) {
    hints.push('usa carrosseis para aprofundar contexto');
  }
  if (mix.some((item) => item.format === 'image' && item.share >= 0.2)) {
    hints.push('mantem posts estaticos para reforco visual');
  }
  if (!hints.length) {
    hints.push('mistura formatos sem depender de um unico modelo');
  }

  return hints;
}

function topAnglesFromPosts(posts: CompetitorCapturedPost[]) {
  const angles = new Set<string>();

  posts.forEach((post) => {
    if (post.hookPattern === 'POV' || post.hookPattern === 'relato pessoal') {
      angles.add('narrativas em primeira pessoa');
    }
    if (post.hookPattern === 'lista numerada') {
      angles.add('listas rapidas e objetivas');
    }
    if (post.storytellingPatterns.includes('transformacao')) {
      angles.add('promessa de transformacao');
    }
    if (post.storytellingPatterns.includes('prova social')) {
      angles.add('prova social e validacao externa');
    }
    if (post.ctaPatterns.includes('dm')) {
      angles.add('CTA de conversa direta');
    }
  });

  return [...angles].slice(0, 6);
}

async function enrichPostsWithTranscripts(posts: CompetitorCapturedPost[], limit = 10) {
  const enriched = [...posts];
  const transcriptCandidates = enriched
    .filter((post) => post.format === 'reels' || post.format === 'video')
    .sort((left, right) => right.metrics.engagementScore - left.metrics.engagementScore || right.postedAt.localeCompare(left.postedAt))
    .slice(0, limit);

  for (const candidate of transcriptCandidates) {
    if (candidate.transcriptText && candidate.transcriptStatus === 'success') {
      continue;
    }

    const mediaUrl = normalizeText(candidate.mediaUrl || candidate.sourceUrl);
    if (!mediaUrl) {
      candidate.transcriptStatus = 'missing';
      candidate.transcriptSource = 'none';
      candidate.transcriptConfidence = null;
      candidate.transcriptError = 'Sem URL de video para transcricao.';
      candidate.screenTextLead = candidate.screenTextLead || candidate.accessibilityCaption || '';
      continue;
    }

    const transcript = await transcribeMediaFromUrl({ sourceUrl: mediaUrl });
    if (transcript.status === 'success' && transcript.text) {
      candidate.transcriptText = transcript.text;
      candidate.transcriptStatus = 'success';
      candidate.transcriptSource = transcript.provider;
      candidate.transcriptConfidence = transcript.confidence;
      candidate.transcriptError = '';
      candidate.screenTextLead = transcript.screenTextLead || candidate.screenTextLead || '';
      candidate.hookPattern = detectHookPattern(buildPostEvidenceText(candidate));
      candidate.ctaPatterns = detectCtaPatterns(buildPostEvidenceText(candidate));
      candidate.storytellingPatterns = detectStorytellingPatterns(buildPostEvidenceText(candidate));
    } else {
      candidate.transcriptStatus = candidate.transcriptText ? 'success' : 'missing';
      candidate.transcriptSource = candidate.transcriptText ? candidate.transcriptSource : 'none';
      candidate.transcriptConfidence = candidate.transcriptText ? candidate.transcriptConfidence ?? 0.75 : null;
      candidate.transcriptError = transcript.error || candidate.transcriptError || 'Sem transcript disponivel para este reel.';
      candidate.screenTextLead = transcript.screenTextLead || candidate.screenTextLead || candidate.accessibilityCaption || '';
    }
  }

  return enriched;
}

export function buildCompetitorFacts(snapshot: CompetitorSourceSnapshot, competitor: CompetitorAnalysisInput['competitor']): CompetitorAnalysisFacts {
  const posts = Array.isArray(snapshot.topPosts) ? snapshot.topPosts : [];
  const evidenceTexts = posts.map((post) => buildPostEvidenceText(post)).filter(Boolean);
  const captions = posts.map((post) => post.caption).filter(Boolean);
  const transcriptCount = posts.filter((post) => post.transcriptStatus === 'success' && normalizeText(post.transcriptText)).length;
  const captionCount = countFilledCaptions(posts);
  const screenTextCount = posts.filter((post) => normalizeText(post.screenTextLead)).length;
  const confidenceLevel: CompetitorAnalysisFacts['confidenceLevel'] = transcriptCount > 0 ? 'high' : captionCount > 0 ? 'medium' : 'low';
  const mix = formatMix(posts);
  const competitorTags = Array.isArray(competitor.tags) ? competitor.tags : [];

  return {
    recurringThemes: topRepeatedTerms([
      ...evidenceTexts,
      snapshot.instagram?.bio ?? '',
      competitor.notes,
      competitor.niche,
      competitorTags.join(' ')
    ]),
    formatMix: mix,
    hookPatterns: topCounts(posts.map((post) => post.hookPattern), 5),
    ctaPatterns: topCounts(posts.flatMap((post) => post.ctaPatterns), 5),
    storytellingPatterns: topCounts(posts.flatMap((post) => post.storytellingPatterns), 5),
    toneHints: toneHintsFromTexts([snapshot.instagram?.bio ?? '', ...evidenceTexts, competitor.notes]),
    visualHints: visualHintsFromFormats(mix),
    cadenceLabel: cadenceLabel(posts),
    averageVideoDuration: averageVideoDurationSeconds(posts),
    transcriptCount,
    captionCount,
    screenTextCount,
    confidenceLevel,
    topAngles: topAnglesFromPosts(posts),
    topCaptions: posts
      .slice(0, 6)
      .map((post) => post.captionLead || post.transcriptText || post.caption)
      .filter(Boolean)
      .slice(0, 6)
  };
}

export function extractHashtagsFromText(text: string) {
  return [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.toLowerCase()))];
}

function countFilledCaptions(posts: CompetitorCapturedPost[]) {
  return posts.filter((post) => normalizeText(buildPostEvidenceText(post))).length;
}

function captureTextLength(posts: CompetitorCapturedPost[]) {
  return posts.reduce((total, post) => total + normalizeText(buildPostEvidenceText(post)).length, 0);
}

export function assessCompetitorDataQuality(snapshot: CompetitorSourceSnapshot): CompetitorDataQualityAssessment {
  const posts = Array.isArray(snapshot.topPosts) ? snapshot.topPosts : [];
  const captions = countFilledCaptions(posts);
  const transcripts = posts.filter((post) => post.transcriptStatus === 'success' && normalizeText(post.transcriptText)).length;
  const screenTexts = posts.filter((post) => normalizeText(post.screenTextLead)).length;
  const characters = captureTextLength(posts);
  const stats = {
    posts: snapshot.postsAnalyzed,
    captions,
    transcripts,
    screenTexts,
    reels: snapshot.reelsAnalyzed,
    feed: snapshot.feedAnalyzed,
    characters
  };

  if (!stats.posts || !captions) {
    return {
      quality: 'insufficient',
      enoughForAi: false,
      reason: 'Dados insuficientes para analise completa. O sistema nao conseguiu capturar posts, legendas ou transcripts publicos suficientes desse perfil.',
      stats
    };
  }

  if (
    stats.posts < MIN_COMPETITOR_POSTS_FOR_AI ||
    captions < MIN_COMPETITOR_CAPTIONS_FOR_AI ||
    characters < MIN_COMPETITOR_TEXT_LENGTH_FOR_AI
  ) {
    return {
      quality: 'partial',
      enoughForAi: false,
      reason: `Dados insuficientes para analise completa. Foram capturados ${stats.posts} post(s), ${captions} legenda(s) utilizaveis, ${transcripts} transcript(s) e ${characters} caracteres de texto.`,
      stats
    };
  }

  return {
    quality: 'ready',
    enoughForAi: true,
    reason: '',
    stats
  };
}

export function buildCompetitorCapturePayload(input: {
  companyId: string;
  competitorId: string;
  source: CompetitorCaptureSource;
  snapshot: CompetitorSourceSnapshot;
  status: 'success' | 'partial' | 'error';
}) {
  const posts = Array.isArray(input.snapshot.topPosts) ? input.snapshot.topPosts : [];

  return {
    company_id: input.companyId,
    competitor_id: input.competitorId,
    source: input.source,
    status: input.status,
    bio: input.snapshot.instagram?.bio ?? '',
    captions: posts.map((post) => post.caption).filter(Boolean),
    hashtags: [...new Set(posts.flatMap((post) => extractHashtagsFromText(post.caption)))],
    post_types: posts.map((post) => post.format).filter(Boolean),
    hooks_detected: posts.map((post) => post.hookPattern).filter(Boolean),
    ctas_detected: posts.flatMap((post) => post.ctaPatterns).filter(Boolean),
    transcript_text: posts
      .map((post) => normalizeText(post.transcriptText))
      .filter(Boolean),
    capture_notes: input.snapshot.captureNotes,
    posts_captured: input.snapshot.postsAnalyzed,
    reels_captured: input.snapshot.reelsAnalyzed,
    feed_captured: input.snapshot.feedAnalyzed,
    raw_snapshot: input.snapshot
  };
}

export function buildCompetitorPatternPayload(input: {
  companyId: string;
  competitorId: string;
  captureId: string;
  snapshot: CompetitorSourceSnapshot;
  facts: CompetitorAnalysisFacts;
  assessment: CompetitorDataQualityAssessment;
}) {
  const dominantFormat = input.facts.formatMix[0];

  return {
    company_id: input.companyId,
    competitor_id: input.competitorId,
    capture_id: input.captureId,
    data_quality: input.assessment.quality,
    tone: input.facts.toneHints.join(', '),
    most_common_cta: input.facts.ctaPatterns[0] ?? '',
    most_common_hook_type: input.facts.hookPatterns[0] ?? '',
    most_common_format: dominantFormat ? formatShareLabel(dominantFormat.format) : '',
    narrative_structure: input.facts.storytellingPatterns[0] ?? '',
    content_pillars: input.facts.topAngles,
    recurring_themes: input.facts.recurringThemes,
    top_words: input.facts.recurringThemes,
    format_mix: input.facts.formatMix,
    hook_patterns: input.facts.hookPatterns,
    cta_patterns: input.facts.ctaPatterns,
    pattern_summary: {
      cadenceLabel: input.facts.cadenceLabel,
      averageVideoDuration: input.facts.averageVideoDuration,
      confidenceLevel: input.facts.confidenceLevel,
      visualHints: input.facts.visualHints,
      toneHints: input.facts.toneHints,
      transcriptCount: input.facts.transcriptCount,
      captionCount: input.facts.captionCount,
      screenTextCount: input.facts.screenTextCount,
      topCaptions: input.facts.topCaptions,
      stats: input.assessment.stats,
      sourceNotes: input.snapshot.captureNotes
    }
  };
}

function topPostsForSnapshot(posts: CompetitorCapturedPost[]) {
  return [...posts]
    .sort((left, right) => right.metrics.engagementScore - left.metrics.engagementScore)
    .slice(0, 8);
}

export async function captureCompetitorSources(
  competitor: CompetitorAnalysisInput['competitor'],
  options?: { deep?: boolean }
) {
  const normalizedHandle = normalizeInstagramHandle(competitor.handle);
  const deepCapture = options?.deep ?? false;
  const apifyConfigured = Boolean(process.env.APIFY_API_TOKEN?.trim());
  const [apifyInstagram, website] = await Promise.all([
    normalizedHandle ? fetchInstagramSnapshotFromApify(normalizedHandle, deepCapture) : Promise.resolve(null),
    competitor.website ? fetchWebsiteSnapshot(competitor.website) : Promise.resolve(null)
  ]);

  let instagram = apifyInstagram;
  let captureSource: CompetitorCaptureSource = apifyInstagram ? 'apify' : 'automatic';
  const captureNotes: string[] = [...(apifyInstagram?.captureNotes ?? [])];

  if (normalizedHandle && !apifyConfigured) {
    captureNotes.push('APIFY_API_TOKEN nao configurado; usando captura publica direta do Instagram como fallback.');
  }

  if (normalizedHandle) {
    const shouldFallbackToInternal = deepCapture
      ? !instagram ||
        instagram.posts.length < MIN_COMPETITOR_POSTS_FOR_AI ||
        !instagram.bio ||
        !instagram.fullName
      : !instagram || !instagram.profilePicUrl;

    if (shouldFallbackToInternal) {
      const fallbackInstagram = await fetchInstagramSnapshot(normalizedHandle);
      instagram = mergeInstagramSnapshots(instagram, fallbackInstagram);

      if (fallbackInstagram) {
        captureSource = apifyInstagram ? 'apify' : 'automatic';
        captureNotes.push(
          apifyInstagram
            ? 'Fallback publico do Instagram complementou a captura via Apify.'
            : 'Captura publica direta do Instagram foi usada como fallback.'
        );
      } else if (!instagram) {
        captureNotes.push('Nao foi possivel ler o perfil publico do Instagram informado.');
      }
    }
  }

  const instagramPosts = instagram?.posts ?? [];
  const feedAnalyzed = instagramPosts.filter((post) => post.format !== 'reels' && post.format !== 'video').length;
  const reelsAnalyzed = instagramPosts.filter((post) => post.format === 'reels' || post.format === 'video').length;

  if (!website && competitor.website) {
    captureNotes.push('Nao foi possivel ler o website informado.');
  }
  if (!instagramPosts.length) {
    captureNotes.push('Nenhum post publico foi retornado pelo perfil no momento da captura.');
  }
  if (apifyInstagram) {
    captureNotes.unshift(
      deepCapture
        ? 'Apify: Instagram Profile Scraper, Instagram Post Scraper e Instagram Reel Scraper foram usados na coleta.'
        : 'Apify: Instagram Profile Scraper foi usado na coleta.'
    );
  }

  const postsWithTranscripts = deepCapture ? await enrichPostsWithTranscripts(instagramPosts, 10) : instagramPosts;
  const transcriptCount = postsWithTranscripts.filter((post) => post.transcriptStatus === 'success' && normalizeText(post.transcriptText)).length;
  if (deepCapture && transcriptCount) {
    captureNotes.push(`Transcricoes executadas em ${Math.min(transcriptCount, 10)} reels da amostra.`);
  } else if (deepCapture) {
    captureNotes.push('Sem transcripts automaticos suficientes; a analise usou legenda e sinais visuais disponiveis.');
  }

  const snapshot: CompetitorSourceSnapshot = {
    fetchedAt: new Date().toISOString(),
    instagram: instagram
      ? {
          handle: instagram.handle,
          bio: instagram.bio,
          fullName: instagram.fullName,
          followers: instagram.followers,
          following: instagram.following,
          postsCount: instagram.postsCount,
          reelsCount: instagram.reelsCount,
          verified: instagram.verified,
          externalUrl: instagram.externalUrl,
          profilePicUrl: instagram.profilePicUrl
        }
      : null,
    website,
    postsAnalyzed: postsWithTranscripts.length,
    reelsAnalyzed,
    feedAnalyzed,
    captureNotes,
    topPosts: topPostsForSnapshot(postsWithTranscripts)
  };

  return {
    source: captureSource,
    snapshot,
    suggestedLogoUrl: website?.logoUrl || website?.iconUrl || instagram?.profilePicUrl || competitor.logoUrl || ''
  };
}

function splitManualCaptureSamples(content: string) {
  return content
    .replace(/\r/g, '')
    .split(/\n\s*\n+|^---+$|(?:\n-{3,}\n)/m)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildManualCompetitorSnapshot(input: {
  competitor: CompetitorAnalysisInput['competitor'];
  content: string;
  mode: 'captions' | 'script';
}) {
  const samples = splitManualCaptureSamples(input.content);
  const now = Date.now();
  const format: CompetitorContentFormat = input.mode === 'script' ? 'video' : 'unknown';
  const posts = topPostsForSnapshot(
    samples.map((sample, index) => {
      const normalized = normalizeWhitespace(sample);
      const transcriptText = input.mode === 'script' ? normalized : '';
      const transcriptStatus: CompetitorCapturedPost['transcriptStatus'] = input.mode === 'script' ? 'success' : 'missing';
      const transcriptSource: CompetitorCapturedPost['transcriptSource'] = input.mode === 'script' ? 'manual' : 'none';
      const transcriptConfidence = input.mode === 'script' ? 0.9 : null;
      const transcriptError = input.mode === 'script' ? '' : 'Sem transcript para material colado como legenda.';
      const screenTextLead = input.mode === 'script' ? firstTranscriptLine(normalized) : '';

      return {
        id: `manual-${index + 1}`,
        shortcode: '',
        sourceUrl: '',
        format,
        caption: normalized,
        captionLead: firstCaptionLine(normalized),
        thumbnailUrl: '',
        mediaUrl: '',
        postedAt: new Date(now - index * 60 * 1000).toISOString(),
        metrics: {
          likes: Math.max(0, samples.length - index),
          comments: 0,
          views: 0,
          engagementScore: Math.max(0, samples.length - index),
          durationSeconds: input.mode === 'script' ? 45 : null
        },
        accessibilityCaption: '',
        transcriptText,
        transcriptStatus,
        transcriptSource,
        transcriptConfidence,
        transcriptError,
        screenTextLead,
        hookPattern: detectHookPattern(normalized),
        ctaPatterns: detectCtaPatterns(normalized),
        storytellingPatterns: detectStorytellingPatterns(normalized)
      } satisfies CompetitorCapturedPost;
    })
  );

  return {
    snapshot: {
      fetchedAt: new Date().toISOString(),
      instagram: input.competitor.handle
        ? {
            handle: input.competitor.handle,
            bio: '',
            fullName: input.competitor.name,
            followers: 0,
            following: 0,
            postsCount: posts.length,
            reelsCount: input.mode === 'script' ? posts.length : 0,
            verified: false,
            externalUrl: '',
            profilePicUrl: input.competitor.logoUrl ?? ''
          }
        : null,
      website: null,
      postsAnalyzed: posts.length,
      reelsAnalyzed: input.mode === 'script' ? posts.length : 0,
      feedAnalyzed: input.mode === 'script' ? 0 : posts.length,
      captureNotes: [
        input.mode === 'script'
          ? 'Analise apoiada por roteiros/legendas colados manualmente pelo usuario.'
          : 'Analise apoiada por legendas coladas manualmente pelo usuario.'
      ],
      topPosts: posts
    } satisfies CompetitorSourceSnapshot,
    suggestedLogoUrl: input.competitor.logoUrl ?? ''
  };
}

function buildInsight(
  kind: CompetitorInsight['kind'],
  title: string,
  summary: string,
  rationale: string,
  extra?: Partial<CompetitorInsight>,
  facts?: CompetitorAnalysisFacts
): CompetitorInsight {
  return {
    id: buildInsightId(kind, `${title}-${summary}`),
    kind,
    title,
    summary,
    rationale,
    tags: extra?.tags ?? [],
    hookType: extra?.hookType ?? '',
    ctaType: extra?.ctaType ?? '',
    format: extra?.format ?? '',
    sample: extra?.sample ?? '',
    sourceUrl: extra?.sourceUrl ?? '',
    confidenceLevel: normalizeConfidenceLevel(
      extra?.confidenceLevel ?? (facts ? deriveInsightConfidenceLevel(facts, extra?.sourceUrl ?? '', summary, kind) : 'medium')
    )
  };
}

function hydrateCompetitorAnalysisConfidence(analysis: CompetitorAnalysis, facts: CompetitorAnalysisFacts): CompetitorAnalysis {
  return {
    ...analysis,
    sections: analysis.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        confidenceLevel: normalizeConfidenceLevel(
          item.confidenceLevel ?? deriveInsightConfidenceLevel(facts, item.sourceUrl, item.summary, item.kind)
        )
      }))
    }))
  };
}

function formatShareLabel(format: CompetitorContentFormat) {
  switch (format) {
    case 'reels':
      return 'Reels';
    case 'video':
      return 'Video curto';
    case 'carrossel':
      return 'Carrossel';
    case 'image':
      return 'Post estatico';
    default:
      return 'Misto';
  }
}

function formatDurationLabel(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
    return 'Nao capturado publicamente';
  }

  if (seconds < 60) {
    return `~${Math.round(seconds)}s`;
  }

  const minutes = seconds / 60;
  if (minutes < 60) {
    return `~${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
  }

  const hours = minutes / 60;
  return `~${hours.toFixed(1)} h`;
}

function describeRecordingStyle(facts: CompetitorAnalysisFacts, dominantFormat: CompetitorContentFormat | undefined) {
  if (!dominantFormat) {
    return 'Nao foi possivel ler um estilo dominante com confianca.';
  }

  if (dominantFormat === 'reels' || dominantFormat === 'video') {
    if (facts.toneHints.includes('conversacional')) {
      return 'Selfie com fala direta e ritmo de narração.';
    }

    if (facts.toneHints.includes('autoridade')) {
      return 'Narração objetiva com cortes curtos e foco em explicação.';
    }

    return 'Video vertical com cortes curtos e fala guiada por gancho.';
  }

  if (dominantFormat === 'carrossel') {
    return 'Carrossel com texto na tela e progressao por blocos.';
  }

  if (dominantFormat === 'image') {
    return 'Post estatico com legenda forte e leitura rapida no feed.';
  }

  return 'Formato misto com adaptacoes por tema.';
}

function describeProofSocial(facts: CompetitorAnalysisFacts) {
  if (facts.storytellingPatterns.includes('prova social')) {
    return 'Depoimento, resultado real e validacao externa.';
  }

  if (facts.storytellingPatterns.includes('transformacao')) {
    return 'Antes e depois e comparacao de resultado.';
  }

  if (facts.storytellingPatterns.includes('historia pessoal')) {
    return 'Relato pessoal como forma de validacao.';
  }

  return 'Prova social nao ficou evidente na captura publica.';
}

function describeTextOnScreen(facts: CompetitorAnalysisFacts, dominantFormat: CompetitorContentFormat | undefined) {
  if (dominantFormat === 'reels' || dominantFormat === 'video' || dominantFormat === 'carrossel') {
    return 'Sim, aparece com frequencia.';
  }

  if (facts.visualHints.some((hint) => hint.includes('visual'))) {
    return 'Parcialmente, sobretudo em chamadas de capa.';
  }

  return 'Nao ficou evidente na captura publica.';
}

function describeSpokenCaption(facts: CompetitorAnalysisFacts, dominantFormat: CompetitorContentFormat | undefined) {
  if (dominantFormat === 'reels' || dominantFormat === 'video') {
    if (facts.toneHints.includes('conversacional') || facts.toneHints.includes('educativo')) {
      return 'Sim, com roteiro falado ou leitura guiada.';
    }

    return 'Parcialmente, com falas curtas e diretas.';
  }

  return 'Nao apareceu com clareza na captura pública.';
}

function describeTrendUse(facts: CompetitorAnalysisFacts) {
  if (facts.toneHints.includes('humor/trend')) {
    return 'Sim, com sinais claros de trend/humor.';
  }

  if (facts.hookPatterns.some((pattern) => ['POV', 'lista numerada', 'pergunta'].includes(pattern))) {
    return 'Parcialmente, com formatos sociais que lembram trend.';
  }

  return 'Pouco evidente na amostra publica.';
}

export function buildCompetitorAnalysisFallback(input: CompetitorAnalysisInput): CompetitorAnalysis {
  const { competitor, facts, snapshot } = input;
  const dominantFormat = facts.formatMix[0];
  const topPost = snapshot.topPosts[0];
  const hookPattern = facts.hookPatterns[0] ?? 'abertura direta';
  const ctaPattern = facts.ctaPatterns[0] ?? 'comentarios';
  const storytelling = facts.storytellingPatterns[0] ?? 'problema-solucao';
  const topTheme = facts.recurringThemes[0] ?? competitor.niche ?? 'topico central do nicho';
  const secondTheme = facts.recurringThemes[1] ?? 'tema adjacente';
  const visualStyle = facts.visualHints.join(', ') || 'sem volume suficiente para ler o estilo visual';
  const tone = facts.toneHints.join(', ');
  const audience = competitor.niche
    ? `publico interessado em ${competitor.niche.toLowerCase()}`
    : 'publico que acompanha conteudo de descoberta e repertorio';
  const positioning = snapshot.website?.title || snapshot.instagram?.bio || competitor.notes || `marca de ${competitor.niche || 'conteudo'} com forte presenca em social`;
  const dominantFormatLabel = dominantFormat ? formatShareLabel(dominantFormat.format) : 'Misto';
  const averageVideoDuration = formatDurationLabel(facts.averageVideoDuration);

  const sections = [
    {
      id: 'actions',
      title: 'Sugestões práticas',
      description: 'O que ja pode virar acao dentro da plataforma.',
      items: [
        buildInsight('action', 'Enviar para Conteudo', `Gerar uma pauta sobre ${topTheme}, outra sobre ${secondTheme} e uma sequencia de stories com a mesma logica de ${hookPattern.toLowerCase()}.`, 'Transforma a leitura em pauta acionavel.', {
          format: dominantFormat ? dominantFormatLabel : 'Reels',
          confidenceLevel: facts.confidenceLevel === 'low' ? 'low' : 'medium'
        }),
        buildInsight('action', 'Enviar para Creator AI', `Pedir ao Creator AI ${dominantFormatLabel} com tom ${facts.toneHints[0] ?? 'direto'} e CTA de ${ctaPattern}.`, 'Ja sai pronto para virar prompt interno.', {
          ctaType: ctaPattern,
          hookType: hookPattern,
          confidenceLevel: facts.confidenceLevel === 'low' ? 'low' : 'medium'
        }),
        buildInsight('action', 'Salvar no banco', `Salvar ${hookPattern.toLowerCase()}, ${ctaPattern} e os temas ${topTheme} / ${secondTheme} como repertorio reutilizavel.`, 'Permite alimentar futuras geracoes com aprendizado reutilizavel.', {
          tags: [topTheme, secondTheme, hookPattern, ctaPattern],
          confidenceLevel: facts.confidenceLevel === 'low' ? 'low' : 'medium'
        })
      ]
    },
    {
      id: 'ideas',
      title: 'Ideias aproveitáveis',
      description: 'Separado por tipo para virar repertorio acionavel sem copiar o perfil.',
      items: [
        buildInsight('hook', 'Hooks', `Abrir com ${hookPattern.toLowerCase()} conectando ${topTheme} a uma dor concreta do publico.`, 'Traduz o padrao do perfil em uma abertura adaptavel para redes sociais.', {
          hookType: hookPattern,
          format: dominantFormat ? dominantFormatLabel : 'Reels',
          sample: topPost?.captionLead ?? '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('idea', 'Estruturas de roteiro', `Problema -> prova -> solucao -> CTA usando ${storytelling.toLowerCase()} como espinha dorsal.`, 'Entrega um esqueleto de roteiro pronto para gravacao.', {
          format: dominantFormat ? dominantFormatLabel : 'Reels',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('idea', 'Ideias de Reels', `Video vertical sobre ${topTheme} com gancho ${hookPattern.toLowerCase()} e CTA de ${ctaPattern}.`, 'Versao pratica do que pode virar video curto com mais aderencia ao padrao observado.', {
          hookType: hookPattern,
          ctaType: ctaPattern,
          format: 'Reels',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('idea', 'Ideias de Stories', `Sequencia de 3 stories: contexto, prova e CTA sobre ${secondTheme}.`, 'Ajuda a transformar o repertorio em sequencia gravavel e simples.', {
          format: 'Stories',
          confidenceLevel: facts.confidenceLevel === 'medium' ? 'medium' : 'low'
        }),
        buildInsight('idea', 'Ideias de Carrossel', `Carrossel com capa de promessa forte e paginas internas mostrando ${topTheme}.`, 'Boa forma de aprofundar contexto sem perder retenção.', {
          format: 'Carrossel',
          confidenceLevel: facts.confidenceLevel === 'medium' ? 'medium' : 'low'
        }),
        buildInsight('cta', 'CTAs', `Fechar com CTA de ${ctaPattern} depois de entregar prova ou valor.`, 'Mantem a logica de conversao observada, mas aplicada ao seu contexto.', {
          ctaType: ctaPattern,
          format: dominantFormat ? dominantFormatLabel : '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('idea', 'Angulos de copy', `Dor + desejo + prova: transformar ${topTheme} em uma mensagem de conversao clara.`, 'Organiza a mensagem em um angulo de copia que o time consegue repetir.', {
          tags: [topTheme, secondTheme],
          confidenceLevel: facts.confidenceLevel === 'medium' ? 'medium' : 'low'
        }),
        buildInsight('storytelling', 'Storytelling', `Mini historia pessoal ou antes/depois conectando ${storytelling} e ${secondTheme}.`, 'Aproveita a narrativa dominante do perfil em um formato mais gravavel.', {
          tags: facts.storytellingPatterns,
          format: dominantFormat ? dominantFormatLabel : '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('idea', 'Ofertas', `Oferta curta com beneficio claro, prova social e urgencia leve para ${topTheme}.`, 'Traduz o repertorio em um angulo comercial util.', {
          tags: [topTheme, ctaPattern],
          confidenceLevel: facts.confidenceLevel === 'medium' ? 'medium' : 'low'
        }),
        buildInsight('adaptation', 'Provas sociais', describeProofSocial(facts), 'Mostra como a validacao pode entrar sem copiar a peca original.', {
          tags: facts.storytellingPatterns,
          confidenceLevel: facts.confidenceLevel === 'medium' ? 'medium' : 'low'
        })
      ]
    },
    {
      id: 'engineering',
      title: 'ENGENHARIA DE CONTEÚDO',
      description: 'Leitura rapida do que sustenta a estrutura de publicacao do perfil.',
      items: [
        buildInsight('engineering', 'Duracao media dos videos', averageVideoDuration, facts.averageVideoDuration ? 'Média calculada a partir dos videos/reels capturados.' : 'Amostra sem duracao publica suficiente para calcular a media.', {
          format: dominantFormat ? dominantFormatLabel : '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.averageVideoDuration ? 'medium' : 'low'
        }),
        buildInsight('engineering', 'Frequencia de posts por semana', facts.cadenceLabel, 'Leitura do intervalo medio entre publicacoes capturadas.', {
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: snapshot.postsAnalyzed ? 'medium' : 'low'
        }),
        buildInsight('engineering', 'Frequencia de stories por dia', 'Nao observavel na captura publica.', 'Stories nao aparecem no feed aberto; use material manual ou referencia extra para fechar essa leitura.', {
          sourceUrl: snapshot.instagram ? `https://www.instagram.com/${snapshot.instagram.handle}/` : '',
          confidenceLevel: 'low'
        }),
        buildInsight('engineering', 'Tipo de abertura mais comum', hookPattern, 'Padrao detectado nos inicios das legendas e chamadas que mais aparecem no feed.', {
          hookType: hookPattern,
          sample: facts.topCaptions[0] ?? '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('engineering', 'Estrutura mais comum', storytelling, 'Resumo do arco narrativo que mais se repete nas publicacoes observadas.', {
          tags: facts.storytellingPatterns,
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('engineering', 'Tipo de CTA', ctaPattern, 'Mostra como o perfil normalmente tenta mover a audiencia para a proxima acao.', {
          ctaType: ctaPattern,
          sample: facts.topCaptions[1] ?? '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('engineering', 'Estilo de gravacao', describeRecordingStyle(facts, dominantFormat?.format), 'Inferido pela combinacao de formato dominante, tom e ritmo de publicacao.', {
          format: dominantFormat ? dominantFormatLabel : '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: dominantFormat ? 'medium' : 'low'
        }),
        buildInsight('engineering', 'Tipo de prova social', describeProofSocial(facts), 'Sinal de validacao mais aparente na amostra publica.', {
          tags: facts.storytellingPatterns,
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.storytellingPatterns.length ? 'medium' : 'low'
        }),
        buildInsight('engineering', 'Cenarios mais usados', 'Nao observavel na captura publica.', 'Cenarios dependem de imagem aberta, enquadramento ou referencia manual mais rica.', {
          sourceUrl: snapshot.instagram ? `https://www.instagram.com/${snapshot.instagram.handle}/` : '',
          confidenceLevel: 'low'
        }),
        buildInsight('engineering', 'Formatos dominantes', dominantFormat ? `${dominantFormatLabel} lidera o mix com ${Math.round(dominantFormat.share * 100)}% das amostras analisadas.` : 'Nao houve volume suficiente para ler o mix de formatos.', 'Mostra onde o perfil concentra energia de publicacao.', {
          format: dominantFormat ? dominantFormatLabel : '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: dominantFormat ? 'medium' : 'low'
        }),
        buildInsight('engineering', 'Uso de texto na tela', describeTextOnScreen(facts, dominantFormat?.format), 'Sinal de estrutura visual e de retenção nas pecas capturadas.', {
          format: dominantFormat ? dominantFormatLabel : '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.screenTextCount ? 'medium' : 'low'
        }),
        buildInsight('engineering', 'Uso de legenda falada', describeSpokenCaption(facts, dominantFormat?.format), 'Sinal de fala guiada, narração ou leitura do roteiro.', {
          format: dominantFormat ? dominantFormatLabel : '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.transcriptCount ? 'high' : 'low'
        }),
        buildInsight('engineering', 'Uso de trend', describeTrendUse(facts), 'Sinal de linguagem, formato e repertorio social que lembra trend.', {
          tags: facts.hookPatterns,
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.toneHints.includes('humor/trend') ? 'medium' : 'low'
        })
      ]
    },
    {
      id: 'overview',
      title: 'Visao geral da comunicacao',
      description: 'Leitura objetiva do jeito que o perfil se posiciona e conversa.',
      items: [
        buildInsight('overview', 'Tom de voz', tone || 'direto e pratico', 'Sintetiza a forma como o perfil conversa repetidamente nas legendas e bio.', {
          tags: facts.toneHints,
          sample: snapshot.instagram?.bio ?? '',
          sourceUrl: snapshot.instagram ? `https://www.instagram.com/${snapshot.instagram.handle}/` : '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('overview', 'Posicionamento', positioning, 'Resume a proposta que fica mais evidente entre bio, site e temas recorrentes.', {
          tags: competitor.tags,
          sample: snapshot.website?.description || snapshot.instagram?.bio || competitor.notes,
          sourceUrl: competitor.website || (snapshot.instagram ? `https://www.instagram.com/${snapshot.instagram.handle}/` : ''),
          confidenceLevel: facts.recurringThemes.length ? 'medium' : 'low'
        }),
        buildInsight('visual', 'Estilo visual aparente', visualStyle || 'sem volume suficiente para ler o estilo visual', 'Inferido pela mistura de formatos e pelo tipo de publicacao que domina o perfil.', {
          format: dominantFormat ? dominantFormatLabel : '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: dominantFormat ? 'medium' : 'low'
        }),
        buildInsight('overview', 'Publico aparente', audience, 'Estimativa baseada no nicho informado e nos temas mais recorrentes do perfil.', {
          tags: facts.recurringThemes.slice(0, 4),
          confidenceLevel: facts.recurringThemes.length ? 'medium' : 'low'
        })
      ]
    },
    {
      id: 'patterns',
      title: 'Padrões de conteúdo',
      description: 'O que aparece com mais frequencia no conteudo publicado.',
      items: [
        buildInsight('theme', 'Temas recorrentes', `Temas que mais se repetem: ${facts.recurringThemes.slice(0, 5).join(', ') || 'sem repeticao clara ainda'}.`, 'Ajuda a entender quais assuntos estruturam o repertorio do perfil.', {
          tags: facts.recurringThemes.slice(0, 5),
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.recurringThemes.length ? 'medium' : 'low'
        }),
        buildInsight('format', 'Formatos mais usados', dominantFormat ? `${dominantFormatLabel} lidera o mix com ${Math.round(dominantFormat.share * 100)}% das amostras analisadas.` : 'Nao houve volume suficiente para ler o mix de formatos.', 'Mostra onde o perfil concentra energia de publicacao.', {
          format: dominantFormat ? dominantFormatLabel : '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: dominantFormat ? 'medium' : 'low'
        }),
        buildInsight('hook', 'Tipo de abertura mais comum', hookPattern, 'Padrao detectado nos inicios das legendas e chamadas que mais aparecem no feed.', {
          hookType: hookPattern,
          sample: facts.topCaptions[0] ?? '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('cta', 'CTA mais recorrente', ctaPattern, 'Mostra como o perfil normalmente tenta mover a audiencia para a proxima acao.', {
          ctaType: ctaPattern,
          sample: facts.topCaptions[1] ?? '',
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.confidenceLevel === 'high' ? 'high' : 'medium'
        }),
        buildInsight('storytelling', 'Estrutura narrativa frequente', storytelling, 'Resume o padrao narrativo que mais se repete nas publicacoes observadas.', {
          tags: facts.storytellingPatterns,
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: facts.storytellingPatterns.length ? 'medium' : 'low'
        })
      ]
    },
    {
      id: 'adaptation',
      title: 'O que podemos aproveitar',
      description: 'Aproveitamento seguro sem copiar formula pronta.',
      items: [
        buildInsight('adaptation', 'Vale adaptar', `A combinacao de ${topTheme} com ${hookPattern.toLowerCase()} e ${dominantFormatLabel.toLowerCase()} tende a ser a melhor referencia para adaptar.`, 'Mostra o nucleo que parece mais forte no perfil.', {
          tags: [topTheme, hookPattern],
          sourceUrl: topPost?.sourceUrl ?? '',
          confidenceLevel: dominantFormat ? 'medium' : 'low'
        }),
        buildInsight('adaptation', 'Nao vale copiar', 'Evite reproduzir legenda, framing ou visual exatamente iguais. O valor esta no angulo e na estrutura, nao na copia literal.', 'Mantem a referencia util sem descaracterizar a marca.', {
          tags: ['adaptacao', 'originalidade'],
          confidenceLevel: 'low'
        })
      ]
    }
  ];

  const sectionById = (id: string) => sections.find((section) => section.id === id)?.items ?? [];
  const ideasItems = sectionById('ideas');
  const actionItems = sectionById('actions');

  return hydrateCompetitorAnalysisConfidence({
    generatedAt: new Date().toISOString(),
    model: 'fallback-logic',
    overview: {
      toneOfVoice: tone || 'direto',
      positioning,
      apparentAudience: audience,
      visualStyle
    },
    sections,
    practicalSuggestions: {
      toContent: ideasItems
        .filter((item) => ['Ideias de Reels', 'Ideias de Stories', 'Ideias de Carrossel'].includes(item.title))
        .map((item) => item.summary),
      toCreatorAi: ideasItems
        .filter((item) => ['Hooks', 'Estruturas de roteiro', 'CTAs'].includes(item.title))
        .map((item) => item.summary),
      toReferenceBank: ideasItems
        .filter((item) => ['Storytelling', 'Angulos de copy', 'Provas sociais'].includes(item.title) || ['Storytelling', 'Ângulos de copy', 'Provas sociais'].includes(item.title))
        .map((item) => item.summary)
        .concat(actionItems.slice(2, 3).map((item) => item.summary))
    },
    sourceSnapshot: snapshot
  }, facts);
}

export function summarizeCompetitorAnalysisInput(input: CompetitorAnalysisInput) {
  const { competitor, snapshot, facts } = input;

  return {
    competitor: {
      name: competitor.name,
      type: competitor.type,
      niche: competitor.niche,
      notes: competitor.notes,
      tags: competitor.tags
    },
    profile: {
      instagram: snapshot.instagram,
      website: snapshot.website,
      postsAnalyzed: snapshot.postsAnalyzed,
      reelsAnalyzed: snapshot.reelsAnalyzed,
      feedAnalyzed: snapshot.feedAnalyzed,
      captureNotes: snapshot.captureNotes
    },
    facts: {
      recurringThemes: facts.recurringThemes,
      formatMix: facts.formatMix.map((item) => `${formatShareLabel(item.format)} ${item.count}`),
      hookPatterns: facts.hookPatterns,
      ctaPatterns: facts.ctaPatterns,
      storytellingPatterns: facts.storytellingPatterns,
      toneHints: facts.toneHints,
      visualHints: facts.visualHints,
      cadenceLabel: facts.cadenceLabel,
      transcriptCount: facts.transcriptCount,
      captionCount: facts.captionCount,
      screenTextCount: facts.screenTextCount,
      confidenceLevel: facts.confidenceLevel,
      topAngles: facts.topAngles
    },
    topSamples: snapshot.topPosts.slice(0, 6).map((post) => ({
      format: formatShareLabel(post.format),
      captionLead: post.captionLead,
      transcriptText: post.transcriptText,
      transcriptStatus: post.transcriptStatus,
      transcriptSource: post.transcriptSource,
      transcriptConfidence: post.transcriptConfidence,
      screenTextLead: post.screenTextLead,
      hookPattern: post.hookPattern,
      ctaPatterns: post.ctaPatterns,
      storytellingPatterns: post.storytellingPatterns,
      likes: post.metrics.likes,
      comments: post.metrics.comments,
      views: post.metrics.views,
      sourceUrl: post.sourceUrl
    }))
  };
}
