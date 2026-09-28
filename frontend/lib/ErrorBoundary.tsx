"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, AlertTriangle, Home, Bug } from "lucide-react";
import { useToast } from "./toast";
import { logError } from "./errorHandler";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
  resetOnPropsChange?: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.props.resetKeys && this.props.resetOnPropsChange) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.reset}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

function DefaultErrorFallback({ error, errorInfo, onReset }: DefaultErrorFallbackProps) {
  const { error: showError } = useToast();

  const handleReport = () => {
    const errorDetails = {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    const blob = new Blob([JSON.stringify(errorDetails, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f8fafc",
      }}
    >
      <div style={{
        background: "#ffffff",
        border: "1px solid #fecaca",
        borderRadius: 16,
        padding: "32px",
        maxWidth: 500,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "#fef2f2",
          color: "#ef4444",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}>
          <AlertTriangle size={28} />
        </div>

        <h2 style={{
          fontSize: "1.35rem",
          fontWeight: 700,
          color: "#1e293b",
          margin: "0 0 8px",
        }}>
          Something went wrong
        </h2>

        <p style={{
          fontSize: "0.9rem",
          color: "#64748b",
          margin: "0 0 20px",
          lineHeight: 1.5,
        }}>
          We encountered an unexpected error. Your data should be safe, but this feature isn't working right now.
        </p>

        {error && (
          <details style={{
            textAlign: "left",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "12px",
            marginBottom: 20,
            fontSize: "0.75rem",
          }}>
            <summary style={{
              cursor: "pointer",
              fontWeight: 600,
              color: "#475569",
              marginBottom: 8,
            }}>
              Error Details (click to expand)
            </summary>
            <pre style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "#ef4444",
              fontFamily: "monospace",
            }}>
              {error.message}
            </pre>
          </details>
        )}

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          <button
            onClick={onReset}
            className="btn btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "12px 16px",
            }}
          >
            <RefreshCw size={18} />
            <span>Try Again</span>
          </button>

          <button
            onClick={() => window.location.href = "/"}
            className="btn btn-secondary"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "10px 16px",
            }}
          >
            <Home size={18} />
            <span>Go to Dashboard</span>
          </button>

          <button
            onClick={handleReport}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "10px 16px",
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
              borderRadius: 10,
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Bug size={18} />
            <span>Download Error Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}