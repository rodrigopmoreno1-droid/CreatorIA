import { NextResponse } from 'next/server';

import { chatWithAi } from '@/services/ai';
import { getWorkspaceAiMessages, resolveWorkspaceDataAccess, toAiConversationItem, toAiMessageItem } from '@/lib/platform-data';

type ChatPayload = {
  prompt?: string;
};

function deriveConversationTitle(prompt: string) {
  return prompt.trim().replace(/\s+/g, ' ').slice(0, 42) || 'Nova conversa';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspace: string; conversationId: string }> }
) {
  const { workspace, conversationId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as ChatPayload | null;
  const prompt = body?.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: 'Digite uma mensagem.' }, { status: 400 });
  }

  const { admin, context } = access;
  const { data: conversation, error: conversationError } = await admin
    .from('ai_conversations')
    .select('id,company_id,title,created_by_user_id,last_message_at,created_at,updated_at,deleted_at,deleted_by_user_id')
    .eq('company_id', context.companyId)
    .eq('id', conversationId)
    .is('deleted_at', null)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: 'Conversa nao encontrada.' }, { status: 404 });
  }

  const userMessage = await admin
    .from('ai_messages')
    .insert({
      company_id: context.companyId,
      conversation_id: conversationId,
      role: 'user',
      content: prompt
    })
    .select('id,conversation_id,company_id,role,content,created_at')
    .single();

  if (userMessage.error || !userMessage.data) {
    return NextResponse.json({ error: userMessage.error?.message ?? 'Nao foi possivel registrar a mensagem.' }, { status: 500 });
  }

  const historyMessages = await getWorkspaceAiMessages(workspace, conversationId);
  const assistantResponse = await chatWithAi({
    prompt,
    workspace,
    history: historyMessages.slice(0, -1).map((message) => ({
      role: message.role,
      content: message.content
    }))
  });

  const assistantMessage = await admin
    .from('ai_messages')
    .insert({
      company_id: context.companyId,
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantResponse
    })
    .select('id,conversation_id,company_id,role,content,created_at')
    .single();

  if (assistantMessage.error || !assistantMessage.data) {
    return NextResponse.json({ error: assistantMessage.error?.message ?? 'Nao foi possivel gerar a resposta.' }, { status: 500 });
  }

  const nextTitle = conversation.title === 'Nova conversa' ? deriveConversationTitle(prompt) : conversation.title;

  const { data: updatedConversation, error: updateError } = await admin
    .from('ai_conversations')
    .update({
      title: nextTitle,
      last_message_at: new Date().toISOString()
    })
    .eq('company_id', context.companyId)
    .eq('id', conversationId)
    .select('id,company_id,title,created_by_user_id,last_message_at,created_at,updated_at,deleted_at,deleted_by_user_id')
    .single();

  if (updateError || !updatedConversation) {
    return NextResponse.json({ error: updateError?.message ?? 'Nao foi possivel atualizar a conversa.' }, { status: 500 });
  }

  const messages = await getWorkspaceAiMessages(workspace, conversationId);

  return NextResponse.json({
    conversation: toAiConversationItem(updatedConversation),
    messages,
    userMessage: toAiMessageItem(userMessage.data as never),
    assistantMessage: toAiMessageItem(assistantMessage.data as never)
  });
}
