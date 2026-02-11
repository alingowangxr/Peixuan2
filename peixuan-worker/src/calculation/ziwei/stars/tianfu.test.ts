/**
 * TianFu Star Positioning Module Tests
 * Comprehensive test coverage for 寅-申 axis mirror symmetry
 *
 * TianFu mirrors ZiWei across the 寅(2)-申(8) axis.
 * Formula: P_tianfu = (4 - P_ziwei + 12) mod 12
 */

import { describe, it, expect } from 'vitest';
import {
  findTianFuPosition,
  calculateTianFuPosition,
  getEarthlyBranch
} from './tianfu';

describe('TianFu Star Positioning', () => {
  describe('findTianFuPosition', () => {
    it('should calculate TianFu position mirrored across 寅-申 axis', () => {
      // ZiWei at 寅 (2) -> TianFu at 寅 (2) — axis point, maps to itself
      expect(findTianFuPosition(2)).toBe(2);

      // ZiWei at 申 (8) -> TianFu at 申 (8) — axis point, maps to itself
      expect(findTianFuPosition(8)).toBe(8);

      // ZiWei at 子 (0) -> TianFu at 辰 (4)
      expect(findTianFuPosition(0)).toBe(4);

      // ZiWei at 午 (6) -> TianFu at 戌 (10)
      expect(findTianFuPosition(6)).toBe(10);
    });

    it('should handle all 12 palace positions correctly', () => {
      // Formula: (4 - ziwei + 12) % 12
      const expectedPositions = [
        { ziwei: 0, tianfu: 4 },   // 子 -> 辰
        { ziwei: 1, tianfu: 3 },   // 丑 -> 卯
        { ziwei: 2, tianfu: 2 },   // 寅 -> 寅 (axis)
        { ziwei: 3, tianfu: 1 },   // 卯 -> 丑
        { ziwei: 4, tianfu: 0 },   // 辰 -> 子
        { ziwei: 5, tianfu: 11 },  // 巳 -> 亥
        { ziwei: 6, tianfu: 10 },  // 午 -> 戌
        { ziwei: 7, tianfu: 9 },   // 未 -> 酉
        { ziwei: 8, tianfu: 8 },   // 申 -> 申 (axis)
        { ziwei: 9, tianfu: 7 },   // 酉 -> 未
        { ziwei: 10, tianfu: 6 },  // 戌 -> 午
        { ziwei: 11, tianfu: 5 }   // 亥 -> 巳
      ];

      expectedPositions.forEach(({ ziwei, tianfu }) => {
        expect(findTianFuPosition(ziwei)).toBe(tianfu);
      });
    });

    it('should maintain inverse property (double application returns original)', () => {
      // Mirror symmetry: applying the same mirror twice returns to original
      for (let i = 0; i < 12; i++) {
        const tianfu = findTianFuPosition(i);
        const backToOriginal = findTianFuPosition(tianfu);
        expect(backToOriginal).toBe(i);
      }
    });

    it('should throw error for invalid ZiWei position', () => {
      expect(() => findTianFuPosition(-1)).toThrow('Invalid ZiWei position');
      expect(() => findTianFuPosition(12)).toThrow('Invalid ZiWei position');
      expect(() => findTianFuPosition(100)).toThrow('Invalid ZiWei position');
    });
  });

  describe('getEarthlyBranch', () => {
    it('should return correct branch names for all positions', () => {
      const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

      branches.forEach((branch, index) => {
        expect(getEarthlyBranch(index)).toBe(branch);
      });
    });

    it('should throw error for invalid position', () => {
      expect(() => getEarthlyBranch(-1)).toThrow('Invalid position');
      expect(() => getEarthlyBranch(12)).toThrow('Invalid position');
    });
  });

  describe('calculateTianFuPosition', () => {
    it('should return position and branch for TianFu', () => {
      // ZiWei at 寅 (2) -> TianFu at 寅 (2) — axis point
      const result = calculateTianFuPosition(2);
      expect(result.position).toBe(2);
      expect(result.branch).toBe('寅');
    });

    it('should handle all 12 positions with correct branches', () => {
      const testCases = [
        { ziwei: 0, position: 4, branch: '辰' },
        { ziwei: 1, position: 3, branch: '卯' },
        { ziwei: 2, position: 2, branch: '寅' },
        { ziwei: 3, position: 1, branch: '丑' },
        { ziwei: 4, position: 0, branch: '子' },
        { ziwei: 5, position: 11, branch: '亥' },
        { ziwei: 6, position: 10, branch: '戌' },
        { ziwei: 7, position: 9, branch: '酉' },
        { ziwei: 8, position: 8, branch: '申' },
        { ziwei: 9, position: 7, branch: '未' },
        { ziwei: 10, position: 6, branch: '午' },
        { ziwei: 11, position: 5, branch: '巳' }
      ];

      testCases.forEach(({ ziwei, position, branch }) => {
        const result = calculateTianFuPosition(ziwei);
        expect(result.position).toBe(position);
        expect(result.branch).toBe(branch);
      });
    });
  });

  describe('Integration: TianFu-ZiWei mirror symmetry verification', () => {
    it('should verify mirror pairs across 寅-申 axis', () => {
      // Mirror pairs: positions equidistant from the 寅(2)-申(8) axis
      const mirrorPairs = [
        [0, 4],   // 子-辰 (each 2 away from axis point 寅)
        [1, 3],   // 丑-卯 (each 1 away from axis point 寅)
        [2, 2],   // 寅-寅 (axis point)
        [5, 11],  // 巳-亥 (each 3 away from axis points)
        [6, 10],  // 午-戌
        [7, 9],   // 未-酉
        [8, 8],   // 申-申 (axis point)
      ];

      mirrorPairs.forEach(([pos1, pos2]) => {
        expect(findTianFuPosition(pos1)).toBe(pos2);
        expect(findTianFuPosition(pos2)).toBe(pos1);
      });
    });

    it('should satisfy the mirror formula for all positions', () => {
      for (let i = 0; i < 12; i++) {
        const tianfu = findTianFuPosition(i);
        expect(tianfu).toBe(((4 - i) % 12 + 12) % 12);
      }
    });
  });
});
