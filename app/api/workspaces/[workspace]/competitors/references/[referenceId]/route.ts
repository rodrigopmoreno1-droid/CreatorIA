import { NextResponse } from 'next/server';

import { resolveWorkspaceDataAccess, toContentReferenceItem } from '@/lib/platform-data';

type ReferencePatchPayload = {
  liked?: boolean;
  title?: string;
  content?: string;
  hookType?: string;
  ctaType?: string;
  format?: string;
  imageUrl?: string;
  notes?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspace: string; referenceId: string }> }
) {
  const { workspace, referenceId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as ReferencePatchPayload | null;

  if (!body) {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  const { admin, context } = access;
  const updatePayload: Record<string, unknown> = {};

  if (body.liked !== undefined) updatePayload.liked = body.liked;
  if (body.title !== undefined) updatePayload.title = body.title.trim() || 'Referencia salva';
  if (body.content !== undefined) updatePayload.content = body.content.trim();
  if (body.hookType !== undefined) updatePayload.hook_type = body.hookType.trim() || null;
  if (body.ctaType !== undefined) updatePayload.cta_type = body.ctaType.trim() || null;
  if (body.format !== undefined) updatePayload.format = body.format.trim() || null;
  if (body.imageUrl !== undefined) updatePayload.image_url = body.imageUrl.trim() || null;
  if (body.notes !== undefined) updatePayload.notes = body.notes.trim() || null;

  const { data, error } = await admin
    .from('content_references')
    .update(updatePayload)
    .eq('company_id', context.companyId)
    .eq('id', referenceId)
    .select('id,company_id,competitor_id,title,content,hook_type,cta_type,format,image_url,notes,liked,category,source,source_insight_id,source_url,metadata,created_at,updated_at,competitors(name)')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel atualizar a referencia.' }, { status: 500 });
  }

  return NextResponse.json({
    reference: toContentReferenceItem(
      data as {
        id: string;
        company_id: string;
        competitor_id: string | null;
        title: string;
        content: string;
        hook_type: string | null;
        cta_type: string | null;
        format: string | null;
        image_url: string | null;
        notes: string | null;
        liked: boolean | null;
        category: string | null;
        source: string | null;
        source_insight_id: string | null;
        source_url: string | null;
        metadata: unknown;
        created_at: string;
        updated_at: string;
        competitors?: { name?: string | null } | null;
      }
    )
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; referenceId: string }> }
) {
  const { workspace, referenceId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { error } = await admin
    .from('content_references')
    .delete()
    .eq('company_id', context.companyId)
    .eq('id', referenceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
