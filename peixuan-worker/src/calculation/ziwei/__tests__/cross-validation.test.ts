/**
 * Cross-Validation Test: Existing ZiWei Engine vs iztro
 *
 * Compares our custom ZiWei DouShu calculation engine against the iztro library
 * to verify correctness. This is a read-only validation — no production code is modified.
 */

import { describe, it, expect } from 'vitest';
import { astro } from 'iztro';
import { UnifiedCalculator } from '../../integration/calculator';
import type { CalculationResult } from '../../types';
import type { IFunctionalPalace } from 'iztro/lib/astro/FunctionalPalace';
import { getPalaceStem } from '../sihua/edgeGenerator';

// ─── Helpers ────────────────────────────────────────────────────────────────

const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** Convert clock hour (0-23) to iztro time index (0-12). 0=早子, 12=晚子 */
function hourToTimeIndex(hour: number): number {
  if (hour === 23) return 12; // 晚子時
  return Math.floor((hour + 1) / 2) % 12;
}

/** Parse iztro fiveElementsClass string like "水二局" to bureau number */
function parseBureau(fiveElementsClass: string): number {
  const map: Record<string, number> = {
    '水二局': 2, '木三局': 3, '金四局': 4, '土五局': 5, '火六局': 6,
  };
  return map[fiveElementsClass] ?? -1;
}

/** The 14 major stars in our system (traditional Chinese) */
const MAJOR_STARS_14 = [
  '紫微', '天機', '太陽', '武曲', '天同', '廉貞',
  '天府', '太陰', '貪狼', '巨門', '天相', '天梁', '七殺', '破軍',
];

/** Key auxiliary stars to compare */
const AUX_STARS_TO_COMPARE = ['文昌', '文曲', '左輔', '右弼'];

/**
 * Find which earthly branch (palace) a star sits in from iztro palaces.
 * Returns the earthly branch string, or null if not found.
 */
function findStarBranchInIztro(
  palaces: IFunctionalPalace[],
  starName: string,
): string | null {
  for (const palace of palaces) {
    const allStars = [
      ...palace.majorStars,
      ...palace.minorStars,
      ...(palace.adjectiveStars ?? []),
    ];
    if (allStars.some((s) => s.name === starName)) {
      return palace.earthlyBranch as string;
    }
  }
  return null;
}

/**
 * Find which earthly branch (palace) a star sits in from our system's palaces.
 * Returns the earthly branch string, or null if not found.
 */
function findStarBranchInOurs(
  result: CalculationResult,
  starName: string,
): string | null {
  for (const palace of result.ziwei.palaces) {
    if (palace.stars?.some((s) => s.name === starName)) {
      return palace.branch;
    }
  }
  return null;
}

// ─── Test Cases ─────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  solar: string;   // YYYY-MM-DD
  hour: number;    // 0-23
  gender: 'male' | 'female';
  lng: number;
}

const TEST_CASES: TestCase[] = [
  { name: '案例1-男-子時', solar: '2000-01-15', hour: 0, gender: 'male', lng: 121.5 },
  { name: '案例2-女-辰時', solar: '1990-06-20', hour: 8, gender: 'female', lng: 121.5 },
  { name: '案例3-男-未時', solar: '1985-03-10', hour: 14, gender: 'male', lng: 116.4 },
  { name: '案例4-女-亥時', solar: '1995-11-08', hour: 22, gender: 'female', lng: 121.5 },
  { name: '案例5-男-卯時', solar: '1988-09-25', hour: 6, gender: 'male', lng: 121.5 },
  { name: '子時邊界', solar: '2024-01-01', hour: 0, gender: 'male', lng: 121.5 },
  { name: '立春邊界', solar: '2024-02-04', hour: 12, gender: 'male', lng: 121.5 },
];

// ─── Run both calculators for all test cases ────────────────────────────────

const calculator = new UnifiedCalculator();

interface Computed {
  ours: CalculationResult;
  iztroResult: ReturnType<typeof astro.bySolar>;
}

const computed: Record<string, Computed> = {};

