import Link from 'next/link';
import { Bot, CalendarDays, ChevronRight, Package, PenSquare, Video } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { PageIntro } from '@/components/platform/page-intro';
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
  const approvedCount = recordings.length;
  const editedCount = recordings.filter((item) => item.column === 'edited').length;
  const recentScripts = scripts.slice(0, 4);
  const quickStats = [
    { label: 'Roteiros ativos', value: formatCount(scripts.length), Icon: PenSquare },
    { label: 'Fila de gravacao', value: formatCount(approvedCount), Icon: Video },
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
                href={`/${workspace}/scripts`}
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
              </div>
              <div className="rounded-[18px] border border-border bg-muted/30 p-3.5">
                <CalendarDays className="h-4 w-4 text-foreground" />
                <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Editados</p>
                <p className="mt-1.5 text-[24px] font-semibold">{formatCount(editedCount)}</p>
              </div>
            </div>

            <div className="rounded-[20px] border border-border bg-white p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Ultimos roteiros</p>
                <Link href={`/${workspace}/scripts`} className="text-[13px] text-muted-foreground transition hover:text-foreground">
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
    </div>
  );
}
