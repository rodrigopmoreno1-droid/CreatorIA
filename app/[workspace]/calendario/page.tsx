import { CalendarioWorkspace } from '@/components/platform/calendario-workspace';
import { getWorkspacePlannerBatches, getWorkspaceProducts, getWorkspaceScripts } from '@/lib/platform-data';

export default async function CalendarioPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [scripts, products, plannerBatches] = await Promise.all([
    getWorkspaceScripts(workspace),
    getWorkspaceProducts(workspace),
    getWorkspacePlannerBatches(workspace)
  ]);

  return (
    <CalendarioWorkspace
      workspace={workspace}
      scripts={scripts}
      products={products}
      plannerBatches={plannerBatches}
    />
  );
}
