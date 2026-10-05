"use client";

import React from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Admin-only chrome. Everything else lives in `@/components/ui/panel` so the
 * non-admin views render the same panels, table cells and states; this module
 * re-exports that surface so the admin tabs keep a single import.
 */
export {
  ACTIONS_COLUMN_STYLE,
  ActionsHeaderCell,
  CountBadge,
  EmptyState,
  ErrorBanner,
  FormField,
  LoadingState,
  NAVBAR_HEIGHT,
  PANEL_CLASS,
  Panel,
  PanelBody,
  PanelHeading,
  PanelTitle,
  ROW_ACTIONS_CLASS,
  ROW_ACTION_BUTTON,
  RowActions,
  StatCard,
  StatusPill,
  TABLE_TH_RIGHT_STYLE,
  TABLE_TH_STYLE,
  TableCaption,
  TableStateRow,
  TD,
} from "@/components/ui/panel";
export type { Tone } from "@/components/ui/panel";

export function AdminDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "sm:max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={cn("flex max-h-[90vh] flex-col overflow-hidden p-0", maxWidth)}>
        <DialogHeader className="shrink-0 border-b border-border/70 bg-muted/40 px-6 py-5 pr-14">
          <DialogTitle className="text-lg font-bold tracking-tight">{title}</DialogTitle>
          {description && <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>}
        </DialogHeader>
        <div className="modal-scroll-content flex-1 space-y-4 px-6 py-5">{children}</div>
        {footer && (
          <DialogFooter className="shrink-0 gap-3 border-t border-border/70 bg-muted/40 px-6 py-4 sm:justify-end">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
