"use client";

import { useCallback, useMemo, useState } from "react";
import { SortAccessors, SortDir, sortRows } from "@/lib/tableUtils";

export interface UseTableSortOptions {
  initialKey?: string | null;
  initialDir?: SortDir;
  /**
   * Columns whose natural order is newest/biggest first (dates, counts): the
   * first click on one of these sorts descending instead of ascending.
   */
  descFirstKeys?: readonly string[];
}

export interface UseTableSortResult<T> {
  sortKey: string | null;
  sortDir: SortDir;
  sortedRows: T[];
  /** Click-to-sort on a header: unsorted -> asc -> desc -> unsorted. */
  toggleSort: (key: string) => void;
  /** Explicit control, used by the "Sort by" dropdown. Pass dir = null to clear. */
  applySort: (key: string | null, dir?: SortDir) => void;
  clearSort: () => void;
  isSorted: (key: string) => boolean;
  /**
   * Bumps on every sort change. Reordering the rows changes which slice a
   * paginated table is showing, so this belongs in the same "reset to page 1"
   * effect as `useTableFilters`' `filtersVersion`.
   */
  sortVersion: number;
}

export function useTableSort<T>(
  rows: readonly T[],
  accessors: SortAccessors<T>,
  { initialKey = null, initialDir, descFirstKeys }: UseTableSortOptions = {}
): UseTableSortResult<T> {
  const descFirstSet = useMemo(() => new Set(descFirstKeys ?? []), [descFirstKeys]);

  const initialDirection = useCallback(
    (key: string): SortDir => (descFirstSet.has(key) ? "desc" : "asc"),
    [descFirstSet]
  );

  // `version` rides along in the sort state rather than being derived from it, so
  // a single `setSort` both reorders the rows and publishes the change. Deriving
  // it (e.g. `key === null ? 0 : dir === "asc" ? 1 : 2`) collapses every ascending
  // sort onto the same number, so moving from "Program ascending" to "Client
  // ascending" looks like no change at all even though the row order is entirely
  // different, and a paginated table stays stranded on a page that now holds
  // unrelated rows.
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir; version: number }>(() => ({
    key: initialKey,
    dir: initialKey ? initialDir ?? initialDirection(initialKey) : null,
    version: 0,
  }));

  const commit = useCallback((next: { key: string | null; dir: SortDir }) => {
    setSort((current) =>
      current.key === next.key && current.dir === next.dir ? current : { ...next, version: current.version + 1 }
    );
  }, []);

  const toggleSort = useCallback(
    (key: string) => {
      commit(
        sort.key !== key
          ? { key, dir: initialDirection(key) }
          : sort.dir === "asc"
            ? { key, dir: "desc" }
            : sort.dir === "desc"
              ? { key: null, dir: null }
              : { key, dir: initialDirection(key) }
      );
    },
    [commit, initialDirection, sort.key, sort.dir]
  );

  const applySort = useCallback(
    (key: string | null, dir?: SortDir) => {
      commit({ key, dir: key ? dir ?? initialDirection(key) : null });
    },
    [commit, initialDirection]
  );

  const clearSort = useCallback(() => commit({ key: null, dir: null }), [commit]);

  const isSorted = useCallback(
    (key: string) => sort.key === key && sort.dir !== null,
    [sort.key, sort.dir]
  );

  const sortedRows = useMemo(
    () => sortRows(rows, accessors, sort.key, sort.dir),
    [rows, accessors, sort.key, sort.dir]
  );

  const sortVersion = sort.version;

  return {
    sortKey: sort.key,
    sortDir: sort.dir,
    sortedRows,
    toggleSort,
    applySort,
    clearSort,
    isSorted,
    sortVersion,
  };
}
