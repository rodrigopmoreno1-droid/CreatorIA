"use client";

import { startTransition, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Users
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { navigationItems } from '@/lib/constants';
import { listWorkspaceSnapshots } from '@/lib/demo-data';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { useUiStore } from '@/store/use-ui-store';
import { cn } from '@/lib/utils';
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

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
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-3 p-3">
        <aside
          className={cn(
            'dark-rail sticky top-3 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-[24px] px-3 py-4 lg:flex',
            sidebarOpen ? 'w-[248px]' : 'w-[78px]'
          )}
        >
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-foreground">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            {sidebarOpen ? (
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight">ContentOS</p>
                <p className="truncate text-[11px] text-muted-foreground">Operação de conteúdo</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 px-2">
            <WorkspaceSwitcher currentWorkspace={workspace} />
          </div>

          <Separator className="my-4" />

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
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {sidebarOpen ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              aria-label={sidebarOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-border bg-white text-foreground transition hover:bg-muted"
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {sidebarOpen ? (
              <Link
                href="/login"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-[13px] font-medium text-foreground transition hover:bg-muted"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Trocar conta
              </Link>
            ) : null}
          </div>
        </aside>

        <div className="surface-shell flex min-h-screen flex-1 flex-col overflow-hidden rounded-[28px]">
          <header className="sticky top-0 z-20 border-b border-border bg-[rgba(255,255,255,0.94)] backdrop-blur-md">
            <div className="flex flex-col gap-3 px-4 py-3 lg:px-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="flex h-10 flex-1 items-center gap-3 rounded-xl border border-border bg-white px-3">
                  <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    aria-label="Pesquisar no workspace"
                    placeholder="Pesquisar ideias, posts, creators, métricas…"
                    className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                  />
                  <span className="hidden items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground sm:inline-flex">
                    <Command className="h-3.5 w-3.5" aria-hidden="true" />
                    K
                  </span>
                </div>

                <div className="flex items-center gap-2 xl:shrink-0">
                  <Button variant="outline" size="sm">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Hoje
                  </Button>
                  <Link href={`/${workspace}/ai`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <Bot className="h-4 w-4" aria-hidden="true" />
                    IA
                  </Link>
                  <Button size="sm">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Criar
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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

                <div className="flex flex-wrap items-center gap-2">
                  <div className="hidden rounded-xl border border-border bg-white px-3 py-2 text-right lg:block">
                    <p className="text-[10px] tracking-[0.08em] text-muted-foreground">{currentWorkspace?.plan ?? 'Demo'}</p>
                    <p className="text-[12px] font-medium text-foreground">{currentWorkspace?.company ?? 'ContentOS'}</p>
                  </div>

                  <details className="group relative">
                    <summary className="list-none">
                      <button
                        type="button"
                        className="inline-flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2 text-left transition hover:bg-muted"
                      >
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-semibold text-white"
                          style={{ backgroundColor: activeMember?.color ?? '#17171b' }}
                        >
                          {getInitials(activeMember?.name ?? 'Equipe')}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-foreground">
                            {activeMember?.name ?? 'Equipe'}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {activeMember?.role ?? 'Selecione um membro'}
                          </span>
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                      </button>
                    </summary>
                    <div className="surface-shell absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[280px] rounded-2xl p-2">
                      <div className="mb-2 flex items-center gap-2 px-2 py-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        Operar como
                      </div>
                      <div className="space-y-1">
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
                              'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition',
                              member.id === activeMember?.id ? 'bg-muted text-foreground' : 'hover:bg-muted/70'
                            )}
                          >
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-semibold text-white"
                              style={{ backgroundColor: member.color }}
                            >
                              {getInitials(member.name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-medium text-foreground">{member.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {member.role}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </details>
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
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>

          <main className="flex-1 px-4 py-4 lg:px-5 lg:py-5">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
