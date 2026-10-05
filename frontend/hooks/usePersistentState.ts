"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * `useState` that remembers its value in `localStorage`. Used for page sizes
 * and column layouts so a user's table setup survives a reload.
 *
 * The stored value is applied in an effect, never in the `useState` initialiser,
 * so the server render and the first client render agree.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
  revive?: (raw: unknown) => T | null
): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        const revived = revive ? revive(parsed) : (parsed as T);
        if (revived !== null && revived !== undefined) setValue(revived);
      }
    } catch {
      // Corrupt or blocked storage falls back to the caller's default.
    }
    setIsHydrated(true);
  }, [key, revive]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // A full or blocked quota must never break the control.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}

/** Reviver for numeric settings such as a page size. */
export function reviveNumber(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}
