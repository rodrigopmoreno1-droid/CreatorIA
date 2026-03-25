import type { InstagramConnectionSnapshot, InstagramMediaItem, InstagramStoryItem } from '@/types';

type MetaPublishInput = {
  caption?: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'REELS';
  scheduledAt?: string;
  shareToFeed?: boolean;
};

type MetaAuthTokenPayload = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type MetaGraphError = {
  message?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

const META_GRAPH_VERSION = 'v23.0';
const META_TOKEN_COOKIE = 'contentos-meta-token';
const META_SCOPES = [
  'pages_show_list',
  'business_management',
  'instagram_basic',
  'instagram_manage_insights',
  'instagram_content_publish'
].join(',');

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

function getConfiguredMetaAccessToken() {
  return process.env.META_ACCESS_TOKEN ?? '';
}

function getActiveMetaAccessToken(accessToken?: string) {
  return accessToken ?? getConfiguredMetaAccessToken();
}

function getConfiguredInstagramAccountId() {
  return (
    process.env.META_INSTAGRAM_ACCOUNT_ID ??
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ??
    process.env.META_IG_USER_ID ??
    ''
  );
}

function normalizeMediaType(value?: string) {
  if (value === 'IMAGE' || value === 'VIDEO' || value === 'CAROUSEL_ALBUM' || value === 'STORY' || value === 'REELS') {
    return value;
  }

  return 'UNKNOWN' as const;
}

function sanitizeMetaMessage(message: string, accessToken?: string) {
  const configuredAccessToken = getConfiguredMetaAccessToken();
  const currentToken = getActiveMetaAccessToken(accessToken);
  const tokens = [configuredAccessToken, currentToken].filter(Boolean);

  const redacted = tokens.reduce((acc, token) => acc.replaceAll(token, '[REDACTED_ACCESS_TOKEN]'), message);
  return redacted.replace(/EA[A-Za-z0-9]+/g, '[REDACTED_ACCESS_TOKEN]');
}

async function readGraph<T>(path: string, params: Record<string, string>, accessToken?: string) {
  const token = getActiveMetaAccessToken(accessToken);
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set('access_token', token);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = (await response.json().catch(() => null)) as T & MetaGraphError;

  if (!response.ok) {
    throw new Error(sanitizeMetaMessage(payload?.error?.message ?? payload?.message ?? `Meta Graph error ${response.status}`, token));
  }

  return payload;
}

async function postGraph<T>(path: string, body: Record<string, string | boolean>, accessToken?: string) {
  const token = getActiveMetaAccessToken(accessToken);
  const payload = new URLSearchParams();

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null && value !== '') {
      payload.set(key, String(value));
    }
  }

  payload.set('access_token', token);

  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
    cache: 'no-store'
  });

  const parsed = (await response.json().catch(() => null)) as T & MetaGraphError;

  if (!response.ok) {
    throw new Error(sanitizeMetaMessage(parsed?.error?.message ?? parsed?.message ?? `Meta Graph error ${response.status}`, token));
  }

  return parsed;
}

async function discoverInstagramAccount(accessToken?: string) {
  const configured = getConfiguredInstagramAccountId();
  if (configured) {
    return {
      instagramAccountId: configured,
      pageName: undefined as string | undefined,
      username: undefined as string | undefined
    };
  }

  const payload = await readGraph<{
    data?: Array<{
      name?: string;
      instagram_business_account?: {
        id?: string;
        username?: string;
      };
    }>;
  }>('me/accounts', {
    fields: 'name,instagram_business_account{id,username}'
  }, accessToken);

  const page = payload.data?.find((item) => item.instagram_business_account?.id);

  return {
    instagramAccountId: page?.instagram_business_account?.id ?? '',
    pageName: page?.name,
    username: page?.instagram_business_account?.username
  };
}

function buildInsights(media: InstagramMediaItem[]) {
  const likes = media.reduce((sum, item) => sum + (item.likeCount ?? 0), 0);
  const comments = media.reduce((sum, item) => sum + (item.commentsCount ?? 0), 0);
  const reels = media.filter((item) => item.mediaType === 'VIDEO' || item.mediaType === 'REELS').length;

  return [
    { metric: 'posts', value: media.length },
    { metric: 'likes', value: likes },
    { metric: 'comments', value: comments },
    { metric: 'reels', value: reels }
  ];
}

