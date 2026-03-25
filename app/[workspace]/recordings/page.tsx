import { RecordingsWorkspace } from '@/components/platform/recordings-workspace';
import { getWorkspaceRecordings } from '@/lib/platform-data';

export default async function RecordingsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const recordings = await getWorkspaceRecordings(workspace);

  return <RecordingsWorkspace workspace={workspace} initialCards={recordings} />;
}
