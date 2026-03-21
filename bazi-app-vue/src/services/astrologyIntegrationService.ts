import axios from 'axios';
import { ref } from 'vue';
import type {
  IntegratedAnalysisResponse,
  ConfidenceAssessmentResponse,
} from '@/types/astrologyTypes';

export interface BirthInfo {
  birthDate: string;
  birthTime: string;
  gender: 'male' | 'female';
  location?:
    | string
    | {
        latitude: number;
        longitude: number;
        timezone?: string;
        name?: string; // 可選的地名描述
      };
  options?: {
    useAdvancedAlgorithm?: boolean;
    includeCrossVerification?: boolean;
    includeRealTimeData?: boolean;
    confidenceScoring?: boolean;
  };
}

class AstrologyIntegrationService {
  private baseUrl = '/api/v1/astrology';

  /**
   * 執行時運分析（整合八字與紫微斗數）
   */
  async performIntegratedAnalysis(
    birthInfo: BirthInfo,
    useSessionCharts = false,
  ) {
    try {
      // 確保請求資料格式正確
      const requestData: any = {
        birthDate: birthInfo.birthDate,
        birthTime: birthInfo.birthTime,
        gender: birthInfo.gender,
        location:
          typeof birthInfo.location === 'string'
            ? birthInfo.location
            : birthInfo.location?.name || '台北市',
        options: birthInfo.options || {
          useAdvancedAlgorithm: true,
          includeCrossVerification: true,
          includeRealTimeData: true,
          confidenceScoring: true,
        },
        useSessionCharts, // 標記是否使用 sessionStorage 中的命盤資料
      };

      // 如果啟用使用 session 中的命盤資料，則添加這些資料到請求中
      if (useSessionCharts) {
        const storageService = await import('@/utils/storageService').then(
          (m) => m.default,
        );

        // 獲取並添加八字命盤資料
        const baziChart = storageService.getFromStorage(
          storageService.STORAGE_KEYS.BAZI_CHART,
        );
        if (baziChart) {
          requestData.baziChart = baziChart;
        }

        // 獲取並添加紫微斗數命盤資料
        const purpleStarChart = storageService.getFromStorage(
          storageService.STORAGE_KEYS.PURPLE_STAR_CHART,
        );
        if (purpleStarChart) {
          requestData.purpleStarChart = purpleStarChart;
        }
      }

      // 發送API請求
      const response = await axios.post<IntegratedAnalysisResponse>(
        `${this.baseUrl}/integrated-analysis`,
        requestData,
      );

      return response.data;
    } catch (error) {
      console.error('多術數交互驗證分析失敗', error);
      throw error;
    }
  }

  /**
   * 獲取信心度評估
   */
  async getConfidenceAssessment(birthInfo: BirthInfo) {
    try {
      // 發送API請求
      const response = await axios.post<ConfidenceAssessmentResponse>(
        `${this.baseUrl}/confidence-assessment`,
        birthInfo,
      );

      return response.data;
    } catch (error) {
      console.error('信心度評估失敗', error);
      throw error;
    }
  }

  /**
   * 創建響應式的分析結果
   */
  createReactiveAnalysis() {
    return {
      integratedAnalysis: ref<IntegratedAnalysisResponse | null>(null),
      confidenceAssessment: ref<ConfidenceAssessmentResponse | null>(null),
      loading: ref(false),
      error: ref<string | null>(null),

      async analyze(birthInfo: BirthInfo, useSessionCharts = false) {
        this.loading.value = true;
        this.error.value = null;

        try {
          const integrationService = new AstrologyIntegrationService();
          const analysisResult =
            await integrationService.performIntegratedAnalysis(
              birthInfo,
              useSessionCharts,
            );
          // 只有當 useSessionCharts 為 false 時才呼叫信心度評估
          const confidenceResult = useSessionCharts
            ? null
            : await integrationService.getConfidenceAssessment(birthInfo);

          this.integratedAnalysis.value = analysisResult;
          this.confidenceAssessment.value = confidenceResult;
        } catch (error) {
          this.error.value =
            error instanceof Error ? error.message : '未知錯誤';
          this.integratedAnalysis.value = null;
          this.confidenceAssessment.value = null;
        } finally {
          this.loading.value = false;
        }
      },
    };
  }
}

export default new AstrologyIntegrationService();
