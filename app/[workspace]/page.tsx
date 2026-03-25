import { redirect } from 'next/navigation';

export default async function WorkspaceIndexPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/${workspace}/dashboard`);
}
