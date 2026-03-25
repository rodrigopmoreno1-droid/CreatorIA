import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-foreground text-background',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'border border-border bg-white text-foreground',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
};

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-medium tracking-[0.06em]',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
