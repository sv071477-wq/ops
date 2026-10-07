"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlainHeaderCell } from "@/components/table/SortableHeaderCell";
import { cn } from "@/lib/utils";

/**
 * Presentation primitives shared by every data surface in the app: admin tabs,
 * dashboard tables and the batch drawer. They live here (not under
 * `components/admin`) because the non-admin views need the exact same panels,
 * table cells, stat tiles and empty/loading/error states.
 */

export const PANEL_CLASS = "overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

/**
 * Height of the shared `Navbar` — its `min-h-16` is border-box, so the
 * hairline bottom border is already inside this figure. Used as the sticky
 * offset for table panels: a mismatched value shows either a sliver of the
 * header or a dead band under it.
 */
export const NAVBAR_HEIGHT = 64;

export const TD = "px-5 py-3.5 text-sm align-middle";

export const TABLE_TH_STYLE: React.CSSProperties = {
  padding: "14px 20px",
  // 0.9375rem, not 0.75rem: the app renders at 80% scale, so this holds the
  // physical size these headings had before. Compensate alongside
  // `SORTABLE_TH_STYLE` -- callers spread their own `style` last, so these two
  // constants between them set every heading size in the app.
  fontSize: "0.9375rem",
  fontWeight: 800,
  color: "#111827",
  textAlign: "left",
  whiteSpace: "nowrap",
};

export const TABLE_TH_RIGHT_STYLE: React.CSSProperties = {
  ...TABLE_TH_STYLE,
  textAlign: "right",
};

// Fixed so the action column cannot resize as data or row count changes.
export const ACTIONS_COLUMN_STYLE: React.CSSProperties = { width: 116, minWidth: 116 };

export const ROW_ACTIONS_CLASS = "flex items-center justify-end gap-1";

export const ROW_ACTION_BUTTON =
  "h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground";

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn(PANEL_CLASS, className)}>{children}</section>;
}

export function PanelTitle({
  title,
  description,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
        {meta}
      </div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function PanelHeading({
  title,
  description,
  meta,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <PanelTitle title={title} description={description} meta={meta} />
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PanelBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-5 py-5 sm:px-6", className)}>{children}</div>;
}

export type Tone = "primary" | "info" | "success" | "warning" | "violet";

const TONE_ICON: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  violet: "bg-violet-500/10 text-violet-600",
};

const TONE_VALUE: Record<Tone, string> = {
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-amber-600",
  violet: "text-violet-600",
};

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "primary",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  tone?: Tone;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-[1.75rem] font-extrabold leading-none tracking-tight", TONE_VALUE[tone])}>
          {value}
        </p>
        <p className="mt-1.5 truncate text-xs text-muted-foreground/80">{hint}</p>
      </div>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", TONE_ICON[tone])}>
        {icon}
      </span>
    </>
  );

  const shell =
    "flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-sm";

  if (!onClick) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        shell,
        "transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      {body}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground"
    >
      <RefreshCw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive-light px-4 py-3 text-sm text-destructive",
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Renders a block-level state (`EmptyState`, `LoadingState`, `ErrorBanner`)
 * inside a `<tbody>` so a table keeps its `<thead>` — and therefore every sort
 * control — while it has nothing to show.
 */
export function TableStateRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 align-middle">
        {children}
      </td>
    </tr>
  );
}

/** Screen-reader-only caption; gives a `<table>` its accessible name. */
export function TableCaption({ children }: { children: React.ReactNode }) {
  return <caption className="sr-only">{children}</caption>;
}

export function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  const generatedId = React.useId();
  // A single control child adopts the field's id so the label is actually
  // wired to it; anything more complex (checkbox groups, custom widgets) keeps
  // its own markup and should set `htmlFor` itself.
  const child =
    React.isValidElement(children) && !(children.props as { id?: string }).id
      ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id: generatedId })
      : children;
  const controlId =
    (React.isValidElement(children) ? (children.props as { id?: string }).id : undefined) ?? generatedId;

  return (
    <div className="space-y-1.5">
      <label htmlFor={controlId} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {child}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatusPill({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "secondary"} size="sm" className="gap-1.5 normal-case tracking-normal">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground/60")}
        aria-hidden="true"
      />
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

export function CountBadge({ value, label }: { value: React.ReactNode; label?: string }) {
  return (
    <Badge variant="secondary" size="sm" className="font-semibold normal-case tracking-normal">
      {value}
      {label ? ` ${label}` : null}
    </Badge>
  );
}

export function ActionsHeaderCell({ label = "Actions" }: { label?: string }) {
  return (
    <PlainHeaderCell style={{ ...TABLE_TH_RIGHT_STYLE, ...ACTIONS_COLUMN_STYLE }}>{label}</PlainHeaderCell>
  );
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className={ROW_ACTIONS_CLASS}>{children}</div>;
}
