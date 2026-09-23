/**
 * Global Date Formatting Utility for Enterprise Operations Platform.
 * Enforces strict DD-MM-YYYY format across all views, tables, modals, and drawers.
 */

export function formatDate(
  dateValue?: string | Date | null,
  fallback: string = "—"
): string {
  if (!dateValue) return fallback;

  if (typeof dateValue === "string") {
    const trimmed = dateValue.trim();
    if (!trimmed) return fallback;

    // Match YYYY-MM-DD (ISO dates, SQL date strings)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      return `${dd}-${mm}-${yyyy}`;
    }

    // Already formatted as DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      return trimmed;
    }
  }

  const d = new Date(dateValue);
  if (isNaN(d.getTime())) {
    return typeof dateValue === "string" ? dateValue : fallback;
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

export function formatDateTime(
  dateValue?: string | Date | null,
  fallback: string = "—"
): string {
  if (!dateValue) return fallback;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return formatDate(dateValue, fallback);

  const datePart = formatDate(d, fallback);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${datePart} ${hours}:${minutes}`;
}
