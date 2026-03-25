import { NextResponse } from 'next/server';

import { buildScriptMetadata, parseScriptMetadata, resolveWorkspaceDataAccess, toScriptItem } from '@/lib/platform-data';

const allowedStatuses = new Set(['draft', 'approved', 'recording', 'drive', 'edited']);

type ScriptPatchBody = {
  title?: string;
  productId?: string;
  productName?: string;
  prompt?: string;
  referenceContext?: string;
  hook?: string;
  spoken?: string;
  takes?: string[];
  cta?: string;
  caption?: string;
  status?: string;
  boardOrder?: number;
  notes?: string;
  driveUrl?: string;
  category?: string;
  dueDate?: string;
  labels?: string[];
  fields?: Array<{ key?: string; value?: string }>;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspace: string; scriptId: string }> }
) {
  const { workspace, scriptId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as ScriptPatchBody | null;

  if (!body) {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  const { admin, context } = access;
  const { data: existing, error: existingError } = await admin
    .from('scripts')
    .select('id,title,hook,spoken_text,cta,storyboard,status,created_at,updated_at')
    .eq('company_id', context.companyId)
    .eq('id', scriptId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message ?? 'Roteiro nao encontrado.' }, { status: 404 });
  }

  const existingMeta = parseScriptMetadata(existing.storyboard);
  const title = body.title?.trim() || existing.title;
  const status = body.status && allowedStatuses.has(body.status) ? body.status : existing.status ?? 'draft';

  const updatePayload = {
    title,
    hook: body.hook === undefined ? existing.hook : body.hook.trim() || null,
    spoken_text: body.spoken === undefined ? existing.spoken_text : body.spoken.trim() || null,
    cta: body.cta === undefined ? existing.cta : body.cta.trim() || null,
    status,
    storyboard: buildScriptMetadata({
      caption: body.caption === undefined ? existingMeta.caption : body.caption,
      prompt: body.prompt === undefined ? existingMeta.prompt : body.prompt,
      referenceContext: body.referenceContext === undefined ? existingMeta.referenceContext : body.referenceContext,
      takes: body.takes === undefined ? existingMeta.takes : body.takes,
      productId: body.productId === undefined ? existingMeta.productId : body.productId,
      productName: body.productName === undefined ? existingMeta.productName : body.productName,
      boardOrder: body.boardOrder === undefined ? existingMeta.boardOrder : body.boardOrder,
      notes: body.notes === undefined ? existingMeta.notes : body.notes,
      driveUrl: body.driveUrl === undefined ? existingMeta.driveUrl : body.driveUrl,
      category: body.category === undefined ? existingMeta.category : body.category,
      dueDate: body.dueDate === undefined ? existingMeta.dueDate : body.dueDate,
      labels: body.labels === undefined ? existingMeta.labels : body.labels,
      fields:
        body.fields === undefined
          ? existingMeta.fields
          : body.fields
              .map((item) => ({
                key: item.key?.trim() || '',
                value: item.value?.trim() || ''
              }))
              .filter((item) => item.key || item.value)
    })
  };

  const { data, error } = await admin
    .from('scripts')
    .update(updatePayload)
    .eq('company_id', context.companyId)
    .eq('id', scriptId)
    .select('id,title,hook,spoken_text,cta,storyboard,status,created_at,updated_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel atualizar o roteiro.' }, { status: 500 });
  }

  return NextResponse.json({
    script: toScriptItem(
      data as {
        id: string;
        title: string;
        hook: string | null;
        spoken_text: string | null;
        cta: string | null;
        storyboard: unknown;
        status: string | null;
        created_at: string;
        updated_at: string;
      }
    )
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; scriptId: string }> }
) {
  const { workspace, scriptId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { error } = await admin
    .from('scripts')
    .delete()
    .eq('company_id', context.companyId)
    .eq('id', scriptId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
