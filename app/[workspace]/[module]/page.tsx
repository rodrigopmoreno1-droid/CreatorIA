import { notFound } from 'next/navigation';

import { getWorkspaceSnapshot } from '@/lib/demo-data';
import type { ModuleKey } from '@/types';
import { WorkspaceModuleView } from '@/components/modules/workspace-module-view';

const validModules: ModuleKey[] = [
  'dashboard',
  'calendar',
  'ideas',
  'scripts',
  'stories',
  'pipeline',
  'library',
  'feed',
  'posts',
  'metrics',
  'competitors',
  'products',
  'creators',
  'ai',
  'billing',
  'admin'
];

export default async function ModulePage({
  params
}: {
  params: Promise<{ workspace: string; module: string }>;
}) {
  const { workspace, module } = await params;

  if (!validModules.includes(module as ModuleKey)) {
    notFound();
  }

  const snapshot = getWorkspaceSnapshot(workspace);

  return <WorkspaceModuleView workspace={snapshot} module={module as ModuleKey} />;
}
