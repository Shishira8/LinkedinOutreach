import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const defiBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest',
  {
    variants: {
      variant: {
        default: 'border-white/20 bg-white/5 text-[#94A3B8]',
        orange: 'border-[#F7931A]/50 bg-[#F7931A]/10 text-[#F7931A]',
        gold: 'border-[#FFD600]/45 bg-[#FFD600]/10 text-[#FFD600]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface DefiBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof defiBadgeVariants> {}

export function DefiBadge({ className, variant, ...props }: DefiBadgeProps) {
  return <span className={cn(defiBadgeVariants({ variant }), className)} {...props} />;
}
