"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ALL_FILTER_VALUE,
  TableAccessor,
  buildSearchHaystack,
  collectDistinctOptions,
  isBlankTableValue,
  normalizeFilterValue,
} from "@/lib/tableUtils";

export interface TableFilterField<T> {
  key: string;
  accessor: TableAccessor<T>;
  /** Override the dropdown options derived from the current rows. */
  options?: readonly string[];
  /** Rows excluded from the option list (e.g. the synthetic "Active batches" bucket). */
  hideValues?: readonly string[];
}

export interface UseTableFiltersResult<T> {
  search: string;
  setSearch: (value: string) => void;
  /** fieldKey -> selected value. `ALL_FILTER_VALUE` ("") means inactive. */
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  getFilter: (key: string) => string;
  optionsFor: (key: string) => string[];
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  filteredRows: T[];
  /** Bumps on every search/filter change; use it to reset pagination. */
  filtersVersion: number;
}

export function useTableFilters<T>(
  rows: readonly T[],
  fields: readonly TableFilterField<T>[] = [],
  searchAccessor?: TableAccessor<T>
): UseTableFiltersResult<T> {
  const [search, setSearchState] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filtersVersion, setFiltersVersion] = useState(0);

  const fieldsByKey = useMemo(() => {
    const map = new Map<string, TableFilterField<T>>();
    fields.forEach((field) => map.set(field.key, field));
    return map;
  }, [fields]);

  const optionsByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    fields.forEach((field) => {
      const hidden = field.hideValues ?? [];
      const derived = field.options
        ? [...field.options]
        : collectDistinctOptions(rows, field.accessor).filter((value) => !hidden.includes(value));
      map.set(field.key, derived);
    });
    return map;
  }, [fields, rows]);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setFiltersVersion((version) => version + 1);
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((current) => {
      const next = normalizeFilterValue(value);
      if ((current[key] ?? ALL_FILTER_VALUE) === next) return current;
      return { ...current, [key]: next };
    });
    setFiltersVersion((version) => version + 1);
  }, []);

  const getFilter = useCallback((key: string) => filters[key] ?? ALL_FILTER_VALUE, [filters]);

  const clearFilters = useCallback(() => {
    setSearchState("");
    setFilters({});
    setFiltersVersion((version) => version + 1);
  }, []);

  const activeFilterCount = useMemo(() => {
    const selects = Object.values(filters).filter((value) => value !== ALL_FILTER_VALUE).length;
    return selects + (search.trim() ? 1 : 0);
  }, [filters, search]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const activeSelects = Object.entries(filters).filter(([, value]) => value !== ALL_FILTER_VALUE);

    if (!term && activeSelects.length === 0) return rows as T[];

    return rows.filter((row) => {
      if (term) {
        const haystack = searchAccessor
          ? buildSearchHaystack(row, [searchAccessor])
          : buildSearchHaystack(row, fields.map((field) => field.accessor));
        if (!haystack.includes(term)) return false;
      }

      for (const [key, value] of activeSelects) {
        const field = fieldsByKey.get(key);
        // A select whose key has no field still renders, and silently filtering
        // nothing is the worst possible failure mode for a table filter. Warn in
        // development so a `TableFilters` select is never wired to a missing key.
        if (!field) {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.warn(
              `[useTableFilters] ignoring filter "${key}": no field with that key was passed. ` +
                `Add it to the column defs with \`filterable: true\`, or to the extra filter fields.`
            );
          }
          continue;
        }
        const raw = field.accessor(row);
        if (isBlankTableValue(raw) || String(raw).trim() !== value) return false;
      }

      return true;
    });
  }, [rows, search, searchAccessor, filters, fields, fieldsByKey]);

  return {
    search,
    setSearch,
    filters,
    setFilter,
    getFilter,
    optionsFor: useCallback((key: string) => optionsByKey.get(key) ?? [], [optionsByKey]),
    clearFilters,
    hasActiveFilters: activeFilterCount > 0,
    activeFilterCount,
    filteredRows,
    filtersVersion,
  };
}