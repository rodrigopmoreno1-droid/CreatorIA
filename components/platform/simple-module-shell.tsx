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
  description?: string;
  highlights: string[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <PageIntro eyebrow={eyebrow} title={title} description={description} />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[24px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Base enxuta</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Esse espaco recebe o fluxo certo sem excesso visual.</p>
              </div>
              <Badge variant="outline" className="rounded-full">
                novo
              </Badge>
            </div>
            {children ? (
              children
            ) : (
              <div className="rounded-[20px] border border-dashed border-border bg-muted/30 p-4 text-[13px] leading-6 text-muted-foreground">
                Em seguida, aqui entram os blocos especificos deste modulo.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-border/90 bg-[#17171b] text-white">
          <CardContent className="p-4 lg:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">Pontos-chave</p>
            <div className="mt-3 space-y-2.5">
              {highlights.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/5 px-3 py-2.5">
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/65" />
                  <p className="text-[13px] leading-5 text-white/84">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
