import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Big number + label, as in the "Current situation" band. `tone="danger"` paints the number red (e.g. people missing). */
export function StatCard({
  value,
  label,
  hint,
  tone = "default",
  className = "",
}: {
  value: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "primary" | "danger" | "success";
  className?: string;
}) {
  const number = { default: "text-foreground", primary: "text-primary", danger: "text-destructive", success: "text-success" }[tone];
  const border = tone === "danger" ? "border-destructive/30" : "";
  return (
    <Card className={`p-5 ${border} ${className}`}>
      <p className={`text-3xl font-bold leading-none tabular-nums ${number}`}>{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </Card>
  );
}
