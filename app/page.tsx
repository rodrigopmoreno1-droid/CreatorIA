import Link from 'next/link';
import { ArrowRight, LayoutDashboard, Sparkles, Wand2, Grid2x2, ShieldCheck } from 'lucide-react';

const highlights = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard modular',
    description: 'Widgets reorganizáveis, métricas rápidas e agenda do dia.'
  },
  {
    icon: Grid2x2,
    title: 'Multiempresa',
    description: 'Estrutura pronta para SaaS com empresas, membros e permissões.'
  },
  {
    icon: Sparkles,
    title: 'IA nativa',
    description: 'Gere ideias, roteiros, stories e análises em uma interface tipo ChatGPT.'
  },
  {
    icon: ShieldCheck,
    title: 'Base segura',
    description: 'Supabase, RLS, billing, webhooks e feature flags desenhados desde o início.'
  }
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.12),transparent_26%),linear-gradient(to_bottom,rgba(255,255,255,0.9),rgba(245,247,252,1))]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background shadow-soft">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">ContentOS</p>
              <p className="text-sm text-muted-foreground">Sistema operacional de conteúdo com IA</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-md transition hover:bg-accent hover:text-accent-foreground"
            >
              Entrar
            </Link>
            <Link
              href="/demo/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-soft transition hover:translate-y-[-1px]"
            >
              Abrir demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground shadow-sm backdrop-blur">
              Notion + ChatGPT + Instagram Planner
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[0.95] tracking-tight text-balance text-foreground sm:text-6xl lg:text-7xl">
              A fábrica de conteúdo que parece produto premium.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Planeje, roteirize, grave, publique e analise conteúdo em um SaaS multiempresa com IA, calendário,
              pipeline, biblioteca e feed preview.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/demo/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:translate-y-[-1px]"
              >
                Explorar plataforma
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-5 py-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-accent hover:text-accent-foreground"
              >
                Acessar conta
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="rounded-3xl border border-border bg-white/70 p-5 shadow-sm backdrop-blur-md"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-sky-400/15 via-emerald-300/10 to-amber-300/15 blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/70 bg-white/80 p-4 shadow-glow backdrop-blur-xl">
              <div className="rounded-[1.4rem] border border-border bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))] p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">Workspace demo</p>
                    <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">ContentOS OS</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                    Live preview
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Ideias prontas', '18'],
                    ['Posts no pipeline', '12'],
                    ['Stories hoje', '5'],
                    ['Crescimento', '+24%']
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/50">{label}</p>
                      <p className="mt-3 text-2xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white/70">IA sugeriu hoje</p>
                    <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                      3 blocos
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="h-3 w-3/4 rounded-full bg-white/15" />
                    <div className="h-3 w-11/12 rounded-full bg-white/10" />
                    <div className="h-3 w-5/6 rounded-full bg-white/15" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
