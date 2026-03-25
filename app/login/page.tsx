import Link from 'next/link';
import { ArrowLeft, Sparkles, Wand2 } from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.12),transparent_24%),linear-gradient(180deg,rgba(248,250,252,1),rgba(241,245,249,1))]" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-6 lg:grid-cols-[0.95fr_0.9fr] lg:px-10 lg:py-10">
        <section className="flex flex-col justify-between rounded-[2rem] border border-white/70 bg-white/70 p-8 shadow-soft backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5" />
              ContentOS
            </div>
          </div>

          <div className="max-w-xl py-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Bem-vindo ao sistema operacional de conteúdo
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-balance">
              Uma base premium para criar, organizar e vender o seu SaaS de conteúdo.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
              Entre com sua conta Supabase ou use a demo para explorar dashboard, calendário, pipeline, stories,
              biblioteca, IA e billing.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Auth', 'Supabase + demo'],
              ['IA', 'Anthropic ou Gemini'],
              ['PWA', 'Instalável e offline']
            ].map(([title, description]) => (
              <div key={title} className="rounded-3xl border border-border bg-white/80 p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl">
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
