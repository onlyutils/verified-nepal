import * as React from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** When false, backdrop clicks and Escape cannot dismiss the dialog — only an explicit action inside it can. Default true. */
  dismissible?: boolean;
}

const DialogTitleIdContext = React.createContext<string | undefined>(undefined);

export function Dialog({ open, onOpenChange, children, dismissible = true }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClose = () => onOpenChange(false);
    const onCancel = (e: Event) => {
      e.preventDefault();
      if (dismissible) onOpenChange(false);
    };
    el.addEventListener("close", onClose);
    el.addEventListener("cancel", onCancel);
    return () => {
      el.removeEventListener("close", onClose);
      el.removeEventListener("cancel", onCancel);
    };
  }, [onOpenChange, dismissible]);

  return (
    <DialogTitleIdContext.Provider value={titleId}>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-modal="true"
        onClick={(e) => {
          if (dismissible && e.target === ref.current) onOpenChange(false);
        }}
        className="fixed inset-0 m-0 h-full w-full max-h-none max-w-none overflow-hidden border-0 bg-transparent p-4 open:flex open:items-center open:justify-center"
      >
        {/* Sized and scrolled here, not on the <dialog> box itself — some engines (headless Chrome included) shrink-wrap
            a modal <dialog>'s own box to its content instead of the viewport when it isn't explicitly full-bleed, which
            leaves the ::backdrop covering only that box and the page's own scrollbar showing through. */}
        <div className="max-h-full w-full max-w-lg overflow-y-auto">{children}</div>
      </dialog>
    </DialogTitleIdContext.Provider>
  );
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border border-rule bg-paper p-6 shadow-lg", className)} {...props}>
      {children}
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1", className)} {...props} />;
}

export function DialogTitle({ className, id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const ctxId = React.useContext(DialogTitleIdContext);
  return <h2 id={id ?? ctxId} className={cn("font-display text-lg font-semibold leading-none", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-sans text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}
