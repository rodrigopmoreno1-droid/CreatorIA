"use client";

import { startTransition, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BellDot,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Command,
  LogOut,
  Mail,
  Plus,
  Search,
  Sparkles
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { navigationItems } from '@/lib/constants';
import { listWorkspaceSnapshots } from '@/lib/demo-data';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { useUiStore } from '@/store/use-ui-store';
import { cn } from '@/lib/utils';
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher';

export function AppShell({
  workspace,
  children
}: {
  workspace: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const currentWorkspace = listWorkspaceSnapshots().find((item) => item.slug === workspace);
  const ensureWorkspace = useWorkspaceStore((state) => state.ensureWorkspace);
  const viewMode = useWorkspaceStore((state) => state.viewModeByWorkspace[workspace] ?? 'general');
  const setViewMode = useWorkspaceStore((state) => state.setViewMode);
  const members = useWorkspaceStore((state) => state.membersByWorkspace[workspace] ?? currentWorkspace?.teamMembers ?? []);
  const actingAs = useWorkspaceStore((state) => state.actingAsByWorkspace[workspace] ?? currentWorkspace?.teamMembers?.[0]?.id ?? '');
  const setActingAs = useWorkspaceStore((state) => state.setActingAs);
  const activeMember = members.find((member) => member.id === actingAs) ?? members[0];

  useEffect(() => {
    if (currentWorkspace) {
      ensureWorkspace(currentWorkspace);
    }
  }, [currentWorkspace, ensureWorkspace]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-3 p-3 lg:p-4">
        <aside
          className={cn(
            'dark-rail sticky top-3 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-2xl px-3 py-4 text-foreground lg:flex',
            sidebarOpen ? 'w-[292px]' : 'w-[84px]'
          )}
        >
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            {sidebarOpen ? (
              <div>
                <p className="font-display text-sm font-semibold tracking-tight">ContentOS</p>
                <p className="text-[11px] text-muted-foreground">Workspace de operação</p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 px-2">
            <WorkspaceSwitcher currentWorkspace={workspace} />
          </div>

          <Separator className="my-5" />

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-1">
            {navigationItems.map((item) => {
              const active = pathname.startsWith(item.href(workspace));
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  href={item.href(workspace) as any}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition',
                    active
                      ? 'bg-[#17171b] text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {sidebarOpen ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span>{item.label}</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-2">
            <Button className="w-full justify-start" size="sm">
              <Plus className="h-4 w-4" />
              {sidebarOpen ? 'Criar' : null}
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Bot className="h-4 w-4" />
              {sidebarOpen ? 'Abrir IA' : null}
            </Button>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-muted/60 p-4">
            {sidebarOpen ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Workspace ativo</p>
                <p className="mt-2 font-display text-sm font-semibold leading-tight">
                  {currentWorkspace?.name ?? 'ContentOS SaaS'}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {currentWorkspace?.plan ?? 'Plano demo'}
                </p>
              </>
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-border bg-white p-2.5 text-foreground transition hover:bg-muted"
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {sidebarOpen ? (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-[13px] font-medium text-foreground transition hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Trocar conta
              </Link>
            ) : null}
          </div>
        </aside>

        <div className="surface-shell flex min-h-screen flex-1 flex-col overflow-hidden rounded-2xl">
          <header className="sticky top-0 z-20 border-b border-border bg-[rgba(255,255,255,0.92)] backdrop-blur-md">
            <div className="flex flex-col gap-3 px-4 py-3 lg:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 flex-1 items-center gap-3 rounded-xl border border-border bg-white px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    aria-label="Pesquisar"
                    placeholder="Pesquisar ideias, posts, creators, métricas..."
                    className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                  />
                  <span className="hidden items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground sm:inline-flex">
                    <Command className="h-3.5 w-3.5" />
                    K
                  </span>
                </div>

                <div className="hidden items-center gap-2 md:flex">
                  <Button variant="outline" size="icon">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <BellDot className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <CalendarDays className="h-4 w-4" />
                    Hoje
                  </Button>
                  <Button variant="outline" size="sm">
                    <Bot className="h-4 w-4" />
                    IA
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden rounded-xl border border-border bg-white px-3 py-2 text-right sm:block">
                    <p className="text-[10px] tracking-[0.08em] text-muted-foreground">{currentWorkspace?.plan ?? 'Demo'}</p>
                    <p className="text-[12px] font-medium text-foreground">{currentWorkspace?.company ?? 'ContentOS'}</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-[12px] font-semibold text-foreground">
                    {(currentWorkspace?.name ?? 'CO').slice(0, 2).toUpperCase()}
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Criar
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 lg:hidden">
                <div>
                  <p className="text-[10px] tracking-[0.08em] text-muted-foreground">{currentWorkspace?.plan ?? 'Demo'}</p>
                  <p className="text-sm font-semibold text-foreground">{currentWorkspace?.name ?? 'ContentOS'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Bot className="h-4 w-4" />
                    IA
                  </Button>
                </div>
              </div>

              <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {navigationItems.map((item) => {
                  const active = pathname.startsWith(item.href(workspace));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.key}
                      href={item.href(workspace) as any}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium whitespace-nowrap transition',
                        active
                          ? 'border-[#17171b] bg-[#17171b] text-white'
                          : 'border-border bg-white text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {[
                    ['general', 'Geral'],
                    ['production', 'Gravacao'],
                    ['social', 'Social Media']
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      variant={viewMode === key ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        startTransition(() => {
                          setViewMode(workspace, key as 'general' | 'production' | 'social');
                        });
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2 overflow-x-auto">
                  {members.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          setActingAs(workspace, member.id);
                        });
                      }}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition',
                        member.id === activeMember?.id
                          ? 'border-[#17171b] bg-[#17171b] text-white'
                          : 'border-border bg-white text-foreground'
                      )}
                    >
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-semibold text-white"
                        style={{ backgroundColor: member.id === activeMember?.id ? '#111827' : member.color }}
                      >
                        {member.name
                          .split(' ')
                          .map((word) => word[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-semibold">{member.name}</span>
                        <span className={cn('block truncate text-[11px]', member.id === activeMember?.id ? 'text-white/65' : 'text-muted-foreground')}>
                          {member.role}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-4 lg:px-6 lg:py-5">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
