import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser, getWorkspaceContextForSlug, type WorkspaceContext } from '@/lib/workspace-server';
import type {
  AiConversation,
  AiMessage,
  CarrosselSlide,
  PlannerBatchItem,
  PlannerBatchSummary,
  PostFields,
  ProductItem,
  RecordingCard,
  RecordingColumnKey,
  RecordingField,
  ScriptPlannerMeta,
  ScriptItem,
  StorySlide
} from '@/types/platform';
import type {
  CompetitorAnalysis,
  CompetitorAnalysisStatus,
  CompetitorRecord,
  CompetitorSourceSnapshot,
  CompetitorType,
  ContentReferenceRecord
} from '@/types/competitor-intelligence';

type ProductRow = {
  id: string;
  name: string;
  benefits: string | null;
  audience: string | null;
  price: number | string | null;
  restrictions: string | null;
  metadata: unknown;
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

type AiConversationRow = {
  id: string;
  company_id: string;
  title: string;
  created_by_user_id: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by_user_id?: string | null;
};

type AiMessageRow = {
  id: string;
  conversation_id: string;
  company_id: string;
  role: 'user' | 'assistant' | null;
  content: string;
  created_at: string;
};

type CompetitorRow = {
  id: string;
  company_id: string;
  name: string;
  handle: string | null;
  niche: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profile_type?: string | null;
  logo_url?: string | null;
  tags?: unknown;
  analysis_status?: string | null;
  analysis_error?: string | null;
  analysis?: unknown;
  source_snapshot?: unknown;
  last_analyzed_at?: string | null;
};

type ContentReferenceRow = {
  id: string;
  company_id: string;
  competitor_id: string | null;
  title: string;
  content: string;
  hook_type: string | null;
  cta_type: string | null;
  format: string | null;
  image_url: string | null;
  notes: string | null;
  liked: boolean | null;
  category: string | null;
  source: string | null;
  source_insight_id: string | null;
  source_url: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
  competitors?: {
    name?: string | null;
  } | null;
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
  contentType?: string;
  subOption?: string;
  storySlides?: StorySlide[];
  carrosselSlides?: CarrosselSlide[];
  postFields?: PostFields;
  assignee?: string;
  blockType?: string;
  scheduledFor?: string;
  plannerMeta?: ScriptPlannerMeta | null;
};

type PlannerBatchRow = {
  id: string;
  company_id: string;
  mode: string | null;
  status: string | null;
  range_start: string;
  range_end: string;
  reason: string | null;
  progress_total: number | null;
  progress_completed: number | null;
  error_message: string | null;
  summary: unknown;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type WorkspaceDataAccess = {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  context: WorkspaceContext;
};

const recordingColumns = new Set<RecordingColumnKey>(['approved', 'production', 'recording', 'drive', 'editing', 'edited', 'scheduled', 'posted']);

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeJsonObject<T extends Record<string, unknown>>(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : null;
}

function normalizePlannerMeta(value: unknown): ScriptPlannerMeta | null {
  const meta = normalizeJsonObject<Record<string, unknown>>(value);

  if (!meta || normalizeString(meta.source) !== 'planner') {
    return null;
  }

  const batchId = normalizeString(meta.batchId);
  const rangeStart = normalizeString(meta.rangeStart);
  const rangeEnd = normalizeString(meta.rangeEnd);

  if (!batchId || !rangeStart || !rangeEnd) {
    return null;
  }

  return {
    source: 'planner',
    batchId,
    rangeStart,
    rangeEnd,
    mode: normalizeString(meta.mode) === 'replan' ? 'replan' : 'create',
    reason: normalizeString(meta.reason),
    templateId: normalizeString(meta.templateId) || undefined,
    productRuleId: normalizeString(meta.productRuleId) || undefined,
    fixedWeekdays: (Array.isArray(meta.fixedWeekdays) ? meta.fixedWeekdays : [])
      .filter((item): item is number => typeof item === 'number' && item >= 0 && item <= 6),
    fixedPlacement: typeof meta.fixedPlacement === 'boolean' ? meta.fixedPlacement : undefined,
    storiesInPeriod: typeof meta.storiesInPeriod === 'number' ? meta.storiesInPeriod : undefined,
    slotType:
      normalizeString(meta.slotType) === 'stories'
        ? 'stories'
        : normalizeString(meta.slotType) === 'feed'
          ? 'feed'
          : undefined,
    slotIndex: typeof meta.slotIndex === 'number' ? meta.slotIndex : undefined,
    sequenceSize: typeof meta.sequenceSize === 'number' ? meta.sequenceSize : undefined
  };
}

function normalizePlannerBatchSummary(value: unknown): PlannerBatchSummary | null {
  const summary = normalizeJsonObject<Record<string, unknown>>(value);

  if (!summary) {
    return null;
  }

  const rawProducts = Array.isArray(summary.products) ? summary.products : [];

  return {
    totalDays: typeof summary.totalDays === 'number' ? summary.totalDays : 0,
    totalFeedPosts: typeof summary.totalFeedPosts === 'number' ? summary.totalFeedPosts : 0,
    totalStoryPosts: typeof summary.totalStoryPosts === 'number' ? summary.totalStoryPosts : 0,
    totalPosts: typeof summary.totalPosts === 'number' ? summary.totalPosts : 0,
    generatedScripts: typeof summary.generatedScripts === 'number' ? summary.generatedScripts : undefined,
    failedScripts: typeof summary.failedScripts === 'number' ? summary.failedScripts : undefined,
    products: rawProducts
      .map((item) => {
        const product = normalizeJsonObject<Record<string, unknown>>(item);

        if (!product) {
          return null;
        }

        const productId = normalizeString(product.productId);
        const productName = normalizeString(product.productName);

        if (!productId || !productName) {
          return null;
        }

        return {
          productId,
          productName,
          scheduledDates: normalizeStringArray(product.scheduledDates),
          fixedDates: normalizeStringArray(product.fixedDates),
          storiesTotal: typeof product.storiesTotal === 'number' ? product.storiesTotal : 0
        };
      })
      .filter((item): item is PlannerBatchSummary['products'][number] => Boolean(item))
  };
}

function toPlannerBatchItem(row: PlannerBatchRow): PlannerBatchItem {
  return {
    id: row.id,
    mode: row.mode === 'replan' ? 'replan' : 'create',
    status:
      row.status === 'running' || row.status === 'completed' || row.status === 'error'
        ? row.status
        : 'queued',
    reason: row.reason ?? '',
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    progressTotal: row.progress_total ?? 0,
    progressCompleted: row.progress_completed ?? 0,
    errorMessage: row.error_message ?? '',
    summary: normalizePlannerBatchSummary(row.summary),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at ?? '',
    completedAt: row.completed_at ?? ''
  };
}

function normalizeCompetitorSourceSnapshot(value: unknown): CompetitorSourceSnapshot | null {
  const snapshot = normalizeJsonObject<Record<string, unknown>>(value);

  if (!snapshot) {
    return null;
  }

  const rawTopPosts = Array.isArray(snapshot.topPosts) ? snapshot.topPosts : [];

  return {
    fetchedAt: normalizeString(snapshot.fetchedAt),
    instagram: normalizeJsonObject(snapshot.instagram) as CompetitorSourceSnapshot['instagram'],
    website: normalizeJsonObject(snapshot.website) as CompetitorSourceSnapshot['website'],
    postsAnalyzed: typeof snapshot.postsAnalyzed === 'number' ? snapshot.postsAnalyzed : 0,
    reelsAnalyzed: typeof snapshot.reelsAnalyzed === 'number' ? snapshot.reelsAnalyzed : 0,
    feedAnalyzed: typeof snapshot.feedAnalyzed === 'number' ? snapshot.feedAnalyzed : 0,
    captureNotes: normalizeStringArray(snapshot.captureNotes),
    topPosts: rawTopPosts as CompetitorSourceSnapshot['topPosts']
  };
}

function normalizeCompetitorAnalysis(value: unknown): CompetitorAnalysis | null {
  const analysis = normalizeJsonObject<Record<string, unknown>>(value);

  if (!analysis) {
    return null;
  }

  const overview = normalizeJsonObject<Record<string, unknown>>(analysis.overview);
  const practicalSuggestions = normalizeJsonObject<Record<string, unknown>>(analysis.practicalSuggestions);
  const sourceSnapshot = normalizeCompetitorSourceSnapshot(analysis.sourceSnapshot);
  const rawSections = Array.isArray(analysis.sections) ? analysis.sections : [];

  if (!overview || !practicalSuggestions || !sourceSnapshot) {
    return null;
  }

  const sections = rawSections
    .map((section) => {
      const record = normalizeJsonObject<Record<string, unknown>>(section);

      if (!record) {
        return null;
      }

      const rawItems = Array.isArray(record.items)
        ? record.items
        : Array.isArray(record.insights)
          ? record.insights
          : [];

      const items = rawItems
        .map((item) => {
          const insight = normalizeJsonObject<Record<string, unknown>>(item);

          if (!insight) {
            return null;
          }

          const title = normalizeString(insight.title);
          const summary = normalizeString(insight.summary);

          if (!title || !summary) {
            return null;
          }

          return {
            id: normalizeString(insight.id),
            kind: (normalizeString(insight.kind) || 'idea') as CompetitorAnalysis['sections'][number]['items'][number]['kind'],
            title,
            summary,
            rationale: normalizeString(insight.rationale),
            tags: normalizeStringArray(insight.tags),
            hookType: normalizeString(insight.hookType),
            ctaType: normalizeString(insight.ctaType),
            format: normalizeString(insight.format),
            sample: normalizeString(insight.sample),
            sourceUrl: normalizeString(insight.sourceUrl)
          };
        })
        .filter((item): item is CompetitorAnalysis['sections'][number]['items'][number] => Boolean(item));

      if (!items.length) {
        return null;
      }

      return {
        id: normalizeString(record.id) || normalizeString(record.key),
        title: normalizeString(record.title),
        description: normalizeString(record.description),
        items
      };
    })
    .filter((section): section is CompetitorAnalysis['sections'][number] => Boolean(section?.title && section.items.length));

  if (!sections.length) {
    return null;
  }

  return {
    generatedAt: normalizeString(analysis.generatedAt),
    model: normalizeString(analysis.model),
    overview: {
      toneOfVoice: normalizeString(overview.toneOfVoice),
      positioning: normalizeString(overview.positioning),
      apparentAudience: normalizeString(overview.apparentAudience),
      visualStyle: normalizeString(overview.visualStyle)
    },
    sections,
    practicalSuggestions: {
      toContent: normalizeStringArray(practicalSuggestions.toContent),
      toCreatorAi: normalizeStringArray(practicalSuggestions.toCreatorAi),
      toReferenceBank: normalizeStringArray(practicalSuggestions.toReferenceBank)
    },
    sourceSnapshot
  };
}

function normalizeCompetitorType(value: unknown): CompetitorType {
  return value === 'reference' || value === 'inspiration' ? value : 'competitor';
}

function normalizeCompetitorAnalysisStatus(value: unknown): CompetitorAnalysisStatus {
  return value === 'capturing' ||
    value === 'processing' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'insufficient_data' ||
    value === 'error'
    ? value
    : 'idle';
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

function parseProductMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const raw = metadata as Record<string, unknown>;

  return {
    discountPrice: normalizeString(raw.discountPrice ?? raw.discount_price),
    pain: normalizeString(raw.pain),
    benefit: normalizeString(raw.benefit)
  };
}

function trimToTitle(input: string) {
  return input.trim().replace(/\s+/g, ' ').slice(0, 64) || 'Nova conversa';
}

const AI_CONVERSATION_TRASH_RETENTION_DAYS = 30;
const AI_CONVERSATION_TRASH_SELECT =
  'id,company_id,title,created_by_user_id,last_message_at,created_at,updated_at,deleted_at,deleted_by_user_id';
const AI_CONVERSATION_SELECT = 'id,company_id,title,created_by_user_id,last_message_at,created_at,updated_at';

let aiConversationTrashColumnsSupported: boolean | null = null;

function getAiConversationTrashCutoffIso() {
  return new Date(Date.now() - AI_CONVERSATION_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '42703' || /column .* does not exist/i.test(error?.message ?? '');
}

async function detectAiConversationTrashColumns(access: WorkspaceDataAccess) {
  if (aiConversationTrashColumnsSupported !== null) {
    return aiConversationTrashColumnsSupported;
  }

  const { error } = await access.admin.from('ai_conversations').select('deleted_at').eq('company_id', access.context.companyId).limit(1);

  if (error && isMissingColumnError(error)) {
    aiConversationTrashColumnsSupported = false;
    return false;
  }

  if (error) {
    throw new Error(error.message);
  }

  aiConversationTrashColumnsSupported = true;
  return true;
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
      fields: normalizeRecordingFields(raw.fields),
      storySlides: Array.isArray(raw.storySlides) ? (raw.storySlides as StorySlide[]) : [],
      carrosselSlides: Array.isArray(raw.carrosselSlides) ? (raw.carrosselSlides as CarrosselSlide[]) : [],
      postFields: (raw.postFields && typeof raw.postFields === 'object') ? (raw.postFields as PostFields) : undefined,
      assignee: normalizeString(raw.assignee) || undefined,
      blockType: normalizeString(raw.blockType) || undefined,
      contentType: normalizeString(raw.contentType) || undefined,
      subOption: normalizeString(raw.subOption) || undefined,
      scheduledFor: normalizeString(raw.scheduledFor) || undefined,
      plannerMeta: normalizePlannerMeta(raw.plannerMeta)
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
  contentType?: string;
  subOption?: string;
  storySlides?: StorySlide[];
  carrosselSlides?: CarrosselSlide[];
  postFields?: PostFields | null;
  assignee?: string;
  blockType?: string;
  scheduledFor?: string;
  plannerMeta?: ScriptPlannerMeta | null;
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
    fields: input.fields ?? [],
    contentType: input.contentType ?? '',
    subOption: input.subOption ?? '',
    storySlides: input.storySlides ?? [],
    carrosselSlides: input.carrosselSlides ?? [],
    postFields: input.postFields ?? null,
    assignee: input.assignee ?? '',
    blockType: input.blockType ?? '',
    scheduledFor: input.scheduledFor ?? '',
    plannerMeta: input.plannerMeta ?? null
  };
}

export function toProductItem(row: ProductRow): ProductItem {
  const metadata = parseProductMetadata(row.metadata);

  return {
    id: row.id,
    name: row.name,
    benefits: row.benefits ?? '',
    audience: row.audience ?? '',
    price: row.price == null ? '' : String(row.price),
    discountPrice: metadata.discountPrice ?? '',
    restrictions: row.restrictions ?? '',
    pain: metadata.pain ?? '',
    benefit: metadata.benefit ?? '',
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
    contentType: meta.contentType ?? '',
    subOption: meta.subOption ?? '',
    storySlides: meta.storySlides ?? [],
    carrosselSlides: meta.carrosselSlides ?? [],
    postFields: meta.postFields ?? null,
    status:
      status === 'draft' ||
      status === 'approved' ||
      status === 'production' ||
      status === 'recording' ||
      status === 'drive' ||
      status === 'editing' ||
      status === 'edited' ||
      status === 'scheduled' ||
      status === 'posted'
        ? status
        : 'approved',
    scheduledFor: meta.scheduledFor ?? '',
    plannerMeta: meta.plannerMeta ?? null,
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
    contentType: meta.contentType ?? '',
    productName: meta.productName,
    assignee: meta.assignee,
    blockType: meta.blockType,
    column,
    order: meta.boardOrder ?? 0,
    notes: meta.notes ?? '',
    driveUrl: meta.driveUrl,
    updatedAt: row.updated_at
  };
}

export function toAiConversationItem(row: AiConversationRow): AiConversation {
  return {
    id: row.id,
    title: row.title,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
    deletedByUserId: row.deleted_by_user_id ?? null
  };
}

export function toAiMessageItem(row: AiMessageRow): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    createdAt: row.created_at
  };
}

