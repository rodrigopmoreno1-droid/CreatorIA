import type { InstagramConnectionSnapshot, InstagramMediaItem, InstagramStoryItem } from '@/types';
import type { MetaStoredConnection } from '@/services/integrations/meta-storage';

type MetaPublishInput = {
  caption?: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'REELS';
  scheduledAt?: string;
  shareToFeed?: boolean;
};

export type MetaOAuthStatePayload = {
  workspace: string;
  module: string;
  nonce: string;
  pageId?: string;
};

export type MetaAuthTokenResult = {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
};

export type MetaOAuthMode = 'standard' | 'business';

export type MetaConnectRequest = {
  url: string;
  mode: MetaOAuthMode;
  errorCode?: 'missing-app-id' | 'missing-config-id';
  errorMessage?: string;
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

type MetaPageNode = {
  id?: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: {
    id?: string;
    username?: string;
  };
};

type MetaInsightMetric = {
  name?: string;
  values?: Array<{
    value?: unknown;
  }>;
};

type MetaResolvedConnection = {
  connection: MetaStoredConnection;
  snapshot: InstagramConnectionSnapshot;
  userAccessToken: string;
  pagesCount: number;
  eligiblePagesCount: number;
  pageSelection: 'requested' | 'first_eligible';
};

const META_GRAPH_VERSION = 'v23.0';
const DEFAULT_META_REDIRECT_URI = 'https://creator-ia.vercel.app/api/integrations/meta/callback';
const META_STATE_COOKIE = 'contentos-meta-oauth-state';
const META_CONFIG_ID_ENV_KEY = 'META_CONFIG_ID';

const META_SCOPES = [
  'pages_show_list',
  'instagram_basic',
  'pages_read_engagement',
  'instagram_manage_insights',
  'instagram_content_publish'
] as const;

function getMetaRedirectUri() {
  return process.env.META_REDIRECT_URI ?? DEFAULT_META_REDIRECT_URI;
}

function getMetaConfigId() {
  return process.env.META_CONFIG_ID?.trim() ?? '';
}

function shouldUseMetaBusinessLogin() {
  return Object.prototype.hasOwnProperty.call(process.env, META_CONFIG_ID_ENV_KEY);
}

function getConfiguredMetaAccessToken() {
  return process.env.META_ACCESS_TOKEN ?? '';
}

function getConfiguredInstagramAccountId() {
  return (
    process.env.META_INSTAGRAM_ACCOUNT_ID ??
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ??
    process.env.META_IG_USER_ID ??
    ''
  );
}

export function getMetaRequestedScopes() {
  return [...META_SCOPES];
}

export function getMetaStateCookieName() {
  return META_STATE_COOKIE;
}

export function getMetaOAuthMode(): MetaOAuthMode {
  return shouldUseMetaBusinessLogin() ? 'business' : 'standard';
}

function sanitizeMetaMessage(message: string) {
  const configuredAccessToken = getConfiguredMetaAccessToken();
  const redactedConfigured = configuredAccessToken ? message.replaceAll(configuredAccessToken, '[REDACTED_ACCESS_TOKEN]') : message;

  return redactedConfigured.replace(/EA[A-Za-z0-9]+/g, '[REDACTED_ACCESS_TOKEN]');
}

function normalizeMediaType(value?: string) {
  if (value === 'IMAGE' || value === 'VIDEO' || value === 'CAROUSEL_ALBUM' || value === 'STORY' || value === 'REELS') {
    return value;
  }

  return 'UNKNOWN' as const;
}

function parseMetricValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }

  return undefined;
}

