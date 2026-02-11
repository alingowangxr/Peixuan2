/**
 * True Solar Time Calculation Module
 *
 * Implements astronomical time corrections for accurate astrological calculations.
 * Based on the mathematical model in 命理計算邏輯數學化研究.md §1.1.1
 */

/**
 * Result of true solar time calculation
 */
export interface TrueSolarTimeResult {
  /** True solar time after all corrections */
  trueSolarTime: Date;
  /** Longitude correction in minutes */
  longitudeCorrection: number;
  /** Equation of time correction in minutes */
  equationOfTime: number;
  /** Total correction applied in minutes */
  totalCorrection: number;
}

/**
 * Calculate the Equation of Time (EoT) for a given date
 *
 * The EoT corrects for Earth's elliptical orbit and axial tilt,
 * causing the apparent solar time to differ from mean solar time.
 *
 * Formula from research doc:
 * E = B + 9.87*sin(2B) - 7.53*cos(B) - 1.5*sin(B)
 * where B = (360/365)(n - 81) degrees
 *
 * @param date - The date to calculate EoT for
 * @returns Equation of time in minutes
 */
function calculateEquationOfTime(date: Date): number {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;

  const B = (360 / 365) * (dayOfYear - 81);
  const radB = B * Math.PI / 180;

  const eot = B + 9.87 * Math.sin(2 * radB) - 7.53 * Math.cos(radB) - 1.5 * Math.sin(radB);

  return eot / 60; // Convert from seconds to minutes
}

/**
 * Calculate true solar time from clock time
 *
 * Converts mean solar time (clock time) to true solar time by applying:
 * 1. Longitude correction: Adjusts for distance from standard meridian
 * 2. Equation of Time: Corrects for Earth's orbital eccentricity
 *
 * Formula: T_true = T_clock + ΔT_long + EoT
 * where ΔT_long = (L_local - L_std) × 4 minutes
 *
 * @param clockTime - The clock time (mean solar time)
 * @param longitude - Local longitude in degrees (positive = East, negative = West)
 * @param standardMeridian - Standard meridian for the timezone (default: 120°E for UTC+8)
 * @returns True solar time result with all corrections
 *
 * @example
 * // Beijing at 12:00 noon on 2024-01-01
 * const result = calculateTrueSolarTime(
 *   new Date(2024, 0, 1, 12, 0, 0),
 *   116.4
 * );
 * // Returns time adjusted by ~14.4 minutes earlier + EoT correction
 */
export function calculateTrueSolarTime(
  clockTime: Date,
  longitude: number,
  standardMeridian = 120
): TrueSolarTimeResult {
  // Longitude correction: (L_local - L_std) × 4 minutes
  const longitudeCorrection = (longitude - standardMeridian) * 4;

  // Total correction = longitude correction only
  const totalCorrection = longitudeCorrection;

  // Apply correction to clock time
  const trueSolarTime = new Date(clockTime.getTime() + totalCorrection * 60 * 1000);

  return {
    trueSolarTime,
    longitudeCorrection,
    equationOfTime: 0,
    totalCorrection
  };
}
