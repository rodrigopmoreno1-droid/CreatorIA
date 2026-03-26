import { CreatorsWorkspace } from '@/components/platform/creators-workspace';
import { getWorkspaceProducts, getWorkspaceRecordings } from '@/lib/platform-data';

export default async function CreatorsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [products, recordings] = await Promise.all([
    getWorkspaceProducts(workspace),
    getWorkspaceRecordings(workspace),
  ]);

  return (
    <CreatorsWorkspace
      workspace={workspace}
      products={products}
      recordings={recordings}
    />
  );
}
