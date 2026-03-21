/**
 * Analyze Routes
 * Provides AI-powered analysis endpoint
 */

import type { Router, IRequest } from 'itty-router';
import type { Env } from '../index';
import { AnalyzeController, type AnalyzeRequest } from '../controllers/analyzeController';
import { GeminiService } from '../services/geminiService';
import { AzureOpenAIService } from '../services/azureOpenAIService';
import { AIServiceManager } from '../services/aiServiceManager';
import { AgenticGeminiService } from '../services/agenticGeminiService';
import { AgenticAzureService } from '../services/agenticAzureService';
import { ChartCacheService } from '../services/chartCacheService';
import { DailyQuestionLimitService } from '../services/dailyQuestionLimitService';
import { AnalyticsService } from '../services/analyticsService';

/**
 * Configure Azure OpenAI fallback provider
 */
function configureAzureFallback(env: Env): AzureOpenAIService | undefined {
  const azureEndpoint = env.AZURE_OPENAI_ENDPOINT?.trim();
  const azureApiKey = env.AZURE_OPENAI_API_KEY?.trim();

  if (!azureApiKey || !azureEndpoint || azureEndpoint === '') {
    if (!azureApiKey) {
    }
    if (!azureEndpoint || azureEndpoint === '') {
    }
    return undefined;
  }

  const service = new AzureOpenAIService({
    apiKey: azureApiKey,
    endpoint: azureEndpoint,
    deployment: env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini',
    apiVersion: env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
  });

  return service;
}

/**
 * Initialize AI services with fallback support
 */
function initializeAIServices(env: Env): { manager: AIServiceManager } {
  // Initialize primary provider (Gemini)
  const geminiService = new GeminiService({
    apiKey: env.GEMINI_API_KEY || '',
    model: 'gemini-3-flash-preview',
    maxRetries: 3,
  });

  // Initialize fallback provider (Azure OpenAI) if configured
  const fallbackProvider = configureAzureFallback(env);

  // Create AI service manager
  const manager = new AIServiceManager({
    primaryProvider: geminiService,
    fallbackProvider,
    enableFallback: env.ENABLE_AI_FALLBACK !== false, // Default: true
    maxRetries: 3,
    timeout: env.AI_PROVIDER_TIMEOUT_MS || 45000,
  });

  return { manager };
}

