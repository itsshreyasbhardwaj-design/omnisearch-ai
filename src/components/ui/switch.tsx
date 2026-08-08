'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'border-line-strong bg-raised relative h-5 w-9 shrink-0 rounded-full border transition-colors',
        'data-[state=checked]:border-beam data-[state=checked]:bg-beam',
        'focus-visible:ring-beam/40 focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="bg-ink-faint data-[state=checked]:bg-void block size-3.5 translate-x-0.5 rounded-full transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
});
