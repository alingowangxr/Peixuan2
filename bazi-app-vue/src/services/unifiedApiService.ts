import axios from 'axios';

const BASE_URL = '/api/v1';

/**
 * Request payload for unified calculation
 */
export interface UnifiedCalculateRequest {
  birthDate: string; // Format: YYYY-MM-DD
  birthTime: string; // Format: HH:mm
  gender: 'male' | 'female';
  longitude?: number; // Default: 121.5 (Taiwan)
  isLeapMonth?: boolean; // Default: false
}

/**
 * GanZhi (天干地支) representation
 */
export interface GanZhi {
  gan: string;
  zhi: string;
}

/**
 * Hidden stems in earthly branches
 */
export interface HiddenStems {
  primary: string;
  middle?: string;
  residual?: string;
}

/**
 * Ten Gods relationship type
 */
export type TenGod =
  | '比肩'
  | '劫财'
  | '食神'
  | '伤官'
  | '偏财'
  | '正财'
  | '七杀'
  | '正官'
  | '偏印'
  | '正印';

/**
 * BaZi calculation result
 */
export interface BaZiResult {
  fourPillars: {
    year: GanZhi;
    month: GanZhi;
    day: GanZhi;
    hour: GanZhi;
  };
  trueSolarTime: string;
  julianDay: number;
  hiddenStems: {
    year: HiddenStems;
    month: HiddenStems;
    day: HiddenStems;
    hour: HiddenStems;
  };
  tenGods: {
    year: TenGod;
    month: TenGod;
    hour: TenGod;
  };
  calculationSteps: any[];
  metadata: {
    algorithms: string[];
    references: string[];
    methods: string[];
  };
}

/**
 * Palace position information
 */
export interface PalacePosition {
  index: number;
  name: string;
}

/**
 * Bureau type (五行局)
 */
export type Bureau = 2 | 3 | 4 | 5 | 6;

/**
 * Star symmetry information
 */
export interface StarSymmetry {
  star: string;
  position: number;
  symmetryPair?: string;
  symmetryPosition?: number;
  symmetryType?: string;
}

/**
 * ZiWei calculation result
 */
export interface ZiWeiResult {
  lifePalace: PalacePosition;
  bodyPalace: PalacePosition;
  bureau: Bureau;
  ziWeiPosition: number;
  tianFuPosition: number;
  auxiliaryStars: {
    wenChang: number;
    wenQu: number;
    zuoFu: number;
    youBi: number;
  };
  starSymmetry: StarSymmetry[];
  calculationSteps: any[];
  metadata: {
    algorithms: string[];
    references: string[];
    methods: string[];
  };
}

/**
 * Complete calculation result
 */
export interface CalculationResult {
  chartId: string;
  input: {
    solarDate: string;
    longitude: number;
    gender: 'male' | 'female';
    isLeapMonth: boolean;
  };
  bazi: BaZiResult;
  ziwei: ZiWeiResult;
  annualFortune?: any;
  timestamp: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Cache entry structure
 */
interface CacheEntry {
  data: CalculationResult;
  timestamp: number;
}

/**
 * Unified API Service
 *
 * Provides unified calculation endpoint for both BaZi and ZiWei systems.
 * Includes error handling and optional caching mechanism.
 *
 * Reference: Sprint B Task B2 - IMPLEMENTATION_PLAN_PHASE1.md
 */
class UnifiedApiService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Calculate complete astrological chart
   *
   * @param birthInfo - Birth information for calculation
   * @returns Complete calculation result with BaZi and ZiWei data
   * @throws Error with user-friendly message if calculation fails
   */
  async calculate(
    birthInfo: UnifiedCalculateRequest,
  ): Promise<CalculationResult> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(birthInfo);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await axios.post<ApiResponse<CalculationResult>>(
        `${BASE_URL}/calculate`,
        birthInfo,
      );

      // Validate response structure
      if (!response.data) {
        throw new Error('伺服器回應格式錯誤');
      }

      // Backend returns the calculation result directly (not wrapped in success/data)
      // Type assertion needed because axios types expect ApiResponse but backend returns CalculationResult
      const backendResult = response.data as unknown as any;

