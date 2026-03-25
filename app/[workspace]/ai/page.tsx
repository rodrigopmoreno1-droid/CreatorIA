import { AiChatWorkspace } from '@/components/platform/ai-chat-workspace';

export default async function AiPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  return <AiChatWorkspace workspace={workspace} />;
}
