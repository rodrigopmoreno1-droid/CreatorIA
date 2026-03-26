import {
  communicationStyles,
  ctaPatterns,
  formatBlueprints,
  hookPatterns,
  nichePatterns,
  objectiveStrategies,
  strategicReferences,
  storytellingPatterns,
  trendPatterns
} from '@/lib/content-engine/library';
import type {
  ContentBriefInput,
  ContentFormat,
  CtaPattern,
  FormatBlueprint,
  GenerationPlan,
  HookPattern,
  NichePattern,
  NormalizedContentBrief,
  ObjectiveStrategy,
  StrategicReference,
  StorytellingPattern,
  TrendPattern
} from '@/lib/content-engine/types';

function normalizeText(value?: string) {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function normalizeFormat(value?: string): ContentFormat {
  if (value === 'stories' || value === 'video_curto' || value === 'carrossel' || value === 'post') {
    return value;
  }

  return 'reels';
}

function resolveUnitCount(format: ContentFormat, subOption?: string) {
  const numeric = Number.parseInt(subOption ?? '', 10);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  return formatBlueprints[format].defaultUnits;
}

function buildSeed(parts: string[]) {
  return parts.join('|').split('').reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

function matchesFormats<T extends { formats?: ContentFormat[] }>(entry: T, format: ContentFormat) {
  return !entry.formats?.length || entry.formats.includes(format);
}

function matchesObjectives<T extends { objectives?: string[] }>(entry: T, objectives: string[]) {
  return !entry.objectives?.length || entry.objectives.some((objective) => objectives.includes(objective));
}

function matchesTones<T extends { tones?: string[] }>(entry: T, tones: string[]) {
  return !entry.tones?.length || entry.tones.some((tone) => tones.includes(tone));
}

function rotateSelect<T>(items: T[], count: number, seed: number) {
  if (!items.length) {
    return [];
  }

  const start = seed % items.length;
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => items[(start + index) % items.length]);
}

export function normalizeContentBrief(input: ContentBriefInput): NormalizedContentBrief {
  const contentType = normalizeFormat(input.contentType);
  const tones = uniqueValues(input.tones?.length ? input.tones : input.tone ? [input.tone] : ['natural']);
  const objectives = uniqueValues(input.objectives?.length ? input.objectives : input.objective ? [input.objective] : ['vender']);
  const normalized: NormalizedContentBrief = {
    prompt: normalizeText(input.prompt),
    productName: normalizeText(input.productName),
    productContext: normalizeText(input.productContext),
    referenceContext: normalizeText(input.referenceContext),
    contentType,
    subOption: normalizeText(input.subOption),
    duration: normalizeText(input.duration || input.subOption),
    tones,
    objectives,
    pain: normalizeText(input.pain),
    benefit: normalizeText(input.benefit),
    targetAudience: normalizeText(input.targetAudience),
    unitCount: resolveUnitCount(contentType, input.subOption),
    seed: 0
  };

  normalized.seed = buildSeed([
    normalized.contentType,
    normalized.productName,
    normalized.pain,
    normalized.benefit,
    normalized.targetAudience,
    normalized.tones.join(','),
    normalized.objectives.join(','),
    normalized.prompt
  ]);

  return normalized;
}

export function shouldRunTrendResearchForBrief(brief: NormalizedContentBrief) {
  if (brief.tones.includes('trend')) {
    return true;
  }

  const text = [brief.prompt, brief.referenceContext, brief.productContext].join(' ').toLowerCase();
  return /(trend|tendenc|viral|agora|atual|recent|instagram|tiktok|reels)/i.test(text);
}

function selectBlueprint(format: ContentFormat): FormatBlueprint {
  return formatBlueprints[format];
}

function selectHookPatterns(brief: NormalizedContentBrief): HookPattern[] {
  const eligible = hookPatterns.filter(
    (pattern) =>
      matchesFormats(pattern, brief.contentType) &&
      matchesObjectives(pattern, brief.objectives) &&
      matchesTones(pattern, brief.tones)
  );

  return rotateSelect(eligible.length ? eligible : hookPatterns.filter((pattern) => matchesFormats(pattern, brief.contentType)), 3, brief.seed);
}

function selectCtaPattern(brief: NormalizedContentBrief): CtaPattern {
  const eligible = ctaPatterns.filter(
    (pattern) => matchesFormats(pattern, brief.contentType) && matchesObjectives(pattern, brief.objectives)
  );

  return rotateSelect(eligible.length ? eligible : ctaPatterns, 1, brief.seed)[0];
}

function selectStorytellingPattern(brief: NormalizedContentBrief): StorytellingPattern {
  const eligible = storytellingPatterns.filter(
    (pattern) => matchesFormats(pattern, brief.contentType) && matchesTones(pattern, brief.tones)
  );

  return rotateSelect(eligible.length ? eligible : storytellingPatterns.filter((pattern) => matchesFormats(pattern, brief.contentType)), 1, brief.seed)[0];
}

function selectTrendPatterns(brief: NormalizedContentBrief, blueprint: FormatBlueprint): TrendPattern[] {
  const eligible = trendPatterns.filter((pattern) => matchesFormats(pattern, brief.contentType));

  if (!brief.tones.includes('trend')) {
    return eligible.filter((pattern) => blueprint.trendFormats.includes(pattern.label)).slice(0, 2);
  }

  return rotateSelect(eligible, 3, brief.seed + 7);
}

function selectCommunicationStyles(brief: NormalizedContentBrief) {
  const selected = communicationStyles.filter((style) => brief.tones.includes(style.id));
  return selected.length ? selected : communicationStyles.filter((style) => style.id === 'natural');
}

function selectObjectiveStrategies(brief: NormalizedContentBrief): ObjectiveStrategy[] {
  const selected = objectiveStrategies.filter((strategy) => brief.objectives.includes(strategy.id));
  return selected.length ? selected : objectiveStrategies.filter((strategy) => strategy.id === 'vender');
}

function selectStrategicReferences(brief: NormalizedContentBrief): StrategicReference[] {
  const eligible = strategicReferences.filter((reference) =>
    reference.bestFor.some((item) => item === brief.contentType || brief.objectives.includes(item) || brief.tones.includes(item))
  );

  return rotateSelect(eligible.length ? eligible : strategicReferences, 2, brief.seed + 17);
}

function selectNichePatterns(brief: NormalizedContentBrief): NichePattern[] {
  const haystack = [
    brief.prompt,
    brief.productName,
    brief.productContext,
    brief.referenceContext,
    brief.pain,
    brief.benefit,
    brief.targetAudience
  ]
    .join(' ')
    .toLowerCase();

  const matched = nichePatterns.filter(
    (pattern) => pattern.matchTerms.length > 0 && pattern.matchTerms.some((term) => haystack.includes(term))
  );

  return rotateSelect(matched.length ? matched : nichePatterns.filter((pattern) => pattern.id === 'generic-performance'), 2, brief.seed + 23);
}

export function buildGenerationPlan(input: ContentBriefInput): GenerationPlan {
  const brief = normalizeContentBrief(input);
  const blueprint = selectBlueprint(brief.contentType);

  return {
    brief,
    blueprint,
    hookPatterns: selectHookPatterns(brief),
    ctaPattern: selectCtaPattern(brief),
    storytellingPattern: selectStorytellingPattern(brief),
    trendPatterns: selectTrendPatterns(brief, blueprint),
    communicationStyles: selectCommunicationStyles(brief),
    objectiveStrategies: selectObjectiveStrategies(brief),
    strategicReferences: selectStrategicReferences(brief),
    nichePatterns: selectNichePatterns(brief),
    useTrendResearch: shouldRunTrendResearchForBrief(brief),
    costProfile: shouldRunTrendResearchForBrief(brief) ? 'trend' : 'lite'
  };
}

export function formatGenerationPlanForPrompt(plan: GenerationPlan) {
  return [
    `Formato: ${plan.blueprint.label}`,
    `Blocos obrigatorios: ${plan.blueprint.blocks.join(', ')}`,
    `Campos obrigatorios: ${plan.blueprint.requiredFields.join(', ')}`,
    `Hook formulas escolhidas: ${plan.hookPatterns.map((pattern) => `${pattern.label} -> ${pattern.formula}`).join(' | ')}`,
    `CTA principal: ${plan.ctaPattern.label} -> ${plan.ctaPattern.formula}`,
    `Storytelling base: ${plan.storytellingPattern.label} -> ${plan.storytellingPattern.stages.join(' -> ')}`,
    `Trend patterns selecionados: ${plan.trendPatterns.map((pattern) => pattern.label).join(', ')}`,
    `Tons aplicados: ${plan.communicationStyles.map((style) => `${style.label}: ${style.notes.join('; ')}`).join(' | ')}`,
    `Objetivos aplicados: ${plan.objectiveStrategies.map((strategy) => `${strategy.label}: ${strategy.notes.join('; ')}`).join(' | ')}`,
    `Playbooks de nicho: ${plan.nichePatterns.map((pattern) => `${pattern.label}: focos ${pattern.focus.join(', ')}; angulos ${pattern.contentAngles.join(', ')}`).join(' | ')}`,
    `Referencias estrategicas: ${plan.strategicReferences.map((reference) => `${reference.label}: ${reference.focus.join(', ')}`).join(' | ')}`,
    `Regras de escrita: ${plan.blueprint.writingRules.join(' | ')}`
  ].join('\n');
}
