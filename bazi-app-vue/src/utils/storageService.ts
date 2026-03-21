/**
 * 存儲服務 - 處理應用中的資料存儲與獲取
 * 使用 sessionStorage 而非 localStorage，以確保資料在關閉瀏覽器時自動清除，提高安全性
 */

// 存儲鍵名常數
export const STORAGE_KEYS = {
  BAZI_CHART: 'peixuan_bazi_chart',
  BAZI_BIRTH_INFO: 'peixuan_bazi_birth_info',
  PURPLE_STAR_CHART: 'peixuan_purple_star_chart',
  PURPLE_STAR_BIRTH_INFO: 'peixuan_birth_info',
  TRANSFORMATION_STARS: 'peixuan_transformation_stars',
  TRANSFORMATION_FLOWS: 'peixuan_transformation_flows',
  TRANSFORMATION_COMBINATIONS: 'peixuan_transformation_combinations',
  TRANSFORMATION_MULTI_LAYER_ENERGIES:
    'peixuan_transformation_multi_layer_energies',
  INTEGRATED_ANALYSIS: 'peixuan_integrated_analysis',
  INTEGRATED_BIRTH_INFO: 'peixuan_integrated_birth_info',
  SESSION_ID: 'peixuan_session_id',
  TIMEZONE_INFO: 'peixuan_timezone_info',
};

/**
 * 生成或獲取 session ID
 */
export const getOrCreateSessionId = (): string => {
  let sessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
  }
  return sessionId;
};

/**
 * 保存資料到 sessionStorage
 */
export const saveToStorage = <T>(key: string, data: T): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`保存資料到 sessionStorage 失敗 (${key}):`, error);
  }
};

/**
 * 從 sessionStorage 獲取資料
 */
export const getFromStorage = <T>(key: string): T | null => {
  try {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`從 sessionStorage 獲取資料失敗 (${key}):`, error);
    return null;
  }
};

/**
 * 刪除特定鍵的資料
 */
export const removeFromStorage = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error(`從 sessionStorage 刪除資料失敗 (${key}):`, error);
  }
};

/**
 * 清除所有相關的資料
 */
export const clearAllAstrologyData = (): void => {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      sessionStorage.removeItem(key);
    });
  } catch (error) {
    console.error('清除所有資料失敗:', error);
  }
};

/**
 * 清除特定分析的資料
 */
export const clearAnalysisData = (
  analysisType:
    | 'bazi'
    | 'purpleStar'
    | 'purpleStarAll'
    | 'integrated'
    | 'transformationStars',
): void => {
  try {
    switch (analysisType) {
      case 'bazi':
        sessionStorage.removeItem(STORAGE_KEYS.BAZI_CHART);
        sessionStorage.removeItem(STORAGE_KEYS.BAZI_BIRTH_INFO);
        break;
      case 'purpleStar':
        sessionStorage.removeItem(STORAGE_KEYS.PURPLE_STAR_CHART);
        sessionStorage.removeItem(STORAGE_KEYS.PURPLE_STAR_BIRTH_INFO);
        // 不清除四化飛星資料，讓它們保持獨立
        // sessionStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_STARS);
        // sessionStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_FLOWS);
        // sessionStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_COMBINATIONS);
        break;
      case 'purpleStarAll':
        // 清除所有紫微斗數相關資料，包括四化飛星
        sessionStorage.removeItem(STORAGE_KEYS.PURPLE_STAR_CHART);
        sessionStorage.removeItem(STORAGE_KEYS.PURPLE_STAR_BIRTH_INFO);
        sessionStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_STARS);
        sessionStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_FLOWS);
        sessionStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_COMBINATIONS);
        sessionStorage.removeItem(
          STORAGE_KEYS.TRANSFORMATION_MULTI_LAYER_ENERGIES,
        );
        break;
      case 'transformationStars':
        sessionStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_STARS);
        sessionStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_FLOWS);
        sessionStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_COMBINATIONS);
        sessionStorage.removeItem(
          STORAGE_KEYS.TRANSFORMATION_MULTI_LAYER_ENERGIES,
        );
        break;
      case 'integrated':
        sessionStorage.removeItem(STORAGE_KEYS.INTEGRATED_ANALYSIS);
        sessionStorage.removeItem(STORAGE_KEYS.INTEGRATED_BIRTH_INFO);
        break;
    }
  } catch (error) {
    console.error(`清除 ${analysisType} 資料失敗:`, error);
  }
};

