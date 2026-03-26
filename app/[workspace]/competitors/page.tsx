import { CompetitorsWorkspace } from '@/components/platform/competitors-workspace';
import { getWorkspaceCompetitors, getWorkspaceContentReferences } from '@/lib/platform-data';

export default async function CompetitorsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [competitors, references] = await Promise.all([
    getWorkspaceCompetitors(workspace),
    getWorkspaceContentReferences(workspace)
  ]);

  return <CompetitorsWorkspace workspace={workspace} initialCompetitors={competitors} initialReferences={references} />;
}
