/**
 * Analyze Controller
 * Provides AI-powered astrological analysis endpoint
 */

import type { BirthInfo, CalculationResult } from '../calculation/types';
import type { AIOptions } from '../types/aiTypes';
import { UnifiedCalculator } from '../calculation/integration/calculator';
import { formatToMarkdown } from '../formatters/markdownFormatter';
import { formatAdvancedMarkdown } from '../formatters/advancedMarkdownFormatter';
import type { AIServiceManager } from '../services/aiServiceManager';
import { ChartCacheService } from '../services/chartCacheService';
import { AnalysisCacheService } from '../services/analysisCacheService';
import { AdvancedAnalysisCacheService } from '../services/advancedAnalysisCacheService';
import { buildAnalysisPrompt, buildAdvancedAnalysisPrompt } from './promptBuilder';
import { processAzureStream, processGeminiStream, parseAndSendGeminiResponse, accumulateStreamBuffer, createCachedSSEStream } from './streamProcessor';
import { getLoadingMessage, sendCachedAnalysis } from './cacheUtilities';

export interface AnalyzeRequest {
  birthDate: string;
  birthTime: string;
  gender: 'male' | 'female';
  longitude?: number;
  isLeapMonth?: boolean;
}

export interface AnalyzeResponse {
  calculation: CalculationResult;
  aiAnalysis: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface CachedAnalysisResult {
  text: string;
}

export class AnalyzeController {
  private aiServiceManager: AIServiceManager;
  private chartCacheService: ChartCacheService;
  private analysisCacheService: AnalysisCacheService;
  private advancedAnalysisCacheService: AdvancedAnalysisCacheService;

  constructor(aiServiceManager: AIServiceManager) {
    this.aiServiceManager = aiServiceManager;
    this.chartCacheService = new ChartCacheService();
    this.analysisCacheService = new AnalysisCacheService();
    this.advancedAnalysisCacheService = new AdvancedAnalysisCacheService();
  }

