/**
 * BaZi Ten Gods (十神) Module
 *
 * Type definition only. Calculation delegated to lunar-typescript via lunarAdapter.
 */

export type TenGod =
  | '比肩'
  | '劫財'
  | '食神'
  | '傷官'
  | '偏財'
  | '正財'
  | '七殺'
  | '正官'
  | '偏印'
  | '正印';

export { getTenGodsFromLunar } from './lunarAdapter';
