import { redirect } from 'next/navigation';

export default async function ScriptsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/${workspace}/roteiros`);
}
