import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A styled native <select>. We use the platform control on purpose: it is the
 * best picker on low-end Android phones and costs no JavaScript. Mirrors
 * shadcn/ui's `native-select` (Tailwind v4 registry) for our v3 setup.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, children, ...props }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full appearance-none rounded-md border border-input bg-background py-2 pl-3 pr-9 text-base text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDownIcon
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
    />
  </div>
));
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };

const NativeSelectOption = ({ children, ...props }: React.OptionHTMLAttributes<HTMLOptionElement>) => (
  <option {...props}>{children}</option>
);

export { NativeSelectOption };
