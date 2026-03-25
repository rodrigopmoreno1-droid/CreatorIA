import { ScriptsWorkspace } from '@/components/platform/scripts-workspace';
import { getWorkspaceProducts, getWorkspaceScripts } from '@/lib/platform-data';

export default async function ScriptsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [products, scripts] = await Promise.all([getWorkspaceProducts(workspace), getWorkspaceScripts(workspace)]);

  return <ScriptsWorkspace workspace={workspace} products={products} scripts={scripts} />;
}
