import Link from 'next/link';
import { ArrowLeft, Sparkles, Wand2 } from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,163,255,0.2),transparent_24%),radial-gradient(circle_at_top_right,rgba(255,183,120,0.16),transparent_24%),linear-gradient(180deg,rgba(230,236,248,1),rgba(244,240,236,1))]" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-6 lg:grid-cols-[0.95fr_0.9fr] lg:px-10 lg:py-10">
        <section className="surface-shell flex flex-col justify-between rounded-[2rem] p-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5" />
              ContentOS
            </div>
          </div>

          <div className="max-w-xl py-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Bem-vindo ao sistema operacional de conteúdo
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-balance">
              A mesma linguagem visual do produto, desde o primeiro login.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
              Entre com sua conta Supabase ou use a demo para explorar dashboard, calendário, pipeline, stories,
              biblioteca, IA e billing.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="surface-card rounded-[1.75rem] p-5 inner-stroke">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Preview de operação</p>
                <span className="gradient-sunset rounded-full px-3 py-1 text-xs font-semibold text-white">Live</span>
              </div>
              <div className="mt-5 flex gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="story-ring rounded-full p-[2px]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#17171b]">
                      0{item}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="surface-muted rounded-[1.5rem] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pipeline</p>
                  <p className="mt-3 font-display text-3xl font-semibold">12</p>
                </div>
                <div className="surface-muted rounded-[1.5rem] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stories</p>
                  <p className="mt-3 font-display text-3xl font-semibold">05</p>
                </div>
              </div>
            </div>

            <div className="dark-rail rounded-[1.75rem] p-5 text-white">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">Base pronta</p>
              <div className="mt-5 space-y-3">
                {[
                  ['Auth', 'Supabase + demo'],
                  ['IA', 'Anthropic ou Gemini'],
                  ['PWA', 'Instalável e offline']
                ].map(([title, description]) => (
                  <div key={title} className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-white/65">{description}</p>
                  </div>
                ))}
              </div>
            </div>
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
