/**
 * ZiWei Palace Positioning Module
 * Implements palace position calculations based on lunar calendar
 */

export interface PalacePosition {
  /** Palace index (0-11, representing 12 earthly branches) */
  position: number;
  /** Earthly branch name */
  branch: string;
}

export interface LifePalaceOptions {
  /** Adjustment for leap month (+1 for leap month) */
  leapMonthAdjustment?: number;
}

/** Earthly branches mapping */
const EARTHLY_BRANCHES = [
  '子', '丑', '寅', '卯', '辰', '巳',
  '午', '未', '申', '酉', '戌', '亥'
];

/**
 * Calculate Life Palace position
 * Formula: P_life = (M - H + 1 + 12) mod 12
 *
 * @param lunarMonth - Lunar month (1-12)
 * @param hourBranch - Hour branch index (0-11)
 * @param options - Optional parameters including leap month adjustment
 * @returns Palace position with branch name
 */
export function calculateLifePalace(
  lunarMonth: number,
  hourBranch: number,
  options?: LifePalaceOptions
): PalacePosition {
  const adjustment = options?.leapMonthAdjustment ?? 0;
  const adjustedMonth = lunarMonth + adjustment;

  const position = ((adjustedMonth - hourBranch + 1 + 12) % 12 + 12) % 12;

  return {
    position,
    branch: EARTHLY_BRANCHES[position]
  };
}

/**
 * Calculate Body Palace position
 * Formula: P_body = (M + H + 1) mod 12
 *
 * The body palace advances from 寅 by (month + hour) steps.
 * With 1-based month and 0-based hour branch: position = (M + H + 1) mod 12.
 *
 * @param lunarMonth - Lunar month (1-12)
 * @param hourBranch - Hour branch index (0-11)
 * @returns Palace position with branch name
 */
export function calculateBodyPalace(
  lunarMonth: number,
  hourBranch: number
): PalacePosition {
  const position = ((lunarMonth + hourBranch + 1) % 12 + 12) % 12;

  return {
    position,
    branch: EARTHLY_BRANCHES[position]
  };
}