async function fetchInstagramProfile(instagramAccountId: string, accessToken?: string) {
  try {
    const profile = await readGraph<{
      id?: string;
      username?: string;
      profile_picture_url?: string;
      followers_count?: number;
      media_count?: number;
    }>(instagramAccountId, {
      fields: 'id,username,profile_picture_url,followers_count,media_count'
    }, accessToken);

    return profile;
  } catch {
    return {
      id: instagramAccountId
    };
  }
}

async function fetchInstagramMediaFeed(instagramAccountId: string, accessToken?: string) {
  const payload = await readGraph<{
    data?: Array<{
      id?: string;
      caption?: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      like_count?: number;
      comments_count?: number;
      timestamp?: string;
    }>;
  }>(`${instagramAccountId}/media`, {
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp',
    limit: '12'
  }, accessToken);

  return (payload.data ?? []).map<InstagramMediaItem>((item) => ({
    id: item.id ?? '',
    caption: item.caption ?? '',
    mediaType: normalizeMediaType(item.media_type),
    mediaUrl: item.media_url ?? '',
    thumbnailUrl: item.thumbnail_url ?? undefined,
    permalink: item.permalink ?? undefined,
    likeCount: item.like_count ?? undefined,
    commentsCount: item.comments_count ?? undefined,
    timestamp: item.timestamp ?? undefined
  }));
}

async function fetchInstagramStoriesFeed(instagramAccountId: string, accessToken?: string) {
  try {
    const payload = await readGraph<{
      data?: Array<{
        id?: string;
        media_type?: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
        timestamp?: string;
      }>;
    }>(`${instagramAccountId}/stories`, {
      fields: 'id,media_type,media_url,thumbnail_url,permalink,timestamp',
      limit: '10'
    }, accessToken);

    return (payload.data ?? []).map<InstagramStoryItem>((item) => ({
      id: item.id ?? '',
      mediaType: normalizeMediaType(item.media_type),
      mediaUrl: item.media_url ?? '',
      thumbnailUrl: item.thumbnail_url ?? undefined,
      permalink: item.permalink ?? undefined,
      timestamp: item.timestamp ?? undefined
    }));
  } catch {
    return [];
  }
}

export function getMetaTokenCookieName() {
  return META_TOKEN_COOKIE;
}

export function getMetaAuthRedirectUri(siteOrigin?: string) {
  return `${siteOrigin ?? getSiteUrl()}/api/integrations/meta/callback`;
}

export function buildMetaConnectUrl(state: string, siteOrigin?: string) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return '';
  }

  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('redirect_uri', getMetaAuthRedirectUri(siteOrigin));
  url.searchParams.set('scope', META_SCOPES);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForMetaToken(code: string, siteOrigin?: string) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    throw new Error('Meta credentials are missing.');
  }

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('client_secret', process.env.META_APP_SECRET);
  url.searchParams.set('redirect_uri', getMetaAuthRedirectUri(siteOrigin));
  url.searchParams.set('code', code);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = (await response.json().catch(() => null)) as MetaAuthTokenPayload & MetaGraphError;

  if (!response.ok || !payload?.access_token) {
    throw new Error(sanitizeMetaMessage(payload?.error?.message ?? payload?.message ?? 'Falha ao trocar o code da Meta.'));
  }

  return payload.access_token;
}

export async function exchangeForLongLivedMetaToken(shortLivedToken: string) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return shortLivedToken;
  }

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('client_secret', process.env.META_APP_SECRET);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = (await response.json().catch(() => null)) as MetaAuthTokenPayload & MetaGraphError;

  if (!response.ok || !payload?.access_token) {
    return shortLivedToken;
  }

  return payload.access_token;
}

