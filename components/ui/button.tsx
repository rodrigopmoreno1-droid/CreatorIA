import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[linear-gradient(135deg,#ffb36b_0%,#ff7b54_36%,#ff4f86_68%,#ff3d9a_100%)] text-white shadow-[0_18px_40px_rgba(255,92,131,0.28)] hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(255,92,131,0.34)]',
        ink: 'bg-[#17171b] text-white shadow-soft hover:bg-[#0f0f12]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-white/70 bg-white/92 hover:bg-white hover:text-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        glass: 'border border-white/70 bg-white/80 backdrop-blur-md text-foreground shadow-sm hover:bg-white'
      },
      size: {
        default: 'h-11 px-5 py-2.5',
        sm: 'h-9 rounded-full px-4',
        lg: 'h-12 rounded-full px-6',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
