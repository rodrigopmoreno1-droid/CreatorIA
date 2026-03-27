import type { CompetitorInsight, CompetitorRecord, ContentReferenceRecord } from '@/types/competitor-intelligence';

export function buildReferencePayloadFromInsight(
  competitor: Pick<CompetitorRecord, 'id' | 'name' | 'niche' | 'type'>,
  insight: CompetitorInsight
): Omit<ContentReferenceRecord, 'id' | 'savedAt'> {
  return {
    competitorId: competitor.id,
    competitorName: competitor.name,
    title: insight.title,
    content: insight.summary,
    hookType: insight.hookType || insight.kind,
    ctaType: insight.ctaType || '',
    format: insight.format || '',
    imageUrl: '',
    notes: insight.rationale,
    liked: true,
    category: insight.kind,
    source: 'analysis',
    sourceInsightId: insight.id,
    sourceUrl: insight.sourceUrl,
    metadata: {
      origin: 'competitors-analysis',
      competitorType: competitor.type,
      niche: competitor.niche,
      tags: insight.tags,
      hookType: insight.hookType || insight.kind,
      ctaType: insight.ctaType || '',
      format: insight.format || '',
      referenceType: insight.kind
    }
  };
}
