export interface CsvColumn<T> {
  /** Property read from each row, or a literal header when `value` is given. */
  key: string;
  label: string;
  value?: (row: T) => string | number | null | undefined;
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cellText<T>(row: T, column: CsvColumn<T>): string {
  const raw = column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

/** Serialises rows to RFC 4180 CSV text. */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const header = columns.map((column) => escapeCell(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCell(cellText(row, column))).join(","));
  return [header, ...body].join("\r\n");
}

/** Triggers a browser download of the given rows as CSV. */
export function downloadCsv<T>(filename: string, columns: readonly CsvColumn<T>[], rows: readonly T[]): void {
  if (rows.length === 0) return;
  // The BOM keeps Excel from mangling non-ASCII names in the first column.
  const blob = new Blob(["\uFEFF", toCsv(columns, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}