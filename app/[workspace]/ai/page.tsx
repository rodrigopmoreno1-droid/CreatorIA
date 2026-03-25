import { AiChatWorkspace } from '@/components/platform/ai-chat-workspace';
import { getWorkspaceAiConversations, getWorkspaceAiMessages, getWorkspaceAiTrashConversations } from '@/lib/platform-data';

export default async function AiPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [conversations, trashedConversations] = await Promise.all([
    getWorkspaceAiConversations(workspace),
    getWorkspaceAiTrashConversations(workspace)
  ]);
  const activeConversationId = conversations[0]?.id ?? null;
  const messages = activeConversationId ? await getWorkspaceAiMessages(workspace, activeConversationId) : [];

  return (
    <AiChatWorkspace
      workspace={workspace}
      initialConversations={conversations}
      initialTrashedConversations={trashedConversations}
      initialConversationId={activeConversationId}
      initialMessages={messages}
    />
  );
}