      // Adapt backend format to frontend format
      const result: CalculationResult = {
        chartId: backendResult.chartId, // Preserve chartId from backend
        ...backendResult,
        bazi: {
          ...backendResult.bazi,
          fourPillars: {
            year: {
              gan: backendResult.bazi.fourPillars.year.stem,
              zhi: backendResult.bazi.fourPillars.year.branch,
            },
            month: {
              gan: backendResult.bazi.fourPillars.month.stem,
              zhi: backendResult.bazi.fourPillars.month.branch,
            },
            day: {
              gan: backendResult.bazi.fourPillars.day.stem,
              zhi: backendResult.bazi.fourPillars.day.branch,
            },
            hour: {
              gan: backendResult.bazi.fourPillars.hour.stem,
              zhi: backendResult.bazi.fourPillars.hour.branch,
            },
          },
          // Adapt wuxingDistribution: merge tiangan + hiddenStems into flat structure
          // Backend uses English keys (Wood/Fire/Earth/Metal/Water), convert to Chinese
          wuxingDistribution: backendResult.bazi.wuxingDistribution
            ? {
                raw: {
                  木:
                    (backendResult.bazi.wuxingDistribution.raw.tiangan[
                      'Wood'
                    ] || 0) +
                    (backendResult.bazi.wuxingDistribution.raw.hiddenStems[
                      'Wood'
                    ] || 0),
                  火:
                    (backendResult.bazi.wuxingDistribution.raw.tiangan[
                      'Fire'
                    ] || 0) +
                    (backendResult.bazi.wuxingDistribution.raw.hiddenStems[
                      'Fire'
                    ] || 0),
                  土:
                    (backendResult.bazi.wuxingDistribution.raw.tiangan[
                      'Earth'
                    ] || 0) +
                    (backendResult.bazi.wuxingDistribution.raw.hiddenStems[
                      'Earth'
                    ] || 0),
                  金:
                    (backendResult.bazi.wuxingDistribution.raw.tiangan[
                      'Metal'
                    ] || 0) +
                    (backendResult.bazi.wuxingDistribution.raw.hiddenStems[
                      'Metal'
                    ] || 0),
                  水:
                    (backendResult.bazi.wuxingDistribution.raw.tiangan[
                      'Water'
                    ] || 0) +
                    (backendResult.bazi.wuxingDistribution.raw.hiddenStems[
                      'Water'
                    ] || 0),
                },
                adjusted: {
                  木:
                    backendResult.bazi.wuxingDistribution.adjusted['Wood'] || 0,
                  火:
                    backendResult.bazi.wuxingDistribution.adjusted['Fire'] || 0,
                  土:
                    backendResult.bazi.wuxingDistribution.adjusted['Earth'] ||
                    0,
                  金:
                    backendResult.bazi.wuxingDistribution.adjusted['Metal'] ||
                    0,
                  水:
                    backendResult.bazi.wuxingDistribution.adjusted['Water'] ||
                    0,
                },
                dominant: backendResult.bazi.wuxingDistribution.dominant,
                deficient: backendResult.bazi.wuxingDistribution.deficient,
                balance: backendResult.bazi.wuxingDistribution.balance,
              }
            : undefined,
          // Parse Date strings in fortuneCycles
          fortuneCycles: backendResult.bazi.fortuneCycles
            ? {
                ...backendResult.bazi.fortuneCycles,
                qiyunDate: new Date(backendResult.bazi.fortuneCycles.qiyunDate),
                dayunList: backendResult.bazi.fortuneCycles.dayunList.map(
                  (dayun: any) => ({
                    ...dayun,
                    startDate: new Date(dayun.startDate),
                    endDate: new Date(dayun.endDate),
                  }),
                ),
                currentDayun: backendResult.bazi.fortuneCycles.currentDayun
                  ? {
                      ...backendResult.bazi.fortuneCycles.currentDayun,
                      startDate: new Date(
                        backendResult.bazi.fortuneCycles.currentDayun.startDate,
                      ),
                      endDate: new Date(
                        backendResult.bazi.fortuneCycles.currentDayun.endDate,
                      ),
                    }
                  : null,
              }
            : undefined,
        },
        ziwei: {
          ...backendResult.ziwei,
          lifePalace: {
            name: backendResult.ziwei.lifePalace.branch,
            position: backendResult.ziwei.lifePalace.position,
            index: backendResult.ziwei.lifePalace.position, // Alias for compatibility
          },
          bodyPalace: {
            name: backendResult.ziwei.bodyPalace.branch,
            position: backendResult.ziwei.bodyPalace.position,
            index: backendResult.ziwei.bodyPalace.position, // Alias for compatibility
          },
        },
        // Pass through annualFortune with element-to-Chinese mapping
        annualFortune: backendResult.annualFortune
          ? {
              ...backendResult.annualFortune,
              interactions: {
                ...backendResult.annualFortune.interactions,
                harmoniousCombinations:
                  backendResult.annualFortune.interactions.harmoniousCombinations.map(
                    (combo: any) => ({
                      ...combo,
                      result: this.elementToChinese(combo.element),
                    }),
                  ),
              },
            }
          : undefined,
      };

