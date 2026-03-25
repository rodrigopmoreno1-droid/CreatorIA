import { redirect } from 'next/navigation';
import { getCurrentWorkspaceContext } from '@/lib/workspace-server';

export default async function HomePage() {
  const workspace = await getCurrentWorkspaceContext();

  if (workspace) {
    redirect(`/${workspace.workspaceSlug}/dashboard`);
  }

  redirect('/login');
}
