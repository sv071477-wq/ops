"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FullscreenTableProps {
  children: React.ReactNode;
  /** Heading shown in the panel header (left of the toolbar). */
  title?: React.ReactNode;
  /** Usually a `<TableFilters />` instance; rendered next to the title. */
  toolbar?: React.ReactNode;
  /** Right-aligned controls (export, refresh, save, ...). */
  actions?: React.ReactNode;
  /** Rendered after the scroll area, e.g. `<PaginationControls />`. */
  footer?: React.ReactNode;
  panelClassName?: string;
  className?: string;
  style?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  titleStyle?: React.CSSProperties;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  showFullscreenButton?: boolean;
  fullscreenLabel?: string;
  exitFullscreenLabel?: string;
  fullscreenBackground?: string;
  /**
   * "fixed" covers the viewport. "absolute" fills the nearest positioned
   * ancestor instead — required for tables rendered inside a dialog/drawer,
   * where a transformed ancestor turns `fixed` into a local positioning box.
   */
  strategy?: "fixed" | "absolute";
  initialFullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

/**
 * Panel wrapper that gives any table a fullscreen mode, Escape-to-exit,
 * body scroll locking and a sticky toolbar header. It only controls layout —
 * the table markup stays with the consumer.
 */
export function FullscreenTable({
  children,
  title,
  toolbar,
  actions,
  footer,
  panelClassName = "glass-panel",
  className,
  style,
  headerStyle,
  titleStyle,
  contentClassName,
  contentStyle,
  showFullscreenButton = true,
  fullscreenLabel = "Full Screen",
  exitFullscreenLabel = "Exit Full Screen",
  fullscreenBackground = "#f8fbff",
  strategy = "fixed",
  initialFullscreen = false,
  onFullscreenChange,
}: FullscreenTableProps) {
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);

  const applyFullscreen = useCallback(
    (next: boolean) => {
      setIsFullscreen(next);
      onFullscreenChange?.(next);
    },
    [onFullscreenChange]
  );

  const toggleFullscreen = useCallback(() => applyFullscreen(!isFullscreen), [applyFullscreen, isFullscreen]);

  // Escape is the expected way out of a fullscreen overlay.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") applyFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, applyFullscreen]);

  // Keep the page behind the overlay from scrolling while it is open.
  useEffect(() => {
    if (!isFullscreen || strategy !== "fixed") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isFullscreen, strategy]);

  return (
    <div
      className={cn(panelClassName, isFullscreen ? "table-fullscreen-panel" : null, className)}
      data-fullscreen={isFullscreen ? "true" : "false"}
      style={{
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        ...(isFullscreen
          ? {
              position: strategy,
              inset: 0,
              zIndex: 100,
              borderRadius: 0,
              padding: 16,
              overflow: "auto",
              background: fullscreenBackground,
            }
          : null),
        ...style,
      }}
    >
      {(title || toolbar || actions || showFullscreenButton) && (
        <div
style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          background: isFullscreen ? "#ffffff" : undefined,
          ...headerStyle,
          // Structural layout is owned by this component and re-declared after
          // the spread, so a caller's `headerStyle` can theme the padding,
          // background and border but can never collapse the two-row header
          // into one row and squeeze the toolbar.
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
          {(title || actions || showFullscreenButton) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                minWidth: 0,
              }}
            >
              {title ? (
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--text-main)",
                    whiteSpace: "nowrap",
                    ...titleStyle,
                  }}
                >
                  {title}
                </div>
              ) : (
                <span />
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {actions}
                {showFullscreenButton && (
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="btn btn-secondary"
                    aria-pressed={isFullscreen}
                    title={isFullscreen ? exitFullscreenLabel : fullscreenLabel}
                    style={{ padding: "8px 11px", fontSize: "0.8rem" }}
                  >
                {isFullscreen ? (
                      <Minimize2 size={15} aria-hidden="true" />
                    ) : (
                      <Maximize2 size={15} aria-hidden="true" />
                    )}
                    <span>{isFullscreen ? exitFullscreenLabel : fullscreenLabel}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* The filter grid gets the full panel width so it wraps predictably. */}
          {toolbar ? <div style={{ width: "100%", minWidth: 0 }}>{toolbar}</div> : null}
        </div>
      )}

      <div
        className={cn("table-scroll-wrapper", contentClassName)}
        style={{
          overflowX: "auto",
          overflowY: isFullscreen ? "auto" : "visible",
          minHeight: 0,
          width: "100%",
          ...contentStyle,
        }}
      >
        {children}
      </div>

      {footer}
    </div>
  );
}