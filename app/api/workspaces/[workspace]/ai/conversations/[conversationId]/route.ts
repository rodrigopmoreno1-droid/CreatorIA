import { NextResponse } from 'next/server';

import {
  getWorkspaceAiMessages,
  resolveWorkspaceDataAccess,
  supportsWorkspaceAiTrashColumns
} from '@/lib/platform-data';
import { getAuthenticatedUser } from '@/lib/workspace-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; conversationId: string }> }
) {
  const { workspace, conversationId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const supportsTrashColumns = await supportsWorkspaceAiTrashColumns(workspace);
  const { data: conversation, error: conversationError } = supportsTrashColumns
    ? await admin
        .from('ai_conversations')
        .select('id')
        .eq('company_id', context.companyId)
        .eq('id', conversationId)
        .is('deleted_at', null)
        .maybeSingle()
    : await admin.from('ai_conversations').select('id').eq('company_id', context.companyId).eq('id', conversationId).maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: 'Conversa nao encontrada.' }, { status: 404 });
  }

  const messages = await getWorkspaceAiMessages(workspace, conversationId);
  return NextResponse.json({ messages });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workspace: string; conversationId: string }> }
) {
  const { workspace, conversationId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const permanent = new URL(request.url).searchParams.get('permanent') === '1';
  const { admin, context } = access;
  const user = await getAuthenticatedUser();
  const supportsTrashColumns = await supportsWorkspaceAiTrashColumns(workspace);

  if (permanent || !supportsTrashColumns) {
    const { error } = await admin.from('ai_conversations').delete().eq('company_id', context.companyId).eq('id', conversationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, permanent: true });
  }

  const { data, error } = await admin
    .from('ai_conversations')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_user_id: user?.id ?? null
    })
    .eq('company_id', context.companyId)
    .eq('id', conversationId)
    .is('deleted_at', null)
    .select('id,company_id,title,created_by_user_id,last_message_at,created_at,updated_at,deleted_at,deleted_by_user_id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel mover a conversa para a lixeira.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    conversation: {
      id: data.id,
      title: data.title,
      lastMessageAt: data.last_message_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deletedAt: data.deleted_at,
      deletedByUserId: data.deleted_by_user_id
    }
  });
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
  const action = (body as { action?: string } | null)?.action;

  if (action === 'restore') {
    const supportsTrashColumns = await supportsWorkspaceAiTrashColumns(workspace);

    if (!supportsTrashColumns) {
      return NextResponse.json({ error: 'Lixeira indisponivel nesta base.' }, { status: 400 });
    }

    const { admin, context } = access;
    const { data, error } = await admin
      .from('ai_conversations')
      .update({
        deleted_at: null,
        deleted_by_user_id: null
      })
      .eq('company_id', context.companyId)
      .eq('id', conversationId)
      .not('deleted_at', 'is', null)
      .select('id,company_id,title,created_by_user_id,last_message_at,created_at,updated_at,deleted_at,deleted_by_user_id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Nao foi possivel restaurar a conversa.' }, { status: 500 });
    }

    return NextResponse.json({
      conversation: {
        id: data.id,
        title: data.title,
        lastMessageAt: data.last_message_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        deletedAt: data.deleted_at,
        deletedByUserId: data.deleted_by_user_id
      }
    });
  }

  const title = body?.title?.trim();

  if (!title) {
    return NextResponse.json({ error: 'Titulo obrigatorio.' }, { status: 400 });
  }

  const { admin, context } = access;
  const supportsTrashColumns = await supportsWorkspaceAiTrashColumns(workspace);
  const updateQuery = admin
    .from('ai_conversations')
    .update({ title })
    .eq('company_id', context.companyId)
    .eq('id', conversationId);

  if (supportsTrashColumns) {
    updateQuery.is('deleted_at', null);
  }

  const { data, error } = supportsTrashColumns
    ? await updateQuery
        .select('id,company_id,title,created_by_user_id,last_message_at,created_at,updated_at,deleted_at,deleted_by_user_id')
        .single()
    : await updateQuery.select('id,company_id,title,created_by_user_id,last_message_at,created_at,updated_at').single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel atualizar a conversa.' }, { status: 500 });
  }

  const conversationRow = data as {
    id: string;
    title: string;
    last_message_at: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    deleted_by_user_id?: string | null;
  };

  if (supportsTrashColumns) {
    return NextResponse.json({
      conversation: {
        id: conversationRow.id,
        title: conversationRow.title,
        lastMessageAt: conversationRow.last_message_at,
        createdAt: conversationRow.created_at,
        updatedAt: conversationRow.updated_at,
        deletedAt: conversationRow.deleted_at ?? null,
        deletedByUserId: conversationRow.deleted_by_user_id ?? null
      }
    });
  }

  return NextResponse.json({
    conversation: {
      id: conversationRow.id,
      title: conversationRow.title,
      lastMessageAt: conversationRow.last_message_at,
      createdAt: conversationRow.created_at,
      updatedAt: conversationRow.updated_at,
      deletedAt: null,
      deletedByUserId: null
    }
  });
}