      // Store in cache
      this.setCache(cacheKey, result);

      return result;
    } catch (error: any) {
      console.error('統一計算API錯誤:', error);

      // Handle different error types with user-friendly messages
      if (error?.response) {
        const { status } = error.response;
        const { data } = error.response;

        switch (status) {
          case 400:
            throw new Error(
              `輸入驗證錯誤: ${data?.error || data?.message || '請檢查出生日期時間格式'}`,
            );
          case 500:
            throw new Error(
              `伺服器計算錯誤: ${data?.error || data?.message || '請稍後再試'}`,
            );
          default:
            throw new Error(
              `請求失敗 (${status}): ${data?.error || data?.message || '未知錯誤'}`,
            );
        }
      } else if (error?.request) {
        throw new Error('無法連接到伺服器，請檢查網路連接');
      } else if (error?.message) {
        throw error; // Re-throw errors with messages we already set
      } else {
        throw new Error('計算過程發生未知錯誤');
      }
    }
  }

  /**
   * Generate cache key from birth info
   */
  private generateCacheKey(birthInfo: UnifiedCalculateRequest): string {
    const {
      birthDate,
      birthTime,
      gender,
      longitude = 121.5,
      isLeapMonth = false,
    } = birthInfo;
    return `${birthDate}_${birthTime}_${gender}_${longitude}_${isLeapMonth}`;
  }

  /**
   * Get cached result if valid
   */
  private getFromCache(key: string): CalculationResult | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store result in cache
   */
  private setCache(key: string, data: CalculationResult): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Simple cache size management: keep only last 50 entries
    if (this.cache.size > 50) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Clear cache manually if needed
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Convert English element name to Chinese
   */
  private elementToChinese(element: string): string {
    const map: Record<string, string> = {
      Wood: '木局',
      Fire: '火局',
      Earth: '土局',
      Metal: '金局',
      Water: '水局',
    };
    return map[element] || element;
  }
}

/**
 * Daily Reminder Interface
 * 每日運勢提醒資料結構
 */
export interface DailyReminder {
  text: string;
  tags: Array<{ label: string; type: 'success' | 'warning' | 'info' }>;
  cached: boolean;
}

/**
 * Get Daily Reminder
 * 取得每日運勢提醒（含 localStorage 快取）
 *
 * @param chartId - 命盤 ID
 * @param date - 查詢日期
 * @param locale - 語言設定 (預設 'zh-TW', 可選 'en')
 * @returns 每日運勢提醒資料
 *
 * 快取策略：
 * - Key: `daily-reminder-${chartId}-${dateKey}-${locale}`
 * - Storage: localStorage
 * - TTL: 永久（日期固定，結果不變）
 */
export async function getDailyReminder(
  chartId: string,
  date: Date,
  locale = 'zh-TW',
): Promise<DailyReminder> {
  const dateKey = date.toISOString().split('T')[0];
  const cacheKey = `daily-reminder-${chartId}-${dateKey}-${locale}`;

  try {
    // 先查 localStorage（永久快取）
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsedCache = JSON.parse(cached);
      return { ...parsedCache, cached: true };
    }

    // API 調用
    const response = await axios.get<DailyReminder>(
      `${BASE_URL}/daily-reminder`,
      {
        params: { chartId, date: date.toISOString(), locale },
      },
    );

    // 永久快取（日期固定，結果不變）
    localStorage.setItem(cacheKey, JSON.stringify(response.data));

    return { ...response.data, cached: false };
  } catch (error: any) {
    console.error('Failed to get daily reminder:', error);

    // 錯誤時拋出，由組件處理 Fallback
    throw new Error(
      error?.response?.data?.error ||
        error?.response?.data?.message ||
        '無法取得每日運勢提醒',
    );
  }
}

export default new UnifiedApiService();
