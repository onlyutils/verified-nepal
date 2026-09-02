import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

/** The one empty/idle state for lists, queues and search results. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center ${className}`}>
      <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-muted-foreground" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Loading placeholder with the same footprint as EmptyState, announced to screen readers. */
export function LoadingState({ label, className = "" }: { label: string; className?: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground ${className}`}
    >
      {label}
    </p>
  );
}
