import { Home } from "lucide-react";
import { data } from "./data";
import { labels } from "./i18n";
import { useLiveData } from "./live";
import type { Language } from "./types";

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-nepal-crimson">
      <span className="h-px w-6 bg-nepal-crimson" aria-hidden="true" />
      {children}
    </p>
  );
}

export function Panel({
  title,
  icon: Icon,
  action,
  children,
  footer,
  className = "",
}: {
  title: string;
  icon?: typeof Home;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col border border-nepal-line bg-white shadow-panel ${className}`}>
      <div className="flex items-center gap-3 border-b border-nepal-line px-5 py-4">
        {Icon ? <Icon className="shrink-0 text-nepal-crimson" size={18} aria-hidden="true" /> : null}
        <h2 className="text-[0.9rem] font-bold uppercase tracking-[0.08em] text-nepal-ink">{title}</h2>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      <div className="flex-1 p-5">{children}</div>
      {footer ? <div className="px-5 pb-4 pt-1">{footer}</div> : null}
    </section>
  );
}

export function SourceCaption({
  language,
  source = "NDRRMA",
  updatedAt,
}: {
  language: Language;
  source?: string;
  updatedAt?: string | null;
}) {
  const t = labels[language];
  const liveData = useLiveData();
  const captionUpdatedAt =
    updatedAt ?? (liveData.isLive && liveData.updatedAt ? liveData.updatedAt : data.meta.synced_at);

  return (
    <p className="text-[0.68rem] font-bold uppercase leading-5 tracking-[0.14em] text-nepal-slate">
      {t.sourceCaptionSource}: {source} <span aria-hidden="true">·</span>{" "}
      {t.sourceCaptionUpdated} {formatCaptionTime(captionUpdatedAt, language)}
    </p>
  );
}

function formatCaptionTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
