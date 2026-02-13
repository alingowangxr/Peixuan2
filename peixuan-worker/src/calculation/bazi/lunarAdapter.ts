/**
 * Lunar Adapter Module
 *
 * Adapts lunar-typescript library to Peixuan's FourPillars interface.
 * Handles conversion from Solar date to BaZi four pillars using community-validated algorithms.
 */

import { Solar } from 'lunar-typescript';
import { HEAVENLY_STEMS, EARTHLY_BRANCHES, type GanZhi } from '../core/ganZhi';
import type { FourPillars } from './fourPillars';

/**
 * Convert lunar-typescript BaZi output to FourPillars interface
 *
 * @param options.solarDate - Birth date in solar calendar
 * @param options.longitude - Longitude for true solar time correction (optional)
 * @param options.latitude - Latitude for location (optional)
 * @returns FourPillars with year/month/day/hour as GanZhi
 */
export function getFourPillarsFromLunar(options: {
  solarDate: Date;
  longitude?: number;
  latitude?: number;
}): FourPillars {
  const { solarDate } = options;

  const solar = Solar.fromDate(solarDate);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  // Get the four pillars strings from lunar-typescript
  const yearGanZhi = eightChar.getYearGan() + eightChar.getYearZhi();
  const monthGanZhi = eightChar.getMonthGan() + eightChar.getMonthZhi();
  const dayGanZhi = eightChar.getDayGan() + eightChar.getDayZhi();
  const hourGanZhi = eightChar.getTimeGan() + eightChar.getTimeZhi();

  return {
    year: parseGanZhi(yearGanZhi),
    month: parseGanZhi(monthGanZhi),
    day: parseGanZhi(dayGanZhi),
    hour: parseGanZhi(hourGanZhi)
  };
}

/**
 * Parse GanZhi string (e.g., "甲子") to GanZhi interface
 *
 * @param ganzhiStr - GanZhi string from lunar-typescript
 * @returns GanZhi object with stem and branch
 */
function parseGanZhi(ganzhiStr: string): GanZhi {
  if (ganzhiStr.length !== 2) {
    throw new Error(`Invalid GanZhi string: ${ganzhiStr}`);
  }

  const stem = ganzhiStr[0] as any;
  const branch = ganzhiStr[1] as any;

  if (!HEAVENLY_STEMS.includes(stem)) {
    throw new Error(`Invalid stem: ${stem}`);
  }

  if (!EARTHLY_BRANCHES.includes(branch)) {
    throw new Error(`Invalid branch: ${branch}`);
  }

  return { stem, branch };
}

/**
 * Simplified → Traditional Chinese mapping for ten gods
 * lunar-typescript returns simplified Chinese, we need traditional
 */
const SHISHEN_TO_TRADITIONAL: Record<string, string> = {
  '劫财': '劫財',
  '伤官': '傷官',
  '偏财': '偏財',
  '正财': '正財',
  '七杀': '七殺',
  // These are the same in simplified and traditional
  '比肩': '比肩',
  '食神': '食神',
  '正官': '正官',
  '偏印': '偏印',
  '正印': '正印',
};

/**
 * Get ten gods (十神) for year/month/hour stems using lunar-typescript
 *
 * @param solarDate - Birth date in solar calendar (should be true solar time corrected)
 * @returns Ten gods in Traditional Chinese for year, month, and hour stems
 */
export function getTenGodsFromLunar(solarDate: Date): { year: string; month: string; hour: string } {
  const solar = Solar.fromDate(solarDate);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  const yearRaw = eightChar.getYearShiShenGan();
  const monthRaw = eightChar.getMonthShiShenGan();
  const hourRaw = eightChar.getTimeShiShenGan();

  return {
    year: SHISHEN_TO_TRADITIONAL[yearRaw] || yearRaw,
    month: SHISHEN_TO_TRADITIONAL[monthRaw] || monthRaw,
    hour: SHISHEN_TO_TRADITIONAL[hourRaw] || hourRaw,
  };
}

/**
 * Get day pillar from lunar-typescript
 *
 * @param solarDate - Date in solar calendar
 * @returns Day pillar as GanZhi
 */
export function getDayPillarFromLunar(solarDate: Date): GanZhi {
  const solar = Solar.fromDate(solarDate);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  const dayGanZhi = eightChar.getDayGan() + eightChar.getDayZhi();
  return parseGanZhi(dayGanZhi);
}
