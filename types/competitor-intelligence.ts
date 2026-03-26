export type CompetitorType = 'competitor' | 'reference' | 'inspiration';

export type CompetitorAnalysisStatus = 'idle' | 'running' | 'completed' | 'error';

export type CompetitorContentFormat =
  | 'reels'
  | 'video'
  | 'carrossel'
  | 'image'
  | 'stories'
  | 'mixed'
  | 'unknown';

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
  | 'action';

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
  };
  accessibilityCaption: string;
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
};

export type CompetitorAnalysisSection = {
  id: string;
  title: string;
  description: string;
  items: CompetitorInsight[];
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
};
