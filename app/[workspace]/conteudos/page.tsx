import { PostsWorkspace } from '@/components/platform/posts-workspace';
import { getWorkspacePlannerBatches, getWorkspaceProducts, getWorkspaceRecordings, getWorkspaceScripts } from '@/lib/platform-data';

const viewMap = {
  drafts: 'Rascunhos',
  production: 'Produção',
  edited: 'Editados',
  calendar: 'Calendário',
  posted: 'Postados',
  overdue: 'Atrasados'
} as const;

type ViewKey = keyof typeof viewMap;

function resolveInitialTab(view?: string) {
  return (view && view in viewMap ? viewMap[view as ViewKey] : 'Rascunhos') as (typeof viewMap)[ViewKey];
}

export default async function ContentsPage({
  params,
  searchParams
}: {
  params: Promise<{ workspace: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { workspace } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : null;
  const [products, scripts, plannerBatches, recordings] = await Promise.all([
    getWorkspaceProducts(workspace),
    getWorkspaceScripts(workspace),
    getWorkspacePlannerBatches(workspace),
    getWorkspaceRecordings(workspace)
  ]);

  return (
    <PostsWorkspace
      workspace={workspace}
      products={products}
      scripts={scripts}
      plannerBatches={plannerBatches}
      recordings={recordings}
      initialTab={resolveInitialTab(resolvedSearchParams?.view)}
    />
  );
}
