import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDuration, getDateRange } from '../src/utils/time';

describe('Time Utils', () => {
  describe('formatDuration', () => {
    it('should format seconds only', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2m 5s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3665)).toBe('1h 1m');
    });

    it('should format multiple hours', () => {
      expect(formatDuration(7200)).toBe('2h 0m');
    });

    it('should handle zero seconds', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should format large durations', () => {
      expect(formatDuration(86400)).toBe('24h 0m');
    });
  });

  describe('getDateRange', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Set to Jan 15, 2024 at noon local time
      vi.setSystemTime(new Date(2024, 0, 15, 12, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should get today range', () => {
      const result = getDateRange('today');
      expect(result.label).toBe('Today');
      expect(result.startDate).toBe('2024-01-15');
      expect(result.endDate).toBe('2024-01-15');
    });

    it('should get yesterday range', () => {
      const result = getDateRange('yesterday');
      expect(result.label).toBe('Yesterday');
      expect(result.startDate).toBe('2024-01-14');
      expect(result.endDate).toBe('2024-01-14');
    });

    it('should get week range (Monday to Sunday)', () => {
      const result = getDateRange('week');
      expect(result.label).toBe('This Week');
      expect(result.startDate).toBe('2024-01-15'); // Monday
      expect(result.endDate).toBe('2024-01-21'); // Sunday
    });

    it('should get month range', () => {
      const result = getDateRange('month');
      expect(result.label).toBe('January 2024');
      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-01-31');
    });

    it('should handle specific date format', () => {
      const result = getDateRange('2024-01-10');
      expect(result.startDate).toBe('2024-01-10');
      expect(result.endDate).toBe('2024-01-10');
      expect(result.label).toContain('Wednesday');
      expect(result.label).toContain('January');
    });

    it('should default to today for invalid input', () => {
      const result = getDateRange('invalid');
      expect(result.label).toBe('Today');
      expect(result.startDate).toBe('2024-01-15');
    });

    it('should handle week range when starting on Sunday', () => {
      vi.setSystemTime(new Date(2024, 0, 14, 12, 0, 0)); // Sunday
      const result = getDateRange('week');
      expect(result.startDate).toBe('2024-01-08'); // Previous Monday
      expect(result.endDate).toBe('2024-01-14'); // Current Sunday
    });
  });
});