import { NextResponse } from 'next/server';

import { captureCompetitorSources, normalizeInstagramHandle, normalizeWebsiteUrl } from '@/lib/competitor-intelligence';
import { resolveWorkspaceDataAccess, toCompetitorRecord } from '@/lib/platform-data';

type CompetitorPayload = {
  name?: string;
  handle?: string;
  website?: string;
  type?: string;
  logoUrl?: string;
  niche?: string;
  notes?: string;
  tags?: string[];
};

function sanitizeTags(tags: unknown) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean);
}

async function preparePayload(payload: CompetitorPayload) {
  const name = payload.name?.trim() ?? '';

  if (!name) {
    return { error: 'Nome do perfil e obrigatorio.' } as const;
  }

  const handle = normalizeInstagramHandle(payload.handle ?? '');
  const website = normalizeWebsiteUrl(payload.website ?? '');
  let logoUrl = payload.logoUrl?.trim() ?? '';

  if (!logoUrl && (handle || website)) {
    const { suggestedLogoUrl } = await captureCompetitorSources({
      id: '',
      name,
      handle,
      website,
      type: payload.type === 'reference' || payload.type === 'inspiration' ? payload.type : 'competitor',
      niche: payload.niche?.trim() ?? '',
      notes: payload.notes?.trim() ?? '',
      logoUrl: '',
      tags: sanitizeTags(payload.tags)
    });

    logoUrl = suggestedLogoUrl;
  }

  return {
    data: {
      name,
      handle: handle || null,
      website: website || null,
      profile_type: payload.type === 'reference' || payload.type === 'inspiration' ? payload.type : 'competitor',
      logo_url: logoUrl || null,
      niche: payload.niche?.trim() || null,
      notes: payload.notes?.trim() || null,
      tags: sanitizeTags(payload.tags)
    }
  } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('competitors')
    .select('id,company_id,name,handle,niche,website,notes,created_at,updated_at,profile_type,logo_url,tags,analysis_status,analysis_error,analysis,source_snapshot,analysis_progress,last_analyzed_at')
    .eq('company_id', context.companyId)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    competitors: (data ?? []).map((row) =>
      toCompetitorRecord(
        row as {
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
        }
      )
    )
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as CompetitorPayload | null;
  const prepared = await preparePayload(body ?? {});

  if ('error' in prepared) {
    return NextResponse.json({ error: prepared.error }, { status: 400 });
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('competitors')
    .insert({
      company_id: context.companyId,
      ...prepared.data
    })
    .select('id,company_id,name,handle,niche,website,notes,created_at,updated_at,profile_type,logo_url,tags,analysis_status,analysis_error,analysis,source_snapshot,analysis_progress,last_analyzed_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel criar o perfil.' }, { status: 500 });
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
        last_analyzed_at?: string | null;
      }
    )
  });
}
