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

    // Match DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // Match DD/MM/YYYY
    const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, dd, mm, yyyy] = slashMatch;
      return `${dd}-${mm}-${yyyy}`;
    }

    // Match MM/DD/YYYY (US format)
    const usMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (usMatch && parseInt(usMatch[1], 10) <= 12) {
      const [, mm, dd, yyyy] = usMatch;
      return `${dd}-${mm}-${yyyy}`;
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

export function parseToISO(dateValue?: string | Date | null): string | null {
  if (!dateValue) return null;
  if (typeof dateValue === "string") {
    const trimmed = dateValue.trim();
    if (!trimmed) return null;
    
    // Already ISO format
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      return trimmed;
    }
    
    // DD-MM-YYYY
    const dashMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dashMatch) {
      const [, dd, mm, yyyy] = dashMatch;
      return `${yyyy}-${mm}-${dd}T00:00:00`;
    }
  }
  
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
