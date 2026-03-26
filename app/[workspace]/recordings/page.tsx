import { redirect } from 'next/navigation';

export default async function RecordingsPage({
  params
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/${workspace}/conteudos?view=production`);
}
