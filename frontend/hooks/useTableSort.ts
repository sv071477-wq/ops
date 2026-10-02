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

  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>(() => ({
    key: initialKey,
    dir: initialKey ? initialDir ?? initialDirection(initialKey) : null,
  }));

  const toggleSort = useCallback(
    (key: string) => {
      setSort((current) => {
        if (current.key !== key) return { key, dir: initialDirection(key) };
        if (current.dir === "asc") return { key, dir: "desc" };
        if (current.dir === "desc") return { key: null, dir: null };
        return { key, dir: initialDirection(key) };
      });
    },
    [initialDirection]
  );

  const applySort = useCallback(
    (key: string | null, dir?: SortDir) => {
      setSort({ key, dir: key ? dir ?? initialDirection(key) : null });
    },
    [initialDirection]
  );

  const clearSort = useCallback(() => setSort({ key: null, dir: null }), []);

  const isSorted = useCallback(
    (key: string) => sort.key === key && sort.dir !== null,
    [sort.key, sort.dir]
  );

  const sortedRows = useMemo(
    () => sortRows(rows, accessors, sort.key, sort.dir),
    [rows, accessors, sort.key, sort.dir]
  );

  return { sortKey: sort.key, sortDir: sort.dir, sortedRows, toggleSort, applySort, clearSort, isSorted };
}