import * as React from 'react';
import { cn } from '@/lib/utils';

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'border-line-strong bg-raised text-ink-muted inline-flex h-5 min-w-5 items-center justify-center rounded-xs border px-1 font-mono text-[10px]',
        className,
      )}
      {...props}
    />
  );
}
