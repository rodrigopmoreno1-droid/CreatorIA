import { PostsWorkspace } from '@/components/platform/posts-workspace';

export default async function PostsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  return <PostsWorkspace workspace={workspace} />;
}
