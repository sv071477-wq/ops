"use client";

import { useState, useCallback, useMemo } from "react";

export interface FilterConfig<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  multiple?: boolean;
}

export function useFilters<T extends Record<string, any>>(
  items: T[],
  filters: FilterConfig<T>[]
) {
  const [activeFilters, setActiveFilters] = useState<Record<string, string | string[]>>({});

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      return Object.entries(activeFilters).every(([key, value]) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true;
        const itemValue = item[key];
        if (Array.isArray(value)) {
          return value.includes(itemValue);
        }
        return itemValue === value;
      });
    });
  }, [items, activeFilters]);

  const setFilter = useCallback((key: string, value: string | string[]) => {
    setActiveFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const clearFilter = useCallback((key: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
  }, []);

  const hasActiveFilters = Object.values(activeFilters).some(
    (v) => v && (Array.isArray(v) ? v.length > 0 : v !== "")
  );

  return {
    activeFilters,
    filteredItems,
    setFilter,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
  };
}