export function createAnalyzeRoutes(router: Router, env: Env, ctx: ExecutionContext) {
  /**
   * POST /api/v1/daily-insight/check
   *
   * Check if user has already asked a daily question today
   */
  router.post('/api/v1/daily-insight/check', async (req: IRequest) => {
    try {
      const body = await req.json() as { chartId?: string };
      const {chartId} = body;

      if (!chartId) {
        return new Response(
          JSON.stringify({ error: 'Missing chartId parameter' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check daily limit using existing service
      const dailyLimitService = new DailyQuestionLimitService(env.DB);
      const hasAskedToday = await dailyLimitService.hasAskedToday(chartId);

      return new Response(
        JSON.stringify({ hasAskedToday }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('[daily-insight/check] Error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });

  /**
   * POST /api/v1/analyze
   * 
   * Calculates astrological chart and provides AI-powered analysis
   * 
   * Request body:
   * {
   *   birthDate: string (YYYY-MM-DD)
   *   birthTime: string (HH:mm)
   *   gender: 'male' | 'female'
   *   longitude?: number (default: 121.5)
   *   isLeapMonth?: boolean (default: false)
   * }
   * 
   * Response:
   * {
   *   calculation: CalculationResult
   *   aiAnalysis: string
   *   usage?: { promptTokens, completionTokens, totalTokens }
   * }
   */
  router.post('/api/v1/analyze', async (req: IRequest) => {
    try {
      // Initialize AI services
      const { manager } = initializeAIServices(env);

      if (!env.GEMINI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Gemini API key not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const controller = new AnalyzeController(manager);
      const input = await req.json() as AnalyzeRequest;
      const result = await controller.analyze(input);

      return result; // AutoRouter will convert to JSON Response
    } catch (error) {
      console.error('Analyze error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });

  /**
   * GET /api/v1/analyze/check
   *
   * Checks if analysis cache exists for a chart
   *
   * Query params:
   * - chartId: string (required)
   *
   * Response:
   * {
   *   cached: boolean
   * }
   */
  router.get('/api/v1/analyze/check', async (req: IRequest) => {
    try {
      const url = new URL(req.url);
      const chartId = url.searchParams.get('chartId');
      const locale = url.searchParams.get('locale') || 'zh-TW';

      if (!chartId) {
        return new Response(
          JSON.stringify({ error: 'chartId is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { manager } = initializeAIServices(env);
      const controller = new AnalyzeController(manager);
      const result = await controller.checkCache(chartId, env, locale);

      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('Check cache error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to check cache' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });

  /**
   * GET /api/v1/analyze/stream
   *
   * Streams AI-powered analysis for an existing chart using Server-Sent Events (SSE)
   *
   * Query parameters:
   * - chartId: string (required) - The ID of the chart to analyze
   * - locale: string (optional) - Language locale (zh-TW or en, default: zh-TW)
   *
   * Response:
   * - Content-Type: text/event-stream
   * - Format: SSE events with incremental analysis text
   * - Final event: "data: [DONE]\n\n"
   */
  router.get('/api/v1/analyze/stream', async (req: IRequest) => {
    try {
      // Parse URL and get chartId from query params
      const url = new URL(req.url);
      const chartId = url.searchParams.get('chartId');
      const locale = url.searchParams.get('locale') || 'zh-TW';
      const force = url.searchParams.get('force') === 'true';

      // Validate chartId
      if (!chartId) {
        return new Response(
          JSON.stringify({ error: 'Missing chartId parameter' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Initialize AI services
      const { manager } = initializeAIServices(env);

      if (!env.GEMINI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Gemini API key not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check if there's a cached analysis to get the timestamp
      const { manager: timestampManager } = initializeAIServices(env);
      const timestampController = new AnalyzeController(timestampManager);
      const analysisType = `ai-streaming-${locale}-personality`;

      // Import cache service to check for existing timestamp
      const { AnalysisCacheService: TimestampCacheService } = await import('../services/analysisCacheService');
      const timestampCacheService = new TimestampCacheService();
      const cachedAnalysis = await timestampCacheService.getAnalysis(chartId, analysisType, env);

      // Create controller and call analyzeStream with force parameter
      const controller = new AnalyzeController(manager);
      const stream = await controller.analyzeStream(chartId, env, locale, force);

      // Build response headers with optional timestamp
      const headers: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      // Add timestamp header if cached analysis exists
      if (cachedAnalysis) {
        headers['X-Generated-At'] = cachedAnalysis.createdAt;
        headers['Access-Control-Expose-Headers'] = 'X-Generated-At';
      }

      // Return Response with SSE headers
      return new Response(stream, { headers });
    } catch (error) {
      console.error('Analyze stream error:', error);

      // Convert error to Peixuan-style message (locale-aware)
      let errorMessage = locale === 'zh-TW'
        ? '哎呀～佩璇遇到了一些小問題呢...'
        : 'Oops, Peixuan encountered a small issue...';

      if (error instanceof Error) {
        const errMsg = error.message.toLowerCase();

        // Handle quota exceeded (429)
        if (errMsg.includes('quota') || errMsg.includes('429')) {
          // Try to extract retry delay
          const retryMatch = error.message.match(/retry in (\d+)/i);
          if (retryMatch) {
            const seconds = parseInt(retryMatch[1]);
            const minutes = Math.ceil(seconds / 60);
            errorMessage = locale === 'zh-TW'
              ? `佩璇累了，需要休息一下喔～請等 ${minutes} 分鐘後再來找我吧！✨`
              : `Peixuan needs a rest~ Please try again in ${minutes} minutes! ✨`;
          } else {
            errorMessage = locale === 'zh-TW'
              ? '佩璇今天太忙了，需要休息一下～請稍後再來找我喔！💫'
              : 'Peixuan is quite busy today~ Please try again later! 💫';
          }
        }
        // Handle other errors
        else if (errMsg.includes('not found')) {
          errorMessage = locale === 'zh-TW'
            ? '咦？佩璇找不到你的命盤資料耶...要不要重新算一次呢？🔮'
            : 'Hmm? Peixuan cannot find your chart... Would you like to recalculate? 🔮';
        } else if (errMsg.includes('timeout')) {
          errorMessage = locale === 'zh-TW'
            ? '哎呀～佩璇算得太專心，時間有點久了...要不要再試一次呢？⏰'
            : 'Oops~ Peixuan was too focused, took a bit long... Try again? ⏰';
        } else {
          errorMessage = locale === 'zh-TW'
            ? `佩璇遇到了一些小狀況：${error.message} 💭`
            : `Peixuan encountered an issue: ${error.message} 💭`;
        }
      }

      // Return error in SSE format
      const errorStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.close();
        }
      });

      return new Response(errorStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  });

  /**
   * GET /api/v1/analyze/advanced/check
   *
   * Checks if advanced analysis cache exists for a chart
   *
   * Query params:
   * - chartId: string (required)
   *
   * Response:
   * {
   *   cached: boolean
   * }
   */
  router.get('/api/v1/analyze/advanced/check', async (req: IRequest) => {
    try {
      const url = new URL(req.url);
      const chartId = url.searchParams.get('chartId');
      const locale = url.searchParams.get('locale') || 'zh-TW';

      if (!chartId) {
        return new Response(
          JSON.stringify({ error: 'chartId is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { manager } = initializeAIServices(env);
      const controller = new AnalyzeController(manager);
      const result = await controller.checkAdvancedCache(chartId, env, locale);

      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('Check advanced cache error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to check advanced cache' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });

  /**
   * GET /api/v1/analyze/advanced/stream
   *
   * Streams advanced AI-powered analysis for an existing chart using Server-Sent Events (SSE)
   *
   * Query parameters:
   * - chartId: string (required) - The ID of the chart to analyze
   * - locale: string (optional) - Language locale (zh-TW or en, default: zh-TW)
   *
   * Response:
   * - Content-Type: text/event-stream
   * - Format: SSE events with incremental advanced analysis text
   * - Final event: "data: [DONE]\n\n"
   */
  router.get('/api/v1/analyze/advanced/stream', async (req: IRequest) => {
    try {
      // Parse URL and get chartId from query params
      const url = new URL(req.url);
      const chartId = url.searchParams.get('chartId');
      const locale = url.searchParams.get('locale') || 'zh-TW';
      const force = url.searchParams.get('force') === 'true';

      // Validate chartId
      if (!chartId) {
        return new Response(
          JSON.stringify({ error: 'Missing chartId parameter' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Initialize AI services
      const { manager } = initializeAIServices(env);

      if (!env.GEMINI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Gemini API key not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check if there's a cached advanced analysis to get the timestamp
      const advancedAnalysisType = `ai-advanced-${locale}-fortune`;

      // Import cache service to check for existing timestamp
      const { AdvancedAnalysisCacheService: AdvancedTimestampCacheService } = await import('../services/advancedAnalysisCacheService');
      const advancedTimestampCacheService = new AdvancedTimestampCacheService();
      const cachedAdvancedAnalysis = await advancedTimestampCacheService.getAnalysis(chartId, advancedAnalysisType, env);

      // Create controller and call analyzeAdvancedStream with force parameter
      const controller = new AnalyzeController(manager);
      const stream = await controller.analyzeAdvancedStream(chartId, env, locale, force);

      // Build response headers with optional timestamp
      const headers: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      // Add timestamp header if cached advanced analysis exists
      if (cachedAdvancedAnalysis) {
        headers['X-Generated-At'] = cachedAdvancedAnalysis.createdAt;
        headers['Access-Control-Expose-Headers'] = 'X-Generated-At';
      }

      // Return Response with SSE headers
      return new Response(stream, { headers });
    } catch (error) {
      console.error('Analyze advanced stream error:', error);

      // Convert error to Peixuan-style message (locale-aware)
      let errorMessage = locale === 'zh-TW'
        ? '哎呀～佩璇遇到了一些小問題呢...'
        : 'Oops, Peixuan encountered a small issue...';

      if (error instanceof Error) {
        const errMsg = error.message.toLowerCase();

        // Handle quota exceeded (429)
        if (errMsg.includes('quota') || errMsg.includes('429')) {
          const retryMatch = error.message.match(/retry in (\d+)/i);
          if (retryMatch) {
            const seconds = parseInt(retryMatch[1]);
            const minutes = Math.ceil(seconds / 60);
            errorMessage = locale === 'zh-TW'
              ? `佩璇累了，需要休息一下喔～請等 ${minutes} 分鐘後再來找我吧！✨`
              : `Peixuan needs a rest~ Please try again in ${minutes} minutes! ✨`;
          } else {
            errorMessage = locale === 'zh-TW'
              ? '佩璇今天太忙了，需要休息一下～請稍後再來找我喔！💫'
              : 'Peixuan is quite busy today~ Please try again later! 💫';
          }
        }
        else if (errMsg.includes('not found')) {
          errorMessage = locale === 'zh-TW'
            ? '咦？佩璇找不到你的命盤資料耶...要不要重新算一次呢？🔮'
            : 'Hmm? Peixuan cannot find your chart... Would you like to recalculate? 🔮';
        } else if (errMsg.includes('timeout')) {
          errorMessage = locale === 'zh-TW'
            ? '哎呀～佩璇算得太專心，時間有點久了...要不要再試一次呢？⏰'
            : 'Oops~ Peixuan was too focused, took a bit long... Try again? ⏰';
        } else {
          errorMessage = locale === 'zh-TW'
            ? `佩璇遇到了一些小狀況：${error.message} 💭`
            : `Peixuan encountered an issue: ${error.message} 💭`;
        }
      }

      // Return error in SSE format
      const errorStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.close();
        }
      });

      return new Response(errorStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  });

  /**
   * POST /api/v1/daily-insight/stream
   *
   * Streams daily insight with agentic AI reasoning using Server-Sent Events (SSE)
   * Supports automatic fallback from Gemini to Azure OpenAI on rate limit/service unavailable errors
   *
   * Request body:
   * - chartId: string (required) - The ID of the chart to analyze
   * - question: string (required) - User's daily question (kept private, not logged in URLs)
   * - locale: string (optional) - Language locale (zh-TW or en, default: zh-TW)
   *
   * Response:
   * - Content-Type: text/event-stream
   * - Format: SSE events with agent state updates and final answer
   * - State updates: { state: string } - Agent's current action
   * - Text chunks: { text: string } - Incremental answer
   * - Final event: "data: [DONE]\n\n"
   */
  router.post('/api/v1/daily-insight/stream', async (req: IRequest) => {
    try {
      // Parse request body
      const body = await req.json() as { chartId?: string; question?: string; locale?: string };
      const {chartId} = body;
      const {question} = body;
      const locale = body.locale || 'zh_TW';
      // Normalize locale format (support both zh_TW and zh-TW)
      const normalizedLocale = locale.replace('_', '-');

      // Log only metadata, not the sensitive question content

      // Validate required parameters
      if (!chartId) {
        return new Response(
          JSON.stringify({ error: 'Missing chartId parameter' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!question) {
        return new Response(
          JSON.stringify({ error: 'Missing question parameter' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check daily limit before processing
      const limitService = new DailyQuestionLimitService(env.DB);
      const hasAskedToday = await limitService.hasAskedToday(chartId);
      
      if (hasAskedToday) {
        return new Response(
          JSON.stringify({ 
            error: 'Daily limit exceeded', 
            message: 'You have already asked a question today. Please try again tomorrow.' 
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check daily limit
      const hasExceededLimit = await limitService.checkDailyLimit(chartId);

      if (hasExceededLimit) {
        const hoursUntilNext = limitService.getTimeUntilNextQuestion();
        const errorMessage = locale === 'zh-TW'
          ? `今天已經問過佩璇了喔～明天再來問新問題吧！還有 ${hoursUntilNext} 小時就可以再問囉 ✨`
          : `You've already asked Peixuan today~ Come back tomorrow for a new question! ${hoursUntilNext} hours to go ✨`;

        return new Response(
          JSON.stringify({ error: errorMessage, code: 'DAILY_LIMIT_EXCEEDED' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Fetch chart data from cache
      const chartCacheService = new ChartCacheService();
      const chart = await chartCacheService.getChart(chartId, env);

      if (!chart) {
        return new Response(
          JSON.stringify({ error: 'Chart not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Parse chart calculation result
      const calculationResult = typeof chart.chartData === 'string'
        ? JSON.parse(chart.chartData)
        : chart.chartData;

      // Get user's recent conversation history (with 500ms timeout protection)
      let historyContext = "";
      let hasMemoryContext = false;
      let memoryReference = "";
      try {
        const { drizzle } = await import('drizzle-orm/d1');
        const schema = await import('../db/schema');
        const db = drizzle(env.DB, { schema });
        const analyticsService = new AnalyticsService(db);

        // Race between getUserRecentContext and 500ms timeout
        const contextPromise = analyticsService.getUserRecentContext(chartId, 3);
        const timeoutPromise = new Promise<string>((resolve) =>
          setTimeout(() => resolve(""), 500)
        );

        historyContext = await Promise.race([contextPromise, timeoutPromise]);

        // Set memory metadata based on context availability
        hasMemoryContext = historyContext.length > 0;

        // Extract memory reference from context if available
        if (hasMemoryContext) {
          // Extract the most recent topic from history context
          // Format: "[歷史對話 N - Date]\nQ: question\nA: answer"
          const questionMatch = historyContext.match(/Q:\s*([^\n]+)/);
          if (questionMatch) {
            const recentQuestion = questionMatch[1];
            // Use first 50 chars as reference
            memoryReference = recentQuestion.length > 50
              ? `${recentQuestion.substring(0, 47)  }...`
              : recentQuestion;
          } else {
            memoryReference = normalizedLocale === 'zh-TW'
              ? '最近的對話'
              : 'Recent conversation';
          }
        }

      } catch (error) {
        console.error('[Daily Insight] Failed to fetch history context (non-blocking):', error);
        // Gracefully degrade - continue without context
      }

      let stream: ReadableStream;
      let usedFallback = false;

      // Try Gemini first
      if (env.GEMINI_API_KEY) {
        try {
          
          // Prepare Azure fallback service
          let azureFallback;
          if (env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_API_KEY) {
            const { AgenticAzureService } = await import('../services/agenticAzureService');
            azureFallback = new AgenticAzureService({
              endpoint: env.AZURE_OPENAI_ENDPOINT,
              apiKey: env.AZURE_OPENAI_API_KEY,
              deployment: env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini',
              apiVersion: env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
              maxRetries: 3,
              maxIterations: 8
            });
          }

          const agenticService = new AgenticGeminiService(
            env.GEMINI_API_KEY,
            'gemini-3-flash-preview',
            3,  // maxRetries
            8,  // maxIterations
            azureFallback  // Fallback service
          );

          // Generate daily insight stream with Gemini (with built-in Azure fallback)
          stream = await agenticService.generateDailyInsight(
            question,
            calculationResult,
            normalizedLocale,
            historyContext,
            { env, ctx, chartId, hasMemoryContext, memoryReference }
          );

        } catch (error) {
          // Check if this is an error that should trigger Azure fallback
          // (only as outer safety net, inner fallback should catch most cases)
          const shouldFallback = error instanceof Error &&
            (error.message.includes('429') ||
             error.message.includes('503') ||
             error.message.includes('500') ||
             error.message.toLowerCase().includes('quota') ||
             error.message.toLowerCase().includes('resource has been exhausted') ||
             error.message.toLowerCase().includes('unavailable'));

          if (shouldFallback && env.ENABLE_AI_FALLBACK !== false) {

            // Configure Azure fallback as safety net
            const azureEndpoint = env.AZURE_OPENAI_ENDPOINT?.trim();
            const azureApiKey = env.AZURE_OPENAI_API_KEY?.trim();

            if (azureApiKey && azureEndpoint) {
              const azureService = new AgenticAzureService({
                endpoint: azureEndpoint,
                apiKey: azureApiKey,
                deployment: env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini',
                apiVersion: env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
                maxRetries: 3,
                maxIterations: 8
              });

              stream = await azureService.generateDailyInsight(
                question,
                calculationResult,
                normalizedLocale,
                historyContext,
                { env, ctx, fallbackReason: error.message, chartId, hasMemoryContext, memoryReference }
              );
              usedFallback = true;
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'No AI providers configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (usedFallback) {
      }

      // Record the daily question (async, don't wait)
      limitService.recordDailyQuestion(chartId, question, 'SSE stream completed').catch(err => {
        console.error('[Daily Insight] Failed to record question:', err);
      });

      // Return SSE stream
      return new Response(stream!, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });

    } catch (error) {
      console.error('[Daily Insight] Error:', error);

      // Convert error to Peixuan-style message (locale-aware)
      let errorMessage = locale === 'zh-TW'
        ? '哎呀～佩璇在分析每日問題時遇到了一些小狀況...'
        : 'Oops~ Peixuan encountered an issue while analyzing your daily question...';

      if (error instanceof Error) {
        const errMsg = error.message.toLowerCase();

        if (errMsg.includes('quota') || errMsg.includes('429')) {
          errorMessage = locale === 'zh-TW'
            ? '佩璇今天太忙了,需要休息一下～請稍後再來找我喔！💫'
            : 'Peixuan is quite busy today~ Please try again later! 💫';
        } else if (errMsg.includes('not found')) {
          errorMessage = locale === 'zh-TW'
            ? '咦？佩璇找不到你的命盤資料耶...要不要重新算一次呢？🔮'
            : 'Hmm? Peixuan cannot find your chart... Would you like to recalculate? 🔮';
        } else if (errMsg.includes('timeout')) {
          errorMessage = locale === 'zh-TW'
            ? '哎呀～佩璇思考得太投入,時間有點久了...要不要再試一次呢？⏰'
            : 'Oops~ Peixuan was too deep in thought, took a bit long... Try again? ⏰';
        } else {
          errorMessage = locale === 'zh-TW'
            ? `佩璇遇到了一些小狀況：${error.message} 💭`
            : `Peixuan encountered an issue: ${error.message} 💭`;
        }
      }

      // Return error in SSE format
      const errorStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.close();
        }
      });

      return new Response(errorStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  });
}
