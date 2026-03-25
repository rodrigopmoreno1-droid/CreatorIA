import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { getWorkspaceSnapshot } from '@/lib/demo-data';

export default async function WorkspaceLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const auth = await getCurrentUser();

  if (!auth.user && !auth.isDemo && workspace !== 'demo') {
    redirect('/login');
  }

  const snapshot = getWorkspaceSnapshot(workspace);

  return (
    <AppShell workspace={snapshot.slug}>
      <div className="mx-auto max-w-[1440px]">{children}</div>
    </AppShell>
  );
}
