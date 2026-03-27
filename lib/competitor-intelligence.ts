import 'server-only';

import type {
  CompetitorAnalysis,
  CompetitorCapturedPost,
  CompetitorCaptureSource,
  CompetitorContentFormat,
  CompetitorDataQuality,
  CompetitorInsight,
  CompetitorRecord,
  CompetitorSourceSnapshot,
  ContentReferenceRecord
} from '@/types/competitor-intelligence';
import { fetchApifyInstagramCapture } from '@/services/integrations/apify';

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
  const metrics = {
    likes,
    comments,
    views,
    engagementScore: computeEngagementScore({ likes, comments, views })
  };

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
    accessibilityCaption: normalizeText(node.accessibility_caption),
    hookPattern: detectHookPattern(caption),
    ctaPatterns: detectCtaPatterns(caption),
    storytellingPatterns: detectStorytellingPatterns(caption)
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
  const sourceUrl = normalizeText(
    pickApifyField(node, ['url', 'postUrl', 'permalink', 'sourceUrl'])
  ) || buildApifyPostUrl(shortcode, format);
  const accessibilityCaption = normalizeWhitespace(
    firstNonEmptyText(
      pickApifyField(node, ['transcript', 'transcriptText', 'subtitle', 'accessibilityCaption', 'altText', 'caption']),
      getNestedString(node, ['accessibility_caption'])
    )
  );

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
      engagementScore: computeEngagementScore({ likes, comments, views })
    },
    accessibilityCaption,
    hookPattern: detectHookPattern(collectApifyText(node) || caption),
    ctaPatterns: detectCtaPatterns(collectApifyText(node) || caption),
    storytellingPatterns: detectStorytellingPatterns(collectApifyText(node) || caption)
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

async function fetchInstagramSnapshotFromApify(handle: string): Promise<InstagramSnapshotData | null> {
  const capture = await fetchApifyInstagramCapture(handle);

  if (!capture) {
    return null;
  }

  const profile = capture.profile ? mapApifyProfileItem(capture.profile) : null;
  const profilePosts = profile?.posts ?? [];
  const actorPosts = capture.posts
    .map((item) => mapApifyPost(item))
    .filter((post): post is CompetitorCapturedPost => Boolean(post));
  const reelPosts = capture.reels
    .map((item) => mapApifyPost(item, 'reels'))
    .filter((post): post is CompetitorCapturedPost => Boolean(post));
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
      'Instagram Profile Scraper, Instagram Scraper e Instagram Reel Scraper usados na coleta.',
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

export function buildCompetitorFacts(snapshot: CompetitorSourceSnapshot, competitor: CompetitorAnalysisInput['competitor']): CompetitorAnalysisFacts {
  const posts = Array.isArray(snapshot.topPosts) ? snapshot.topPosts : [];
  const captions = posts.map((post) => post.caption).filter(Boolean);
  const mix = formatMix(posts);
  const competitorTags = Array.isArray(competitor.tags) ? competitor.tags : [];

  return {
    recurringThemes: topRepeatedTerms([
      ...captions,
      snapshot.instagram?.bio ?? '',
      competitor.notes,
      competitor.niche,
      competitorTags.join(' ')
    ]),
    formatMix: mix,
    hookPatterns: topCounts(posts.map((post) => post.hookPattern), 5),
    ctaPatterns: topCounts(posts.flatMap((post) => post.ctaPatterns), 5),
    storytellingPatterns: topCounts(posts.flatMap((post) => post.storytellingPatterns), 5),
    toneHints: toneHintsFromTexts([snapshot.instagram?.bio ?? '', ...captions, competitor.notes]),
    visualHints: visualHintsFromFormats(mix),
    cadenceLabel: cadenceLabel(posts),
    topAngles: topAnglesFromPosts(posts),
    topCaptions: posts
      .slice(0, 6)
      .map((post) => post.captionLead || post.caption)
      .filter(Boolean)
      .slice(0, 6)
  };
}

export function extractHashtagsFromText(text: string) {
  return [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.toLowerCase()))];
}

function countFilledCaptions(posts: CompetitorCapturedPost[]) {
  return posts.filter((post) => normalizeText(post.caption || post.captionLead)).length;
}