  /**
   * Analyze astrological chart with AI
   * 
   * @param requestData - Birth information
   * @returns Calculation result with AI analysis
   */
  async analyze(requestData: AnalyzeRequest): Promise<AnalyzeResponse> {
    try {
      // Step 1: Validate and parse input
      // Support multiple date formats:
      // - ISO format: "2024-01-01T12:00:00" or "2024-01-01 12:00:00"
      // - Separated: birthDate="2024-01-01", birthTime="12:00"
      let solarDate: Date;

      // Try to parse birthDate directly if it already contains time
      const directDate = new Date(requestData.birthDate);
      if (!isNaN(directDate.getTime()) && requestData.birthDate.includes('T')) {
        solarDate = directDate;
      } else {
        // Parse date and time separately
        const dateParts = requestData.birthDate.split(/[-/]/);
        const timeParts = requestData.birthTime.split(':');

        if (dateParts.length !== 3 || timeParts.length < 2) {
          throw new Error('Invalid birth date or time format. Expected date: YYYY-MM-DD, time: HH:mm');
        }

        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-indexed
        const day = parseInt(dateParts[2]);
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);
        const second = timeParts[2] ? parseInt(timeParts[2]) : 0;

        solarDate = new Date(year, month, day, hour, minute, second);
      }

      if (isNaN(solarDate.getTime())) {
        throw new Error('Invalid birth date or time format. Expected date: YYYY-MM-DD, time: HH:mm');
      }

      if (!requestData.gender || !['male', 'female'].includes(requestData.gender)) {
        throw new Error('Invalid gender: must be "male" or "female"');
      }

      // Step 2: Prepare birth info
      const birthInfo: BirthInfo = {
        solarDate,
        longitude: requestData.longitude || 121.5,
        gender: requestData.gender,
        isLeapMonth: requestData.isLeapMonth || false,
      };

      // Step 3: Calculate chart
      const calculator = new UnifiedCalculator();
      const calculation = calculator.calculate(birthInfo);

      // Step 4: Convert to Markdown (exclude steps for AI, personality-only mode)
      const markdown = formatToMarkdown(calculation, { excludeSteps: true, personalityOnly: true });

      // Step 5: Build prompt and get AI analysis (default locale: zh-TW)
      const prompt = buildAnalysisPrompt(markdown, 'zh-TW');
      const aiResponse = await this.aiServiceManager.generate(prompt);

      // Step 6: Return combined result
      return {
        calculation,
        aiAnalysis: aiResponse.text,
        usage: aiResponse.metadata.usage,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('Validation failed:')) {
          throw new Error(`Input validation error: ${error.message.replace('Validation failed: ', '')}`);
        }
        throw error;
      }
      throw new Error('Unknown error during analysis');
    }
  }

  /**
   * Check if analysis cache exists for a chart
   * @param chartId - The chart ID to check
   * @param env - Cloudflare Worker environment
   * @param locale - Language locale (zh-TW or en, default: zh-TW)
   * @returns Object with cached status
   */
  async checkCache(chartId: string, env: { DB: D1Database }, locale = 'zh-TW'): Promise<{ cached: boolean }> {
    // HOTFIX: Add analysis mode to cache key to prevent personality/fortune cross-contamination
    const analysisType = `ai-streaming-${locale}-personality`;
    const cachedAnalysis = await this.analysisCacheService.getAnalysis(chartId, analysisType, env);
    return { cached: !!cachedAnalysis };
  }

  /**
   * Analyze astrological chart with streaming AI response
   *
   * @param chartId - The chart ID to analyze
   * @param env - Cloudflare Worker environment with DB binding
   * @param locale - Language locale (zh-TW or en, default: zh-TW)
   * @param force - Force regeneration, bypassing cache (default: false)
   * @returns ReadableStream in SSE format
   */
  async analyzeStream(chartId: string, env: { DB: D1Database }, locale = 'zh-TW', force = false): Promise<ReadableStream> {

    const encoder = new TextEncoder();
    // HOTFIX: Add analysis mode to cache key to prevent personality/fortune cross-contamination
    const analysisType = `ai-streaming-${locale}-personality`;

    // Preserve this context
    const { aiServiceManager } = this;
    const self = this;

    // Return stream immediately to establish SSE connection
    return new ReadableStream({
      async start(controller) {
        try {
          // Send immediate loading message
          const loadingMessage = getLoadingMessage(locale);
          const sseData = `data: ${JSON.stringify({ text: loadingMessage })}\n\n`;
          controller.enqueue(encoder.encode(sseData));

          // Step 0: Check analysis cache first (Daily Consistency Policy - always check cache)
          const analysisCacheService = new AnalysisCacheService();
          const cachedAnalysis = await analysisCacheService.getAnalysis(chartId, analysisType, env);

          if (cachedAnalysis) {
            if (force) {
            } else {
            }
            await sendCachedAnalysis(cachedAnalysis, controller, encoder, force);
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }

          // Step 1: Read chart data from D1
          const chartCacheService = new ChartCacheService();
          const chart = await chartCacheService.getChart(chartId, env);

          if (!chart) {
            const errorData = `data: ${JSON.stringify({ error: 'Chart not found' })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
            return;
          }

          // Step 2: Convert to Markdown
          const calculation: CalculationResult = typeof chart.chartData === 'string'
            ? JSON.parse(chart.chartData)
            : chart.chartData;
          const markdown = formatToMarkdown(calculation, { excludeSteps: true, personalityOnly: true });

          // Step 3: Build prompt and call AI service with fallback support
          const prompt = buildAnalysisPrompt(markdown, locale);

          const aiOptions: AIOptions = { locale };
          const { stream: aiStream, metadata } = await aiServiceManager.generateStream(prompt, aiOptions);

          // Step 4: Process AI stream using unified method
          const fullText = await self.processAIStream(
            aiStream,
            metadata.provider,
            controller,
            '[analyzeStream]'
          );

          // Save to cache with correct chartId and analysisType
          if (fullText) {
            await analysisCacheService.saveAnalysis(
              chartId,
              analysisType,
              { text: fullText },
              env
            );
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[analyzeStream] Error:', error);
          const errorData = `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      }
    });
  }

  /**
   * Process AI stream and convert to SSE format
   * Unified method to handle different AI providers (Azure, Gemini)
   *
   * @param aiStream - ReadableStream from AI provider
   * @param provider - AI provider name ('azure' or 'gemini')
   * @param controller - ReadableStream controller
   * @param logPrefix - Prefix for console logs
   * @returns Full text accumulated from stream
   */
  private async processAIStream(
    aiStream: ReadableStream,
    provider: 'azure' | 'gemini',
    controller: ReadableStreamDefaultController,
    logPrefix: string
  ): Promise<string> {
    if (provider === 'azure') {
      return processAzureStream(aiStream, controller, logPrefix);
    }
    return processGeminiStream(aiStream, controller, logPrefix);
  }

  /**
   * Transform Gemini streaming response to SSE format
   *
   * @deprecated This method is no longer used. analyzeStream now handles stream processing directly.
   *
   * Gemini API returns JSON array format: [{...},{...}]
   * Strategy:
   * 1. Accumulate entire response buffer
   * 2. Parse as JSON array when complete
   * 3. Extract text from each object's candidates[0].content.parts[0].text
   * 4. Send each text chunk as SSE
   *
   * @param geminiStream - ReadableStream from Gemini API
   * @param chartId - The chart ID for caching
   * @param env - Cloudflare Worker environment
   * @returns ReadableStream in SSE format
   */
  private transformToSSE(
    geminiStream: ReadableStream,
    chartId: string,
    env: { DB: D1Database }
  ): ReadableStream {
    const reader = geminiStream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const self = this; // Capture 'this' context
    return new ReadableStream({
      async start(controller) {
        try {
          // Accumulate buffer
          const buffer = await accumulateStreamBuffer(reader, decoder);

          // Parse and send response
          const fullText = await parseAndSendGeminiResponse(
            buffer,
            controller,
            encoder,
            '[transformToSSE]'
          );

          // Save to cache
          await self.saveAnalysisToCache(chartId, fullText, env);

          // Send completion
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[transformToSSE] Stream error:', error);
          controller.error(error);
        }
      }
    });
  }

  /**
   * Save analysis result to cache
   * @param chartId - Chart ID
   * @param fullText - Full analysis text
   * @param env - Cloudflare Worker environment
   */
  private async saveAnalysisToCache(
    chartId: string,
    fullText: string,
    env: { DB: D1Database }
  ): Promise<void> {
    if (fullText) {
      const analysisCacheService = new AnalysisCacheService();
      await analysisCacheService.saveAnalysis(
        chartId,
        'ai-streaming',
        { text: fullText },
        env
      );
    }
  }

  /**
   * Check if advanced analysis cache exists for a chart
   * @param chartId - The chart ID to check
   * @param env - Cloudflare Worker environment
   * @param locale - Language locale (zh-TW or en, default: zh-TW)
   * @returns Object with cached status
   */
  async checkAdvancedCache(chartId: string, env: { DB: D1Database }, locale = 'zh-TW'): Promise<{ cached: boolean }> {
    // HOTFIX: Add analysis mode to cache key to prevent personality/fortune cross-contamination
    const analysisType = `ai-advanced-${locale}-fortune`;
    const cachedAnalysis = await this.advancedAnalysisCacheService.getAnalysis(chartId, analysisType, env);
    return { cached: !!cachedAnalysis };
  }

  /**
   * Analyze astrological chart with advanced streaming AI response
   *
   * @param chartId - The chart ID to analyze
   * @param env - Cloudflare Worker environment with DB binding
   * @param locale - Language locale (zh-TW or en, default: zh-TW)
   * @param force - Force regeneration, bypassing cache (default: false)
   * @returns ReadableStream in SSE format
   */
  async analyzeAdvancedStream(chartId: string, env: { DB: D1Database }, locale = 'zh-TW', force = false): Promise<ReadableStream> {

    // HOTFIX: Add analysis mode to cache key to prevent personality/fortune cross-contamination
    const analysisType = `ai-advanced-${locale}-fortune`;
    const cachedAnalysis = await this.advancedAnalysisCacheService.getAnalysis(chartId, analysisType, env);
    if (cachedAnalysis) {
      if (force) {
      } else {
      }
      const cachedText = typeof cachedAnalysis.result === 'string'
        ? cachedAnalysis.result
        : (cachedAnalysis.result as CachedAnalysisResult).text;
      return createCachedSSEStream(cachedText, force);
    }

    // Step 1: Read chart data from D1
    const chart = await this.chartCacheService.getChart(chartId, env);
    if (!chart) {
      throw new Error('Chart not found');
    }

    // Step 2: Convert to Advanced Markdown
    const calculation: CalculationResult = typeof chart.chartData === 'string'
      ? JSON.parse(chart.chartData)
      : chart.chartData;
    const advancedMarkdown = formatAdvancedMarkdown(calculation);

    // Step 3: Build prompt and call AI service with fallback support
    const prompt = buildAdvancedAnalysisPrompt(advancedMarkdown, locale);

    const aiOptions: AIOptions = { locale };
    const { stream: aiStream, metadata } = await this.aiServiceManager.generateStream(prompt, aiOptions);

    // Step 4: Transform to SSE format with advanced cache
    return this.transformAdvancedToSSE(aiStream, chartId, analysisType, env, metadata.provider);
  }

  /**
   * Transform AI advanced streaming response to SSE format
   *
   * Similar to transformToSSE but saves to advancedAnalysisCacheService
   * Handles both Azure OpenAI (text stream) and Gemini (JSON array) formats
   *
   * @param aiStream - ReadableStream from AI provider
   * @param chartId - The chart ID for caching
   * @param analysisType - The analysis type (e.g., 'ai-advanced-zh-TW', 'ai-advanced-en')
   * @param env - Cloudflare Worker environment
   * @param provider - AI provider name ('azure' or 'gemini')
   * @returns ReadableStream in SSE format
   */
  private transformAdvancedToSSE(
    aiStream: ReadableStream,
    chartId: string,
    analysisType: string,
    env: { DB: D1Database },
    provider: 'azure' | 'gemini'
  ): ReadableStream {
    const encoder = new TextEncoder();

    const self = this; // Capture 'this' context
    return new ReadableStream({
      async start(controller) {
        try {
          // Use unified processAIStream method
          const fullText = await self.processAIStream(
            aiStream,
            provider,
            controller,
            '[transformAdvancedToSSE]'
          );

          // Save complete advanced analysis to D1
          if (fullText) {
            const advancedAnalysisCacheService = new AdvancedAnalysisCacheService();
            await advancedAnalysisCacheService.saveAnalysis(
              chartId,
              analysisType,
              { text: fullText },
              env
            );
          }

          // Send completion event
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[transformAdvancedToSSE] Stream error:', error);
          controller.error(error);
        }
      }
    });
  }

}
