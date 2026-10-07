"use client";

import React from "react";
import { ArrowDownAZ, ArrowUpAZ, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_FILTER_VALUE, type SortDir } from "@/lib/tableUtils";
import { cn } from "@/lib/utils";

// Every toolbar control shares these metrics so a row of filters reads as one
// grid: labels on a common line, controls on a common line, uniform heights.
// The height matches `Button` `size="sm"` so the table's own action buttons sit
// on the same line as the filters.
const CONTROL_HEIGHT = 36;
const LABEL_HEIGHT = 14;

const CELL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const LABEL_SLOT_STYLE: React.CSSProperties = {
  height: LABEL_HEIGHT,
  display: "flex",
  alignItems: "center",
  gap: 4,
  paddingLeft: 2,
  // 0.775rem, not 0.62rem: the app renders at 80% scale, so this holds the
  // physical size the 0.62rem labels had before. They are the smallest text in
  // the UI and already needed `--text-dim` bumped to 88% to pass AA.
  fontSize: "0.775rem",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
  lineHeight: 1,
};

const CONTROL_STYLE: React.CSSProperties = {
  height: CONTROL_HEIGHT,
  width: "100%",
  boxSizing: "border-box",
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--color-input)",
  background: "var(--color-card)",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-main)",
};

/** Height every toolbar control sits at, for bespoke filters built to match. */
export const TABLE_CONTROL_HEIGHT = CONTROL_HEIGHT;

/**
 * The exact box every toolbar control uses. Exported so a bespoke filter renders
 * the same height, border and fill instead of drifting to its own copy.
 */
export const TABLE_CONTROL_STYLE: React.CSSProperties = { ...CONTROL_STYLE };

/** The uppercase micro-label above each toolbar control. */
export const TABLE_LABEL_SLOT_STYLE: React.CSSProperties = { ...LABEL_SLOT_STYLE };

const CONTROL_SLOT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: CONTROL_HEIGHT,
};

export interface TableSortOption {
  key: string;
  label: string;
}

export interface TableFilterSelectConfig {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  allLabel?: string;
  width?: number | string;
}

export interface TableFilterBespokeConfig {
  key: string;
  label?: string;
  width?: number | string;
  /** Id of the control rendered in `content`; omit this for a labelled group. */
  htmlFor?: string;
  content: React.ReactNode;
}

export interface TableFiltersProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    width?: number | string;
  };
  selects?: readonly TableFilterSelectConfig[];
  sort?: {
    options: readonly TableSortOption[];
    sortKey: string | null;
    sortDir: SortDir;
    /** Omit `dir` to let the table pick the column's default direction. */
    onChange: (key: string | null, dir?: SortDir) => void;
    width?: number | string;
  };
  /** Controls that cannot be expressed as a simple option list (date ranges, synthetic buckets). */
  bespoke?: readonly TableFilterBespokeConfig[];
  onClear?: () => void;
  hasActiveFilters?: boolean;
  activeFilterCount?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Full-width row under the filter grid, e.g. a segmented option-set switch. */
  children?: React.ReactNode;
}

function nextDirection(dir: SortDir): SortDir {
  return dir === "asc" ? "desc" : "asc";
}

/** Label line + control line. Pass no label to keep a passthrough control on the same grid. */
function Field({
  label,
  htmlFor,
  width,
  children,
}: {
  label?: string;
  htmlFor?: string;
  width?: number | string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...CELL_STYLE, width, minWidth: label ? undefined : 0 }}>
      {label ? (
        htmlFor ? (
          <label htmlFor={htmlFor} style={LABEL_SLOT_STYLE}>
            {label}
          </label>
        ) : (
          <span style={LABEL_SLOT_STYLE}>
            {label}
          </span>
        )
      ) : (
        <span style={LABEL_SLOT_STYLE} aria-hidden="true" />
      )}
      <div style={CONTROL_SLOT_STYLE}>{children}</div>
    </div>
  );
}

/**
 * Toolbar row shared by every table: free-text search, per-column filter
 * dropdowns, any bespoke filter controls, and an explicit "Sort by" control
 * that mirrors the click-to-sort column headers. Controls passed as `children`
 * get their own full-width row.
 *
 * Order is search -> dropdowns -> bespoke -> sort -> clear, so every control
 * that narrows the rows sits together on the left and the view-shaping controls
 * (sort, clear) trail them. Changing this reorders the filter bar on every
 * table, so it is a deliberate shared contract rather than a per-table choice.
 */
