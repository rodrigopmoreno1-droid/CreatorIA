import Link from 'next/link';
import { Bot, CalendarDays, ChevronRight, Package, PenSquare, Video } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { PageIntro } from '@/components/platform/page-intro';
import { cn } from '@/lib/utils';
import type { ProductItem, RecordingCard, ScriptItem } from '@/types/platform';

function formatCount(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function DashboardOverview({
  workspace,
  companyName,
  products,
  scripts,
  recordings,
  postsCount
}: {
  workspace: string;
  companyName: string;
  products: ProductItem[];
  scripts: ScriptItem[];
  recordings: RecordingCard[];
  postsCount: number;
}) {
  const approvedCount = scripts.filter((s) => s.status === 'approved').length;
  const editedCount = scripts.filter((s) => s.status === 'edited').length;
  const inProductionCount = scripts.filter((s) => ['production', 'recording', 'drive', 'editing'].includes(s.status)).length;
  const recentScripts = scripts.filter((s) => s.status === 'draft' || s.status === 'approved').slice(0, 4);
  const quickStats = [
    { label: 'Roteiros ativos', value: formatCount(scripts.filter(s => s.status === 'draft' || s.status === 'approved').length), Icon: PenSquare },
    { label: 'Em produção', value: formatCount(inProductionCount), Icon: Video },
    { label: 'Posts no radar', value: formatCount(postsCount), Icon: CalendarDays }
  ];

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Dashboard"
        title={`Visao geral de ${companyName}`}
      />

      <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="rounded-[24px] border-border/90 bg-[#17171b] text-white">
          <CardContent className="p-4 lg:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">Paineis rapidos</p>
                <h2 className="text-[22px] font-semibold tracking-tight">Operacao do dia</h2>
                <p className="max-w-xl text-[13px] leading-6 text-white/62">Uma leitura curta do que esta pronto para seguir.</p>
              </div>
              <Link
                href={`/${workspace}/roteiros`}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white px-3.5 text-[13px] font-medium text-[#17171b]"
              >
                Criar roteiro
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {quickStats.map(({ label, value, Icon }) => (
                <div key={label} className="rounded-[18px] border border-white/10 bg-white/6 p-3.5">
                  <Icon className="h-4 w-4 text-white/72" />
                  <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.18em] text-white/42">{label}</p>
                  <p className="mt-1.5 text-[24px] font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Resumo curto</p>
                <p className="mt-1 text-[13px] leading-6 text-muted-foreground">Produtos, aprovados e o que ja esta andando.</p>
              </div>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-[18px] border border-border bg-muted/30 p-3.5">
                <Package className="h-4 w-4 text-foreground" />
                <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Produtos</p>
                <p className="mt-1.5 text-[24px] font-semibold">{formatCount(products.length)}</p>
              </div>
              <div className="rounded-[18px] border border-border bg-muted/30 p-3.5">
                <Video className="h-4 w-4 text-foreground" />
                <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Aprovados</p>
                <p className="mt-1.5 text-[24px] font-semibold">{formatCount(approvedCount)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">prontos p/ produção</p>
              </div>
              <div className="rounded-[18px] border border-border bg-muted/30 p-3.5">
                <CalendarDays className="h-4 w-4 text-foreground" />
                <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Editados</p>
                <p className="mt-1.5 text-[24px] font-semibold">{formatCount(editedCount)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">prontos p/ agendar</p>
              </div>
            </div>

            <div className="rounded-[20px] border border-border bg-white p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Ultimos roteiros</p>
                <Link href={`/${workspace}/roteiros`} className="text-[13px] text-muted-foreground transition hover:text-foreground">
                  Ver tudo
                </Link>
              </div>
              <div className="mt-3 space-y-2.5">
                {recentScripts.length ? (
                  recentScripts.map((script) => (
                    <div key={script.id} className="flex items-center justify-between rounded-[18px] border border-border bg-muted/20 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{script.title}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {script.productName || 'Sem produto'} · {script.status === 'approved' ? 'aprovado' : 'rascunho'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border bg-muted/20 p-3.5 text-[13px] leading-6 text-muted-foreground">
                    Nenhum roteiro criado ainda. Comece em Roteiros com um prompt e um produto.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(() => {
        const pipelineStages = [
          { key: 'draft', label: 'Rascunho', count: scripts.filter(s => s.status === 'draft').length, color: 'bg-zinc-100 text-zinc-600 border-zinc-200', dot: 'bg-zinc-400', href: `/${workspace}/roteiros` },
          { key: 'approved', label: 'Aprovado', count: scripts.filter(s => s.status === 'approved').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', href: `/${workspace}/roteiros` },
          { key: 'production', label: 'Em produção', count: scripts.filter(s => s.status === 'production').length, color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', href: `/${workspace}/calendario` },
          { key: 'recording', label: 'Gravando', count: scripts.filter(s => s.status === 'recording').length, color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', href: `/${workspace}/calendario` },
          { key: 'drive', label: 'No Drive', count: scripts.filter(s => s.status === 'drive').length, color: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500', href: `/${workspace}/calendario` },
          { key: 'editing', label: 'Em edição', count: scripts.filter(s => s.status === 'editing').length, color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', href: `/${workspace}/calendario` },
          { key: 'edited', label: 'Editado', count: scripts.filter(s => s.status === 'edited').length, color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', href: `/${workspace}/calendario` },
          { key: 'scheduled', label: 'Agendado', count: scripts.filter(s => s.status === 'scheduled').length, color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', href: `/${workspace}/calendario` },
          { key: 'posted', label: 'Postado', count: scripts.filter(s => s.status === 'posted').length, color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', href: `/${workspace}/calendario` },
        ];

        return (
          <Card className="rounded-[24px] border-border/90 bg-white/95">
            <CardContent className="p-4 lg:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Fluxo de conteúdo</p>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">Pipeline completo</h3>
                </div>
                <p className="text-[13px] text-muted-foreground">{scripts.length} peças no total</p>
              </div>
              <div className="flex items-center gap-0 overflow-x-auto pb-2">
                {pipelineStages.map((stage, index) => (
                  <div key={stage.key} className="flex shrink-0 items-center">
                    <Link
                      href={stage.href as any}
                      className={cn(
                        'flex flex-col items-center rounded-[16px] border px-3 py-2.5 transition hover:opacity-80',
                        stage.color,
                        stage.count === 0 && 'opacity-40'
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={cn('h-2 w-2 rounded-full', stage.dot)} />
                        <span className="whitespace-nowrap text-[11px] font-medium">{stage.label}</span>
                      </div>
                      <span className="mt-1.5 text-[22px] font-semibold leading-none">{stage.count}</span>
                    </Link>
                    {index < pipelineStages.length - 1 && (
                      <span className="mx-1 shrink-0 text-[13px] text-muted-foreground/50">→</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
