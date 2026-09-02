import type { Language } from "@/lib/types";

/**
 * Brand lockup: the mark from public/brand plus a language-aware wordmark.
 * The mark is not final — do not restyle it here; swap the SVG files when it is.
 */
export function Logo({
  language,
  variant = "dark",
  tagline,
  className = "",
}: {
  language: Language;
  /** "dark" ink on light surfaces, "light" white on the dark footer. */
  variant?: "dark" | "light";
  tagline?: string;
  className?: string;
}) {
  const primary = language === "ne" ? "भेरिफाइड नेपाल" : "Verified Nepal";
  const secondary = language === "ne" ? "Verified Nepal" : "भेरिफाइड नेपाल";
  const text = variant === "light" ? "text-white" : "text-foreground";
  const sub = variant === "light" ? "text-faint" : "text-subtle";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={variant === "light" ? "/brand/logo-mark-light.svg" : "/brand/logo-mark.svg"}
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0"
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="flex items-baseline gap-2">
          <span lang={language} className={`text-base font-bold ${text}`}>
            {primary}
          </span>
          <span lang={language === "ne" ? "en" : "ne"} className={`hidden text-xs sm:inline ${sub}`}>
            {secondary}
          </span>
        </span>
        {tagline ? <span className={`hidden text-[11px] sm:block ${sub}`}>{tagline}</span> : null}
      </span>
    </span>
  );
}
