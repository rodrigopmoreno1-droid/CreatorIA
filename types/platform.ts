export type PlatformModuleKey =
  | 'dashboard'
  | 'roteiros'
  | 'calendario'
  | 'creators'
  | 'metrics'
  | 'products'
  | 'ai'
  | 'competitors';

export type ProductItem = {
  id: string;
  name: string;
  benefits: string;
  audience: string;
  price: string;
  discountPrice: string;
  restrictions: string;
  pain: string;
  benefit: string;
  createdAt: string;
};

export type ProductDraft = {
  name: string;
  benefits: string;
  audience: string;
  price: string;
  discountPrice: string;
  restrictions: string;
  pain: string;
  benefit: string;
};

export type ScriptStatus =
  | 'draft'
  | 'approved'
  | 'production'
  | 'recording'
  | 'drive'
  | 'editing'
  | 'edited'
  | 'scheduled'
  | 'posted'
  | 'atrasado';

/** Statuses that appear in the Conteúdo page */
export const CONTENT_STATUSES: ScriptStatus[] = ['draft', 'approved'];

/** Statuses that appear in the Produção kanban */
export const PRODUCTION_STATUSES: ScriptStatus[] = ['production', 'recording', 'drive', 'editing'];

/** Statuses that appear in the calendário/publicação flow */
export const POSTING_STATUSES: ScriptStatus[] = ['edited', 'scheduled', 'posted', 'atrasado'];

export type ScriptPlannerMeta = {
  source: 'planner';
  batchId: string;
  rangeStart: string;
  rangeEnd: string;
  mode: 'create' | 'replan';
  reason: string;
  templateId?: string;
  productRuleId?: string;
  fixedWeekdays?: number[];
  fixedPlacement?: boolean;
  storiesInPeriod?: number;
  slotType?: 'feed' | 'stories';
  slotIndex?: number;
  sequenceSize?: number;
};

export type PlannerBatchStatus = 'queued' | 'running' | 'completed' | 'error';

export type PlannerBatchSummary = {
  totalDays: number;
  totalFeedPosts: number;
  totalStoryPosts: number;
  totalPosts: number;
  products: Array<{
    productId: string;
    productName: string;
    scheduledDates: string[];
    fixedDates: string[];
    storiesTotal: number;
  }>;
  generatedScripts?: number;
  failedScripts?: number;
};

export type PlannerBatchItem = {
  id: string;
  mode: 'create' | 'replan';
  status: PlannerBatchStatus;
  reason: string;
  rangeStart: string;
  rangeEnd: string;
  progressTotal: number;
  progressCompleted: number;
  errorMessage: string;
  summary: PlannerBatchSummary | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  completedAt: string;
};

export type RecordingField = {
  key: string;
  value: string;
};

export type StorySlide = {
  objetivo: string;
  textoTela: string;
  falado: string;
  visual: string;
};

export type CarrosselSlide = {
  numero: number;
  titulo: string;
  subtitulo: string;
  conteudo: string;
  visual: string;
};

export type PostFields = {
  conceito: string;
  tituloPeca: string;
  textoApoio: string;
  direcaoVisual: string;
};

export type ScriptItem = {
  id: string;
  title: string;
  productId?: string;
  productName?: string;
  prompt: string;
  referenceContext: string;
  hook: string;
  spoken: string;
  takes: string[];
  cta: string;
  caption: string;
  contentType: string;
  subOption: string;
  storySlides: StorySlide[];
  carrosselSlides: CarrosselSlide[];
  postFields: PostFields | null;
  status: ScriptStatus;
  scheduledFor: string;
  plannerMeta: ScriptPlannerMeta | null;
  createdAt: string;
  updatedAt: string;
};

export type RecordingColumnKey = 'approved' | 'production' | 'recording' | 'drive' | 'editing' | 'edited' | 'scheduled' | 'posted';

export type RecordingCard = {
  id: string;
  scriptId: string;
  title: string;
  category: string;
  dueDate: string;
  labels: string[];
  fields: RecordingField[];
  hook: string;
  spoken: string;
  takes: string[];
  cta: string;
  caption: string;
  contentType: string;
  productName?: string;
  assignee?: string;
  blockType?: string;
  column: RecordingColumnKey;
  order: number;
  notes: string;
  driveUrl?: string;
  updatedAt: string;
};

export type CreatorItem = {
  id: string;
  name: string;
  handle: string;
  niche: string;
  status: string;
  notes: string;
};

export type PostItem = {
  id: string;
  title: string;
  channel: 'Feed' | 'Reels' | 'Stories';
  status: 'draft' | 'scheduled' | 'published';
  scheduledFor: string;
};

export type CompetitorItem = {
  id: string;
  name: string;
  handle: string;
  note: string;
};

export type AiMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type AiConversation = {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedByUserId: string | null;
};

export type WorkspacePlatformState = {
  companyName: string;
  companyDescription: string;
  products: ProductItem[];
  scripts: ScriptItem[];
  recordings: RecordingCard[];
  posts: PostItem[];
  creators: CreatorItem[];
  competitors: CompetitorItem[];
  aiConversations: AiConversation[];
  aiMessages: AiMessage[];
};
