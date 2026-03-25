import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { getWorkspaceContextForSlug } from '@/lib/workspace-server';

export default async function WorkspaceLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const context = await getWorkspaceContextForSlug(workspace);

  if (!context) {
    redirect('/login');
  }

  return (
    <AppShell workspace={context.workspaceSlug} companyName={context.companyName}>
      {children}
    </AppShell>
  );
}
