import { CompetitorsWorkspace } from '@/components/platform/competitors-workspace';

export default async function CompetitorsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return <CompetitorsWorkspace workspace={workspace} />;
}
