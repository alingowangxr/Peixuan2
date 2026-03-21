import { UnifiedCalculator } from '../calculation/integration/calculator';
import { formatToMarkdown } from '../formatters/markdownFormatter';
import { ChartCacheService } from '../services/chartCacheService';
import type { BirthInfo, CalculationResult } from '../calculation/types';

/**
 * Unified Controller
 *
 * Provides unified API endpoint that returns complete CalculationResult
 * including BaZi (fourPillars, hiddenStems, tenGods) and ZiWei (palaces, bureau, stars, symmetry).
 * Supports multiple output formats (JSON, Markdown).
 *
 * Reference: IMPLEMENTATION_PLAN_PHASE1.md Sprint A Task A2
 */
export class UnifiedController {
  private chartCacheService: ChartCacheService;

  constructor() {
    this.chartCacheService = new ChartCacheService();
  }
  /**
   * Calculate complete astrological chart
   *
   * @param requestData - Request payload with birth information
   * @param format - Output format ('json' or 'markdown'), default 'json'
   * @param env - Cloudflare Worker environment (optional, for D1 caching)
   * @returns Complete calculation result with chartId (if env provided) and all BaZi and ZiWei data
   * @throws Error if validation fails or calculation error occurs
   */
  async calculate(requestData: any, format: 'json' | 'markdown' = 'json', env?: { DB: D1Database }): Promise<CalculationResult | string | { chartId: string; [key: string]: any }> {
    try {
      // Step 1: Validate and parse input
      const birthDateTime = `${requestData.birthDate} ${requestData.birthTime}`;
      const solarDate = new Date(birthDateTime);

      if (isNaN(solarDate.getTime())) {
        throw new Error('Invalid birth date or time format');
      }

      if (!requestData.gender || !['male', 'female'].includes(requestData.gender)) {
        throw new Error('Invalid gender: must be "male" or "female"');
      }

      // Step 2: Prepare birth info
      const birthInfo: BirthInfo = {
        solarDate,
        longitude: requestData.longitude || 121.5,
        gender: requestData.gender,
        isLeapMonth: requestData.isLeapMonth || false
      };

      // Step 3: Calculate using UnifiedCalculator
      const calculator = new UnifiedCalculator();
      const result = calculator.calculate(birthInfo);

      // Step 4: Always generate chartId
      const chartId = crypto.randomUUID();

      // Step 5: Try to save to D1 if env is provided (with error handling)
      if (env) {
        try {
          await this.chartCacheService.saveChart(
            chartId,
            result,
            {
              name: requestData.name,
              birthDate: requestData.birthDate,
              birthTime: requestData.birthTime,
              location: requestData.location || 'Unknown'
            },
            env
          );
        } catch (saveError) {
          console.error('[UnifiedController] Failed to save chart to D1:', saveError);
          // Continue execution even if save fails
        }
      } else {
      }

      // Step 6: Format output based on requested format
      if (format === 'markdown') {
        return formatToMarkdown(result);
      }

      // Step 7: Always return with chartId for JSON format
      return {
        chartId,
        ...result
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('Validation failed:')) {
          throw new Error(`Input validation error: ${error.message.replace('Validation failed: ', '')}`);
        }
        throw error;
      }
      throw new Error('Unknown error during unified calculation');
    }
  }
}
