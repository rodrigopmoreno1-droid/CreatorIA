"use client";

import { ChevronDown, Grid2x2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { listWorkspaceSnapshots } from '@/lib/demo-data';
import { cn } from '@/lib/utils';

export function WorkspaceSwitcher({ currentWorkspace }: { currentWorkspace: string }) {
  const router = useRouter();
  const workspaces = listWorkspaceSnapshots();

  return (
    <details className="group relative">
      <summary className="list-none">
        <div className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-between border-white/80 bg-white px-3 text-[#17171b] hover:bg-white')}>
          <span className="flex min-w-0 items-center gap-2 text-left">
            <Grid2x2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{workspaces.find((w) => w.slug === currentWorkspace)?.name ?? 'Workspace'}</span>
          </span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </div>
      </summary>
      <div className="surface-shell absolute left-0 top-[calc(100%+0.5rem)] z-30 w-72 rounded-3xl p-2">
        {workspaces.map((workspace) => (
          <button
            key={workspace.slug}
            type="button"
            className={cn(
              'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition hover:bg-accent hover:text-accent-foreground',
              workspace.slug === currentWorkspace && 'bg-[#17171b] text-white hover:bg-[#17171b] hover:text-white'
            )}
            onClick={() => {
              router.push(`/${workspace.slug}/dashboard`);
            }}
          >
            <div>
              <p className="font-semibold">{workspace.name}</p>
              <p className="text-xs opacity-70">{workspace.plan}</p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] opacity-70">{workspace.slug}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