function buildMediaInsights(media: InstagramMediaItem[]) {
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

function mergeInsights(media: InstagramMediaItem[], directInsights: Array<{ metric: string; value: number }>) {
  const merged = new Map<string, { metric: string; value: number }>();

  for (const item of buildMediaInsights(media)) {
    merged.set(item.metric, item);
  }

  for (const item of directInsights) {
    merged.set(item.metric, item);
  }

  return Array.from(merged.values());
}

function buildDisconnectedSnapshot(message: string, options?: { connectState?: string; usingWorkspaceToken?: boolean }) {
  return {
    ok: true,
    connected: false,
    usingWorkspaceToken: options?.usingWorkspaceToken ?? false,
    provider: 'meta-graph' as const,
    message,
    connectUrl: buildMetaConnectUrl(options?.connectState ?? 'demo:posts'),
    insights: [],
    media: [],
    stories: []
  };
}

async function readGraph<T>(path: string, params: Record<string, string>, accessToken: string) {
  if (!accessToken) {
    throw new Error('Meta access token is missing.');
  }

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = (await response.json().catch(() => null)) as T & MetaGraphError;

  if (!response.ok) {
    throw new Error(sanitizeMetaMessage(payload?.error?.message ?? payload?.message ?? `Meta Graph error ${response.status}`));
  }

  return payload;
}

async function postGraph<T>(path: string, body: Record<string, string | boolean>, accessToken: string) {
  if (!accessToken) {
    throw new Error('Meta access token is missing.');
  }

  const payload = new URLSearchParams();

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null && value !== '') {
      payload.set(key, String(value));
    }
  }

  payload.set('access_token', accessToken);

  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
    cache: 'no-store'
  });

  const parsed = (await response.json().catch(() => null)) as T & MetaGraphError;

  if (!response.ok) {
    throw new Error(sanitizeMetaMessage(parsed?.error?.message ?? parsed?.message ?? `Meta Graph error ${response.status}`));
  }

  return parsed;
}

async function fetchMetaPages(userAccessToken: string) {
  const payload = await readGraph<{ data?: MetaPageNode[] }>('me/accounts', {
    fields: 'id,name,access_token,tasks,instagram_business_account{id,username}',
    limit: '50'
  }, userAccessToken);

  return (payload.data ?? []).filter((page) => page.id && page.name);
}

function selectMetaPage(pages: MetaPageNode[], requestedPageId?: string) {
  const eligiblePages = pages.filter(
    (page) => page.id && page.access_token && page.instagram_business_account?.id
  );

  if (!eligiblePages.length) {
    return {
      page: null,
      eligibleCount: 0,
      selection: 'first_eligible' as const
    };
  }

  if (requestedPageId) {
    const requested = eligiblePages.find((page) => page.id === requestedPageId);

    if (requested) {
      return {
        page: requested,
        eligibleCount: eligiblePages.length,
        selection: 'requested' as const
      };
    }

    console.warn('[meta.oauth] requested page was not available for the current token, falling back to first eligible page', {
      requestedPageId,
      eligiblePages: eligiblePages.length
    });
  }

  return {
    page: eligiblePages[0] ?? null,
    eligibleCount: eligiblePages.length,
    selection: 'first_eligible' as const
  };
}

async function discoverInstagramAccount(accessToken: string) {
  const configured = getConfiguredInstagramAccountId();

  if (configured) {
    return {
      instagramAccountId: configured,
      pageId: undefined as string | undefined,
      pageName: undefined as string | undefined,
      username: undefined as string | undefined,
      pageAccessToken: accessToken
    };
  }

  const pages = await fetchMetaPages(accessToken);
  const selected = selectMetaPage(pages);

  return {
    instagramAccountId: selected.page?.instagram_business_account?.id ?? '',
    pageId: selected.page?.id ?? undefined,
    pageName: selected.page?.name ?? undefined,
    username: selected.page?.instagram_business_account?.username ?? undefined,
    pageAccessToken: selected.page?.access_token ?? accessToken
  };
}

async function fetchInstagramProfile(instagramAccountId: string, accessToken: string) {
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
  } catch (error) {
    console.warn('[meta.profile] unable to load full Instagram profile', {
      instagramAccountId,
      reason: error instanceof Error ? sanitizeMetaMessage(error.message) : 'unknown error'
    });

    return {
      id: instagramAccountId
    };
  }
}

async function fetchInstagramMediaFeed(instagramAccountId: string, accessToken: string) {
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

async function fetchInstagramStoriesFeed(instagramAccountId: string, accessToken: string) {
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
  } catch (error) {
    console.warn('[meta.stories] unable to load stories feed', {
      instagramAccountId,
      reason: error instanceof Error ? sanitizeMetaMessage(error.message) : 'unknown error'
    });

    return [];
  }
}