/**
 * 保存時區資訊到 sessionStorage
 * @param timeZone 時區資訊
 * @param year 出生年份
 */
export interface TimeZoneInfo {
  timeZone: string;
  year: number;
  timestamp: number;
}

export const saveTimeZoneInfo = (timeZone: string, year: number): void => {
  try {
    const timeZoneInfo: TimeZoneInfo = {
      timeZone,
      year,
      timestamp: Date.now(),
    };
    saveToStorage(STORAGE_KEYS.TIMEZONE_INFO, timeZoneInfo);
  } catch (error) {
    console.error('保存時區資訊失敗:', error);
  }
};

/**
 * 獲取最近選擇的時區資訊
 * @returns 時區資訊或 null
 */
export const getTimeZoneInfo = (): TimeZoneInfo | null => {
  return getFromStorage<TimeZoneInfo>(STORAGE_KEYS.TIMEZONE_INFO);
};

/**
 * 保存四化飛星資料到 sessionStorage
 * @param transformationStars 四化飛星資料
 * @param transformationFlows 四化流資料
 * @param transformationCombinations 四化組合資料
 * @param multiLayerEnergies 多層次能量資料
 */
export const saveTransformationStarsData = (
  transformationStars: any = null,
  transformationFlows: Record<number, any> = {},
  transformationCombinations: Array<any> = [],
  multiLayerEnergies: Record<number, any> = {},
): void => {
  try {
    if (transformationStars) {
      saveToStorage(STORAGE_KEYS.TRANSFORMATION_STARS, transformationStars);
    }

    if (Object.keys(transformationFlows).length > 0) {
      saveToStorage(STORAGE_KEYS.TRANSFORMATION_FLOWS, transformationFlows);
    }

    if (transformationCombinations.length > 0) {
      saveToStorage(
        STORAGE_KEYS.TRANSFORMATION_COMBINATIONS,
        transformationCombinations,
      );
    }

    if (Object.keys(multiLayerEnergies).length > 0) {
      saveToStorage(
        STORAGE_KEYS.TRANSFORMATION_MULTI_LAYER_ENERGIES,
        multiLayerEnergies,
      );
    }

  } catch (error) {
    console.error('保存四化飛星資料失敗:', error);
  }
};

/**
 * 從 sessionStorage 獲取四化飛星資料
 * @returns 四化飛星資料對象，包含 stars, flows, combinations 和 multiLayerEnergies
 */
export const getTransformationStarsData = (): {
  stars: any | null;
  flows: Record<number, any>;
  combinations: Array<any>;
  multiLayerEnergies: Record<number, any>;
} => {
  try {
    const stars = getFromStorage<any>(STORAGE_KEYS.TRANSFORMATION_STARS);
    const flows =
      getFromStorage<Record<number, any>>(STORAGE_KEYS.TRANSFORMATION_FLOWS) ||
      {};
    const combinations =
      getFromStorage<Array<any>>(STORAGE_KEYS.TRANSFORMATION_COMBINATIONS) ||
      [];
    const multiLayerEnergies =
      getFromStorage<Record<number, any>>(
        STORAGE_KEYS.TRANSFORMATION_MULTI_LAYER_ENERGIES,
      ) || {};

    return { stars, flows, combinations, multiLayerEnergies };
  } catch (error) {
    console.error('獲取四化飛星資料失敗:', error);
    return { stars: null, flows: {}, combinations: [], multiLayerEnergies: {} };
  }
};

/**
 * 檢查四化飛星資料是否存在
 * @returns 是否存在四化飛星資料
 */
export const hasTransformationStarsData = (): boolean => {
  const { stars, flows, combinations, multiLayerEnergies } =
    getTransformationStarsData();
  return !!(
    stars ||
    Object.keys(flows).length > 0 ||
    combinations.length > 0 ||
    Object.keys(multiLayerEnergies).length > 0
  );
};

export default {
  STORAGE_KEYS,
  getOrCreateSessionId,
  saveToStorage,
  getFromStorage,
  removeFromStorage,
  clearAllAstrologyData,
  clearAnalysisData,
  saveTimeZoneInfo,
  getTimeZoneInfo,
  saveTransformationStarsData,
  getTransformationStarsData,
  hasTransformationStarsData,
};
