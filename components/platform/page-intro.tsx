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
  description: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-[28px] border border-border bg-white/90 p-5 shadow-soft lg:p-6', className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
          ) : null}
          <div className="space-y-2">
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="max-w-3xl text-[14px] leading-7 text-muted-foreground">{description}</p>
          </div>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
