import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-[24px] border border-border bg-white/90 p-4 shadow-soft lg:p-5', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
          ) : null}
          <div className="space-y-1.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground lg:text-[24px]">{title}</h1>
            {description ? <p className="max-w-2xl text-[13px] leading-6 text-muted-foreground">{description}</p> : null}
          </div>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
