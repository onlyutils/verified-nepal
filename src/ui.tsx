import type { ReactNode } from "react";
import { data } from "./data";
import { labels } from "./i18n";
import { uiStrings } from "./i18n-ui";
import { useLiveData } from "./live";
import type { Language } from "./types";

function formatCaptionTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export const officialLink =
  "text-blue underline decoration-blue/60 underline-offset-4 hover:decoration-blue";

export const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

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
          <code key={`${keyPrefix}-${i}`} className="bg-ink/5 px-1 py-0.5 rounded-none">
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
      blocks.push(<hr key={`hr-${i}`} className="border-rule my-3" />);
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
        <p key={`bq-${i}`} className="border-l-2 border-rule pl-3 italic">
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
      <div className={`border-t border-ink ${className}`} aria-hidden="true">
        <div className="mt-[3px] border-t-[3px] border-ink" />
      </div>
    );
  }
  return <hr className={`m-0 border-0 border-t border-rule ${className}`} />;
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
      className={`flex items-center gap-2 border-b border-rule pb-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink ${className}`}
    >
      {dot ? <span className={`h-2 w-2 rounded-full ${dot === "blue" ? "bg-blue" : "bg-red"}`} aria-hidden="true" /> : null}
      {children}
    </Tag>
  );
}

const headlineSize = {
  1: "text-[2.25rem] leading-[1.05] sm:text-[3rem] lg:text-[3.4rem]",
  2: "text-[1.75rem] leading-[1.1] sm:text-[2.1rem]",
  3: "text-[1.2rem] leading-[1.25]",
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
    <Tag id={id} className={`font-display font-bold tracking-[-0.01em] text-ink ${headlineSize[level]} ${className}`}>
      {children}
    </Tag>
  );
}

export function Standfirst({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-serif text-[1.05rem] italic leading-7 text-muted ${className}`}>{children}</p>;
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
    <p className={`font-sans text-[0.68rem] uppercase leading-5 tracking-[0.14em] text-muted ${className}`}>
      {t.fromSourceData.replace("{source}", source)} <span aria-hidden="true">·</span>{" "}
      {t.sourceCaptionUpdated} {formatCaptionTime(time, language)}
    </p>
  );
}

const buttonTone = {
  outline: "border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
  primary: "border-ink bg-ink text-paper hover:bg-ink/80 hover:border-ink/80",
  red: "border-red bg-red text-paper hover:bg-red/85 hover:border-red/85",
} as const;

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
  const classes = `inline-flex min-h-11 items-center justify-center gap-2 border px-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors ${buttonTone[tone]} ${focusRing} ${className}`;
  const content = (
    <>
      {children}
      {external ? <span aria-hidden="true">↗</span> : null}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        className={classes}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {content}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

const statusGlyph: Record<string, string> = {
  verified: "●",
  missing: "✕",
  pending: "○",
  neutral: "▢",
  published: "●",
  matched: "◐",
  fulfilled: "✓",
  rejected: "✕",
  archived: "▢",
  "in-progress": "◐",
  completed: "✓",
};

const statusDot = {
  verified: "bg-blue text-blue",
  missing: "bg-red text-red",
  pending: "border border-ink bg-transparent text-ink",
  neutral: "bg-muted text-muted",
  published: "bg-ink text-ink",
  matched: "bg-ink text-ink",
  fulfilled: "bg-ink text-ink",
  rejected: "bg-ink text-ink",
  archived: "bg-muted text-muted",
  "in-progress": "bg-ink text-ink",
  completed: "bg-ink text-ink",
} as const;

export function StatusMark({
  tone,
  children,
}: {
  tone: "verified" | "missing" | "pending" | "neutral" | "published" | "matched" | "fulfilled" | "rejected" | "archived" | "in-progress" | "completed";
  children: ReactNode;
}) {
  const glyph = statusGlyph[tone] ?? "○";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink">
      <span className="flex h-3 w-3 items-center justify-center text-[0.6rem] leading-none" aria-hidden="true">{glyph}</span>
      {children}
    </span>
  );
}

export function ProjectStatusMark({ status, language }: { status: string; language: import("./types").Language }) {
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
  return <StatusMark tone={entry.tone}>{entry.label}</StatusMark>;
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
    <table className={`w-full border-collapse font-sans text-sm ${className}`}>
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-rule">
            <th scope="row" className={`py-2.5 pr-3 text-left font-normal ${row.red ? "text-red" : "text-muted"}`}>
              {row.label}
              {row.bar !== undefined ? (
                <span
                  className={`mt-1.5 block h-px ${row.red ? "bg-red" : "bg-ink"}`}
                  style={{ width: `${Math.max(Math.min(row.bar, 1), 0.01) * 100}%` }}
                  aria-hidden="true"
                />
              ) : null}
            </th>
            <td className="py-2.5 text-right align-top font-semibold tabular-nums text-ink">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
