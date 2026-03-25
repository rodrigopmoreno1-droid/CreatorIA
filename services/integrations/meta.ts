type MetaPublishInput = {
  caption?: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'REELS';
  scheduledAt?: string;
  shareToFeed?: boolean;
};

const META_GRAPH_VERSION = 'v23.0';

type MetaGraphError = {
  message?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

function getMetaAccessToken() {
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

function sanitizeMetaMessage(message: string) {
  const accessToken = getMetaAccessToken();

  const withoutRawToken = accessToken ? message.replaceAll(accessToken, '[REDACTED_ACCESS_TOKEN]') : message;

  return withoutRawToken.replace(/EA[A-Za-z0-9]+/g, '[REDACTED_ACCESS_TOKEN]');
}

async function readGraph<T>(path: string, params: Record<string, string>) {
  const accessToken = getMetaAccessToken();
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

async function postGraph<T>(path: string, body: Record<string, string | boolean>) {
  const accessToken = getMetaAccessToken();
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

async function discoverInstagramAccountId() {
  const configured = getConfiguredInstagramAccountId();
  if (configured) {
    return configured;
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
  });

  const discovered = payload.data?.find((item) => item.instagram_business_account?.id)?.instagram_business_account?.id;
  return discovered ?? '';
}

export async function fetchInstagramInsights() {
  if (!process.env.META_APP_ID || !getMetaAccessToken()) {
    return {
      ok: false,
      message: 'Meta credentials are missing.',
      insights: []
    };
  }

  try {
    const instagramAccountId = await discoverInstagramAccountId();

    if (!instagramAccountId) {
      return {
        ok: false,
        message:
          'Nao encontrei uma conta do Instagram Business vinculada ao token atual. Confirme as permissoes instagram_basic, instagram_manage_insights e pages_show_list.',
        insights: []
      };
    }

    const payload = await readGraph<{
      data?: Array<{
        like_count?: number;
        comments_count?: number;
        media_type?: string;
      }>;
    }>(`${instagramAccountId}/media`, {
      fields: 'media_type,like_count,comments_count',
      limit: '10'
    });

    const likes = payload.data?.reduce((sum, item) => sum + (item.like_count ?? 0), 0) ?? 0;
    const comments = payload.data?.reduce((sum, item) => sum + (item.comments_count ?? 0), 0) ?? 0;
    const reels = payload.data?.filter((item) => item.media_type === 'VIDEO').length ?? 0;
    const posts = payload.data?.length ?? 0;
    const insights = [
      { metric: 'posts', value: posts },
      { metric: 'likes', value: likes },
      { metric: 'comments', value: comments },
      { metric: 'reels', value: reels }
    ];

    return {
      ok: true,
      message: 'Insights recuperados da Meta Graph API.',
      instagramAccountId,
      insights
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao consultar insights da Meta.',
      insights: []
    };
  }
}

export async function publishInstagramPost(input: MetaPublishInput) {
  if (!process.env.META_APP_ID || !getMetaAccessToken()) {
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
    const instagramAccountId = await discoverInstagramAccountId();

    if (!instagramAccountId) {
      return {
        ok: false,
        message:
          'Nao encontrei a conta do Instagram Business associada a esse token. Confirme a vinculacao da pagina e as permissoes instagram_content_publish e pages_show_list.',
        input
      };
    }

    const mediaType = input.mediaType === 'REELS' ? 'REELS' : 'IMAGE';
    const creation = await postGraph<{ id?: string }>(`${instagramAccountId}/media`, {
      caption: input.caption ?? '',
      image_url: mediaType === 'IMAGE' ? input.mediaUrl : '',
      media_type: mediaType,
      share_to_feed: mediaType === 'REELS' ? input.shareToFeed ?? true : false,
      video_url: mediaType === 'REELS' ? input.mediaUrl : ''
    });

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
          'Container criado na Meta. O agendamento interno ficou salvo, mas a automacao de publicacao futura ainda depende de um job/cron para disparar no horario.',
        creationId: creation.id,
        instagramAccountId
      };
    }

    const published = await postGraph<{ id?: string }>(`${instagramAccountId}/media_publish`, {
      creation_id: creation.id
    });

    return {
      ok: true,
      message: 'Conteudo enviado para o Instagram com sucesso.',
      creationId: creation.id,
      publishId: published.id ?? '',
      instagramAccountId
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao publicar no Instagram.',
      input
    };
  }
}