export function TableFilters({
  search,
  selects,
  sort,
  bespoke,
  onClear,
  hasActiveFilters = false,
  activeFilterCount,
  className,
  style,
  children,
}: TableFiltersProps) {
  // Tables rendered on the same view share filter keys, so ids must be unique
  // per instance or the labels end up wired to another table's control.
  const instanceId = React.useId();

  // A dropdown whose rows all carry a blank value derives no options, so its
  // only entry is the "All X" placeholder and choosing anything else is
  // impossible. That is a dead control, not a filter: the column either has no
  // data yet (nothing to narrow by) or it will fill in and the dropdown returns
  // on the next render. Dropping it here keeps that decision out of every table.
  const populatedSelects = (selects ?? []).filter((select) => select.options.length > 0);

  return (
    <div
      className={cn("flex flex-wrap items-end", className)}
      style={{ flex: "1 1 auto", minWidth: 0, gap: "10px 10px", ...style }}
    >
      {search && (
        <Field
          label={search.label ?? "Search"}
          htmlFor={`${instanceId}-search`}
          width={search.width ?? 250}
        >
          <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
            <Search
              size={14}
              aria-hidden="true"
              style={{ position: "absolute", left: 9, color: "var(--text-muted)", pointerEvents: "none" }}
            />
            <input
              id={`${instanceId}-search`}
              type="search"
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              placeholder={search.placeholder ?? "Search..."}
              className="glass-input"
              style={{ ...CONTROL_STYLE, paddingLeft: 28, paddingRight: 26 }}
            />
          </div>
        </Field>
      )}

      {populatedSelects.map((select) => {
        const selectId = `${instanceId}-filter-${select.key}`;
        return (
          <Field key={select.key} label={select.label} htmlFor={selectId} width={select.width ?? 150}>
            <select
              id={selectId}
              value={select.value || ALL_FILTER_VALUE}
              onChange={(event) => select.onChange(event.target.value)}
              style={CONTROL_STYLE}
            >
              <option value={ALL_FILTER_VALUE}>{select.allLabel ?? `All ${select.label.toLowerCase()}`}</option>
              {select.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        );
      })}

      {bespoke?.map((entry) => (
        <Field
          key={entry.key}
          label={entry.label}
          htmlFor={entry.htmlFor}
          width={entry.width}
        >
          {entry.content}
        </Field>
      ))}

      {sort && (
        <Field label="Sort by" htmlFor={`${instanceId}-sort`} width={sort.width ?? 200}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
            <select
              id={`${instanceId}-sort`}
              value={sort.sortKey ?? ALL_FILTER_VALUE}
              onChange={(event) => {
                const nextKey = event.target.value || null;
                sort.onChange(nextKey, nextKey === sort.sortKey ? nextDirection(sort.sortDir) : undefined);
              }}
              style={{ ...CONTROL_STYLE, flex: 1, minWidth: 0 }}
            >
              <option value={ALL_FILTER_VALUE}>Unsorted</option>
              {sort.options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => sort.onChange(sort.sortKey, nextDirection(sort.sortDir))}
              disabled={!sort.sortKey}
              title={
                sort.sortDir === "desc"
                  ? "Sorted descending — click for ascending"
                  : "Sorted ascending — click for descending"
              }
              aria-label={sort.sortDir === "desc" ? "Sort ascending" : "Sort descending"}
              style={{
                ...CONTROL_STYLE,
                flexShrink: 0,
                width: CONTROL_HEIGHT,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-card)",
                color: sort.sortKey ? "var(--color-primary)" : "var(--text-muted)",
                cursor: sort.sortKey ? "pointer" : "not-allowed",
              }}
            >
              {sort.sortDir === "desc" ? (
                <ArrowDownAZ size={15} aria-hidden="true" />
              ) : (
                <ArrowUpAZ size={15} aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>
      )}

      {onClear && hasActiveFilters && (
        <Field width="auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            title="Clear all search and filter selections"
            aria-label="Clear all filters"
            className="whitespace-nowrap"
          >
            <span>Clear{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Field>
      )}

      {children && (
        <div
          style={{
            flex: "1 1 100%",
            minWidth: 0,
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}