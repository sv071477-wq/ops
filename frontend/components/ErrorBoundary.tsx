"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f8fafc",
          textAlign: "center"
        }}>
          <div style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "32px",
            maxWidth: 480,
            width: "100%",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#fef2f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}>
              <AlertTriangle size={28} color="#ef4444" />
            </div>
            <h2 style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--text-main)",
              margin: "0 0 8px"
            }}>
              Something went wrong
            </h2>
            <p style={{
              fontSize: "0.95rem",
              color: "var(--text-muted)",
              margin: "0 0 24px",
              lineHeight: 1.5
            }}>
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>
            {this.state.error && (
              <details style={{ textAlign: "left", marginBottom: 16 }}>
                <summary style={{ cursor: "pointer", color: "var(--text-dim)", fontSize: "0.85rem" }}>
                  Error details
                </summary>
                <pre style={{
                  marginTop: 8,
                  padding: 12,
                  background: "#f1f5f9",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  overflow: "auto",
                  maxHeight: 200
                }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleRetry}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                background: "#0b5cab",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "#0d74c8"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "#0b5cab"; }}
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}