function captureTextLength(posts: CompetitorCapturedPost[]) {
  return posts.reduce((total, post) => total + normalizeText(post.caption || post.captionLead).length, 0);
}

export function assessCompetitorDataQuality(snapshot: CompetitorSourceSnapshot): CompetitorDataQualityAssessment {
  const posts = Array.isArray(snapshot.topPosts) ? snapshot.topPosts : [];
  const captions = countFilledCaptions(posts);
  const characters = captureTextLength(posts);
  const stats = {
    posts: snapshot.postsAnalyzed,
    captions,
    reels: snapshot.reelsAnalyzed,
    feed: snapshot.feedAnalyzed,
    characters
  };

  if (!stats.posts || !captions) {
    return {
      quality: 'insufficient',
      enoughForAi: false,
      reason: 'Dados insuficientes para analise completa. O sistema nao conseguiu capturar posts e legendas publicas suficientes desse perfil.',
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
      reason: `Dados insuficientes para analise completa. Foram capturados ${stats.posts} post(s), ${captions} legenda(s) utilizaveis e ${characters} caracteres de texto.`,
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
      .map((post) => normalizeText(post.accessibilityCaption))
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
      visualHints: input.facts.visualHints,
      toneHints: input.facts.toneHints,
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

export async function captureCompetitorSources(competitor: CompetitorAnalysisInput['competitor']) {
  const normalizedHandle = normalizeInstagramHandle(competitor.handle);
  const apifyConfigured = Boolean(process.env.APIFY_API_TOKEN?.trim());
  const [apifyInstagram, website] = await Promise.all([
    normalizedHandle ? fetchInstagramSnapshotFromApify(normalizedHandle) : Promise.resolve(null),
    competitor.website ? fetchWebsiteSnapshot(competitor.website) : Promise.resolve(null)
  ]);

  let instagram = apifyInstagram;
  let captureSource: CompetitorCaptureSource = apifyInstagram ? 'apify' : 'automatic';
  const captureNotes: string[] = [...(apifyInstagram?.captureNotes ?? [])];

  if (normalizedHandle && !apifyConfigured) {
    captureNotes.push('APIFY_API_TOKEN nao configurado; usando captura publica direta do Instagram como fallback.');
  }

  if (normalizedHandle) {
    const shouldFallbackToInternal =
      !instagram ||
      instagram.posts.length < MIN_COMPETITOR_POSTS_FOR_AI ||
      !instagram.bio ||
      !instagram.fullName;

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
    captureNotes.unshift('Apify: Instagram Profile Scraper, Instagram Scraper e Instagram Reel Scraper foram usados na coleta.');
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
    postsAnalyzed: instagramPosts.length,
    reelsAnalyzed,
    feedAnalyzed,
    captureNotes,
    topPosts: topPostsForSnapshot(instagramPosts)
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
          engagementScore: Math.max(0, samples.length - index)
        },
        accessibilityCaption: '',
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
  extra?: Partial<CompetitorInsight>
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
    sourceUrl: extra?.sourceUrl ?? ''
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

export function buildCompetitorAnalysisFallback(input: CompetitorAnalysisInput): CompetitorAnalysis {
  const { competitor, facts, snapshot } = input;
  const dominantFormat = facts.formatMix[0];
  const topPost = snapshot.topPosts[0];
  const hookPattern = facts.hookPatterns[0] ?? 'abertura direta';
  const ctaPattern = facts.ctaPatterns[0] ?? 'comentarios';
  const storytelling = facts.storytellingPatterns[0] ?? 'problema-solucao';
  const topTheme = facts.recurringThemes[0] ?? competitor.niche ?? 'topico central do nicho';
  const secondTheme = facts.recurringThemes[1] ?? 'tema adjacente';
  const visualStyle = facts.visualHints.join(', ');
  const tone = facts.toneHints.join(', ');
  const audience = competitor.niche
    ? `publico interessado em ${competitor.niche.toLowerCase()}`
    : 'publico que acompanha conteudo de descoberta e repertorio';
  const positioning = snapshot.website?.title || snapshot.instagram?.bio || competitor.notes || `marca de ${competitor.niche || 'conteudo'} com forte presenca em social`;

  const sections = [
    {
      id: 'overview',
      title: 'Visao geral da comunicacao',
      description: 'Leitura objetiva do jeito que o perfil se posiciona e conversa.',
      items: [
        buildInsight('overview', 'Tom de voz', tone || 'direto e pratico', 'Sintetiza a forma como o perfil conversa repetidamente nas legendas e bio.', {
          tags: facts.toneHints,
          sample: snapshot.instagram?.bio ?? '',
          sourceUrl: snapshot.instagram ? `https://www.instagram.com/${snapshot.instagram.handle}/` : ''
        }),
        buildInsight('overview', 'Posicionamento', positioning, 'Resume a proposta que fica mais evidente entre bio, site e temas recorrentes.', {
          tags: competitor.tags,
          sample: snapshot.website?.description || snapshot.instagram?.bio || competitor.notes,
          sourceUrl: competitor.website || (snapshot.instagram ? `https://www.instagram.com/${snapshot.instagram.handle}/` : '')
        }),
        buildInsight('visual', 'Estilo visual aparente', visualStyle, 'Inferido pela mistura de formatos e pelo tipo de publicacao que domina o perfil.', {
          format: dominantFormat ? formatShareLabel(dominantFormat.format) : '',
          sourceUrl: topPost?.sourceUrl ?? ''
        }),
        buildInsight('overview', 'Publico aparente', audience, 'Estimativa baseada no nicho informado e nos temas mais recorrentes do perfil.', {
          tags: facts.recurringThemes.slice(0, 4)
        })
      ]
    },
    {
      id: 'patterns',
      title: 'Padroes de conteudo',
      description: 'O que aparece com mais frequencia no conteudo publicado.',
      items: [
        buildInsight('theme', 'Temas recorrentes', `Temas que mais se repetem: ${facts.recurringThemes.slice(0, 5).join(', ') || 'sem repeticao clara ainda'}.`, 'Ajuda a entender quais assuntos estruturam o repertorio do perfil.', {
          tags: facts.recurringThemes.slice(0, 5),
          sourceUrl: topPost?.sourceUrl ?? ''
        }),
        buildInsight('format', 'Formatos mais usados', dominantFormat ? `${formatShareLabel(dominantFormat.format)} lidera o mix com ${Math.round(dominantFormat.share * 100)}% das amostras analisadas.` : 'Nao houve volume suficiente para ler o mix de formatos.', 'Mostra onde o perfil concentra energia de publicacao.', {
          format: dominantFormat ? formatShareLabel(dominantFormat.format) : '',
          sourceUrl: topPost?.sourceUrl ?? ''
        }),
        buildInsight('hook', 'Tipo de abertura mais comum', hookPattern, 'Padrao detectado nos inicios das legendas e chamadas que mais aparecem no feed.', {
          hookType: hookPattern,
          sample: facts.topCaptions[0] ?? '',
          sourceUrl: topPost?.sourceUrl ?? ''
        }),
        buildInsight('cta', 'CTA mais recorrente', ctaPattern, 'Mostra como o perfil normalmente tenta mover a audiencia para a proxima acao.', {
          ctaType: ctaPattern,
          sample: facts.topCaptions[1] ?? '',
          sourceUrl: topPost?.sourceUrl ?? ''
        }),
        buildInsight('storytelling', 'Estrutura narrativa frequente', storytelling, 'Resume o padrao narrativo que mais se repete nas publicacoes observadas.', {
          tags: facts.storytellingPatterns,
          sourceUrl: topPost?.sourceUrl ?? ''
        })
      ]
    },
    {
      id: 'ideas',
      title: 'Ideias aproveitaveis',
      description: 'O que vale transformar em repertorio para conteudo novo.',
      items: [
        buildInsight('idea', `Gancho para ${topTheme}`, `Abrir com ${hookPattern.toLowerCase()} conectando ${topTheme} com um problema concreto do publico.`, 'Traduz o padrao do perfil em um hook que pode ser adaptado sem copiar.', {
          hookType: hookPattern,
          format: dominantFormat ? formatShareLabel(dominantFormat.format) : 'Reels',
          sample: topPost?.captionLead ?? '',
          sourceUrl: topPost?.sourceUrl ?? ''
        }),
        buildInsight('idea', `CTA inspirado em ${ctaPattern}`, `Fechar com CTA de ${ctaPattern} depois de provar valor em um formato de ${formatShareLabel(dominantFormat?.format ?? 'reels').toLowerCase()}.`, 'Mantem a logica de conversao observada, mas aplicada ao seu contexto.', {
          ctaType: ctaPattern,
          format: formatShareLabel(dominantFormat?.format ?? 'reels')
        }),
        buildInsight('storytelling', 'Estrutura de storytelling', `Combinar ${storytelling.toLowerCase()} com o tema ${secondTheme} para dar contexto antes da oferta.`, 'Aproveita a narrativa dominante do perfil em um formato mais gravavel.', {
          format: dominantFormat ? formatShareLabel(dominantFormat.format) : '',
          sample: facts.topCaptions[2] ?? '',
          sourceUrl: topPost?.sourceUrl ?? ''
        }),
        buildInsight('idea', 'Formato para testar', dominantFormat ? `Produzir ${formatShareLabel(dominantFormat.format)} focado em ${topTheme} com CTA de ${ctaPattern}.` : `Produzir conteudo curto focado em ${topTheme}.`, 'Direciona a referencia para uma acao concreta no calendario.', {
          format: formatShareLabel(dominantFormat?.format ?? 'reels'),
          sourceUrl: topPost?.sourceUrl ?? ''
        })
      ]
    },
    {
      id: 'adaptation',
      title: 'O que podemos aproveitar',
      description: 'Aproveitamento seguro sem copiar formula pronta.',
      items: [
        buildInsight('adaptation', 'Vale adaptar', `A combinacao de ${topTheme} com ${hookPattern.toLowerCase()} e ${formatShareLabel(dominantFormat?.format ?? 'reels').toLowerCase()} tende a ser a melhor referencia para adaptar.`, 'Mostra o nucleo que parece mais forte no perfil.', {
          tags: [topTheme, hookPattern],
          sourceUrl: topPost?.sourceUrl ?? ''
        }),
        buildInsight('adaptation', 'Nao vale copiar', 'Evite reproduzir legenda, framing ou visual exatamente iguais. O valor esta no angulo e na estrutura, nao na copia literal.', 'Mantem a referencia util sem descaracterizar a marca.', {
          tags: ['adaptacao', 'originalidade']
        })
      ]
    },
    {
      id: 'actions',
      title: 'Sugestoes praticas',
      description: 'O que ja pode virar acao dentro da plataforma.',
      items: [
        buildInsight('action', 'Enviar para Conteudo', `Gerar uma pauta sobre ${topTheme} e outra sobre ${secondTheme}, mantendo ${hookPattern.toLowerCase()} como linha de abertura.`, 'Transforma a leitura em pauta acionavel.', {
          format: formatShareLabel(dominantFormat?.format ?? 'reels')
        }),
        buildInsight('action', 'Enviar para Creator AI', `Pedir ao Creator AI ${formatShareLabel(dominantFormat?.format ?? 'reels')} com tom ${facts.toneHints[0] ?? 'direto'} e CTA de ${ctaPattern}.`, 'Ja sai pronto para virar prompt interno.', {
          ctaType: ctaPattern,
          hookType: hookPattern
        }),
        buildInsight('action', 'Salvar no banco', `Salvar ${hookPattern.toLowerCase()}, ${ctaPattern} e os temas ${topTheme} / ${secondTheme} como repertorio reutilizavel.`, 'Permite alimentar futuras geracoes com aprendizado reutilizavel.', {
          tags: [topTheme, secondTheme, hookPattern, ctaPattern]
        })
      ]
    }
  ];

  return {
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
      toContent: sections[4]?.items.slice(0, 1).map((item) => item.summary) ?? [],
      toCreatorAi: sections[4]?.items.slice(1, 2).map((item) => item.summary) ?? [],
      toReferenceBank: sections[4]?.items.slice(2, 3).map((item) => item.summary) ?? []
    },
    sourceSnapshot: snapshot
  };
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
      topAngles: facts.topAngles
    },
    topSamples: snapshot.topPosts.slice(0, 6).map((post) => ({
      format: formatShareLabel(post.format),
      captionLead: post.captionLead,
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