export function toCompetitorRecord(row: CompetitorRow): CompetitorRecord {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle ?? '',
    website: row.website ?? '',
    type: normalizeCompetitorType(row.profile_type),
    logoUrl: row.logo_url ?? '',
    niche: row.niche ?? '',
    notes: row.notes ?? '',
    tags: normalizeStringArray(row.tags),
    analysisStatus: normalizeCompetitorAnalysisStatus(row.analysis_status),
    analysisError: row.analysis_error ?? '',
    analysis: normalizeCompetitorAnalysis(row.analysis),
    sourceSnapshot: normalizeCompetitorSourceSnapshot(row.source_snapshot),
    lastAnalyzedAt: row.last_analyzed_at ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toContentReferenceItem(row: ContentReferenceRow): ContentReferenceRecord {
  const metadata = normalizeJsonObject<Record<string, unknown>>(row.metadata) ?? {};

  return {
    id: row.id,
    competitorId: row.competitor_id ?? '',
    competitorName: row.competitors?.name ?? normalizeString(metadata.competitorName),
    title: row.title,
    content: row.content,
    hookType: row.hook_type ?? '',
    ctaType: row.cta_type ?? '',
    format: row.format ?? '',
    imageUrl: row.image_url ?? '',
    notes: row.notes ?? '',
    liked: Boolean(row.liked),
    savedAt: row.created_at,
    category: row.category ?? '',
    source: row.source === 'analysis' ? 'analysis' : 'manual',
    sourceInsightId: row.source_insight_id ?? '',
    sourceUrl: row.source_url ?? '',
    metadata
  };
}

export async function resolveWorkspaceDataAccess(workspaceSlug: string): Promise<WorkspaceDataAccess | null> {
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
    .select('id,name,benefits,audience,price,restrictions,metadata,created_at')
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

export async function getWorkspacePlannerBatches(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return [] as PlannerBatchItem[];
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('content_planner_batches')
    .select('id,company_id,mode,status,range_start,range_end,reason,progress_total,progress_completed,error_message,summary,created_at,updated_at,started_at,completed_at')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toPlannerBatchItem(row as PlannerBatchRow));
}

export async function getWorkspaceCompetitors(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return [] as CompetitorRecord[];
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('competitors')
    .select('id,company_id,name,handle,niche,website,notes,created_at,updated_at,profile_type,logo_url,tags,analysis_status,analysis_error,analysis,source_snapshot,last_analyzed_at')
    .eq('company_id', context.companyId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toCompetitorRecord(row as CompetitorRow));
}

export async function getWorkspaceContentReferences(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return [] as ContentReferenceRecord[];
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('content_references')
    .select('id,company_id,competitor_id,title,content,hook_type,cta_type,format,image_url,notes,liked,category,source,source_insight_id,source_url,metadata,created_at,updated_at,competitors(name)')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toContentReferenceItem(row as ContentReferenceRow));
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
    .in('status', ['approved', 'production', 'recording', 'drive', 'editing', 'edited', 'scheduled', 'posted'])
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

export async function getWorkspaceAiConversations(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return [];
  }

  await purgeExpiredDeletedAiConversations(access);

  const { admin, context } = access;
  const supportsTrashColumns = await detectAiConversationTrashColumns(access);
  const { data, error } = supportsTrashColumns
    ? await admin
        .from('ai_conversations')
        .select(AI_CONVERSATION_TRASH_SELECT)
        .eq('company_id', context.companyId)
        .is('deleted_at', null)
        .order('last_message_at', { ascending: false })
    : await admin
        .from('ai_conversations')
        .select(AI_CONVERSATION_SELECT)
        .eq('company_id', context.companyId)
        .order('last_message_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toAiConversationItem(row as AiConversationRow));
}

export async function getWorkspaceAiTrashConversations(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return [];
  }

  const supportsTrashColumns = await detectAiConversationTrashColumns(access);

  if (!supportsTrashColumns) {
    return [];
  }

  await purgeExpiredDeletedAiConversations(access);

  const { admin, context } = access;
  const { data, error } = await admin
    .from('ai_conversations')
    .select(AI_CONVERSATION_TRASH_SELECT)
    .eq('company_id', context.companyId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toAiConversationItem(row as AiConversationRow));
}

