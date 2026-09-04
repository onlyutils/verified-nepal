import type { ReactNode } from "react";

/** Tracked uppercase label above a title or section, e.g. "2026 XYZ EARTHQUAKE". */
export function Eyebrow({
  children,
  tone = "primary",
  className = "",
}: {
  children: ReactNode;
  tone?: "primary" | "muted";
  className?: string;
}) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.1em] ${tone === "primary" ? "text-primary" : "text-subtle"} ${className}`}>
      {children}
    </p>
  );
}

/**
 * Standard page opening: eyebrow, h1, one-line description, optional actions on the right.
 * Every routed page starts with exactly one of these so headings never skip a level.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  as: Tag = "h1",
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  const size = Tag === "h1" ? "text-3xl sm:text-4xl" : "text-2xl";
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
        <Tag className={`font-bold leading-tight tracking-tight text-foreground ${size}`}>{title}</Tag>
        {description ? <p className="mt-2 max-w-2xl text-base text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Section heading inside a page (h2) with an optional right-aligned link or meta line. */
export function SectionHeader({
  title,
  aside,
  id,
  className = "",
}: {
  title: ReactNode;
  aside?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-2 ${className}`}>
      <h2 id={id} className="text-2xl font-bold leading-tight tracking-tight text-foreground">
        {title}
      </h2>
      {aside ? <div className="text-sm text-muted-foreground">{aside}</div> : null}
    </div>
  );
}
