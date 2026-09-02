import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * One status idiom for the whole site. Every status is colour + text, never colour alone,
 * so it survives grayscale and high-contrast mode.
 *
 *   success  open · verified · published · fulfilled · completed · received
 *   info     matched · in progress · live
 *   warning  pending · limited · awaiting
 *   danger   missing · rejected · suspended · closed · flagged
 *   neutral  archived · draft · snapshot
 */
export type StatusTone = "success" | "info" | "warning" | "danger" | "neutral";

const toneByStatus: Record<string, StatusTone> = {
  open: "success",
  verified: "success",
  published: "success",
  fulfilled: "success",
  completed: "success",
  received: "success",
  active: "success",
  live: "info",
  matched: "info",
  "in-progress": "info",
  in_progress: "info",
  pending: "warning",
  limited: "warning",
  awaiting: "warning",
  missing: "danger",
  rejected: "danger",
  suspended: "danger",
  closed: "danger",
  flagged: "danger",
  not_received: "danger",
  archived: "neutral",
  draft: "neutral",
  snapshot: "neutral",
};

/** Maps a raw API status string to a tone; unknown statuses are neutral. */
export function toneForStatus(status: string): StatusTone {
  return toneByStatus[status] ?? "neutral";
}

const variantByTone = { success: "success", info: "info", warning: "warning", danger: "danger", neutral: "secondary" } as const;
const dotByTone = { success: "bg-success", info: "bg-primary", warning: "bg-warning", danger: "bg-destructive", neutral: "bg-subtle" } as const;

export function StatusBadge({ tone, children, className = "" }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <Badge variant={variantByTone[tone]} className={`gap-1.5 whitespace-nowrap ${className}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dotByTone[tone]}`} />
      {children}
    </Badge>
  );
}
