"use client";

import { cn } from '@/lib/utils';

export function BrandMark({
  className,
  tone = 'dark'
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-[16px] border shadow-[0_10px_22px_rgba(15,23,42,0.06)]',
        tone === 'dark' ? 'border-white/10 bg-[#17171b] text-white' : 'border-border bg-white text-[#17171b]',
        className
      )}
      aria-hidden="true"
    >
      <span className="absolute left-[10px] top-[10px] h-[2px] w-[16px] rounded-full bg-current" />
      <span className="absolute left-[10px] top-[17px] h-[2px] w-[12px] rounded-full bg-current opacity-90" />
      <span className="absolute left-[10px] top-[24px] h-[2px] w-[18px] rounded-full bg-current opacity-80" />
      <span className="absolute right-[10px] top-[10px] h-1.5 w-1.5 rounded-full bg-current opacity-70" />
    </div>
  );
}
