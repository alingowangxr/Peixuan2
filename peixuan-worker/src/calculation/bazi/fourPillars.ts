/**
 * Four Pillars (四柱) Type Definition & Re-export
 *
 * All calculation logic delegated to lunar-typescript via lunarAdapter.
 * This module only retains the FourPillars interface (referenced by 11+ files).
 */

import type { GanZhi } from '../core/ganZhi';

/**
 * Four Pillars result
 */
export interface FourPillars {
  year: GanZhi;
  month: GanZhi;
  day: GanZhi;
  hour: GanZhi;
}

export { getFourPillarsFromLunar } from './lunarAdapter';
