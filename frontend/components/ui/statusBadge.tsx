"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The single status visual for the whole app. The dashboard views, the drawer
 * and the approval queue previously each carried their own hex map, and the
 * maps disagreed about the same status, so the same batch rendered three
 * different colours depending on which screen you were on.
 */
export type StatusTone = "pending" | "info" | "active" | "success" | "warning" | "danger" | "violet" | "neutral";

const TONE_VARIANT: Record<StatusTone, NonNullable<BadgeProps["variant"]>> = {
  pending: "warning",
  info: "info",
  active: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
  violet: "violet",
  neutral: "secondary",
};

/**
 * Maps a backend status string to a tone. Order matters: several statuses
 * contain each other's keywords ("Approval 1 Pending" vs "Ongoing"), so the
 * more specific phrases are tested first.
 */
export function statusTone(status?: string | null): StatusTone {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return "neutral";
  if (s.includes("cancel") || s.includes("not conducted") || s.includes("reject")) return "danger";
  if (s.includes("hold") || s.includes("delayed")) return "warning";
  if (s.includes("pending") || s.includes("request") || s.includes("awaiting") || s.includes("due")) {
    return "pending";
  }
  if (s.includes("reschedul") || s.includes("replan")) return "violet";
  if (s.includes("complet") || s.includes("deliver") || s.includes("clos")) return "success";
  if (s.includes("ongoing") || s.includes("inprogress") || s.includes("in progress") || s.includes("active")) {
    return "active";
  }
  if (s.includes("approv") || s.includes("upcoming") || s.includes("schedul")) return "info";
  return "neutral";
}

export interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  status?: string | null;
  /** Text shown when the backend has no status at all. */
  emptyLabel?: string;
}

/**
 * Status pill. `normal-case` because these are real sentences ("Approval 1
 * Pending"), not enumerations — uppercasing them was a readability regression.
 */
export function StatusBadge({ status, emptyLabel = "—", className, ...rest }: StatusBadgeProps) {
  const label = (status ?? "").trim() || emptyLabel;

  return (
    <Badge
      variant={TONE_VARIANT[statusTone(status)]}
      size="sm"
      className={cn("normal-case tracking-normal", className)}
      {...rest}
    >
      {label}
    </Badge>
  );
}
