import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { labels } from "@/i18n";
import type { Language } from "@/lib/types";

type Props = {
  language: Language;
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/** Catches render-time crashes in one page/section so a failing API call can't blank the whole app. */
export class ComponentErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ComponentErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const t = labels[this.props.language];
      return (
        <div className="border border-rule bg-card px-4 py-6" role="alert">
          <p className="font-sans text-sm text-destructive">{t.errGeneric}</p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => this.setState({ hasError: false })}>
              {t.errBoundaryRetry}
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