export async function getInstagramConnectionSnapshot(accessToken?: string): Promise<InstagramConnectionSnapshot> {
  const token = getActiveMetaAccessToken(accessToken);
  const connectUrl = buildMetaConnectUrl('demo:posts');
  const usingWorkspaceToken = Boolean(accessToken);

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return {
      ok: false,
      connected: false,
      usingWorkspaceToken,
      provider: 'meta-graph',
      message: 'As credenciais base da Meta ainda não estão configuradas.',
      connectUrl,
      insights: [],
      media: [],
      stories: []
    };
  }

  if (!token) {
    return {
      ok: true,
      connected: false,
      usingWorkspaceToken,
      provider: 'meta-graph',
      message: 'Conecte uma conta do Instagram Business para puxar feed, stories e métricas reais.',
      connectUrl,
      insights: [],
      media: [],
      stories: []
    };
  }

  try {
    const discovered = await discoverInstagramAccount(token);

    if (!discovered.instagramAccountId) {
      return {
        ok: true,
        connected: false,
        usingWorkspaceToken,
        provider: 'meta-graph',
        message:
          'Conexão autenticada, mas sem conta do Instagram Business vinculada. Confirme a página conectada e as permissões da Meta.',
        connectUrl,
        insights: [],
        media: [],
        stories: []
      };
    }

    const [profile, media, stories] = await Promise.all([
      fetchInstagramProfile(discovered.instagramAccountId, token),
      fetchInstagramMediaFeed(discovered.instagramAccountId, token),
      fetchInstagramStoriesFeed(discovered.instagramAccountId, token)
    ]);

    const username = profile.username ?? discovered.username ?? 'instagram';

    return {
      ok: true,
      connected: true,
      usingWorkspaceToken,
      provider: 'meta-graph',
      message: `Instagram conectado como @${username}.`,
      connectUrl,
      account: {
        id: discovered.instagramAccountId,
        username,
        pageName: discovered.pageName,
        profilePictureUrl: profile.profile_picture_url ?? undefined,
        followersCount: profile.followers_count ?? undefined,
        mediaCount: profile.media_count ?? media.length
      },
      insights: buildInsights(media),
      media,
      stories
    };
  } catch (error) {
    return {
      ok: false,
      connected: false,
      usingWorkspaceToken,
      provider: 'meta-graph',
      message: error instanceof Error ? error.message : 'Falha ao consultar a Meta Graph API.',
      connectUrl,
      insights: [],
      media: [],
      stories: []
    };
  }
}

export async function fetchInstagramInsights(accessToken?: string) {
  const snapshot = await getInstagramConnectionSnapshot(accessToken);

  return {
    ok: snapshot.ok,
    connected: snapshot.connected,
    provider: snapshot.provider,
    message: snapshot.message,
    instagramAccountId: snapshot.account?.id ?? '',
    account: snapshot.account,
    insights: snapshot.insights,
    media: snapshot.media,
    stories: snapshot.stories
  };
}

export async function publishInstagramPost(input: MetaPublishInput, accessToken?: string) {
  const token = getActiveMetaAccessToken(accessToken);

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET || !token) {
    return {
      ok: false,
      message: 'Meta credentials are missing.',
      input
    };
  }

  if (!input.mediaUrl) {
    return {
      ok: false,
      message: 'Para publicar no Instagram e necessario informar uma media URL publica.',
      input
    };
  }

  try {
    const discovered = await discoverInstagramAccount(token);

    if (!discovered.instagramAccountId) {
      return {
        ok: false,
        message:
          'Nao encontrei a conta do Instagram Business associada a esse token. Confirme a vinculacao da pagina e as permissoes instagram_content_publish e pages_show_list.',
        input
      };
    }

    const mediaType = input.mediaType === 'REELS' ? 'REELS' : 'IMAGE';
    const creation = await postGraph<{ id?: string }>(`${discovered.instagramAccountId}/media`, {
      caption: input.caption ?? '',
      image_url: mediaType === 'IMAGE' ? input.mediaUrl : '',
      media_type: mediaType,
      share_to_feed: mediaType === 'REELS' ? input.shareToFeed ?? true : false,
      video_url: mediaType === 'REELS' ? input.mediaUrl : ''
    }, token);

    if (!creation.id) {
      return {
        ok: false,
        message: 'A Meta nao retornou o container de publicacao.',
        input
      };
    }

    if (input.scheduledAt) {
      return {
        ok: true,
        message:
          'Container criado na Meta. O agendamento interno ficou salvo, mas a publicacao futura ainda depende de um job para disparar no horario.',
        creationId: creation.id,
        instagramAccountId: discovered.instagramAccountId
      };
    }

    const published = await postGraph<{ id?: string }>(`${discovered.instagramAccountId}/media_publish`, {
      creation_id: creation.id
    }, token);

    return {
      ok: true,
      message: 'Conteudo enviado para o Instagram com sucesso.',
      creationId: creation.id,
      publishId: published.id ?? '',
      instagramAccountId: discovered.instagramAccountId
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao publicar no Instagram.',
      input
    };
  }
}
