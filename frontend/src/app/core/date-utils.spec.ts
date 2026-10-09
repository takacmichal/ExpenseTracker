import {
  addMonths,
  isSameMonth,
  monthRange,
  parseIsoDate,
  toIsoDate,
  toMonthKey,
} from './date-utils';

describe('date-utils', () => {
  describe('toIsoDate', () => {
    it('formats in local time with zero-padded month and day', () => {
      expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('does not shift the day near local midnight (unlike toISOString)', () => {
      expect(toIsoDate(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
      expect(toIsoDate(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01');
    });
  });

  describe('parseIsoDate', () => {
    it('parses YYYY-MM-DD as a local date', () => {
      const date = parseIsoDate('2026-03-09');
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2026);
      expect(date!.getMonth()).toBe(2);
      expect(date!.getDate()).toBe(9);
      expect(date!.getHours()).toBe(0);
    });

    it('round-trips with toIsoDate', () => {
      expect(toIsoDate(parseIsoDate('2024-02-29')!)).toBe('2024-02-29');
    });

    it.each([
      null,
      undefined,
      '',
      '2026-3-9',
      '09.03.2026',
      '2026-03-09T00:00',
      'abc',
      ' 2026-03-09',
    ])('returns null for %j', (value) => {
      expect(parseIsoDate(value as string | null | undefined)).toBeNull();
    });
  });

  describe('toMonthKey', () => {
    it('returns YYYY-MM', () => {
      expect(toMonthKey(new Date(2026, 8, 30))).toBe('2026-09');
      expect(toMonthKey(new Date(2026, 11, 1))).toBe('2026-12');
    });
  });

  describe('monthRange', () => {
    it('covers the first to last day of a 31-day month', () => {
      expect(monthRange(new Date(2026, 0, 15))).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    });

    it('handles February in leap and non-leap years', () => {
      expect(monthRange(new Date(2024, 1, 10))).toEqual({ from: '2024-02-01', to: '2024-02-29' });
      expect(monthRange(new Date(2026, 1, 10))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    });

    it('handles December without spilling into the next year', () => {
      expect(monthRange(new Date(2026, 11, 31))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    });
  });

  describe('addMonths', () => {
    it('returns the first day of the target month', () => {
      expect(toIsoDate(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    });

    it('crosses year boundaries in both directions', () => {
      expect(toIsoDate(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01-01');
      expect(toIsoDate(addMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-01');
      expect(toIsoDate(addMonths(new Date(2026, 5, 15), -18))).toBe('2024-12-01');
    });

    it('with zero months returns the start of the same month', () => {
      expect(toIsoDate(addMonths(new Date(2026, 4, 20), 0))).toBe('2026-05-01');
    });
  });

  describe('isSameMonth', () => {
    it('is true for different days of the same month', () => {
      expect(isSameMonth(new Date(2026, 4, 1), new Date(2026, 4, 31, 23))).toBe(true);
    });

    it('is false for the same month in a different year', () => {
      expect(isSameMonth(new Date(2026, 4, 1), new Date(2025, 4, 1))).toBe(false);
    });

    it('is false for adjacent months', () => {
      expect(isSameMonth(new Date(2026, 4, 31), new Date(2026, 5, 1))).toBe(false);
    });
  });
});