export async function supportsWorkspaceAiTrashColumns(workspaceSlug: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return false;
  }

  return detectAiConversationTrashColumns(access);
}

export async function getWorkspaceAiMessages(workspaceSlug: string, conversationId: string) {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return [];
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('ai_messages')
    .select('id,conversation_id,company_id,role,content,created_at')
    .eq('company_id', context.companyId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toAiMessageItem(row as AiMessageRow));
}

export async function createWorkspaceAiConversation(workspaceSlug: string, title = 'Nova conversa') {
  const access = await resolveWorkspaceDataAccess(workspaceSlug);

  if (!access) {
    return null;
  }

  const user = await getAuthenticatedUser();
  const { admin, context } = access;
  const supportsTrashColumns = await detectAiConversationTrashColumns(access);

  const insertPayload = {
    company_id: context.companyId,
    created_by_user_id: user?.id ?? null,
    title: trimToTitle(title),
    last_message_at: new Date().toISOString()
  };

  const { data, error } = supportsTrashColumns
    ? await admin
        .from('ai_conversations')
        .insert({
          ...insertPayload,
          deleted_at: null,
          deleted_by_user_id: null
        })
        .select(AI_CONVERSATION_TRASH_SELECT)
        .single()
    : await admin.from('ai_conversations').insert(insertPayload).select(AI_CONVERSATION_SELECT).single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Nao foi possivel criar a conversa.');
  }

  return toAiConversationItem(data as AiConversationRow);
}

async function purgeExpiredDeletedAiConversations(access: WorkspaceDataAccess) {
  const supportsTrashColumns = await detectAiConversationTrashColumns(access);

  if (!supportsTrashColumns) {
    return;
  }

  const cutoff = getAiConversationTrashCutoffIso();
  const { error } = await access.admin
    .from('ai_conversations')
    .delete()
    .eq('company_id', access.context.companyId)
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff);

  if (error) {
    throw new Error(error.message);
  }
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
