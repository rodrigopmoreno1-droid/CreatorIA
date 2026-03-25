"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Command,
  Plus,
  Search,
  Sparkles
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { navigationItems } from '@/lib/constants';
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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(241,245,249,1))]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-0 lg:gap-4">
        <aside
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border/80 bg-white/75 px-4 py-5 backdrop-blur-xl lg:flex',
            sidebarOpen ? 'w-[312px]' : 'w-[96px]'
          )}
        >
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background shadow-soft">
              <Sparkles className="h-5 w-5" />
            </div>
            {sidebarOpen ? (
              <div>
                <p className="font-display text-lg font-semibold tracking-tight">ContentOS</p>
                <p className="text-xs text-muted-foreground">Sistema operacional de conteúdo</p>
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
                      ? 'bg-foreground text-background shadow-soft'
                      : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground'
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
            <Button className="w-full justify-start" size="sm">
              <Plus className="h-4 w-4" />
              {sidebarOpen ? 'Criar' : null}
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Bot className="h-4 w-4" />
              {sidebarOpen ? 'Abrir IA' : null}
            </Button>
          </div>

          <div className="mt-5 rounded-3xl border border-border bg-gradient-to-br from-foreground to-slate-800 p-4 text-background">
            {sidebarOpen ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Plataforma</p>
                <p className="mt-2 font-display text-lg font-semibold leading-tight">ContentOS SaaS</p>
                <p className="mt-2 text-sm text-white/70">
                  Prepare-se para escalar com billing, feature flags e IA.
                </p>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mt-4 inline-flex items-center justify-center rounded-2xl border border-border bg-white p-3 text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-white/75 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-4 lg:px-6">
              <div className="flex flex-1 items-center gap-3">
                <div className="flex h-11 flex-1 items-center gap-3 rounded-full border border-border bg-white/90 px-4 shadow-sm">
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
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <Button variant="outline" size="sm">
                  <CalendarDays className="h-4 w-4" />
                  Hoje
                </Button>
                <Button variant="glass" size="sm">
                  <Bot className="h-4 w-4" />
                  IA
                </Button>
              </div>

              <Button size="sm">
                <Plus className="h-4 w-4" />
                Criar
              </Button>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-6">
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
