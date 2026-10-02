"use client";

import React from "react";
import { ArrowDownAZ, ArrowUpAZ, Filter, Search, X } from "lucide-react";
import { ALL_FILTER_VALUE, type SortDir } from "@/lib/tableUtils";
import { cn } from "@/lib/utils";

// Every toolbar control shares these metrics so a row of filters reads as one
// grid: labels on a common line, controls on a common line, uniform heights.
const CONTROL_HEIGHT = 34;
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
  fontSize: "0.62rem",
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
  border: "1px solid var(--border-subtle)",
  background: "#fff",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-main)",
};

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
        <label htmlFor={htmlFor} style={LABEL_SLOT_STYLE}>
          {label}
        </label>
      ) : (
        <span style={LABEL_SLOT_STYLE} aria-hidden="true" />
      )}
      <div style={CONTROL_SLOT_STYLE}>{children}</div>
    </div>
  );
}

/**
 * Toolbar row shared by every table: free-text search, per-column filter
 * dropdowns and an explicit "Sort by" control that mirrors the click-to-sort
 * column headers. Controls passed as `children` are slotted onto the same grid.
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

  return (
    <div
      className={cn("flex flex-wrap items-end", className)}
      style={{ flex: "1 1 360px", minWidth: 0, gap: "10px 10px", ...style }}
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
              style={{ ...CONTROL_STYLE, paddingLeft: 28 }}
            />
          </div>
        </Field>
      )}

      {selects?.map((select) => {
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
                width: 36,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: sort.sortKey ? "#fff" : "#f1f5f9",
                color: sort.sortKey ? (sort.sortDir === "desc" ? "#0b5cab" : "#d97706") : "#94a3b8",
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

      {bespoke?.map((entry) => (
        <Field key={entry.key} label={entry.label} width={entry.width}>
          {entry.content}
        </Field>
      ))}

      {children}

      {onClear && hasActiveFilters && (
        <Field>
          <button
            type="button"
            onClick={onClear}
            title="Clear all search and filter selections"
            className="btn btn-secondary"
            style={{
              ...CONTROL_STYLE,
              width: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "0 12px",
              whiteSpace: "nowrap",
            }}
          >
            <Filter size={13} aria-hidden="true" />
            <span>Clear{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
            <X size={13} aria-hidden="true" />
          </button>
        </Field>
      )}
    </div>
  );
}