for (const tc of TEST_CASES) {
  const [y, m, d] = tc.solar.split('-').map(Number);
  const solarDate = new Date(y, m - 1, d, tc.hour, 0, 0);

  const ours = calculator.calculate({
    solarDate,
    longitude: tc.lng,
    gender: tc.gender,
  });

  const iztroGender = tc.gender === 'male' ? '男' : '女';
  const timeIndex = hourToTimeIndex(tc.hour);

  const iztroResult = astro.bySolar(tc.solar, timeIndex, iztroGender, true, 'zh-TW');

  computed[tc.name] = { ours, iztroResult };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ZiWei Cross-Validation with iztro', () => {

  // ── 基本資訊一致性 ──────────────────────────────────────────────────────

  describe('基本資訊一致性', () => {
    it.each(TEST_CASES)('$name: 命宮地支一致', (tc) => {
      const { ours, iztroResult } = computed[tc.name];
      const ourBranch = ours.ziwei.lifePalace.branch;
      const iztroBranch = iztroResult.earthlyBranchOfSoulPalace;

      expect(ourBranch).toBe(iztroBranch);
    });

    it.each(TEST_CASES)('$name: 身宮地支一致', (tc) => {
      const { ours, iztroResult } = computed[tc.name];
      const ourBranch = ours.ziwei.bodyPalace.branch;
      const iztroBranch = iztroResult.earthlyBranchOfBodyPalace;

      expect(ourBranch).toBe(iztroBranch);
    });

    it.each(TEST_CASES)('$name: 五行局一致', (tc) => {
      const { ours, iztroResult } = computed[tc.name];
      const ourBureau = ours.ziwei.bureau;
      const iztroBureau = parseBureau(iztroResult.fiveElementsClass as string);

      expect(ourBureau).toBe(iztroBureau);
    });
  });

  // ── 主星分布一致性 ──────────────────────────────────────────────────────

  describe('主星分布一致性', () => {
    it.each(TEST_CASES)('$name: 14主星各自所在宮位一致', (tc) => {
      const { ours, iztroResult } = computed[tc.name];
      const mismatches: string[] = [];

      for (const starName of MAJOR_STARS_14) {
        const ourBranch = findStarBranchInOurs(ours, starName);
        const iztroBranch = findStarBranchInIztro(iztroResult.palaces, starName);

        if (ourBranch !== iztroBranch) {
          mismatches.push(
            `${starName}: ours=${ourBranch}, iztro=${iztroBranch}`,
          );
        }
      }

      expect(mismatches, `主星位置差異:\n${mismatches.join('\n')}`).toHaveLength(0);
    });
  });

  // ── 輔星位置一致性 ──────────────────────────────────────────────────────

  describe('輔星位置一致性', () => {
    it.each(TEST_CASES)('$name: 文昌/文曲/左輔/右弼位置一致', (tc) => {
      const { ours, iztroResult } = computed[tc.name];
      const mismatches: string[] = [];

      for (const starName of AUX_STARS_TO_COMPARE) {
        const ourBranch = findStarBranchInOurs(ours, starName);
        const iztroBranch = findStarBranchInIztro(iztroResult.palaces, starName);

        if (ourBranch !== iztroBranch) {
          mismatches.push(
            `${starName}: ours=${ourBranch}, iztro=${iztroBranch}`,
          );
        }
      }

      expect(mismatches, `輔星位置差異:\n${mismatches.join('\n')}`).toHaveLength(0);
    });
  });

  // ── 宮位天干一致性 ──────────────────────────────────────────────────────

  describe('宮位天干一致性', () => {
    it.each(TEST_CASES)('$name: 12宮天干一致', (tc) => {
      const { ours, iztroResult } = computed[tc.name];
      const mismatches: string[] = [];

      // Build a branch→heavenlyStem map from iztro palaces
      const iztroStemByBranch = new Map<string, string>();
      for (const p of iztroResult.palaces) {
        iztroStemByBranch.set(p.earthlyBranch as string, p.heavenlyStem as string);
      }

      // Use the year stem from our system with getPalaceStem (五虎遁)
      const yearStem = ours.bazi.fourPillars.year.stem;

      for (const ourPalace of ours.ziwei.palaces) {
        const iztroStem = iztroStemByBranch.get(ourPalace.branch);
        if (!iztroStem) continue;

        const palaceBranchIndex = EARTHLY_BRANCHES.indexOf(ourPalace.branch);
        const ourStem = getPalaceStem(yearStem, palaceBranchIndex);

        if (ourStem !== iztroStem) {
          mismatches.push(
            `${ourPalace.branch}宮: ours=${ourStem}(yearStem=${yearStem}), iztro=${iztroStem}`,
          );
        }
      }

      expect(mismatches, `宮位天干差異:\n${mismatches.join('\n')}`).toHaveLength(0);
    });
  });

  // ── 四化標記一致性 ──────────────────────────────────────────────────────

  describe('四化標記一致性 (生年四化)', () => {
    /** Our SiHua mapping from edgeGenerator */
    const FOUR_TRANSFORMATIONS_MAP: Record<
      string,
      { lu: string; quan: string; ke: string; ji: string }
    > = {
      '甲': { lu: '廉貞', quan: '破軍', ke: '武曲', ji: '太陽' },
      '乙': { lu: '天機', quan: '天梁', ke: '紫微', ji: '太陰' },
      '丙': { lu: '天同', quan: '天機', ke: '文昌', ji: '廉貞' },
      '丁': { lu: '太陰', quan: '天同', ke: '天機', ji: '巨門' },
      '戊': { lu: '貪狼', quan: '太陰', ke: '右弼', ji: '天機' },
      '己': { lu: '武曲', quan: '貪狼', ke: '天梁', ji: '文曲' },
      '庚': { lu: '太陽', quan: '武曲', ke: '太陰', ji: '天同' },
      '辛': { lu: '巨門', quan: '太陽', ke: '文曲', ji: '文昌' },
      '壬': { lu: '天梁', quan: '紫微', ke: '左輔', ji: '武曲' },
      '癸': { lu: '破軍', quan: '巨門', ke: '太陰', ji: '貪狼' },
    };

    const MUTAGEN_MAP: Record<string, string> = {
      'lu': '祿', 'quan': '權', 'ke': '科', 'ji': '忌',
    };

    it.each(TEST_CASES)('$name: 生年四化星標記一致', (tc) => {
      const { ours, iztroResult } = computed[tc.name];
      const yearStem = ours.bazi.fourPillars.year.stem;
      const transforms = FOUR_TRANSFORMATIONS_MAP[yearStem];
      if (!transforms) return;

      const mismatches: string[] = [];

      // Collect iztro's actual mutagen assignments for comparison
      const iztroMutagens: string[] = [];
      for (const palace of iztroResult.palaces) {
        for (const star of [...palace.majorStars, ...palace.minorStars]) {
          if (star.mutagen) {
            iztroMutagens.push(`${star.name}(${star.mutagen})`);
          }
        }
      }

      for (const [key, starName] of Object.entries(transforms)) {
        const expectedMutagen = MUTAGEN_MAP[key];

        // Check iztro: find the star and see if it has the mutagen
        let iztroHasMutagen = false;
        for (const palace of iztroResult.palaces) {
          const allStars = [...palace.majorStars, ...palace.minorStars];
          const star = allStars.find((s) => s.name === starName);
          if (star && (star.mutagen as string) === expectedMutagen) {
            iztroHasMutagen = true;
            break;
          }
        }

        if (!iztroHasMutagen) {
          mismatches.push(
            `我方: ${yearStem}幹 化${expectedMutagen} → ${starName} | iztro實際四化: ${iztroMutagens.join(', ')}`,
          );
        }
      }

      expect(mismatches, `四化標記差異:\n${mismatches.join('\n')}`).toHaveLength(0);
    });
  });

  // ── 差異報告（資訊性） ──────────────────────────────────────────────────

  describe('差異報告（資訊性）', () => {
    it('記錄 iztro 有但現有系統缺少的數據', () => {
      const tc = TEST_CASES[0];
      const { iztroResult } = computed[tc.name];
      const report: string[] = [];

      // Brightness data
      let hasBrightness = false;
      for (const palace of iztroResult.palaces) {
        for (const star of palace.majorStars) {
          if (star.brightness) {
            hasBrightness = true;
            break;
          }
        }
        if (hasBrightness) break;
      }
      if (hasBrightness) {
        report.push('星曜亮度 (brightness): iztro 提供，現有系統未計算');
      }

      // Minor stars count
      let iztroMinorCount = 0;
      for (const palace of iztroResult.palaces) {
        iztroMinorCount += palace.minorStars.length;
      }
      report.push(`iztro 輔星總數: ${iztroMinorCount} (現有系統僅追蹤 4 顆輔星)`);

      // Adjective stars
      let iztroAdjCount = 0;
      for (const palace of iztroResult.palaces) {
        iztroAdjCount += (palace.adjectiveStars?.length ?? 0);
      }
      report.push(`iztro 雜耀總數: ${iztroAdjCount} (現有系統未追蹤雜耀)`);

      // Palace names
      const palaceNames = iztroResult.palaces.map((p) => p.name);
      report.push(`iztro 宮位名稱: ${palaceNames.join(', ')}`);

      // Log the report (informational, always passes)
      console.log('\n══════════════════════════════════════════');
      console.log('  差異報告 (Informational)');
      console.log('══════════════════════════════════════════');
      report.forEach((line) => console.log(`  • ${line}`));
      console.log('══════════════════════════════════════════\n');

      expect(true).toBe(true);
    });

    it('列出各案例的星曜亮度資訊', () => {
      const brightnessSummary: string[] = [];

      for (const tc of TEST_CASES.slice(0, 3)) {
        const { iztroResult } = computed[tc.name];
        const starBrightnesses: string[] = [];

        for (const palace of iztroResult.palaces) {
          for (const star of palace.majorStars) {
            if (star.brightness) {
              starBrightnesses.push(`${star.name}(${star.brightness})`);
            }
          }
        }

        brightnessSummary.push(`${tc.name}: ${starBrightnesses.join(', ')}`);
      }

      console.log('\n══════════════════════════════════════════');
      console.log('  星曜亮度參考資料');
      console.log('══════════════════════════════════════════');
      brightnessSummary.forEach((line) => console.log(`  ${line}`));
      console.log('══════════════════════════════════════════\n');

      expect(true).toBe(true);
    });
  });
});
