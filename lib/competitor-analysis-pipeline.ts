import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  assessCompetitorDataQuality,
  buildCompetitorAnalysisFallback,
  buildCompetitorCapturePayload,
  buildCompetitorFacts,
  buildCompetitorPatternPayload,
  type CompetitorAnalysisInput
} from '@/lib/competitor-intelligence';
import { toCompetitorRecord } from '@/lib/platform-data';
import { organizeCompetitorAnalysis } from '@/services/ai';
import type { CompetitorCaptureSource, CompetitorRecord, CompetitorType } from '@/types/competitor-intelligence';

const COMPETITOR_SELECT =
  'id,company_id,name,handle,niche,website,notes,created_at,updated_at,profile_type,logo_url,tags,analysis_status,analysis_error,analysis,source_snapshot,last_analyzed_at';

type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type PersistedCompetitorRow = {
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

function toPipelineCompetitorInput(row: PersistedCompetitorRow): CompetitorAnalysisInput['competitor'] {
  const type: CompetitorType =
    row.profile_type === 'reference' || row.profile_type === 'inspiration' ? row.profile_type : 'competitor';

  return {
    id: row.id,
    name: row.name,
    handle: row.handle ?? '',
    website: row.website ?? '',
    type,
    niche: row.niche ?? '',
    notes: row.notes ?? '',
    logoUrl: row.logo_url ?? '',
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : []
  };
}

async function replaceCompetitorPosts(
  admin: SupabaseAdminClient,
  companyId: string,
  competitorId: string,
  snapshot: CompetitorAnalysisInput['snapshot']
) {
  await admin.from('competitor_posts').delete().eq('company_id', companyId).eq('competitor_id', competitorId);

  if (!snapshot.topPosts.length) {
    return;
  }

  const { error } = await admin.from('competitor_posts').insert(
    snapshot.topPosts.map((post) => ({
      company_id: companyId,
      competitor_id: competitorId,
      published_at: post.postedAt,
      post_type: post.format,
      caption: post.caption,
      metrics: post.metrics,
      media_url: post.mediaUrl || null,
      source_url: post.sourceUrl || null,
      thumbnail_url: post.thumbnailUrl || null,
      transcript_text: post.transcriptText || null,
      transcript_status: post.transcriptStatus,
      transcript_source: post.transcriptSource,
      transcript_confidence: post.transcriptConfidence,
      transcript_error: post.transcriptError || null,
      metadata: {
        captionLead: post.captionLead,
        accessibilityCaption: post.accessibilityCaption,
        transcriptText: post.transcriptText,
        transcriptStatus: post.transcriptStatus,
        transcriptSource: post.transcriptSource,
        transcriptConfidence: post.transcriptConfidence,
        transcriptError: post.transcriptError,
        screenTextLead: post.screenTextLead,
        hookPattern: post.hookPattern,
        ctaPatterns: post.ctaPatterns,
        storytellingPatterns: post.storytellingPatterns,
        shortcode: post.shortcode
      }
    }))
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function loadPersistedCompetitor(admin: SupabaseAdminClient, companyId: string, competitorId: string) {
  const { data, error } = await admin
    .from('competitors')
    .select(COMPETITOR_SELECT)
    .eq('company_id', companyId)
    .eq('id', competitorId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Nao foi possivel recarregar o perfil apos a analise.');
  }

  return data as PersistedCompetitorRow;
}

export async function runCompetitorAnalysisPipeline(input: {
  admin: SupabaseAdminClient;
  companyId: string;
  competitorRow: PersistedCompetitorRow;
  snapshot: CompetitorAnalysisInput['snapshot'];
  suggestedLogoUrl?: string;
  source: CompetitorCaptureSource;
}) {
  const { admin, companyId, competitorRow, snapshot, suggestedLogoUrl, source } = input;
  const competitor = toPipelineCompetitorInput(competitorRow);
  const facts = buildCompetitorFacts(snapshot, competitor);
  const assessment = assessCompetitorDataQuality(snapshot);
  const now = new Date().toISOString();

  const { data: captureRow, error: captureError } = await admin
    .from('competitor_captures')
    .insert(
      buildCompetitorCapturePayload({
        companyId,
        competitorId: competitor.id,
        source,
        snapshot,
        status: assessment.enoughForAi ? 'success' : 'partial'
      })
    )
    .select('id')
    .single();

  if (captureError || !captureRow) {
    throw new Error(captureError?.message ?? 'Nao foi possivel salvar a captura do perfil.');
  }

  await replaceCompetitorPosts(admin, companyId, competitor.id, snapshot);

  const { error: competitorCaptureStateError } = await admin
    .from('competitors')
    .update({
      logo_url: suggestedLogoUrl || competitorRow.logo_url || null,
      source_snapshot: snapshot,
      analysis_status: assessment.enoughForAi ? 'processing' : 'insufficient_data',
      analysis_error: assessment.enoughForAi ? null : assessment.reason,
      analysis: null,
      last_analyzed_at: now
    })
    .eq('company_id', companyId)
    .eq('id', competitor.id);

  if (competitorCaptureStateError) {
    throw new Error(competitorCaptureStateError.message);
  }

  const { error: patternError } = await admin
    .from('competitor_patterns')
    .upsert(buildCompetitorPatternPayload({
      companyId,
      competitorId: competitor.id,
      captureId: captureRow.id,
      snapshot,
      facts,
      assessment
    }), { onConflict: 'company_id,competitor_id' });

  if (patternError) {
    throw new Error(patternError.message);
  }

  if (!assessment.enoughForAi) {
    const persisted = await loadPersistedCompetitor(admin, companyId, competitor.id);
    return {
      competitor: toCompetitorRecord(persisted),
      facts,
      sufficient: false as const
    };
  }

  const fallback = buildCompetitorAnalysisFallback({
    competitor,
    snapshot,
    facts
  });

  const analysis = await organizeCompetitorAnalysis({
    competitor,
    snapshot,
    facts
  }).catch(() => fallback);

  const { error: completionError } = await admin
    .from('competitors')
    .update({
      logo_url: suggestedLogoUrl || competitorRow.logo_url || null,
      analysis_status: 'completed',
      analysis_error: null,
      analysis,
      source_snapshot: snapshot,
      last_analyzed_at: now
    })
    .eq('company_id', companyId)
    .eq('id', competitor.id);

  if (completionError) {
    throw new Error(completionError.message);
  }

  const persisted = await loadPersistedCompetitor(admin, companyId, competitor.id);

  return {
    competitor: toCompetitorRecord(persisted),
    facts,
    sufficient: true as const
  };
}

export { COMPETITOR_SELECT };
