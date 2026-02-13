/**
 * Tests for BaZi Ten Gods Module (lunar-typescript based)
 *
 * Validates that getTenGodsFromLunar returns correct traditional Chinese ten gods.
 */

import { describe, it, expect } from 'vitest';
import { getTenGodsFromLunar } from '../lunarAdapter';
import type { TenGod } from '../tenGods';

const VALID_TEN_GODS: TenGod[] = [
  '比肩', '劫財', '食神', '傷官', '偏財',
  '正財', '七殺', '正官', '偏印', '正印',
];

describe('BaZi Ten Gods (lunar-typescript)', () => {
  describe('getTenGodsFromLunar', () => {
    it('should return valid ten god values for 2024-06-15 14:30', () => {
      const date = new Date(2024, 5, 15, 14, 30);
      const result = getTenGodsFromLunar(date);

      expect(VALID_TEN_GODS).toContain(result.year);
      expect(VALID_TEN_GODS).toContain(result.month);
      expect(VALID_TEN_GODS).toContain(result.hour);
    });

    it('should return valid ten god values for 2000-01-01 12:00', () => {
      const date = new Date(2000, 0, 1, 12, 0);
      const result = getTenGodsFromLunar(date);

      expect(VALID_TEN_GODS).toContain(result.year);
      expect(VALID_TEN_GODS).toContain(result.month);
      expect(VALID_TEN_GODS).toContain(result.hour);
    });

    it('should return valid ten god values for 1984-02-05 00:00', () => {
      const date = new Date(1984, 1, 5, 0, 0);
      const result = getTenGodsFromLunar(date);

      expect(VALID_TEN_GODS).toContain(result.year);
      expect(VALID_TEN_GODS).toContain(result.month);
      expect(VALID_TEN_GODS).toContain(result.hour);
    });

    it('should return traditional Chinese characters (not simplified)', () => {
      const date = new Date(2024, 5, 15, 14, 30);
      const result = getTenGodsFromLunar(date);

      // Ensure no simplified Chinese characters
      const simplified = ['劫财', '伤官', '偏财', '正财', '七杀'];
      expect(simplified).not.toContain(result.year);
      expect(simplified).not.toContain(result.month);
      expect(simplified).not.toContain(result.hour);
    });

    it('should return consistent results for the same date', () => {
      const date = new Date(2024, 5, 15, 14, 30);
      const result1 = getTenGodsFromLunar(date);
      const result2 = getTenGodsFromLunar(date);

      expect(result1).toEqual(result2);
    });

    it('should have year, month, and hour properties', () => {
      const date = new Date(2024, 5, 15, 14, 30);
      const result = getTenGodsFromLunar(date);

      expect(result).toHaveProperty('year');
      expect(result).toHaveProperty('month');
      expect(result).toHaveProperty('hour');
    });
  });
});
