import { NextResponse } from 'next/server';

import { captureCompetitorSources, normalizeInstagramHandle, normalizeWebsiteUrl } from '@/lib/competitor-intelligence';
import { resolveWorkspaceDataAccess, toCompetitorRecord } from '@/lib/platform-data';

const COMPETITOR_DETAIL_SELECT =
  'id,company_id,name,handle,niche,website,notes,created_at,updated_at,profile_type,logo_url,tags,analysis_status,analysis_error,analysis,source_snapshot,analysis_progress,last_analyzed_at';

type CompetitorPatchPayload = {
  name?: string;
  handle?: string;
  website?: string;
  type?: string;
  logoUrl?: string;
  niche?: string;
  notes?: string;
  tags?: string[];
  analysisStatus?: string;
  analysisError?: string;
  analysis?: unknown;
  lastAnalyzedAt?: string;
};

function sanitizeTags(tags: unknown) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; competitorId: string }> }
) {
  const { workspace, competitorId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('competitors')
    .select(COMPETITOR_DETAIL_SELECT)
    .eq('company_id', context.companyId)
    .eq('id', competitorId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Perfil nao encontrado.' }, { status: 404 });
  }

  return NextResponse.json({
    competitor: toCompetitorRecord(
      data as {
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
      }
    )
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspace: string; competitorId: string }> }
) {
  const { workspace, competitorId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as CompetitorPatchPayload | null;

  if (!body) {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  const { admin, context } = access;
  const { data: existing, error: existingError } = await admin
    .from('competitors')
    .select('id,name,handle,website,profile_type,logo_url,niche,notes,tags')
    .eq('company_id', context.companyId)
    .eq('id', competitorId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message ?? 'Perfil nao encontrado.' }, { status: 404 });
  }

  const name = body.name?.trim() || existing.name;
  const handle = body.handle === undefined ? normalizeInstagramHandle(existing.handle ?? '') : normalizeInstagramHandle(body.handle);
  const website = body.website === undefined ? normalizeWebsiteUrl(existing.website ?? '') : normalizeWebsiteUrl(body.website);
  let logoUrl = body.logoUrl === undefined ? existing.logo_url ?? '' : body.logoUrl.trim();

  if (!logoUrl && (handle || website)) {
    const { suggestedLogoUrl } = await captureCompetitorSources({
      id: competitorId,
      name,
      handle,
      website,
      type: body.type === 'reference' || body.type === 'inspiration'
        ? body.type
        : existing.profile_type === 'reference' || existing.profile_type === 'inspiration'
        ? existing.profile_type
        : 'competitor',
      niche: body.niche?.trim() ?? existing.niche ?? '',
      notes: body.notes?.trim() ?? existing.notes ?? '',
      logoUrl: '',
      tags: body.tags === undefined ? sanitizeTags(existing.tags) : sanitizeTags(body.tags)
    });

    logoUrl = suggestedLogoUrl;
  }

  const updatePayload: Record<string, unknown> = {
    name,
    handle: handle || null,
    website: website || null,
    profile_type:
      body.type === 'reference' || body.type === 'inspiration'
        ? body.type
        : existing.profile_type === 'reference' || existing.profile_type === 'inspiration'
        ? existing.profile_type
        : 'competitor',
    logo_url: logoUrl || null,
    niche: body.niche === undefined ? existing.niche : body.niche.trim() || null,
    notes: body.notes === undefined ? existing.notes : body.notes.trim() || null,
    tags: body.tags === undefined ? sanitizeTags(existing.tags) : sanitizeTags(body.tags)
  };

  if (body.analysisStatus !== undefined) {
    updatePayload.analysis_status = body.analysisStatus;
  }
  if (body.analysisError !== undefined) {
    updatePayload.analysis_error = body.analysisError || null;
  }
  if (body.analysis !== undefined) {
    updatePayload.analysis = body.analysis;
  }
  if (body.lastAnalyzedAt !== undefined) {
    updatePayload.last_analyzed_at = body.lastAnalyzedAt || null;
  }

  const { data, error } = await admin
    .from('competitors')
    .update(updatePayload)
    .eq('company_id', context.companyId)
    .eq('id', competitorId)
    .select(COMPETITOR_DETAIL_SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel atualizar o perfil.' }, { status: 500 });
  }

  return NextResponse.json({
    competitor: toCompetitorRecord(
      data as {
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
      }
    )
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; competitorId: string }> }
) {
  const { workspace, competitorId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { error } = await admin
    .from('competitors')
    .delete()
    .eq('company_id', context.companyId)
    .eq('id', competitorId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
