import { DashboardOverview } from '@/components/platform/dashboard-overview';
import { getWorkspaceDashboardData } from '@/lib/platform-data';

export default async function DashboardPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const data = await getWorkspaceDashboardData(workspace);

  return (
    <DashboardOverview
      workspace={workspace}
      companyName={data.context?.companyName ?? 'Creator AI'}
      products={data.products}
      scripts={data.scripts}
      recordings={data.recordings}
      postsCount={data.postsCount}
    />
  );
}
