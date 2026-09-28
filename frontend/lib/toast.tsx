"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
  success: (title: string, message?: string, options?: Partial<Toast>) => string;
  error: (title: string, message?: string, options?: Partial<Toast>) => string;
  warning: (title: string, message?: string, options?: Partial<Toast>) => string;
  info: (title: string, message?: string, options?: Partial<Toast>) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={20} color="#16a34a" />,
  error: <AlertCircle size={20} color="#ef4444" />,
  warning: <AlertTriangle size={20} color="#f59e0b" />,
  info: <Info size={20} color="#0b5cab" />,
};

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" },
  error: { bg: "#fef2f2", border: "#fecaca", color: "#ef4444" },
  warning: { bg: "#fffbeb", border: "#fde68a", color: "#d97706" },
  info: { bg: "#eff6ff", border: "#bfdbfe", color: "#0b5cab" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { type, title, message, action, dismissible = true } = toast;
  const { bg, border, color } = TOAST_STYLES[type];
  const icon = TOAST_ICONS[type];

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
        animation: "slideIn 0.3s ease-out",
        minWidth: 320,
        maxWidth: 420,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color, marginBottom: message ? 4 : 0 }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: "0.85rem", color: "#475569", lineHeight: 1.4 }}>
            {message}
          </div>
        )}
        {action && (
          <button
            onClick={() => {
              action.onClick();
              if (action.label !== "Dismiss") onDismiss(toast.id);
            }}
            style={{
              marginTop: 8,
              padding: "6px 12px",
              background: "transparent",
              border: `1px solid ${color}`,
              color,
              borderRadius: 6,
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {action.label}
          </button>
        )}
      </div>
      {dismissible && (
        <button
          onClick={() => onDismiss(toast.id)}
          style={{
            flexShrink: 0,
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: Toast = {
      id,
      duration: 5000,
      dismissible: true,
      ...toast,
    };
    setToasts((prev) => [...prev, newToast]);

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    }

    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return showToast({ type: "success", title, message, ...options });
  }, [showToast]);

  const error = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return showToast({ type: "error", title, message, duration: 8000, ...options });
  }, [showToast]);

  const warning = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return showToast({ type: "warning", title, message, duration: 7000, ...options });
  }, [showToast]);

  const info = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return showToast({ type: "info", title, message, ...options });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, dismissAll, success, error, warning, info }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
          maxWidth: 440,
        }}
      >
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: "auto" }}>
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}