async function fetchInstagramAccountInsights(instagramAccountId: string, accessToken: string) {
  const metrics = [
    { metric: 'reach', period: 'day' },
    { metric: 'accounts_engaged', period: 'day' },
    { metric: 'total_interactions', period: 'day' }
  ];

  const collected: Array<{ metric: string; value: number }> = [];

  for (const { metric, period } of metrics) {
    try {
      const payload = await readGraph<{ data?: MetaInsightMetric[] }>(`${instagramAccountId}/insights`, {
        metric,
        period
      }, accessToken);

      const numericValue = parseMetricValue(payload.data?.[0]?.values?.[0]?.value);

      if (typeof numericValue === 'number') {
        collected.push({ metric, value: numericValue });
      }
    } catch (error) {
      console.warn('[meta.insights] metric unavailable for Instagram account', {
        instagramAccountId,
        metric,
        reason: error instanceof Error ? sanitizeMetaMessage(error.message) : 'unknown error'
      });
    }
  }

  return collected;
}

function buildConnectedSnapshot(
  connection: MetaStoredConnection,
  profile: Awaited<ReturnType<typeof fetchInstagramProfile>>,
  media: InstagramMediaItem[],
  stories: InstagramStoryItem[],
  directInsights: Array<{ metric: string; value: number }>,
  options?: { connectState?: string; usingWorkspaceToken?: boolean }
): InstagramConnectionSnapshot {
  const username = profile.username ?? connection.instagramUsername ?? 'instagram';

  return {
    ok: true,
    connected: true,
    usingWorkspaceToken: options?.usingWorkspaceToken ?? false,
    provider: 'meta-graph',
    message: `Instagram conectado como @${username}.`,
    connectUrl: buildMetaConnectUrl(options?.connectState ?? 'demo:posts'),
    account: {
      id: connection.instagramAccountId,
      username,
      pageName: connection.pageName,
      profilePictureUrl: profile.profile_picture_url ?? undefined,
      followersCount: profile.followers_count ?? undefined,
      mediaCount: profile.media_count ?? media.length
    },
    insights: mergeInsights(media, directInsights),
    media,
    stories
  };
}

async function resolveStoredConnectionSnapshot(
  connection: MetaStoredConnection,
  options?: { connectState?: string; usingWorkspaceToken?: boolean }
) {
  const [profile, media, stories, directInsights] = await Promise.all([
    fetchInstagramProfile(connection.instagramAccountId, connection.pageAccessToken),
    fetchInstagramMediaFeed(connection.instagramAccountId, connection.pageAccessToken),
    fetchInstagramStoriesFeed(connection.instagramAccountId, connection.pageAccessToken),
    fetchInstagramAccountInsights(connection.instagramAccountId, connection.pageAccessToken)
  ]);

  return buildConnectedSnapshot(connection, profile, media, stories, directInsights, options);
}

export function buildMetaConnectUrl(state: string) {
  return getMetaConnectRequest(state).url;
}

export function getMetaConnectRequest(state: string): MetaConnectRequest {
  const appId = process.env.META_APP_ID?.trim();

  if (!appId) {
    return {
      url: '',
      mode: getMetaOAuthMode(),
      errorCode: 'missing-app-id',
      errorMessage: 'O META_APP_ID ainda nao foi configurado.'
    };
  }

  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', getMetaRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  if (shouldUseMetaBusinessLogin()) {
    const configId = getMetaConfigId();

    if (!configId) {
      return {
        url: '',
        mode: 'business',
        errorCode: 'missing-config-id',
        errorMessage: 'O app da Meta esta em modo Facebook Login for Business, mas META_CONFIG_ID nao foi configurado.'
      };
    }

    // Business Login configurations own the permission set, so scopes must not be sent manually.
    url.searchParams.set('config_id', configId);
    url.searchParams.set('override_default_response_type', 'true');

    return {
      url: url.toString(),
      mode: 'business'
    };
  }

  url.searchParams.set('scope', META_SCOPES.join(','));

  return {
    url: url.toString(),
    mode: 'standard'
  };
}

export function serializeMetaOAuthState(state: MetaOAuthStatePayload) {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

export function parseMetaOAuthState(rawState?: string | null): MetaOAuthStatePayload | null {
  if (!rawState) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8')) as Partial<MetaOAuthStatePayload>;

    if (!parsed.workspace || !parsed.module || !parsed.nonce) {
      return null;
    }

    return {
      workspace: parsed.workspace,
      module: parsed.module,
      nonce: parsed.nonce,
      pageId: parsed.pageId
    };
  } catch {
    return null;
  }
}

