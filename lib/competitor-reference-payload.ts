import type {
  CompetitorGeneratedContentItem,
  CompetitorInsight,
  CompetitorRecord,
  ContentReferenceRecord,
  CompetitorReferenceCategory
} from '@/types/competitor-intelligence';

function normalizeCategoryText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function inferReferenceCategory(insight: CompetitorInsight, sectionId?: string): CompetitorReferenceCategory {
  const title = normalizeCategoryText(insight.title);
  const summary = normalizeCategoryText(insight.summary);
  const combined = `${title} ${summary}`;

  if (sectionId === 'engineering') {
    if (/cta|comentario|direct|dm|salvar|compartilhar|seguir|vendas|conversao/.test(combined)) {
      return 'cta';
    }

    if (/gancho|hook|abertura|curiosidade|pergunta|erro|pov|lista numerada/.test(combined)) {
      return 'hook';
    }

    if (/oferta|oferec|produto|venda|promoc/.test(combined)) {
      return 'offer';
    }

    if (/prova|depoimento|resultado|antes e depois|print|case/.test(combined)) {
      return 'social_proof';
    }

    if (/formato|video|reels|stories|carrossel|texto na tela|legenda falada|trend/.test(combined)) {
      return 'format';
    }

    return 'structure';
  }

  if (insight.kind === 'hook' || /gancho|hook|abertura|curiosidade|pergunta|erro|pov|lista numerada/.test(combined)) {
    return 'hook';
  }

  if (insight.kind === 'cta' || /cta|comentario|direct|dm|salvar|compartilhar|seguir|vendas|conversao/.test(combined)) {
    return 'cta';
  }

  if (insight.kind === 'storytelling' || /storytelling|historia|transformacao|bastidor|prova social/.test(combined)) {
    return 'storytelling';
  }

  if (insight.kind === 'visual' || /texto na tela|legenda falada|trend|formato|reels|stories|carrossel|video/.test(combined)) {
    return 'format';
  }

  if (insight.kind === 'adaptation' || /estrutura|roteiro|sequencia|bloco|passo a passo/.test(combined)) {
    return 'structure';
  }

  if (/angulo|ângulo|copy/.test(combined)) {
    return 'copy_angle';
  }

  if (/oferta|oferec|produto|venda|promoc/.test(combined)) {
    return 'offer';
  }

  if (/prova social|depoimento|resultado|antes e depois|print|case/.test(combined)) {
    return 'social_proof';
  }

  if (insight.kind === 'overview' || insight.kind === 'theme') {
    return 'copy_angle';
  }

  if (insight.kind === 'idea' || insight.kind === 'action') {
    return 'content_idea';
  }

  return 'other';
}

export function buildReferencePayloadFromInsight(
  competitor: Pick<CompetitorRecord, 'id' | 'name' | 'niche' | 'type'>,
  insight: CompetitorInsight,
  sectionId?: string
): Omit<ContentReferenceRecord, 'id' | 'savedAt'> {
  const category = inferReferenceCategory(insight, sectionId);

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
    category,
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
      referenceType: insight.kind,
      referenceCategory: category
    }
  };
}

export function buildReferencePayloadFromGeneratedContent(
  competitor: Pick<CompetitorRecord, 'id' | 'name' | 'niche' | 'type'>,
  item: CompetitorGeneratedContentItem
): Omit<ContentReferenceRecord, 'id' | 'savedAt'> {
  return {
    competitorId: competitor.id,
    competitorName: competitor.name,
    title: item.title,
    content: item.summary,
    hookType: item.hookType || item.kind,
    ctaType: item.ctaType || '',
    format: item.format || '',
    imageUrl: '',
    notes: item.rationale,
    liked: true,
    category: item.saveCategory,
    source: 'analysis',
    sourceInsightId: item.id,
    sourceUrl: item.sourceUrl,
    metadata: {
      origin: 'competitors-generated-content',
      competitorType: competitor.type,
      niche: competitor.niche,
      tags: item.tags,
      hookType: item.hookType || item.kind,
      ctaType: item.ctaType || '',
      format: item.format || '',
      referenceType: item.kind,
      referenceCategory: item.saveCategory,
      structure: item.structure,
      angle: item.angle
    }
  };
}
