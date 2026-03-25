import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getWorkspaceContextForSlug, type WorkspaceContext } from '@/lib/workspace-server';
import type {
  ProductItem,
  RecordingCard,
  RecordingColumnKey,
  RecordingField,
  ScriptItem
} from '@/types/platform';

type ProductRow = {
  id: string;
  name: string;
  benefits: string | null;
  audience: string | null;
  price: number | string | null;
  restrictions: string | null;
  created_at: string;
};

type ScriptRow = {
  id: string;
  title: string;
  hook: string | null;
  spoken_text: string | null;
  cta: string | null;
  storyboard: unknown;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type ScriptMetadata = {
  caption?: string;
  prompt?: string;
  referenceContext?: string;
  takes?: string[];
  productId?: string;
  productName?: string;
  boardOrder?: number;
  notes?: string;
  driveUrl?: string;
  category?: string;
  dueDate?: string;
  labels?: string[];
  fields?: RecordingField[];
};

const recordingColumns = new Set<RecordingColumnKey>(['approved', 'recording', 'drive', 'edited']);

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeRecordingFields(value: unknown): RecordingField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const raw = item as Record<string, unknown>;
      const key = normalizeString(raw.key).trim();
      const valueText = normalizeString(raw.value).trim();

      if (!key && !valueText) {
        return null;
      }

      return {
        key,
        value: valueText
      };
    })
    .filter((item): item is RecordingField => Boolean(item));
}

export function parseScriptMetadata(storyboard: unknown): ScriptMetadata {
  if (!storyboard) {
    return {};
  }

  if (Array.isArray(storyboard)) {
    return {
      takes: normalizeStringArray(storyboard)
    };
  }

  if (typeof storyboard === 'object') {
    const raw = storyboard as Record<string, unknown>;

    return {
      caption: normalizeString(raw.caption),
      prompt: normalizeString(raw.prompt),
      referenceContext: normalizeString(raw.referenceContext),
      takes: normalizeStringArray(raw.takes),
      productId: normalizeString(raw.productId) || undefined,
      productName: normalizeString(raw.productName) || undefined,
      boardOrder: typeof raw.boardOrder === 'number' ? raw.boardOrder : 0,
      notes: normalizeString(raw.notes),
      driveUrl: normalizeString(raw.driveUrl),
      category: normalizeString(raw.category),
      dueDate: normalizeString(raw.dueDate),
      labels: normalizeStringArray(raw.labels),
      fields: normalizeRecordingFields(raw.fields)
    };
  }

  return {};
}

export function buildScriptMetadata(input: {
  caption?: string;
  prompt?: string;
  referenceContext?: string;
  takes?: string[];
  productId?: string;
  productName?: string;
  boardOrder?: number;
  notes?: string;
  driveUrl?: string;
  category?: string;
  dueDate?: string;
  labels?: string[];
  fields?: RecordingField[];
}) {
  return {
    caption: input.caption ?? '',
    prompt: input.prompt ?? '',
    referenceContext: input.referenceContext ?? '',
    takes: input.takes ?? [],
    productId: input.productId ?? '',
    productName: input.productName ?? '',
    boardOrder: input.boardOrder ?? 0,
    notes: input.notes ?? '',
    driveUrl: input.driveUrl ?? '',
    category: input.category ?? '',
    dueDate: input.dueDate ?? '',
    labels: input.labels ?? [],
    fields: input.fields ?? []
  };
}

export function toProductItem(row: ProductRow): ProductItem {
  return {
    id: row.id,
    name: row.name,
    benefits: row.benefits ?? '',
    audience: row.audience ?? '',
    price: row.price == null ? '' : String(row.price),
    restrictions: row.restrictions ?? '',
    createdAt: row.created_at
  };
}

export function toScriptItem(row: ScriptRow): ScriptItem {
  const meta = parseScriptMetadata(row.storyboard);
  const status = row.status;

  return {
    id: row.id,
    title: row.title,
    productId: meta.productId,
    productName: meta.productName,
    prompt: meta.prompt ?? '',
    referenceContext: meta.referenceContext ?? '',
    hook: row.hook ?? '',
    spoken: row.spoken_text ?? '',
    takes: meta.takes ?? [],
    cta: row.cta ?? '',
    caption: meta.caption ?? '',
    status:
      status === 'draft' || status === 'approved' || status === 'recording' || status === 'drive' || status === 'edited'
        ? status
        : 'approved',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toRecordingCard(row: ScriptRow): RecordingCard | null {
  const column = recordingColumns.has((row.status ?? '') as RecordingColumnKey)
    ? (row.status as RecordingColumnKey)
    : null;

  if (!column) {
    return null;
  }

  const meta = parseScriptMetadata(row.storyboard);

  return {
    id: row.id,
    scriptId: row.id,
    title: row.title,
    category: meta.category ?? '',
    dueDate: meta.dueDate ?? '',
    labels: meta.labels ?? [],
    fields: meta.fields ?? [],
    hook: row.hook ?? '',
    spoken: row.spoken_text ?? '',
    takes: meta.takes ?? [],
    cta: row.cta ?? '',
    caption: meta.caption ?? '',
    column,
    order: meta.boardOrder ?? 0,
    notes: meta.notes ?? '',
    driveUrl: meta.driveUrl,
    updatedAt: row.updated_at
  };
}

export async function resolveWorkspaceDataAccess(workspaceSlug: string) {
  const context = await getWorkspaceContextForSlug(workspaceSlug);

  if (!context) {
    return null;
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error('Supabase admin client indisponivel.');
  }

  return {
    admin,
    context
  };
}

export async function getWorkspaceProducts(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return [];
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('products')
    .select('id,name,benefits,audience,price,restrictions,created_at')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toProductItem(row as ProductRow));
}

export async function getWorkspaceScripts(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return [];
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('scripts')
    .select('id,title,hook,spoken_text,cta,storyboard,status,created_at,updated_at')
    .eq('company_id', context.companyId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toScriptItem(row as ScriptRow));
}

export async function getWorkspaceRecordings(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return [];
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('scripts')
    .select('id,title,hook,spoken_text,cta,storyboard,status,created_at,updated_at')
    .eq('company_id', context.companyId)
    .in('status', ['approved', 'recording', 'drive', 'edited'])
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => toRecordingCard(row as ScriptRow))
    .filter((item): item is RecordingCard => Boolean(item))
    .sort((left, right) => {
      if (left.column === right.column) {
        return left.order - right.order;
      }

      return left.updatedAt.localeCompare(right.updatedAt);
    });
}

export async function getWorkspaceDashboardData(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return {
      context: null,
      products: [] as ProductItem[],
      scripts: [] as ScriptItem[],
      recordings: [] as RecordingCard[],
      postsCount: 0
    };
  }

  const [products, scripts, recordings, postsCount] = await Promise.all([
    getWorkspaceProducts(workspaceSlug),
    getWorkspaceScripts(workspaceSlug),
    getWorkspaceRecordings(workspaceSlug),
    getWorkspacePostsCount(access.context)
  ]);

  return {
    context: access.context,
    products,
    scripts,
    recordings,
    postsCount
  };
}

async function getWorkspacePostsCount(context: WorkspaceContext) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return 0;
  }

  const { count } = await admin
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', context.companyId);

  return count ?? 0;
}
