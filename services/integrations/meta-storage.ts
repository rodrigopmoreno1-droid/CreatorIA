import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type MetaStoredConnection = {
  provider: 'meta-graph';
  pageAccessToken: string;
  pageId: string;
  pageName?: string;
  instagramAccountId: string;
  instagramUsername?: string;
  scopes: string[];
  tokenType?: string;
};

type PersistMetaConnectionInput = MetaStoredConnection & {
  workspaceSlug: string;
  metadata?: Record<string, unknown>;
};

type PersistedMetaConnectionRow = {
  company_id: string;
  provider: string;
  status: string;
  page_id: string | null;
  page_name: string | null;
  instagram_account_id: string | null;
  instagram_username: string | null;
  access_token_encrypted: string;
  token_type: string | null;
  scopes: string[] | null;
  metadata: Record<string, unknown> | null;
  last_synced_at: string | null;
};

const META_COOKIE_NAME = 'contentos-meta-token';

function getEncryptionSecret() {
  return process.env.META_TOKEN_ENCRYPTION_KEY ?? process.env.META_APP_SECRET ?? '';
}

function createEncryptionKey() {
  const secret = getEncryptionSecret();

  if (!secret) {
    throw new Error('Meta encryption secret is missing.');
  }

  return createHash('sha256').update(secret).digest();
}

function encryptValue(value: string) {
  const iv = randomBytes(12);
  const key = createEncryptionKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptValue(value: string) {
  const [ivRaw, authTagRaw, encryptedRaw] = value.split('.');

  if (!ivRaw || !authTagRaw || !encryptedRaw) {
    throw new Error('Malformed encrypted Meta payload.');
  }

  const decipher = createDecipheriv('aes-256-gcm', createEncryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

function isMissingTableError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';

  return code === '42P01' || /integration_connections/i.test(message);
}

function safeDbMessage(error: unknown) {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : 'unknown error';
  return message.slice(0, 240);
}

async function resolveCompanyId(workspaceSlug: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('companies')
    .select('id,slug')
    .eq('slug', workspaceSlug)
    .maybeSingle();

  if (error) {
    console.warn('[meta.persistence] unable to resolve company by workspace', {
      workspaceSlug,
      reason: safeDbMessage(error)
    });
    return null;
  }

  return data?.id ?? null;
}

export function getMetaTokenCookieName() {
  return META_COOKIE_NAME;
}

export function serializeMetaCookieConnection(connection: MetaStoredConnection) {
  return encryptValue(JSON.stringify(connection));
}

export function parseMetaCookieConnection(value?: string | null): MetaStoredConnection | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decryptValue(value)) as Partial<MetaStoredConnection>;

    if (
      parsed.provider !== 'meta-graph' ||
      !parsed.pageAccessToken ||
      !parsed.pageId ||
      !parsed.instagramAccountId
    ) {
      return null;
    }

    return {
      provider: 'meta-graph',
      pageAccessToken: parsed.pageAccessToken,
      pageId: parsed.pageId,
      pageName: parsed.pageName,
      instagramAccountId: parsed.instagramAccountId,
      instagramUsername: parsed.instagramUsername,
      scopes: Array.isArray(parsed.scopes) ? parsed.scopes.filter((scope): scope is string => typeof scope === 'string') : [],
      tokenType: parsed.tokenType
    };
  } catch {
    return null;
  }
}

export async function persistMetaConnection(input: PersistMetaConnectionInput) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { persisted: false as const, reason: 'missing-supabase-admin' };
  }

  const companyId = await resolveCompanyId(input.workspaceSlug);

  if (!companyId) {
    return { persisted: false as const, reason: 'workspace-not-found' };
  }

  const row = {
    company_id: companyId,
    provider: input.provider,
    status: 'connected',
    page_id: input.pageId,
    page_name: input.pageName ?? null,
    instagram_account_id: input.instagramAccountId,
    instagram_username: input.instagramUsername ?? null,
    access_token_encrypted: encryptValue(input.pageAccessToken),
    token_type: input.tokenType ?? null,
    scopes: input.scopes,
    metadata: input.metadata ?? {},
    last_synced_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('integration_connections')
    .upsert(row, { onConflict: 'company_id,provider' });

  if (error) {
    if (isMissingTableError(error)) {
      console.warn('[meta.persistence] integration_connections table is missing; skipping persistence.');
      return { persisted: false as const, reason: 'schema-missing' };
    }

    console.error('[meta.persistence] failed to persist Meta connection', {
      workspaceSlug: input.workspaceSlug,
      reason: safeDbMessage(error)
    });
    return { persisted: false as const, reason: 'db-error' };
  }

  return { persisted: true as const };
}

export async function loadMetaConnection(workspaceSlug: string): Promise<(MetaStoredConnection & {
  metadata: Record<string, unknown>;
}) | null> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const companyId = await resolveCompanyId(workspaceSlug);

  if (!companyId) {
    return null;
  }

  const { data, error } = await supabase
    .from('integration_connections')
    .select(
      'company_id,provider,status,page_id,page_name,instagram_account_id,instagram_username,access_token_encrypted,token_type,scopes,metadata,last_synced_at'
    )
    .eq('company_id', companyId)
    .eq('provider', 'meta-graph')
    .eq('status', 'connected')
    .maybeSingle<PersistedMetaConnectionRow>();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[meta.persistence] unable to load Meta connection', {
        workspaceSlug,
        reason: safeDbMessage(error)
      });
    }
    return null;
  }

  if (!data?.access_token_encrypted || !data.page_id || !data.instagram_account_id) {
    return null;
  }

  try {
    return {
      provider: 'meta-graph',
      pageAccessToken: decryptValue(data.access_token_encrypted),
      pageId: data.page_id,
      pageName: data.page_name ?? undefined,
      instagramAccountId: data.instagram_account_id,
      instagramUsername: data.instagram_username ?? undefined,
      scopes: Array.isArray(data.scopes) ? data.scopes.filter((scope): scope is string => typeof scope === 'string') : [],
      tokenType: data.token_type ?? undefined,
      metadata: data.metadata ?? {}
    };
  } catch (error) {
    console.error('[meta.persistence] failed to decrypt stored Meta connection', {
      workspaceSlug,
      reason: safeDbMessage(error)
    });
    return null;
  }
}

export async function deleteMetaConnection(workspaceSlug: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { deleted: false as const, reason: 'missing-supabase-admin' };
  }

  const companyId = await resolveCompanyId(workspaceSlug);

  if (!companyId) {
    return { deleted: false as const, reason: 'workspace-not-found' };
  }

  const { error } = await supabase
    .from('integration_connections')
    .delete()
    .eq('company_id', companyId)
    .eq('provider', 'meta-graph');

  if (error) {
    if (isMissingTableError(error)) {
      return { deleted: false as const, reason: 'schema-missing' };
    }

    console.warn('[meta.persistence] failed to delete Meta connection', {
      workspaceSlug,
      reason: safeDbMessage(error)
    });
    return { deleted: false as const, reason: 'db-error' };
  }

  return { deleted: true as const };
}
