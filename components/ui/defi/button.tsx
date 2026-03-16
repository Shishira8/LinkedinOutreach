import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const defiButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold uppercase tracking-wider transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7931A] focus-visible:ring-offset-0',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-[#EA580C] to-[#F7931A] text-white shadow-[0_0_20px_-5px_rgba(234,88,12,0.55)] hover:scale-[1.02] hover:shadow-[0_0_30px_-5px_rgba(247,147,26,0.65)]',
        outline:
          'border-2 border-white/25 bg-transparent text-white hover:border-[#F7931A] hover:text-[#F7931A] hover:shadow-[0_0_24px_-10px_rgba(247,147,26,0.5)]',
        ghost: 'bg-transparent text-[#94A3B8] hover:bg-white/5 hover:text-[#F7931A]',
      },
      size: {
        sm: 'h-10 px-4 text-xs',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface DefiButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof defiButtonVariants> {}

export function DefiButton({ className, variant, size, ...props }: DefiButtonProps) {
  return <button className={cn(defiButtonVariants({ variant, size }), className)} {...props} />;
}
