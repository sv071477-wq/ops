"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/panel";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** Stack and message are internals; they stay collapsed until asked for. */
  showDetails: boolean;
}

type ErrorBoundaryRootProps = ErrorBoundaryProps & { resetKey: string | null };

class ErrorBoundaryRoot extends Component<ErrorBoundaryRootProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryRootProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, showDetails: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  // A class cannot call `usePathname`, so the exported function component below
  // feeds the route in as `resetKey`. Without this a single transient throw
  // bricks the session: every later route renders the fallback.
  componentDidUpdate(prevProps: ErrorBoundaryRootProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.handleRetry();
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const details = this.state.error?.stack ?? this.state.error?.message ?? null;

      return (
        <div
          role="alert"
          className="flex min-h-[60vh] w-full items-center justify-center bg-background p-6"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-light text-destructive">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Something went wrong</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An unexpected error stopped this screen from rendering.
            </p>

            <ErrorBanner
              className="mt-4"
              message="Try again to re-render this screen. If the error comes back, reload the page."
            />

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={this.handleRetry}
                aria-label="Try rendering this screen again"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={this.handleReload}
                aria-label="Reload the page"
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                Reload the page
              </Button>
            </div>

            {details && (
              <div className="mt-5 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={this.state.showDetails}
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="px-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  {this.state.showDetails ? "Hide technical details" : "Show technical details"}
                </Button>
                {this.state.showDetails && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-muted p-3 font-mono text-xs text-muted-foreground">
                    {details}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const pathname = usePathname();

  return (
    <ErrorBoundaryRoot resetKey={pathname} fallback={fallback}>
      {children}
    </ErrorBoundaryRoot>
  );
}