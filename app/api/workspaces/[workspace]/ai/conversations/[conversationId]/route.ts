import { NextResponse } from 'next/server';

import { getWorkspaceAiMessages, resolveWorkspaceDataAccess } from '@/lib/platform-data';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; conversationId: string }> }
) {
  const { workspace, conversationId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const messages = await getWorkspaceAiMessages(workspace, conversationId);
  return NextResponse.json({ messages });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; conversationId: string }> }
) {
  const { workspace, conversationId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { error } = await admin
    .from('ai_conversations')
    .delete()
    .eq('company_id', context.companyId)
    .eq('id', conversationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspace: string; conversationId: string }> }
) {
  const { workspace, conversationId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { title?: string } | null;
  const title = body?.title?.trim();

  if (!title) {
    return NextResponse.json({ error: 'Titulo obrigatorio.' }, { status: 400 });
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('ai_conversations')
    .update({ title })
    .eq('company_id', context.companyId)
    .eq('id', conversationId)
    .select('id,company_id,title,created_by_user_id,last_message_at,created_at,updated_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel atualizar a conversa.' }, { status: 500 });
  }

  return NextResponse.json({
    conversation: {
      id: data.id,
      title: data.title,
      lastMessageAt: data.last_message_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }
  });
}
