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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(148,163,255,0.16),transparent_24%),radial-gradient(circle_at_85%_12%,rgba(255,217,173,0.2),transparent_22%),linear-gradient(180deg,rgba(229,236,250,0.95),rgba(244,240,236,0.98))]">
      <div className="mx-auto flex min-h-screen max-w-[1640px] gap-4 p-3 lg:p-4">
        <aside
          className={cn(
            'dark-rail sticky top-3 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-[2rem] px-4 py-5 text-white lg:flex',
            sidebarOpen ? 'w-[304px]' : 'w-[92px]'
          )}
        >
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2e2b54] text-white shadow-soft">
              <Sparkles className="h-5 w-5" />
            </div>
            {sidebarOpen ? (
              <div>
                <p className="font-display text-lg font-semibold tracking-tight">ContentOS</p>
                <p className="text-xs text-white/55">Operação de conteúdo com IA</p>
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
                    'group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition',
                    active
                      ? 'bg-white text-[#17171b] shadow-soft'
                      : 'text-white/68 hover:bg-white/8 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {sidebarOpen ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span>{item.label}</span>
                      <span className="truncate text-xs opacity-60">{item.description}</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 space-y-2">
            <Button className="w-full justify-start bg-[#2e2b54] text-white hover:opacity-95" size="sm">
              <Plus className="h-4 w-4" />
              {sidebarOpen ? 'Criar' : null}
            </Button>
            <Button variant="glass" className="w-full justify-start border-white/10 bg-white/10 text-white hover:bg-white/16 hover:text-white" size="sm">
              <Bot className="h-4 w-4" />
              {sidebarOpen ? 'Abrir IA' : null}
            </Button>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/6 p-4 text-white shadow-soft backdrop-blur-xl">
            {sidebarOpen ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Workspace ativo</p>
                <p className="mt-2 font-display text-lg font-semibold leading-tight">
                  {currentWorkspace?.name ?? 'ContentOS SaaS'}
                </p>
                <p className="mt-2 text-sm text-white/70">
                  {currentWorkspace?.plan ?? 'Plano demo'} com IA, métricas e pipeline.
                </p>
              </>
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/6 p-3 text-white shadow-sm transition hover:bg-white/12"
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {sidebarOpen ? (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/12"
              >
                <LogOut className="h-4 w-4" />
                Trocar conta
              </Link>
            ) : null}
          </div>
        </aside>

        <div className="surface-shell flex min-h-screen flex-1 flex-col overflow-hidden rounded-[2rem]">
          <header className="sticky top-0 z-20 border-b border-white/75 bg-[rgba(252,250,247,0.92)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 px-4 py-4 lg:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 flex-1 items-center gap-3 rounded-full border border-white/80 bg-white/90 px-4 shadow-sm">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    aria-label="Pesquisar"
                    placeholder="Pesquisar ideias, posts, creators, métricas..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <span className="hidden items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:inline-flex">
                    <Command className="h-3.5 w-3.5" />
                    K
                  </span>
                </div>

                <div className="hidden items-center gap-2 md:flex">
                  <Button variant="outline" size="icon" className="rounded-2xl bg-white/90">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-2xl bg-white/90">
                    <BellDot className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-2xl bg-white">
                    <CalendarDays className="h-4 w-4" />
                    Hoje
                  </Button>
                  <Button variant="glass" size="sm" className="rounded-2xl">
                    <Bot className="h-4 w-4" />
                    IA
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden rounded-2xl bg-[#2e2b54] px-3 py-2 text-right text-white shadow-soft sm:block">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">{currentWorkspace?.plan ?? 'Demo'}</p>
                    <p className="text-sm font-semibold">{currentWorkspace?.company ?? 'ContentOS'}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#ffd9ad,#f9f4d7)] text-sm font-semibold text-[#2e2b54] shadow-sm">
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
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{currentWorkspace?.plan ?? 'Demo'}</p>
                  <p className="font-semibold text-foreground">{currentWorkspace?.name ?? 'ContentOS'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="rounded-2xl bg-white">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button variant="glass" size="sm" className="rounded-2xl">
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
                        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition',
                        active
                          ? 'gradient-sunset border-transparent text-white'
                          : 'border-white/80 bg-white/85 text-foreground'
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
                      className="h-9 rounded-2xl"
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
                        'inline-flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition',
                        member.id === activeMember?.id
                          ? 'border-transparent bg-[#17171b] text-white'
                          : 'border-white/80 bg-white/80 text-foreground'
                      )}
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name
                          .split(' ')
                          .map((word) => word[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{member.name}</span>
                        <span className={cn('block truncate text-xs', member.id === activeMember?.id ? 'text-white/60' : 'text-muted-foreground')}>
                          {member.role}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">
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
