import { NextResponse } from 'next/server';

import {
  createWorkspaceAiConversation,
  getWorkspaceAiConversations,
  resolveWorkspaceDataAccess
} from '@/lib/platform-data';

export async function GET(_request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const conversations = await getWorkspaceAiConversations(workspace);
  return NextResponse.json({ conversations });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { title?: string } | null;
  const conversation = await createWorkspaceAiConversation(workspace, body?.title?.trim() || 'Nova conversa');

  return NextResponse.json({ conversation });
}