export async function exchangeCodeForMetaToken(code: string) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    throw new Error('Meta credentials are missing.');
  }

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('client_secret', process.env.META_APP_SECRET);
  url.searchParams.set('redirect_uri', getMetaRedirectUri());
  url.searchParams.set('code', code);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = (await response.json().catch(() => null)) as MetaAuthTokenPayload & MetaGraphError;

  if (!response.ok || !payload?.access_token) {
    throw new Error(sanitizeMetaMessage(payload?.error?.message ?? payload?.message ?? 'Falha ao trocar o code da Meta.'));
  }

  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type,
    expiresIn: payload.expires_in
  } satisfies MetaAuthTokenResult;
}

export async function exchangeForLongLivedMetaToken(shortLivedToken: string) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return {
      accessToken: shortLivedToken
    } satisfies MetaAuthTokenResult;
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
    return {
      accessToken: shortLivedToken
    } satisfies MetaAuthTokenResult;
  }

  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type,
    expiresIn: payload.expires_in
  } satisfies MetaAuthTokenResult;
}

export async function resolveMetaConnectionFromUserToken(
  userAccessToken: string,
  options?: { pageId?: string; connectState?: string; usingWorkspaceToken?: boolean }
): Promise<MetaResolvedConnection> {
  const pages = await fetchMetaPages(userAccessToken);

  if (!pages.length) {
    throw new Error('Nenhuma pagina do Facebook foi encontrada para este login.');
  }

  const selected = selectMetaPage(pages, options?.pageId);

  if (!selected.page) {
    throw new Error('Nenhuma pagina com conta Instagram Business conectada foi encontrada.');
  }

  const pageId = selected.page.id ?? '';
  const instagramAccountId = selected.page.instagram_business_account?.id ?? '';
  const pageAccessToken = selected.page.access_token ?? '';

  if (!pageId || !instagramAccountId || !pageAccessToken) {
    throw new Error('A pagina selecionada nao possui uma conta Instagram Business pronta para uso.');
  }

  const connection: MetaStoredConnection = {
    provider: 'meta-graph',
    pageAccessToken,
    pageId,
    pageName: selected.page.name ?? undefined,
    instagramAccountId,
    instagramUsername: selected.page.instagram_business_account?.username ?? undefined,
    scopes: getMetaRequestedScopes(),
    tokenType: 'page'
  };

  const snapshot = await resolveStoredConnectionSnapshot(connection, {
    connectState: options?.connectState,
    usingWorkspaceToken: options?.usingWorkspaceToken
  });

  return {
    connection,
    snapshot,
    userAccessToken,
    pagesCount: pages.length,
    eligiblePagesCount: selected.eligibleCount,
    pageSelection: selected.selection
  };
}

async function resolveFallbackConnectionSnapshot(accessToken: string, options?: { connectState?: string; usingWorkspaceToken?: boolean }) {
  const configuredInstagramAccountId = getConfiguredInstagramAccountId();

  if (configuredInstagramAccountId) {
    const fallbackConnection: MetaStoredConnection = {
      provider: 'meta-graph',
      pageAccessToken: accessToken,
      pageId: 'configured-page',
      pageName: undefined,
      instagramAccountId: configuredInstagramAccountId,
      instagramUsername: undefined,
      scopes: getMetaRequestedScopes()
    };

    return resolveStoredConnectionSnapshot(fallbackConnection, options);
  }

  const discovered = await discoverInstagramAccount(accessToken);

  if (!discovered.instagramAccountId) {
    return buildDisconnectedSnapshot(
      'Conexao autenticada, mas sem conta do Instagram Business vinculada. Confirme a pagina conectada e as permissoes da Meta.',
      {
        connectState: options?.connectState,
        usingWorkspaceToken: options?.usingWorkspaceToken
      }
    );
  }

  const fallbackConnection: MetaStoredConnection = {
    provider: 'meta-graph',
    pageAccessToken: discovered.pageAccessToken,
    pageId: discovered.pageId ?? 'selected-page',
    pageName: discovered.pageName,
    instagramAccountId: discovered.instagramAccountId,
    instagramUsername: discovered.username,
    scopes: getMetaRequestedScopes()
  };

  return resolveStoredConnectionSnapshot(fallbackConnection, options);
}

