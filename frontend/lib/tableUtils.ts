/**
 * Shared sorting / filtering primitives for the hand-rolled tables in this app.
 * Pure helpers only (no React), so both client components and tests can use them.
 */

export type SortDir = "asc" | "desc" | null;

export type SortValue = string | number | boolean | null | undefined;

/** Reads the raw value a column sorts/filters on. */
export type TableAccessor<T> = (row: T) => SortValue;

/** Map of stable column keys to the value they sort on. */
export type SortAccessors<T> = Record<string, TableAccessor<T>>;

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

export function isBlankTableValue(value: SortValue): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

/**
 * Locale-aware comparison that keeps numbers numeric, treats ISO dates
 * chronologically, and sinks blanks to the bottom in both directions.
 */
export function compareTableValues(a: SortValue, b: SortValue): number {
  const aBlank = isBlankTableValue(a);
  const bBlank = isBlankTableValue(b);
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1;
  if (bBlank) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);

  const as = String(a);
  const bs = String(b);

  if (ISO_DATE_PREFIX.test(as) && ISO_DATE_PREFIX.test(bs)) {
    return as === bs ? 0 : as < bs ? -1 : 1;
  }

  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Returns a sorted copy. Blanks always sink to the bottom, so they never flip
 * with the direction.
 */
export function sortRows<T>(
  rows: readonly T[],
  accessors: SortAccessors<T>,
  key: string | null,
  dir: SortDir
): T[] {
  if (!key || !dir) return rows as T[];
  const accessor = accessors[key];
  if (!accessor) return rows as T[];

  const descending = dir === "desc";

  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    const aBlank = isBlankTableValue(av);
    const bBlank = isBlankTableValue(bv);
    if (aBlank || bBlank) {
      if (aBlank && bBlank) return 0;
      return aBlank ? 1 : -1;
    }
    const result = compareTableValues(av, bv);
    return descending ? -result : result;
  });
}

/** Distinct, de-duplicated, human-readable values for a column filter dropdown. */
export function collectDistinctOptions<T>(rows: readonly T[], accessor: TableAccessor<T>): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = accessor(row);
    if (isBlankTableValue(value)) continue;
    seen.add(String(value).trim());
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

/** Lower-cased haystack used by the free-text search box. */
export function buildSearchHaystack<T>(row: T, accessors: readonly TableAccessor<T>[]): string {
  return accessors
    .map((accessor) => {
      const value = accessor(row);
      return isBlankTableValue(value) ? "" : String(value);
    })
    .join(" ")
    .toLowerCase();
}

/** Value written back into a controlled `<select>`; "" means "no filter". */
export const ALL_FILTER_VALUE = "";

export function normalizeFilterValue(value: string | undefined | null): string {
  if (value === undefined || value === null) return ALL_FILTER_VALUE;
  return value;
}