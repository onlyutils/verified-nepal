import type { ReactNode } from "react";
import { data } from "./data";
import { labels } from "./i18n";
import { useLiveData } from "./live";
import type { Language } from "./types";

function formatCaptionTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

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
  dot?: boolean;
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={`flex items-center gap-2 border-b border-rule pb-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink ${className}`}
    >
      {dot ? <span className="h-2 w-2 rounded-full bg-red" aria-hidden="true" /> : null}
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
  primary: "border-ink bg-ink text-paper hover:border-red hover:bg-red",
  red: "border-red bg-red text-paper hover:border-ink hover:bg-ink",
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

const statusDot = {
  verified: "bg-ink",
  missing: "bg-red",
  pending: "border border-ink bg-transparent",
  neutral: "bg-muted",
} as const;

export function StatusMark({
  tone,
  children,
}: {
  tone: "verified" | "missing" | "pending" | "neutral";
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink">
      <span className={`h-2 w-2 rounded-full ${statusDot[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
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
