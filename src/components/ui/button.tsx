import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper hover:bg-ink/90 border-ink",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive",
        outline: "border-rule bg-paper text-ink hover:bg-paper hover:border-ink",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-secondary",
        ghost: "border-transparent bg-transparent hover:bg-secondary text-ink",
        link: "text-ink underline-offset-4 hover:underline border-transparent bg-transparent",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
