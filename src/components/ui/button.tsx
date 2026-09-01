import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none border",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper hover:bg-ink/90 border-ink disabled:bg-muted disabled:border-muted disabled:text-paper",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive disabled:bg-muted disabled:border-muted disabled:text-paper",
        outline: "border-rule bg-paper text-ink hover:bg-paper hover:border-ink disabled:text-muted disabled:border-rule",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-secondary disabled:text-muted disabled:border-rule",
        ghost: "border-transparent bg-transparent hover:bg-secondary text-ink disabled:text-muted disabled:border-rule",
        link: "text-ink underline-offset-4 hover:underline border-transparent bg-transparent",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-10 px-3 text-xs",
        lg: "min-h-11 px-8",
        icon: "min-h-11 min-w-11 h-11 w-11",
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
