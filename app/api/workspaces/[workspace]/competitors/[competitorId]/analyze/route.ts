import { NextResponse } from 'next/server';

import { COMPETITOR_SELECT, runCompetitorAnalysisPipeline } from '@/lib/competitor-analysis-pipeline';
import { captureCompetitorSources } from '@/lib/competitor-intelligence';
import { resolveWorkspaceDataAccess } from '@/lib/platform-data';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; competitorId: string }> }
) {
  const { workspace, competitorId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { data: existing, error: existingError } = await admin
    .from('competitors')
    .select(COMPETITOR_SELECT)
    .eq('company_id', context.companyId)
    .eq('id', competitorId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message ?? 'Perfil nao encontrado.' }, { status: 404 });
  }

  if (!existing.handle && !existing.website) {
    return NextResponse.json({ error: 'Informe ao menos o Instagram ou o website para gerar a analise.' }, { status: 400 });
  }

  await admin
    .from('competitors')
    .update({
      analysis_status: 'capturing',
      analysis_error: null
    })
    .eq('company_id', context.companyId)
    .eq('id', competitorId);

  try {
    const competitorInput = {
      id: existing.id,
      name: existing.name,
      handle: existing.handle ?? '',
      website: existing.website ?? '',
      type: existing.profile_type === 'reference' || existing.profile_type === 'inspiration' ? existing.profile_type : 'competitor',
      niche: existing.niche ?? '',
      notes: existing.notes ?? '',
      logoUrl: existing.logo_url ?? '',
      tags: Array.isArray(existing.tags) ? existing.tags.filter((tag): tag is string => typeof tag === 'string') : []
    };

    const { snapshot, suggestedLogoUrl, source } = await captureCompetitorSources(competitorInput, { deep: true });
    const result = await runCompetitorAnalysisPipeline({
      admin,
      companyId: context.companyId,
      competitorRow: existing as {
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
      },
      snapshot,
      suggestedLogoUrl,
      source
    });

    return NextResponse.json({
      competitor: result.competitor
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel gerar a analise.';

    await admin
      .from('competitors')
      .update({
        analysis_status: 'error',
        analysis_error: message
      })
      .eq('company_id', context.companyId)
      .eq('id', competitorId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
