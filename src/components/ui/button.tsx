'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam/60',
  {
    variants: {
      variant: {
        primary: 'bg-beam text-void hover:bg-beam-soft active:scale-[0.98]',
        outline: 'border border-line bg-raised/60 text-ink hover:bg-hover hover:border-line-strong',
        ghost: 'text-ink-muted hover:bg-hover hover:text-ink',
        subtle: 'bg-raised text-ink-muted hover:bg-hover hover:text-ink',
        danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
        link: 'text-beam underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        xs: 'h-6 rounded-xs px-2 text-[11px] [&_svg]:size-3',
        sm: 'h-8 rounded-sm px-3 text-[13px] [&_svg]:size-3.5',
        md: 'h-9 rounded-md px-4 text-sm [&_svg]:size-4',
        lg: 'h-11 rounded-md px-6 text-[15px] [&_svg]:size-4',
        icon: 'size-9 rounded-sm [&_svg]:size-4',
        'icon-sm': 'size-7 rounded-xs [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
});

export { buttonVariants };