export async function fetchInstagramConnectionSnapshot(params?: {
  browserConnection?: MetaStoredConnection | null;
  persistedConnection?: (MetaStoredConnection & { metadata?: Record<string, unknown> }) | null;
  fallbackAccessToken?: string | null;
  connectState?: string;
}): Promise<InstagramConnectionSnapshot> {
  const connectState = params?.connectState ?? 'demo:posts';
  const connectRequest = getMetaConnectRequest(connectState);

  if (connectRequest.errorCode === 'missing-config-id') {
    return {
      ok: false,
      connected: false,
      usingWorkspaceToken: false,
      provider: 'meta-graph',
      message: connectRequest.errorMessage ?? 'O META_CONFIG_ID ainda nao foi configurado.',
      connectUrl: connectRequest.url,
      insights: [],
      media: [],
      stories: []
    };
  }

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return {
      ok: false,
      connected: false,
      usingWorkspaceToken: false,
      provider: 'meta-graph',
      message: 'As credenciais base da Meta ainda nao estao configuradas.',
      connectUrl: connectRequest.url,
      insights: [],
      media: [],
      stories: []
    };
  }

  try {
    if (params?.browserConnection) {
      return await resolveStoredConnectionSnapshot(params.browserConnection, {
        connectState,
        usingWorkspaceToken: true
      });
    }

    if (params?.persistedConnection) {
      return await resolveStoredConnectionSnapshot(params.persistedConnection, {
        connectState,
        usingWorkspaceToken: false
      });
    }

    const fallbackAccessToken = params?.fallbackAccessToken ?? getConfiguredMetaAccessToken();

    if (!fallbackAccessToken) {
      return buildDisconnectedSnapshot('Conecte uma conta do Instagram Business para puxar feed, stories e metricas reais.', {
        connectState,
        usingWorkspaceToken: false
      });
    }

    return await resolveFallbackConnectionSnapshot(fallbackAccessToken, {
      connectState,
      usingWorkspaceToken: false
    });
  } catch (error) {
    const message = error instanceof Error ? sanitizeMetaMessage(error.message) : 'Falha ao consultar a Meta Graph API.';
    const shouldSoftFail = /malformed access token|invalid oauth|session has expired|invalid access token/i.test(message);

    return {
      ok: shouldSoftFail,
      connected: false,
      usingWorkspaceToken: Boolean(params?.browserConnection),
      provider: 'meta-graph',
      message: shouldSoftFail
        ? 'A conexao salva expirou. Conecte novamente sua conta do Instagram para puxar feed, stories e metricas reais.'
        : message,
      connectUrl: connectRequest.url,
      insights: [],
      media: [],
      stories: []
    };
  }
}

export async function publishInstagramPost(
  input: MetaPublishInput,
  params?: {
    connection?: MetaStoredConnection | null;
    fallbackAccessToken?: string | null;
  }
) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
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
    const connection =
      params?.connection ??
      (
        await resolveMetaConnectionFromUserToken(
          params?.fallbackAccessToken ?? getConfiguredMetaAccessToken()
        )
      ).connection;

    if (!connection?.instagramAccountId || !connection.pageAccessToken) {
      return {
        ok: false,
        message: 'Nao encontrei uma conexao valida do Instagram Business para publicar.',
        input
      };
    }

    const mediaType = input.mediaType === 'REELS' ? 'REELS' : 'IMAGE';
    const creation = await postGraph<{ id?: string }>(`${connection.instagramAccountId}/media`, {
      caption: input.caption ?? '',
      image_url: mediaType === 'IMAGE' ? input.mediaUrl : '',
      media_type: mediaType,
      share_to_feed: mediaType === 'REELS' ? input.shareToFeed ?? true : false,
      video_url: mediaType === 'REELS' ? input.mediaUrl : ''
    }, connection.pageAccessToken);

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
        instagramAccountId: connection.instagramAccountId
      };
    }

    const published = await postGraph<{ id?: string }>(`${connection.instagramAccountId}/media_publish`, {
      creation_id: creation.id
    }, connection.pageAccessToken);

    return {
      ok: true,
      message: 'Conteudo enviado para o Instagram com sucesso.',
      creationId: creation.id,
      publishId: published.id ?? '',
      instagramAccountId: connection.instagramAccountId
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? sanitizeMetaMessage(error.message) : 'Falha ao publicar no Instagram.',
      input
    };
  }
}
