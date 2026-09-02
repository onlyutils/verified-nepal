/**
 * LEGACY newsprint primitives kept so old pages keep compiling while they are migrated.
 * Do not import from this file in new code. Use shadcn/ui components and the app
 * components in src/components (page-header, status-badge, stat-card, …) instead.
 * Delete each export once nothing imports it. See docs/DESIGN-GUIDELINES.md §8.
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge, toneForStatus, type StatusTone } from "@/components/status-badge";
import { data } from "@/lib/data";
import { labels } from "@/i18n";
import { uiStrings } from "@/i18n/ui";
import { useLiveData } from "@/lib/live";
import type { Language } from "@/lib/types";

function formatCaptionTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

/** @deprecated use `text-primary underline underline-offset-4` */
export const officialLink = "text-primary underline underline-offset-4 hover:text-primary/80";

export const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function renderMarkdownInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter((part) => part !== "")
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={`${keyPrefix}-${i}`} className="rounded bg-accent px-1 py-0.5 font-mono text-[0.9em]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
}

// ponytail: hand-rolled renderer for the small, fixed set of markdown this doc
// actually uses (headers, bold, inline code, `-` lists, `>` quotes, `---`
// rules) — not full CommonMark. Swap for a real parser if the doc's markdown
// usage grows beyond this.
export function SimpleMarkdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i}>{renderMarkdownInline(item, `li-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  text.split("\n").forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (line === "") {
      flushList();
      return;
    }
    if (line === "---") {
      flushList();
      blocks.push(<hr key={`hr-${i}`} className="my-3" />);
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const text = renderMarkdownInline(heading[2], `h-${i}`);
      blocks.push(
        level === 1 ? (
          <h1 key={`h-${i}`} className="mt-4 text-lg font-bold first:mt-0">
            {text}
          </h1>
        ) : (
          <h2 key={`h-${i}`} className="mt-3 text-base font-bold first:mt-0">
            {text}
          </h2>
        ),
      );
      return;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushList();
      blocks.push(
        <p key={`bq-${i}`} className="border-l-2 border-primary pl-3 text-muted-foreground">
          {renderMarkdownInline(quote[1], `bq-${i}`)}
        </p>,
      );
      return;
    }
    const item = line.match(/^-\s+(.*)$/);
    if (item) {
      list.push(item[1]);
      return;
    }
    flushList();
    blocks.push(<p key={`p-${i}`}>{renderMarkdownInline(line, `p-${i}`)}</p>);
  });
  flushList();

  return <div className={`space-y-2 ${className}`}>{blocks}</div>;
}

export function Rule({ variant = "single", className = "" }: { variant?: "single" | "double"; className?: string }) {
  if (variant === "double") {
    return (
      <div className={`border-t-2 border-foreground ${className}`} aria-hidden="true" />
    );
  }
  return <hr className={`m-0 border-0 border-t ${className}`} />;
}

export function SectionLabel({
  children,
  as: Tag = "h2",
  id,
  dot = false,
  className = "",
}: {
  children: ReactNode;
  as?: "h2" | "h3" | "p";
  id?: string;
  dot?: boolean | "red" | "blue";
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={`flex items-center gap-2 border-b pb-2 text-xs font-semibold uppercase tracking-[0.1em] text-foreground ${className}`}
    >
      {dot ? <span className={`size-2 rounded-full ${dot === "blue" ? "bg-primary" : "bg-destructive"}`} aria-hidden="true" /> : null}
      {children}
    </Tag>
  );
}

const headlineSize = {
  1: "text-3xl leading-tight sm:text-4xl lg:text-5xl",
  2: "text-2xl leading-tight sm:text-3xl",
  3: "text-lg leading-snug",
} as const;

export function Headline({
  level,
  as,
  id,
  className = "",
  children,
}: {
  level: 1 | 2 | 3;
  as?: "h1" | "h2" | "h3" | "p";
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const Tag = as ?? (`h${level}` as "h1" | "h2" | "h3");
  return (
    <Tag id={id} className={`font-bold tracking-tight text-foreground ${headlineSize[level]} ${className}`}>
      {children}
    </Tag>
  );
}

export function Standfirst({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-lg leading-relaxed text-muted-foreground ${className}`}>{children}</p>;
}

