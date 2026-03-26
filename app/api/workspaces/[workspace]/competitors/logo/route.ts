import { NextResponse } from 'next/server';

import { captureCompetitorSources, normalizeInstagramHandle, normalizeWebsiteUrl } from '@/lib/competitor-intelligence';
import { resolveWorkspaceDataAccess } from '@/lib/platform-data';

export async function GET(request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const website = normalizeWebsiteUrl(url.searchParams.get('website') ?? '');
  const handle = normalizeInstagramHandle(url.searchParams.get('handle') ?? '');
  const name = url.searchParams.get('name')?.trim() || 'Perfil';
  const niche = url.searchParams.get('niche')?.trim() || '';

  if (!website && !handle) {
    return NextResponse.json({ logoUrl: '' });
  }

  const { snapshot, suggestedLogoUrl } = await captureCompetitorSources({
    id: '',
    name,
    handle,
    website,
    type: 'competitor',
    niche,
    notes: '',
    logoUrl: '',
    tags: []
  });

  return NextResponse.json({
    logoUrl: suggestedLogoUrl,
    websiteTitle: snapshot.website?.title ?? '',
    profileName: snapshot.instagram?.fullName ?? ''
  });
}
