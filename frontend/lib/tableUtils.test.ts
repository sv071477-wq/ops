import {
  buildSearchHaystack,
  collectDistinctOptions,
  compareTableValues,
  isBlankTableValue,
  sortRows,
  type SortAccessors,
} from './tableUtils';

interface Row {
  name: string;
  count: number | null;
  date: string;
}

const ROWS: Row[] = [
  { name: "Beta", count: 10, date: "2026-01-05" },
  { name: "alpha", count: 2, date: "2026-03-11" },
  { name: "Gamma 10", count: null, date: "" },
];

const ACCESSORS: SortAccessors<Row> = {
  name: (row) => row.name,
  count: (row) => row.count,
  date: (row) => row.date,
};

describe('isBlankTableValue', () => {
  it('treats null, undefined and empty/blank strings as blank', () => {
    expect(isBlankTableValue(null)).toBe(true);
    expect(isBlankTableValue(undefined)).toBe(true);
    expect(isBlankTableValue("")).toBe(true);
    expect(isBlankTableValue("   ")).toBe(true);
    expect(isBlankTableValue(0)).toBe(false);
    expect(isBlankTableValue(false)).toBe(false);
  });
});

describe('compareTableValues', () => {
  it('compares numbers numerically rather than lexicographically', () => {
    expect(compareTableValues(9, 10)).toBeLessThan(0);
    expect(compareTableValues(10, 9)).toBeGreaterThan(0);
  });

  it('compares strings case-insensitively and digit-numerically', () => {
    expect(compareTableValues("alpha", "Beta")).toBeLessThan(0);
    expect(compareTableValues("Gamma 10", "Gamma 9")).toBeGreaterThan(0);
  });

  it('orders ISO dates chronologically instead of as plain strings', () => {
    expect(compareTableValues("2026-01-05", "2026-03-11")).toBeLessThan(0);
  });

  it('sinks blanks below values', () => {
    expect(compareTableValues(null, "a")).toBeGreaterThan(0);
    expect(compareTableValues("a", "")).toBeLessThan(0);
    expect(compareTableValues(null, undefined)).toBe(0);
  });
});

describe('sortRows', () => {
  it('returns the rows untouched when no key or direction is set', () => {
    expect(sortRows(ROWS, ACCESSORS, null, null)).toBe(ROWS);
    expect(sortRows(ROWS, ACCESSORS, "name", null)).toBe(ROWS);
  });

  it('returns the rows untouched for an unknown column key', () => {
    expect(sortRows(ROWS, ACCESSORS, "missing", "asc")).toBe(ROWS);
  });

  it('sorts ascending without mutating the input array', () => {
    const sorted = sortRows(ROWS, ACCESSORS, "name", "asc");
    expect(sorted.map((row) => row.name)).toEqual(["alpha", "Beta", "Gamma 10"]);
    expect(ROWS.map((row) => row.name)).toEqual(["Beta", "alpha", "Gamma 10"]);
  });

  it('sorts descending so blanks stay at the bottom', () => {
    const sorted = sortRows(ROWS, ACCESSORS, "count", "desc");
    expect(sorted.map((row) => row.name)).toEqual(["Beta", "alpha", "Gamma 10"]);
  });

  it('keeps numeric columns in numeric order in both directions', () => {
    expect(sortRows(ROWS, ACCESSORS, "count", "asc").map((row) => row.count)).toEqual([2, 10, null]);
    expect(sortRows(ROWS, ACCESSORS, "count", "desc").map((row) => row.count)).toEqual([10, 2, null]);
  });
});

describe('collectDistinctOptions', () => {
  it('returns sorted, de-duplicated, non-blank values', () => {
    expect(collectDistinctOptions(ROWS, ACCESSORS.name)).toEqual(["alpha", "Beta", "Gamma 10"]);
  });

  it('drops rows whose value is blank', () => {
    expect(collectDistinctOptions(ROWS, ACCESSORS.date)).toEqual(["2026-01-05", "2026-03-11"]);
  });
});

describe('buildSearchHaystack', () => {
  it('joins every accessor into one lower-cased haystack', () => {
    const haystack = buildSearchHaystack(ROWS[0], [ACCESSORS.name, ACCESSORS.count, ACCESSORS.date]);
    expect(haystack).toBe("beta 10 2026-01-05");
  });
});