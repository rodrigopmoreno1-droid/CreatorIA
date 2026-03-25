import { AiChatWorkspace } from '@/components/platform/ai-chat-workspace';
import { getWorkspaceAiConversations, getWorkspaceAiMessages } from '@/lib/platform-data';

export default async function AiPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const conversations = await getWorkspaceAiConversations(workspace);
  const activeConversationId = conversations[0]?.id ?? null;
  const messages = activeConversationId ? await getWorkspaceAiMessages(workspace, activeConversationId) : [];

  return (
    <AiChatWorkspace
      workspace={workspace}
      initialConversations={conversations}
      initialConversationId={activeConversationId}
      initialMessages={messages}
    />
  );
}
