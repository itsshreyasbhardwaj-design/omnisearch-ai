import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'border-line bg-raised/60 text-ink placeholder:text-ink-faint flex h-9 w-full rounded-md border px-3 py-1 text-sm transition-colors outline-none',
        'focus-visible:border-beam/60 focus-visible:ring-beam/30 focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'border-line bg-raised/60 text-ink placeholder:text-ink-faint flex min-h-16 w-full rounded-md border px-3 py-2 text-sm transition-colors outline-none',
        'focus-visible:border-beam/60 focus-visible:ring-beam/30 focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
});
