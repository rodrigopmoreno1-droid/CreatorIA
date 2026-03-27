import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  assessCompetitorDataQuality,
  buildCompetitorAnalysisFallback,
  buildCompetitorCapturePayload,
  buildCompetitorFacts,
  buildCompetitorPatternPayload,
  type CompetitorAnalysisInput
} from '@/lib/competitor-intelligence';
import { reviewCompetitorSignals } from '@/lib/competitor-signal-review';
import { toCompetitorRecord } from '@/lib/platform-data';
import { organizeCompetitorAnalysis } from '@/services/ai';
import type { CompetitorCaptureSource, CompetitorRecord, CompetitorType } from '@/types/competitor-intelligence';

const COMPETITOR_SELECT =
  'id,company_id,name,handle,niche,website,notes,created_at,updated_at,profile_type,logo_url,tags,analysis_status,analysis_error,analysis,source_snapshot,analysis_progress,last_analyzed_at';

type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type AnalysisProgressStage =
  | 'capturing'
  | 'downloading'
  | 'transcribing'
  | 'extracting'
  | 'validating'
  | 'building_repertoire'
  | 'completed'
  | 'incomplete';

function buildProgressPayload(input: {
  stage: AnalysisProgressStage;
  message: string;
  reelsTotal: number;
  reelsTranscribed: number;
  transcriptCoverage: number;
}) {
  return {
    stage: input.stage,
    message: input.message,
    reelsTotal: input.reelsTotal,
    reelsTranscribed: input.reelsTranscribed,
    transcriptCoverage: input.transcriptCoverage,
    updatedAt: new Date().toISOString()
  };
}

function analysisStatusForStage(stage: AnalysisProgressStage) {
  if (stage === 'capturing' || stage === 'downloading') {
    return 'capturing';
  }

  if (stage === 'completed') {
    return 'completed';
  }

  return 'processing';
}

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
  analysis_progress?: unknown;
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

function buildPostRow(companyId: string, competitorId: string, post: CompetitorAnalysisInput['snapshot']['topPosts'][number]) {
  return {
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
    transcript_status: post.transcriptStatus || 'missing',
    transcript_source: post.transcriptSource || 'none',
    transcript_confidence: post.transcriptConfidence ?? null,
    transcript_error: post.transcriptError || null,
    screen_text_lead: post.screenTextLead || null,
    metadata: {
      captionLead: post.captionLead,
      accessibilityCaption: post.accessibilityCaption,
      transcriptText: post.transcriptText,
      transcriptStatus: post.transcriptStatus,
      transcriptSource: post.transcriptSource,
      transcriptConfidence: post.transcriptConfidence,
      transcriptError: post.transcriptError,
      screenTextLead: post.screenTextLead,
      downloadedVideoUrl: post.downloadedVideoUrl,
      hookPattern: post.hookPattern,
      ctaPatterns: post.ctaPatterns,
      storytellingPatterns: post.storytellingPatterns,
      shortcode: post.shortcode
    }
  };
}

