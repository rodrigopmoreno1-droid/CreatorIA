export type ContentFormat = 'reels' | 'stories' | 'video_curto' | 'carrossel' | 'post';

export type ContentBriefInput = {
  prompt: string;
  productName?: string;
  productContext?: string;
  referenceContext?: string;
  contentType?: string;
  subOption?: string;
  duration?: string;
  tones?: string[];
  tone?: string;
  objectives?: string[];
  objective?: string;
  pain?: string;
  benefit?: string;
  targetAudience?: string;
};

export type NormalizedContentBrief = {
  prompt: string;
  productName: string;
  productContext: string;
  referenceContext: string;
  contentType: ContentFormat;
  subOption: string;
  duration: string;
  tones: string[];
  objectives: string[];
  pain: string;
  benefit: string;
  targetAudience: string;
  unitCount: number;
  seed: number;
};

export type FormatBlueprint = {
  id: ContentFormat;
  label: string;
  defaultUnits: number;
  blocks: string[];
  requiredFields: string[];
  writingRules: string[];
  captionPolicy: 'none' | 'required' | 'optional';
  trendFormats: string[];
};

export type HookPattern = {
  id: string;
  label: string;
  formula: string;
  note: string;
  formats?: ContentFormat[];
  objectives?: string[];
  tones?: string[];
};

export type CtaPattern = {
  id: string;
  label: string;
  formula: string;
  note: string;
  formats?: ContentFormat[];
  objectives?: string[];
};

export type StorytellingPattern = {
  id: string;
  label: string;
  stages: string[];
  note: string;
  formats?: ContentFormat[];
  tones?: string[];
};

export type TrendPattern = {
  id: string;
  label: string;
  note: string;
  openings: string[];
  formats?: ContentFormat[];
};

export type CommunicationStyle = {
  id: string;
  label: string;
  notes: string[];
};

export type ObjectiveStrategy = {
  id: string;
  label: string;
  notes: string[];
  ctaDirection: string;
};

export type StrategicReference = {
  id: string;
  label: string;
  focus: string[];
  voice: string[];
  bestFor: string[];
};

export type NichePattern = {
  id: string;
  label: string;
  matchTerms: string[];
  focus: string[];
  contentAngles: string[];
  proofPoints: string[];
};

export type GenerationPlan = {
  brief: NormalizedContentBrief;
  blueprint: FormatBlueprint;
  hookPatterns: HookPattern[];
  ctaPattern: CtaPattern;
  storytellingPattern: StorytellingPattern;
  trendPatterns: TrendPattern[];
  communicationStyles: CommunicationStyle[];
  objectiveStrategies: ObjectiveStrategy[];
  strategicReferences: StrategicReference[];
  nichePatterns: NichePattern[];
  useTrendResearch: boolean;
  costProfile: 'lite' | 'trend';
};
