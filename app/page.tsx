import { redirect } from 'next/navigation';
import { getAuthenticatedUser, getCurrentWorkspaceContext } from '@/lib/workspace-server';

export default async function HomePage() {
  const [workspace, user] = await Promise.all([getCurrentWorkspaceContext(), getAuthenticatedUser()]);

  if (workspace) {
    redirect(`/${workspace.workspaceSlug}/dashboard`);
  }

  if (user) {
    redirect('/setup');
  }

  redirect('/login');
}