function buildPostRowSafe(companyId: string, competitorId: string, post: CompetitorAnalysisInput['snapshot']['topPosts'][number]) {
  return {
    company_id: companyId,
    competitor_id: competitorId,
    published_at: post.postedAt,
    post_type: post.format,
    caption: post.caption,
    metrics: post.metrics,
    media_url: post.mediaUrl || null,
    source_url: post.sourceUrl || null,
    thumbnail_url: post.thumbnailUrl || null,
    metadata: {
      captionLead: post.captionLead,
      accessibilityCaption: post.accessibilityCaption,
      transcriptText: post.transcriptText,
      transcriptStatus: post.transcriptStatus,
      transcriptSource: post.transcriptSource,
      transcriptConfidence: post.transcriptConfidence,
      transcriptError: post.transcriptError,
      screenTextLead: post.screenTextLead,
      downloadedVideoUrl: post.downloadedVideoUrl,
      hookPattern: post.hookPattern,
      ctaPatterns: post.ctaPatterns,
      storytellingPatterns: post.storytellingPatterns,
      shortcode: post.shortcode
    }
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

  const rows = snapshot.topPosts.map((post) => buildPostRow(companyId, competitorId, post));
  const { error } = await admin.from('competitor_posts').insert(rows);

  if (error) {
    if (/column|schema|screen_text_lead|transcript_/i.test(error.message)) {
      const safeRows = snapshot.topPosts.map((post) => buildPostRowSafe(companyId, competitorId, post));
      const { error: safeError } = await admin.from('competitor_posts').insert(safeRows);
      if (safeError) {
        throw new Error(safeError.message);
      }
      return;
    }
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
  const reelsTotal = snapshot.reelsAnalyzed || snapshot.topPosts.filter((post) => post.format === 'reels' || post.format === 'video').length;

  async function updateAnalysisProgress(stage: AnalysisProgressStage, message: string, reelsTranscribed = facts.transcriptCount) {
    const progress = buildProgressPayload({
      stage,
      message,
      reelsTotal,
      reelsTranscribed,
      transcriptCoverage: facts.transcriptCoverage
    });

    const { error } = await admin
      .from('competitors')
      .update({
        analysis_status: analysisStatusForStage(stage),
        analysis_progress: progress
      })
      .eq('company_id', companyId)
      .eq('id', competitor.id);

    if (error) {
      throw new Error(error.message);
    }
  }

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
      analysis_status: assessment.quality === 'insufficient' ? 'insufficient_data' : 'processing',
      analysis_error: assessment.quality === 'insufficient' ? assessment.reason : null,
      analysis_progress: buildProgressPayload({
        stage: 'capturing',
        message: 'Baixando fontes e consolidando capturas...',
        reelsTotal,
        reelsTranscribed: 0,
        transcriptCoverage: facts.transcriptCoverage
      }),
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

  if (assessment.quality === 'insufficient') {
    const persisted = await loadPersistedCompetitor(admin, companyId, competitor.id);
    return {
      competitor: toCompetitorRecord(persisted),
      facts,
      sufficient: false as const
    };
  }

  await updateAnalysisProgress('extracting', 'Extraindo hooks, CTAs e temas validados...');

  const signalReview = await reviewCompetitorSignals({
    snapshot,
    facts
  });

  const analysisInput = {
    competitor,
    snapshot,
    facts,
    signalReview
  };

  const enoughForFinalAnalysis = assessment.enoughForAi && signalReview.transcriptCoverage >= 0.7;
  const fallback = buildCompetitorAnalysisFallback(analysisInput);

  let analysis = fallback;

  if (enoughForFinalAnalysis) {
    await updateAnalysisProgress('validating', 'Validando ganchos, CTAs e temas com OpenAI...');
    analysis = await organizeCompetitorAnalysis(analysisInput).catch(() => fallback);
  }

  analysis = {
    ...analysis,
    signalReview
  };

  await updateAnalysisProgress(
    enoughForFinalAnalysis ? 'building_repertoire' : 'incomplete',
    enoughForFinalAnalysis
      ? 'Montando repertorio acionavel com base nas evidencias validadas...'
      : `Processando (incompleto): cobertura de transcricao em ${(signalReview.transcriptCoverage * 100).toFixed(0)}%`
  );

  const { error: completionError } = await admin
    .from('competitors')
    .update({
      logo_url: suggestedLogoUrl || competitorRow.logo_url || null,
      analysis_status: enoughForFinalAnalysis ? 'completed' : 'processing',
      analysis_error: null,
      analysis,
      analysis_progress: buildProgressPayload({
        stage: enoughForFinalAnalysis ? 'completed' : 'incomplete',
        message: enoughForFinalAnalysis
          ? 'Analise pronta com repertorio validado e transcricoes suficientes.'
          : `Processando (incompleto): ${Math.round(signalReview.transcriptCoverage * 100)}% das transcricoes necessarias.`,
        reelsTotal,
        reelsTranscribed: signalReview.reelsTranscribed,
        transcriptCoverage: signalReview.transcriptCoverage
      }),
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
    sufficient: enoughForFinalAnalysis
  };
}

export { COMPETITOR_SELECT };
