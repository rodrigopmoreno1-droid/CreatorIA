import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bot, CalendarDays, Search } from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';
import { getAuthenticatedUser, getCurrentWorkspaceContext } from '@/lib/workspace-server';

export default async function LoginPage() {
  const [workspace, user] = await Promise.all([getCurrentWorkspaceContext(), getAuthenticatedUser()]);

  if (workspace) {
    redirect(`/${workspace.workspaceSlug}/dashboard`);
  }

  if (user) {
    redirect('/setup');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#eef2f8_0%,#f6f7fb_48%,#f4f4f1_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.05),transparent_22%)]" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl gap-8 px-6 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-10">
        <section className="surface-shell flex flex-col justify-between rounded-[2rem] p-6 lg:p-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
            <div className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Operacao de conteudo
            </div>
          </div>

          <div className="max-w-2xl py-10 lg:py-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Creator AI</p>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight text-foreground lg:text-[3.2rem]">
              Plataforma enxuta para organizar, gerar e aprovar conteudo com clareza.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted-foreground">
              Login, configuracao da empresa e uma estrutura feita para roteiros, gravacoes, produtos, performance e IA,
              sem a poluicao que atrapalha a operacao.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="surface-card rounded-[1.75rem] p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Visao inicial</p>
                <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  minimalista
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                <div className="flex h-11 items-center gap-3 rounded-2xl border border-border bg-white px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px] text-muted-foreground">Pesquisar roteiros, produtos ou status</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <CalendarDays className="h-4 w-4 text-foreground" />
                    <p className="mt-4 text-sm font-semibold">Agenda limpa</p>
                    <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                      O que gravar, aprovar e publicar sem blocos desnecessarios.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <Bot className="h-4 w-4 text-foreground" />
                    <p className="mt-4 text-sm font-semibold">IA aplicada</p>
                    <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                      Geracao de roteiros e conversa com contexto de produto e operacao.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[rgba(15,23,42,0.08)] bg-[#17171b] p-5 text-white shadow-[0_24px_48px_rgba(15,23,42,0.14)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">O que entra agora</p>
              <div className="mt-5 space-y-3">
                {[
                  'Dashboard mais enxuto e direto',
                  'Roteiros com IA e edicao real',
                  'Gravacoes em Kanban arrastavel',
                  'Produtos como base da operacao'
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl">
            <LoginForm />
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-[12px] text-muted-foreground">
              <Link href="/privacy" className="transition hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-foreground">
                Terms
              </Link>
              <Link href="/data-deletion" className="transition hover:text-foreground">
                Data Deletion
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
