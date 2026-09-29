import { formatDate, formatDateTime, parseToISO } from '@/lib/dateUtils';

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('returns fallback for null/undefined', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
      expect(formatDate('')).toBe('—');
    });

    it('formats ISO date string (YYYY-MM-DD) to DD-MM-YYYY', () => {
      expect(formatDate('2024-01-15')).toBe('15-01-2024');
      expect(formatDate('2024-12-31')).toBe('31-12-2024');
    });

    it('handles DD-MM-YYYY format', () => {
      expect(formatDate('15-01-2024')).toBe('15-01-2024');
    });

    it('converts MM/DD/YYYY to DD-MM-YYYY when month <= 12 and day > 12', () => {
      expect(formatDate('01/15/2024')).toBe('15-01-2024');
    });

    it('converts DD/MM/YYYY to DD-MM-YYYY when day > 12', () => {
      expect(formatDate('15/01/2024')).toBe('15-01-2024');
    });

    it('handles Date objects', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toBe('15-01-2024');
    });

    it('returns fallback for invalid date', () => {
      expect(formatDate('invalid')).toBe('invalid');
    });
  });

  describe('formatDateTime', () => {
    it('returns fallback for null/undefined', () => {
      expect(formatDateTime(null)).toBe('—');
    });

    it('formats ISO datetime string', () => {
      expect(formatDateTime('2024-01-15T14:30:00')).toBe('15-01-2024 14:30');
    });

    it('handles Date objects', () => {
      const date = new Date('2024-01-15T14:30:00');
      expect(formatDateTime(date)).toBe('15-01-2024 14:30');
    });
  });

  describe('parseToISO', () => {
    it('returns null for null/undefined', () => {
      expect(parseToISO(null)).toBeNull();
      expect(parseToISO(undefined)).toBeNull();
    });

    it('returns ISO string for already ISO format', () => {
      const result = parseToISO('2024-01-15T14:30:00');
      // Result will be in UTC, exact time depends on timezone
      expect(result).toMatch(/^2024-01-15T\d{2}:\d{2}:\d{2}\.000Z$/);
    });

    it('converts DD-MM-YYYY to ISO', () => {
      expect(parseToISO('15-01-2024')).toBe('2024-01-15T00:00:00.000Z');
    });

    it('converts MM/DD/YYYY to ISO', () => {
      expect(parseToISO('01/15/2024')).toBe('2024-01-15T00:00:00.000Z');
    });

    it('converts DD/MM/YYYY to ISO', () => {
      expect(parseToISO('15/01/2024')).toBe('2024-01-15T00:00:00.000Z');
    });

    it('returns null for invalid date', () => {
      expect(parseToISO('invalid')).toBeNull();
    });
  });
});