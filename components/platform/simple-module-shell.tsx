import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageIntro } from '@/components/platform/page-intro';

export function SimpleModuleShell({
  eyebrow,
  title,
  description,
  highlights,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <PageIntro eyebrow={eyebrow} title={title} description={description} />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[26px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Base pronta para evoluir</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Essa area ficou limpa de proposito para a gente encaixar o fluxo certo, sem poluicao.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full">
                etapa nova
              </Badge>
            </div>
            {children ? (
              children
            ) : (
              <div className="rounded-[22px] border border-dashed border-border bg-muted/30 p-5 text-[13px] leading-7 text-muted-foreground">
                Em seguida, aqui entram os blocos especificos desse modulo com a mesma linguagem visual do restante da plataforma.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-border/90 bg-[#17171b] text-white">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Pontos-chave</p>
            <div className="mt-4 space-y-3">
              {highlights.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/65" />
                  <p className="text-[13px] leading-6 text-white/84">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
