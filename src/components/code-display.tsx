import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The three bearer codes the site issues, each with its own colour so they are never confused:
 *   ref     reference code for a need or donation (look up status)          — blue
 *   claim   claim code redeemed at the ward office (proof of entitlement)   — green
 *   update  update code that lets a committee post project updates          — amber
 */
export type CodeKind = "ref" | "claim" | "update";

const kindStyle: Record<CodeKind, string> = {
  ref: "border-primary bg-primary-soft text-primary",
  claim: "border-success bg-success-soft text-success",
  update: "border-warning bg-warning-soft text-warning",
};

export function CodeDisplay({
  code,
  kind,
  label,
  hint,
  copyLabel = "Copy",
  copiedLabel = "Copied",
  className = "",
}: {
  code: string;
  kind: CodeKind;
  label: string;
  hint?: string;
  copyLabel?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (http, old WebView). The code is still selectable.
    }
  };
  return (
    <div className={`rounded-xl border-2 p-4 ${kindStyle[kind]} ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.1em]">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <output className="select-all break-all font-mono text-2xl font-bold tracking-widest sm:text-3xl">{code}</output>
        <Button type="button" variant="outline" size="sm" onClick={copy} className="bg-background">
          {copied ? <Check /> : <Copy />}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      {hint ? <p className="mt-2 text-sm text-foreground/80">{hint}</p> : null}
    </div>
  );
}
