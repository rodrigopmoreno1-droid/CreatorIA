export type CompetitorType = 'competitor' | 'reference' | 'inspiration';

export type CompetitorAnalysisStatus =
  | 'idle'
  | 'capturing'
  | 'processing'
  | 'running'
  | 'insufficient_data'
  | 'completed'
  | 'error';

export type CompetitorDataQuality = 'unknown' | 'insufficient' | 'partial' | 'ready';

export type CompetitorCaptureSource = 'automatic' | 'apify' | 'manual_captions' | 'manual_script';

export type CompetitorContentFormat =
  | 'reels'
  | 'video'
  | 'carrossel'
  | 'image'
  | 'stories'
  | 'mixed'
  | 'unknown';

export type CompetitorConfidenceLevel = 'high' | 'medium' | 'low';

export type CompetitorReferenceCategory =
  | 'hook'
  | 'cta'
  | 'structure'
  | 'content_idea'
  | 'storytelling'
  | 'copy_angle'
  | 'offer'
  | 'social_proof'
  | 'format'
  | 'other';

export type CompetitorInsightKind =
  | 'overview'
  | 'theme'
  | 'format'
  | 'hook'
  | 'cta'
  | 'storytelling'
  | 'visual'
  | 'idea'
  | 'adaptation'
  | 'action'
  | 'engineering';

export type CompetitorCapturedPost = {
  id: string;
  shortcode: string;
  sourceUrl: string;
  format: CompetitorContentFormat;
  caption: string;
  captionLead: string;
  thumbnailUrl: string;
  mediaUrl: string;
  postedAt: string;
  metrics: {
    likes: number;
    comments: number;
    views: number;
    engagementScore: number;
    durationSeconds: number | null;
  };
  accessibilityCaption: string;
  transcriptText: string;
  transcriptStatus: 'success' | 'failed' | 'missing';
  transcriptSource: 'apify' | 'gemini' | 'openai' | 'manual' | 'none';
  transcriptConfidence: number | null;
  transcriptError: string;
  screenTextLead: string;
  hookPattern: string;
  ctaPatterns: string[];
  storytellingPatterns: string[];
};

export type CompetitorSourceSnapshot = {
  fetchedAt: string;
  instagram: {
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
  } | null;
  website: {
    url: string;
    title: string;
    description: string;
    iconUrl: string;
    logoUrl: string;
  } | null;
  postsAnalyzed: number;
  reelsAnalyzed: number;
  feedAnalyzed: number;
  captureNotes: string[];
  topPosts: CompetitorCapturedPost[];
};

export type CompetitorCaptureRecord = {
  id: string;
  competitorId: string;
  source: CompetitorCaptureSource;
  status: 'success' | 'partial' | 'error';
  bio: string;
  captions: string[];
  hashtags: string[];
  postTypes: string[];
  hooksDetected: string[];
  ctasDetected: string[];
  transcriptText: string[];
  captureNotes: string[];
  postsCaptured: number;
  reelsCaptured: number;
  feedCaptured: number;
  rawSnapshot: CompetitorSourceSnapshot | null;
  createdAt: string;
  updatedAt: string;
};

export type CompetitorPatternRecord = {
  id: string;
  competitorId: string;
  captureId: string;
  dataQuality: CompetitorDataQuality;
  tone: string;
  mostCommonCta: string;
  mostCommonHookType: string;
  mostCommonFormat: string;
  narrativeStructure: string;
  contentPillars: string[];
  recurringThemes: string[];
  topWords: string[];
  formatMix: Array<{ format: string; count: number; share: number }>;
  hookPatterns: string[];
  ctaPatterns: string[];
  patternSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CompetitorInsight = {
  id: string;
  kind: CompetitorInsightKind;
  title: string;
  summary: string;
  rationale: string;
  tags: string[];
  hookType: string;
  ctaType: string;
  format: string;
  sample: string;
  sourceUrl: string;
  confidenceLevel: CompetitorConfidenceLevel;
};

export type CompetitorAnalysisSection = {
  id: string;
  title: string;
  description: string;
  items: CompetitorInsight[];
};

export type CompetitorGeneratedContentKind =
  | 'hook'
  | 'structure'
  | 'reels'
  | 'stories'
  | 'carrossel'
  | 'cta'
  | 'copy_angle'
  | 'storytelling'
  | 'offer'
  | 'social_proof';

export type CompetitorGeneratedContentItem = {
  id: string;
  kind: CompetitorGeneratedContentKind;
  title: string;
  summary: string;
  rationale: string;
  tags: string[];
  hookType: string;
  ctaType: string;
  format: string;
  sample: string;
  sourceUrl: string;
  saveCategory: CompetitorReferenceCategory;
  structure: string;
  angle: string;
  confidenceLevel: CompetitorConfidenceLevel;
};

export type CompetitorGeneratedContentSection = {
  id: string;
  title: string;
  description: string;
  items: CompetitorGeneratedContentItem[];
};

export type CompetitorGeneratedContentPack = {
  generatedAt: string;
  model: string;
  summary: string;
  sections: CompetitorGeneratedContentSection[];
  sourceSnapshot: CompetitorSourceSnapshot;
};

export type CompetitorAnalysis = {
  generatedAt: string;
  model: string;
  overview: {
    toneOfVoice: string;
    positioning: string;
    apparentAudience: string;
    visualStyle: string;
  };
  sections: CompetitorAnalysisSection[];
  practicalSuggestions: {
    toContent: string[];
    toCreatorAi: string[];
    toReferenceBank: string[];
  };
  sourceSnapshot: CompetitorSourceSnapshot;
};

export type CompetitorRecord = {
  id: string;
  name: string;
  handle: string;
  website: string;
  type: CompetitorType;
  logoUrl: string;
  niche: string;
  notes: string;
  tags: string[];
  analysisStatus: CompetitorAnalysisStatus;
  analysisError: string;
  analysis: CompetitorAnalysis | null;
  sourceSnapshot: CompetitorSourceSnapshot | null;
  lastAnalyzedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ContentReferenceRecord = {
  id: string;
  competitorId: string;
  competitorName: string;
  title: string;
  content: string;
  hookType: string;
  ctaType: string;
  format: string;
  imageUrl: string;
  notes: string;
  liked: boolean;
  savedAt: string;
  category: string;
  source: 'manual' | 'analysis';
  sourceInsightId: string;
  sourceUrl: string;
  metadata?: Record<string, unknown>;
};
