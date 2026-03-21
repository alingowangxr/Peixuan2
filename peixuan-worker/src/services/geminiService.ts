/**
 * Gemini AI Service
 * Provides AI-powered astrological analysis using Google Gemini
 */

import type { AIProvider, AIOptions, AIResponse, AIErrorCode } from '../types/aiTypes';
import { AIProviderError } from '../types/aiTypes';

interface AbortControllerGlobal {
  AbortController: typeof globalThis.AbortController;
}

interface ErrorDetail {
  '@type'?: string;
  retryDelay?: string;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
}

export interface GeminiResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Gemini AI Service for astrological analysis
 * Implements AIProvider interface for unified AI service management
 */
export class GeminiService implements AIProvider {
  private apiKey: string;
  private model: string;
  private maxRetries: number;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-3-flash-preview';
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Get provider name (AIProvider interface)
   */
  getName(): string {
    return 'gemini';
  }

  /**
   * Check if provider is available (AIProvider interface)
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate streaming response (AIProvider interface)
   * @param prompt - Input prompt
   * @param options - Generation options
   * @returns ReadableStream of text chunks
   */
  async generateStream(prompt: string, options?: AIOptions): Promise<ReadableStream> {
    const url = `${this.baseUrl}/${this.model}:streamGenerateContent`;

    const body = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: options?.temperature ?? 0.85,
        topK: options?.topK ?? 40,
        topP: options?.topP ?? 0.95,
        maxOutputTokens: options?.maxTokens ?? 6144,
      },
    });

    return this.callGeminiStreamWithRetry(url, body, '[Gemini Stream]');
  }

  /**
   * Generate non-streaming response (AIProvider interface)
   * @param prompt - Input prompt
   * @param options - Generation options
   * @returns AI response with text and metadata
   */
  async generate(prompt: string, options?: AIOptions): Promise<AIResponse> {
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.callGemini(prompt, options);
        const latencyMs = Date.now() - startTime;

        return {
          text: response.text,
          metadata: {
            provider: 'gemini',
            fallbackTriggered: false,
            latencyMs,
            usage: response.usage,
          },
        };
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw this.convertToAIProviderError(error);
        }
        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw new AIProviderError('Unexpected error in generate', 'UNKNOWN_ERROR' as AIErrorCode);
  }

  /**
   * Analyze astrological chart using Gemini AI
   *
   * @param prompt - Pre-built prompt string
   * @returns AI-generated analysis
   */
  async analyzeChart(prompt: string): Promise<GeminiResponse> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.callGemini(prompt);
        return response;
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw new Error(`Gemini API failed after ${this.maxRetries} attempts: ${error}`);
        }
        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw new Error('Unexpected error in analyzeChart');
  }

  /**
   * Analyze astrological chart using Gemini AI with streaming
   *
   * @param prompt - Pre-built prompt string
   * @returns ReadableStream of AI-generated analysis
   */
  async analyzeChartStream(prompt: string): Promise<ReadableStream> {
    const url = `${this.baseUrl}/${this.model}:streamGenerateContent`;

    const body = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 6144,  // Increased for comprehensive personality analysis
      },
    });

    return this.callGeminiStreamWithRetry(url, body, '[Gemini Stream]');
  }

  /**
   * Analyze advanced astrological data using Gemini AI with streaming
   *
   * @param prompt - Pre-built prompt string
   * @returns ReadableStream of AI-generated analysis
   */
  async analyzeAdvancedStream(prompt: string): Promise<ReadableStream> {
    const url = `${this.baseUrl}/${this.model}:streamGenerateContent`;

    const body = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 6144,  // Increased to match personality analysis
      },
    });

    return this.callGeminiStreamWithRetry(url, body, '[Gemini Advanced Stream]');
  }

  /**
   * Internal method to call Gemini Stream with retry logic
   */
  private async callGeminiStreamWithRetry(url: string, body: string, logPrefix = '[Gemini Stream]'): Promise<ReadableStream> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new (globalThis as AbortControllerGlobal).AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout per attempt

      try {
        this.logAttempt(attempt, url, logPrefix);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return this.handleSuccessfulResponse(response, logPrefix);
        }

        await this.handleErrorResponse(response, attempt, logPrefix);

      } catch (error: unknown) {
        clearTimeout(timeoutId);
        this.handleFetchException(error, attempt);
      }

      const backoff = Math.pow(2, attempt) * 1000;
      await this.sleep(backoff);
    }

    throw new Error('Unexpected error in callGeminiStreamWithRetry');
  }

  /**
   * Log retry attempt information
   */
  private logAttempt(attempt: number, url: string, logPrefix: string): void {
    if (attempt > 1) {
    } else {
    }
  }

  /**
   * Handle successful streaming response
   */
  private handleSuccessfulResponse(response: Response, logPrefix: string): ReadableStream {
    if (!response.body) {
      console.error(`${logPrefix} No response body received`);
      throw new Error('No response body from Gemini streaming API');
    }
    return response.body;
  }

  /**
   * Handle error response from Gemini API
   */
  private async handleErrorResponse(response: Response, attempt: number, logPrefix: string): Promise<void> {
    const errorText = await response.text();
    console.error(`${logPrefix} Error response (Attempt ${attempt}): ${errorText}`);

    // Stop retrying if it's a client error (4xx), unless it's 429 (Too Many Requests)
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      throw new Error(`Gemini streaming API error (${response.status} ${response.statusText}): ${errorText}`);
    }

    // For 503, 429, or other server errors, we continue to retry loop unless it's the last attempt
    if (attempt === this.maxRetries) {
      this.throwEnhancedError(errorText, response.status, response.statusText);
    }
  }

  /**
   * Parse error JSON and throw enhanced error with retry delay if available
   */
  private throwEnhancedError(errorText: string, status: number, statusText: string): never {
    let errorMessage = `Gemini streaming API error (${status} ${statusText}): ${errorText}`;
    let retryAfter: number | undefined;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) {
        errorMessage = errorJson.error.message || 'Unknown error';
        if (errorJson.error.details) {
          const retryInfo = errorJson.error.details.find((d: ErrorDetail) => d['@type']?.includes('RetryInfo'));
          if (retryInfo?.retryDelay) {
            const seconds = parseInt(retryInfo.retryDelay.replace('s', ''));
            retryAfter = seconds;
            errorMessage += ` Please retry in ${seconds}s`;
          }
        }
      }
    } catch {
      // If JSON parsing fails, use the raw error text
    }

    // Convert to AIProviderError with appropriate error code
    let code: AIErrorCode;
    if (status === 429) {
      code = AIErrorCode.RATE_LIMIT_EXCEEDED;
    } else if (status === 503) {
      code = AIErrorCode.SERVICE_UNAVAILABLE;
    } else if (status === 401 || status === 403) {
      code = AIErrorCode.AUTH_ERROR;
    } else if (status === 400) {
      code = AIErrorCode.INVALID_REQUEST;
    } else {
      code = AIErrorCode.UNKNOWN_ERROR;
    }

    throw new AIProviderError(errorMessage, code, status, retryAfter);
  }

  /**
   * Handle exceptions during fetch
   */
  private handleFetchException(error: unknown, attempt: number): void {
    const err = error as Error;

    if (attempt === this.maxRetries) {
      if (err.name === 'AbortError') {
        throw new Error('Request timeout - Gemini API took too long to respond');
      }
      throw error;
    }

    const backoff = Math.pow(2, attempt) * 1000;
  }

  /**
   * Convert error to AIProviderError
   */
  private convertToAIProviderError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }

    const err = error as Error & { statusCode?: number };
    let code: AIErrorCode = 'UNKNOWN_ERROR' as AIErrorCode;

    if (err.message?.includes('timeout') || err.name === 'AbortError') {
      code = 'TIMEOUT' as AIErrorCode;
    } else if (err.message?.includes('429')) {
      code = 'RATE_LIMIT_EXCEEDED' as AIErrorCode;
    } else if (err.message?.includes('503')) {
      code = 'SERVICE_UNAVAILABLE' as AIErrorCode;
    } else if (err.message?.includes('401') || err.message?.includes('403')) {
      code = 'AUTH_ERROR' as AIErrorCode;
    } else if (err.message?.includes('400')) {
      code = 'INVALID_REQUEST' as AIErrorCode;
    }

    return new AIProviderError(
      err.message || 'Unknown error',
      code,
      err.statusCode,
    );
  }

  /**
   * Call Gemini API
   */
  private async callGemini(prompt: string, options?: AIOptions): Promise<GeminiResponse> {
    const startTime = Date.now();
    const url = `${this.baseUrl}/${this.model}:generateContent`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: options?.temperature ?? 0.85,
            topK: options?.topK ?? 40,
            topP: options?.topP ?? 0.95,
            maxOutputTokens: options?.maxTokens ?? 6144,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        const errorTime = Date.now();
        throw new Error(`Gemini API error (${response.status}): ${error}`);
      }

      const data = await response.json() as GeminiApiResponse;

      // Debug: log response structure

      // Extract text from response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!text) {
        console.error('[Gemini] No text found. Full response:', JSON.stringify(data));
        throw new Error('No text in Gemini response');
      }

      // Extract usage info if available
      const usage = data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined;

      // Performance monitoring: Token usage and response time
      const responseTime = Date.now() - startTime;
      if (usage) {
        const estimatedCost = (usage.promptTokens * 0.000075 + usage.completionTokens * 0.0003) / 1000;
      }

      return { text, usage };
    } catch (error) {
      const errorTime = Date.now();
      throw error;
    }
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
