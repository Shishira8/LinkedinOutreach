import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DefiInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const DefiInput = React.forwardRef<HTMLInputElement, DefiInputProps>(function DefiInput(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full border-b-2 border-white/20 bg-black/50 px-4 py-2 text-sm text-white placeholder:text-white/30 transition-all duration-200 focus-visible:border-[#F7931A] focus-visible:outline-none focus-visible:shadow-[0_10px_20px_-10px_rgba(247,147,26,0.35)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
