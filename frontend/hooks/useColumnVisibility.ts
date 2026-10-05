"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface ColumnVisibility<K extends string> {
  columns: readonly { key: K; label: string }[];
  /** Keys hidden on first render. */
  defaultHidden?: readonly K[];
  /**
   * Persists the choice under this key so a column layout survives a reload.
   * Omit it to keep the state local to the view.
   */
  storageKey?: string;
}

export interface UseColumnVisibilityResult<K extends string> {
  hidden: ReadonlySet<K>;
  /** Render guard for a cell or heading. */
  isVisible: (key: K) => boolean;
  toggle: (key: K) => void;
  showAll: () => void;
  hiddenCount: number;
  visibleColumns: readonly { key: K; label: string }[];
}

/** Reads a persisted layout, ignoring keys the current table no longer declares. */
function readStored<K extends string>(storageKey: string, known: ReadonlySet<K>): K[] | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((key): key is K => typeof key === "string" && known.has(key as K));
  } catch {
    return null;
  }
}

/**
 * Per-table column show/hide state. Kept local to the view so a column choice
 * never leaks between tables that happen to share a column key. Pass
 * `storageKey` to also remember the layout between visits.
 */
export function useColumnVisibility<K extends string>({
  columns,
  defaultHidden = [],
  storageKey,
}: ColumnVisibility<K>): UseColumnVisibilityResult<K> {
  const knownKeys = useMemo(() => new Set(columns.map((column) => column.key)), [columns]);

  // Two-phase init: the server and the first client render must agree, so the
  // stored layout is applied in an effect rather than in the `useState` initialiser.
  const [hiddenKeys, setHiddenKeys] = useState<Set<K>>(() => new Set(defaultHidden));
  const [isHydrated, setIsHydrated] = useState(!storageKey);

  useEffect(() => {
    if (!storageKey) return;
    const stored = readStored(storageKey, knownKeys);
    if (stored) setHiddenKeys(new Set(stored));
    setIsHydrated(true);
  }, [storageKey, knownKeys]);

  // A table whose column list changes must not keep hiding a key it dropped.
  useEffect(() => {
    setHiddenKeys((current) => {
      const next = new Set(Array.from(current).filter((key) => knownKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [knownKeys]);

  useEffect(() => {
    if (!storageKey || !isHydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(hiddenKeys)));
    } catch {
      // A full or blocked storage quota must never break the table.
    }
  }, [storageKey, isHydrated, hiddenKeys]);

  const toggle = useCallback((key: K) => {
    setHiddenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const showAll = useCallback(() => setHiddenKeys(new Set<K>()), []);

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenKeys.has(column.key)),
    [columns, hiddenKeys]
  );

  return {
    hidden: hiddenKeys,
    isVisible: useCallback((key: K) => !hiddenKeys.has(key), [hiddenKeys]),
    toggle,
    showAll,
    hiddenCount: hiddenKeys.size,
    visibleColumns,
  };
}
