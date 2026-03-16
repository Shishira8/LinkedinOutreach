import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const defiPanelVariants = cva(
  'rounded-2xl border backdrop-blur-md',
  {
    variants: {
      variant: {
        surface:
          'border-white/10 bg-[#0F1115]/85 shadow-[0_0_50px_-10px_rgba(247,147,26,0.12)]',
        glass:
          'border-white/10 bg-black/40 shadow-[0_0_30px_-10px_rgba(247,147,26,0.15)]',
        subtle:
          'border-[#1E293B] bg-[#090B10]/70',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'surface',
      padding: 'md',
    },
  },
);

export interface DefiPanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof defiPanelVariants> {}

export function DefiPanel({ className, variant, padding, ...props }: DefiPanelProps) {
  return <div className={cn(defiPanelVariants({ variant, padding }), className)} {...props} />;
}
