import { PostsWorkspace } from '@/components/platform/posts-workspace';
import { getWorkspaceProducts, getWorkspaceScripts } from '@/lib/platform-data';

export default async function PostsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [products, scripts] = await Promise.all([
    getWorkspaceProducts(workspace),
    getWorkspaceScripts(workspace),
  ]);

  return (
    <PostsWorkspace
      workspace={workspace}
      products={products}
      scripts={scripts}
    />
  );
}