export function Byline({
  language,
  source = "NDRRMA",
  updatedAt,
  className = "",
}: {
  language: Language;
  source?: string;
  updatedAt?: string | null;
  className?: string;
}) {
  const t = labels[language];
  const liveData = useLiveData();
  const time = updatedAt ?? (liveData.isLive && liveData.updatedAt ? liveData.updatedAt : data.meta.synced_at);
  return (
    <p className={`text-xs text-subtle ${className}`}>
      {t.fromSourceData.replace("{source}", source)} <span aria-hidden="true">·</span>{" "}
      {t.sourceCaptionUpdated} {formatCaptionTime(time, language)}
    </p>
  );
}

/** @deprecated use `<Button>` (and `<Button asChild><a …/></Button>` for links). */
export function SquareButton({
  href,
  onClick,
  type = "button",
  tone = "outline",
  external = false,
  className = "",
  children,
}: {
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "outline" | "primary" | "red";
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const variant = tone === "primary" ? "default" : tone === "red" ? "destructive" : "secondary";
  const content = (
    <>
      {children}
      {external ? <span aria-hidden="true">↗</span> : null}
    </>
  );
  if (href) {
    return (
      <Button asChild variant={variant} className={className}>
        <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
          {content}
        </a>
      </Button>
    );
  }
  return (
    <Button type={type} onClick={onClick} variant={variant} className={className}>
      {content}
    </Button>
  );
}

/** @deprecated use `<StatusBadge tone={toneForStatus(status)}>` */
export function StatusMark({ tone, children }: { tone: string; children: ReactNode }) {
  const t: StatusTone = tone === "neutral" ? "neutral" : toneForStatus(tone);
  return <StatusBadge tone={t}>{children}</StatusBadge>;
}

export function ProjectStatusMark({ status, language }: { status: string; language: import("@/lib/types").Language }) {
  const t = labels[language] as Record<string,string>;
  const u = uiStrings[language] as Record<string,string>;
  const map: Record<string, { tone: "pending"|"published"|"matched"|"fulfilled"|"rejected"|"archived"|"in-progress"|"completed", label: string }> = {
    pending: { tone: "pending", label: u.statusPending ?? t.deskNeedsStatusPending ?? "Pending" },
    published: { tone: "published", label: u.statusPublished ?? t.deskNeedsStatusPublished ?? "Published" },
    matched: { tone: "matched", label: u.statusMatched ?? t.deskNeedsStatusMatched ?? "Matched" },
    fulfilled: { tone: "fulfilled", label: u.statusFulfilled ?? t.deskNeedsStatusFulfilled ?? "Fulfilled" },
    rejected: { tone: "rejected", label: u.statusRejected ?? t.deskNeedsStatusRejected ?? "Rejected" },
    archived: { tone: "archived", label: u.statusArchived ?? t.deskNeedsStatusArchived ?? "Archived" },
    "in-progress": { tone: "in-progress", label: u.statusInProgress },
    completed: { tone: "completed", label: u.statusCompleted },
  };
  const entry = map[status] ?? { tone: "pending" as const, label: status };
  return <StatusBadge tone={toneForStatus(entry.tone)}>{entry.label}</StatusBadge>;
}

export function RuledTable({
  caption,
  rows,
  className = "",
}: {
  caption: string;
  rows: Array<{ key: string; label: ReactNode; value: ReactNode; red?: boolean; bar?: number }>;
  className?: string;
}) {
  return (
    <table className={`w-full border-collapse text-sm ${className}`}>
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b">
            <th scope="row" className={`py-2.5 pr-3 text-left font-normal ${row.red ? "text-destructive" : "text-muted-foreground"}`}>
              {row.label}
              {row.bar !== undefined ? (
                <span
                  className={`mt-1.5 block h-0.5 rounded ${row.red ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.max(Math.min(row.bar, 1), 0.01) * 100}%` }}
                  aria-hidden="true"
                />
              ) : null}
            </th>
            <td className="py-2.5 text-right align-top font-semibold tabular-nums text-foreground">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
