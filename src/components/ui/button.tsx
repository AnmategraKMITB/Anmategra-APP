import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '~/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        dark_blue:
          'bg-[#2B6282] text-white hover:bg-[#265673] active:bg-[#2B6282]',
        light_blue:
          'bg-[#00B7B7] text-white hover:bg-[#00A5A5] active:bg-[#00B7B7]',
        warning:
          'bg-[#F16350] text-white hover:bg-[#FF9B8D] active:bg-[#F16350]',
        dark_blue_outline:
          'bg-transparent border-2 border-[#2B6282] text-[#2B6282] hover:bg-[#2B6282] hover:text-white active:bg-[#2B6282] active:text-white',
        green_outline:
          'bg-transparent border-2 border-[#29BC5B] text-[#29BC5B] hover:bg-[#29BC5B] hover:text-white active:bg-[#29BC5B] active:text-white',
        warning_outline:
          'bg-transparent border-2 border-[#F16350] text-[#F16350] hover:bg-[#F16350] hover:text-white active:bg-[#F16350] active:text-white',
        // destructive:
        //   'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'dark_blue',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
