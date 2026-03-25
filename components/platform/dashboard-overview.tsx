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
        description="Tudo o que precisa bater o olho para tocar a operacao de conteudo sem ruído: o que criar, o que gravar e o que ja esta pronto para seguir."
      />

      <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="rounded-[28px] border-border/90 bg-[#17171b] text-white">
          <CardContent className="p-5 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Paineis rapidos</p>
                <h2 className="mt-3 text-[28px] font-semibold tracking-tight">Operacao pronta para o dia</h2>
              </div>
              <Link
                href={`/${workspace}/scripts`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white px-4 text-[13px] font-medium text-[#17171b]"
              >
                Criar roteiro
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {quickStats.map(({ label, value, Icon }) => (
                <div key={label} className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                  <Icon className="h-4 w-4 text-white/72" />
                  <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-white/42">{label}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-5 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Resumo limpo</p>
                <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                  Produtos cadastrados, roteiros recentes e o que ja avancou na fila de producao.
                </p>
              </div>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-border bg-muted/30 p-4">
                <Package className="h-4 w-4 text-foreground" />
                <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Produtos</p>
                <p className="mt-2 text-2xl font-semibold">{formatCount(products.length)}</p>
              </div>
              <div className="rounded-[22px] border border-border bg-muted/30 p-4">
                <Video className="h-4 w-4 text-foreground" />
                <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Aprovados</p>
                <p className="mt-2 text-2xl font-semibold">{formatCount(approvedCount)}</p>
              </div>
              <div className="rounded-[22px] border border-border bg-muted/30 p-4">
                <CalendarDays className="h-4 w-4 text-foreground" />
                <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Editados</p>
                <p className="mt-2 text-2xl font-semibold">{formatCount(editedCount)}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Ultimos roteiros</p>
                <Link href={`/${workspace}/scripts`} className="text-[13px] text-muted-foreground transition hover:text-foreground">
                  Ver tudo
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {recentScripts.length ? (
                  recentScripts.map((script) => (
                    <div key={script.id} className="flex items-center justify-between rounded-[20px] border border-border bg-muted/20 px-4 py-3">
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
                  <div className="rounded-[20px] border border-dashed border-border bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground">
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
