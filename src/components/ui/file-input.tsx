import * as React from "react";
import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Language } from "@/lib/types";

const copy = {
  en: { drop: "Drop a file here or tap to choose", dropMany: "Drop files here or tap to choose", selected: "{n} files selected" },
  ne: { drop: "फाइल यहाँ छोड्नुहोस् वा छान्न ट्याप गर्नुहोस्", dropMany: "फाइलहरू यहाँ छोड्नुहोस् वा छान्न ट्याप गर्नुहोस्", selected: "{n} फाइल छानियो" },
};

type Props = Omit<React.ComponentProps<"input">, "type" | "className"> & { language: Language; className?: string };

/** Dashed drop-zone wrapping a visually hidden `<input type="file">`; drops re-fire the input's onChange. */
const FileInput = React.forwardRef<HTMLInputElement, Props>(({ language, className, id, multiple, disabled, onChange, ...props }, ref) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [names, setNames] = React.useState<string[]>([]);
  const t = copy[language];
  const setRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const input = inputRef.current;
        if (!input || disabled || !e.dataTransfer.files.length) return;
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }}
      className={cn(
        "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input bg-muted/40 px-4 py-5 text-center text-sm transition-colors hover:border-primary/60 hover:bg-accent focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        disabled && "cursor-not-allowed opacity-50 hover:border-input hover:bg-muted/40",
        className,
      )}
    >
      <Upload aria-hidden="true" className="size-6 text-muted-foreground" />
      <span className="font-medium">{multiple ? t.dropMany : t.drop}</span>
      {names.length ? (
        <span className="max-w-full truncate text-xs text-muted-foreground">
          {names.length === 1 ? names[0] : t.selected.replace("{n}", String(names.length))}
        </span>
      ) : null}
      <input
        ref={setRef}
        id={id}
        type="file"
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          setNames(Array.from(e.target.files ?? []).map((f) => f.name));
          onChange?.(e);
        }}
        {...props}
      />
    </label>
  );
});
FileInput.displayName = "FileInput";

export { FileInput };
