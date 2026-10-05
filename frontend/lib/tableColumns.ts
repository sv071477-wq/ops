"use client";

import type { TableFilterField } from "@/hooks/useTableFilters";
import type { SortAccessors, TableAccessor } from "@/lib/tableUtils";

/**
 * One column definition per table column, from which the sort accessors, the
 * "Sort by" options, the filter dropdowns, the free-text search haystack and
 * the CSV export are all derived. Declaring a column in five parallel lists is
 * how a table ends up sorting by a column that is not on screen.
 */
export interface TableColumnDef<T, K extends string = string> {
  key: K;
  /** Exact header text; also the CSV header and the sort-option label. */
  label: string;
  /** Value the column sorts and filters on. */
  accessor: TableAccessor<T>;
  /** Static columns render a `PlainHeaderCell` and are absent from the sort options. */
  sortable?: boolean;
  align?: "left" | "center" | "right";
  /** Extra values folded into the free-text search haystack. */
  search?: readonly TableAccessor<T>[];
  /** Surfaces the column as a dropdown filter. Off by default. */
  filterable?: boolean;
  /** Renders the column first in the CSV export. Off by default. */
  exportable?: boolean;
  /** CSV cell value; defaults to `accessor`. */
  csvValue?: (row: T) => string | number | boolean | null | undefined;
}

export const ALIGN_TO_TEXT_ALIGN: Record<NonNullable<TableColumnDef<unknown>["align"]>, "left" | "center" | "right"> = {
  left: "left",
  center: "center",
  right: "right",
};

export function isSortable<T, K extends string>(column: TableColumnDef<T, K>): boolean {
  return column.sortable !== false;
}

/** Sort/filter accessors for every column, keyed by column key. */
export function buildSortAccessors<T, K extends string>(
  columns: readonly TableColumnDef<T, K>[]
): SortAccessors<T> {
  const accessors: SortAccessors<T> = {};
  for (const column of columns) accessors[column.key] = column.accessor;
  return accessors;
}

/** "Sort by" options, in column order, skipping the static columns. */
export function buildSortOptions<T, K extends string>(
  columns: readonly TableColumnDef<T, K>[]
): { key: K; label: string }[] {
  return columns.filter(isSortable).map((column) => ({ key: column.key, label: column.label }));
}

/** Dropdown filters, in column order, for the columns flagged `filterable`. */
export function buildFilterFields<T, K extends string>(
  columns: readonly TableColumnDef<T, K>[]
): TableFilterField<T>[] {
  return columns
    .filter((column) => column.filterable)
    .map((column) => ({ key: column.key, accessor: column.accessor }));
}

/** Lower-cased haystack over every column accessor plus any `search` extras. */
export function buildSearchAccessor<T, K extends string>(
  columns: readonly TableColumnDef<T, K>[]
): TableAccessor<T> {
  const accessors: TableAccessor<T>[] = [];
  for (const column of columns) {
    accessors.push(column.accessor);
    if (column.search) accessors.push(...column.search);
  }
  return (row: T) =>
    accessors
      .map((accessor) => {
        const value = accessor(row);
        return value === null || value === undefined ? "" : String(value);
      })
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
}
