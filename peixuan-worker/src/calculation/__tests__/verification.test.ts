/**
 * 開源專案驗算測試套件
 *
 * 使用 lunar-typescript 作為計算引擎，驗證各模組輸出的準確性。
 */

import { describe, it, expect } from 'vitest';
import { Solar } from 'lunar-typescript';
import { getFourPillarsFromLunar, getTenGodsFromLunar } from '../bazi/lunarAdapter';
import { getHiddenStems } from '../bazi/hiddenStems';

describe('開源專案驗算', () => {
  describe('四柱驗算 - lunar-typescript', () => {
    const testCases = [
      { date: new Date(2024, 5, 15, 14, 30), desc: '2024-06-15 14:30' },
      { date: new Date(2000, 0, 1, 12, 0), desc: '2000-01-01 12:00' },
      { date: new Date(1984, 1, 5, 0, 0), desc: '1984-02-05 00:00' },
    ];

    testCases.forEach(({ date, desc }) => {
      it(`四柱驗算: ${desc}`, () => {
        const fourPillars = getFourPillarsFromLunar({ solarDate: date });

        // Verify against lunar-typescript directly
        const solar = Solar.fromDate(date);
        const bazi = solar.getLunar().getEightChar();

        expect(fourPillars.year.stem + fourPillars.year.branch).toBe(bazi.getYearGan() + bazi.getYearZhi());
        expect(fourPillars.month.stem + fourPillars.month.branch).toBe(bazi.getMonthGan() + bazi.getMonthZhi());
        expect(fourPillars.day.stem + fourPillars.day.branch).toBe(bazi.getDayGan() + bazi.getDayZhi());
        expect(fourPillars.hour.stem + fourPillars.hour.branch).toBe(bazi.getTimeGan() + bazi.getTimeZhi());
      });
    });
  });

  describe('藏干驗算 - lunar-typescript', () => {
    const testCases = [
      { date: new Date(2024, 5, 15), pillar: 'year' as const, desc: '2024-06-15 年柱' },
      { date: new Date(2024, 5, 15), pillar: 'month' as const, desc: '2024-06-15 月柱' },
      { date: new Date(2024, 5, 15), pillar: 'day' as const, desc: '2024-06-15 日柱' },
    ];

    testCases.forEach(({ date, pillar, desc }) => {
      it(`藏干驗算: ${desc}`, () => {
        const solar = Solar.fromDate(date);
        const bazi = solar.getLunar().getEightChar();

        let branch: string;
        let refHidden: string[];

        switch(pillar) {
          case 'year':
            branch = bazi.getYearZhi();
            refHidden = bazi.getYearHideGan();
            break;
          case 'month':
            branch = bazi.getMonthZhi();
            refHidden = bazi.getMonthHideGan();
            break;
          case 'day':
            branch = bazi.getDayZhi();
            refHidden = bazi.getDayHideGan();
            break;
        }

        const ourHidden = getHiddenStems(branch);

        // 驗證（藏干順序可能不同，只驗證內容）
        expect(ourHidden.map(h => h.stem).sort()).toEqual(refHidden.sort());
      });
    });
  });

  describe('十神驗算 - lunar-typescript', () => {
    it('十神計算驗算（繁體中文）', () => {
      const date = new Date(2024, 5, 15);
      const tenGods = getTenGodsFromLunar(date);

      // Verify against lunar-typescript directly
      const solar = Solar.fromDate(date);
      const bazi = solar.getLunar().getEightChar();
      const refYear = bazi.getYearShiShenGan();

      // 簡繁體轉換映射
      const toTraditional: Record<string, string> = {
        '偏财': '偏財', '正财': '正財', '劫财': '劫財', '伤官': '傷官',
        '七杀': '七殺',
        '偏印': '偏印', '正印': '正印', '比肩': '比肩', '食神': '食神',
        '正官': '正官',
      };

      const refYearTraditional = toTraditional[refYear] || refYear;
      expect(tenGods.year).toBe(refYearTraditional);
    });
  });

  describe('驗算報告', () => {
    it('產出驗算摘要', () => {
      console.log('\n=== 開源專案驗算摘要 ===');
      console.log('四柱計算: 使用 lunar-typescript');
      console.log('藏干計算: 與 lunar-typescript 一致');
      console.log('十神計算: 使用 lunar-typescript（繁體中文）');
    });
  });
});
