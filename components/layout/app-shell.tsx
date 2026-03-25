"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bot, CalendarDays, ChevronLeft, ChevronRight, LogOut, Menu, Plus, Search, Sparkles, X } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { platformNavigation } from '@/lib/platform-navigation';
import { cn } from '@/lib/utils';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AppShell({
  workspace,
  companyName,
  children
}: {
  workspace: string;
  companyName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuCollapsed, setDesktopMenuCollapsed] = useState(false);
  const currentLabel = useMemo(() => {
    return platformNavigation.find((item) => pathname.startsWith(item.href(workspace)))?.label ?? 'Dashboard';
  }, [pathname, workspace]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-3 p-3">
        <aside
          className={cn(
            'hidden shrink-0 flex-col rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-[#17171b] p-4 text-white shadow-[0_24px_48px_rgba(15,23,42,0.12)] lg:flex',
            desktopMenuCollapsed ? 'w-[88px]' : 'w-[248px]'
          )}
        >
          <div className={cn('flex items-center gap-3 px-2', desktopMenuCollapsed && 'justify-center px-0')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#17171b]">
              <Sparkles className="h-4 w-4" />
            </div>
            {!desktopMenuCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight">Creator AI</p>
                <p className="truncate text-[11px] text-white/55">Operacao de conteudo</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setDesktopMenuCollapsed((value) => !value)}
              className={cn(
                'ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition hover:bg-white/10',
                desktopMenuCollapsed && 'ml-0'
              )}
              aria-label={desktopMenuCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            >
              {desktopMenuCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {!desktopMenuCollapsed ? (
            <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">Empresa</p>
              <p className="mt-2 truncate text-sm font-semibold text-white">{companyName}</p>
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-[11px] font-semibold text-white">
                {getInitials(companyName)}
              </div>
            </div>
          )}

          <Separator className={cn('my-5 bg-white/8', desktopMenuCollapsed && 'my-4')} />

          <nav className="flex flex-1 flex-col gap-1">
            {platformNavigation.map((item) => {
              const active = pathname.startsWith(item.href(workspace));
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  href={item.href(workspace) as never}
                  className={cn(
                    'group flex items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium transition',
                    desktopMenuCollapsed && 'justify-center px-2',
                    active ? 'bg-white text-[#17171b]' : 'text-white/62 hover:bg-white/7 hover:text-white'
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!desktopMenuCollapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className={cn('mt-4 grid gap-2', desktopMenuCollapsed && 'justify-items-center')}>
            <Link
              href={`/${workspace}/ai`}
              className={cn(
                buttonVariants({ variant: 'glass', size: 'sm' }),
                desktopMenuCollapsed && 'w-9 px-0'
              )}
              aria-label="Abrir IA"
            >
              <Bot className="h-4 w-4" />
              {!desktopMenuCollapsed ? 'Abrir IA' : null}
            </Link>
            <Link
              href="/login"
              className={cn(
                'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[13px] font-medium text-white/85 transition hover:bg-white/10',
                desktopMenuCollapsed && 'w-9 px-0'
              )}
              aria-label="Trocar conta"
            >
              <LogOut className="h-4 w-4" />
              {!desktopMenuCollapsed ? 'Trocar conta' : null}
            </Link>
          </div>
        </aside>

        <div className="surface-shell flex min-h-screen flex-1 flex-col overflow-hidden rounded-[28px]">
          <header className="sticky top-0 z-20 border-b border-border bg-[rgba(255,255,255,0.94)] px-4 py-3 backdrop-blur-md lg:px-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((value) => !value)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white lg:hidden"
                aria-label="Abrir menu"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>

              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-white px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  aria-label="Pesquisar"
                  placeholder={`Pesquisar em ${currentLabel.toLowerCase()}`}
                  className="h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <Button variant="outline" size="sm">
                  <CalendarDays className="h-4 w-4" />
                  Agenda
                </Button>
                <Link href={`/${workspace}/ai`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Bot className="h-4 w-4" />
                  IA
                </Link>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Criar
                </Button>
              </div>
            </div>

            {mobileMenuOpen ? (
              <div className="mt-3 rounded-[22px] border border-border bg-white p-3 shadow-soft lg:hidden">
                <div className="mb-3 flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#17171b] text-white">
                    <span className="text-[11px] font-semibold">{getInitials(companyName)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{companyName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">Creator AI</p>
                  </div>
                </div>

                <nav className="grid gap-1">
                  {platformNavigation.map((item) => {
                    const active = pathname.startsWith(item.href(workspace));
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.key}
                        href={item.href(workspace) as never}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium transition',
                          active ? 'bg-[#17171b] text-white' : 'hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ) : null}
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-5 lg:py-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
