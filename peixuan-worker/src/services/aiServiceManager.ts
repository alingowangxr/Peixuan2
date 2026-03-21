/**
 * AI Service Manager
 * Manages multiple AI providers with automatic fallback support
 */

import {
  type AIProvider,
  type AIOptions,
  type AIResponse,
  type AIServiceConfig,
  type AIResponseMetadata,
  AIProviderError,
} from '../types/aiTypes';

/**
 * AI Service Manager
 * Provides unified interface for AI generation with automatic fallback
 */
export class AIServiceManager {
  private primaryProvider: AIProvider;
  private fallbackProvider?: AIProvider;
  private enableFallback: boolean;
  private maxRetries: number;
  private timeout: number;

  constructor(config: AIServiceConfig) {
    this.primaryProvider = config.primaryProvider;
    this.fallbackProvider = config.fallbackProvider;
    this.enableFallback = config.enableFallback ?? true;
    this.maxRetries = config.maxRetries ?? 3;
    this.timeout = config.timeout ?? 45000;
  }

  /**
   * Generate streaming response with automatic fallback
   *
   * @param prompt - Input prompt
   * @param options - Generation options
   * @returns ReadableStream of text chunks with metadata
   */
  async generateStream(
    prompt: string,
    options?: AIOptions,
  ): Promise<{ stream: ReadableStream; metadata: AIResponseMetadata }> {
    const startTime = Date.now();

    try {
      const stream = await this.primaryProvider.generateStream(prompt, {
        ...options,
        timeout: options?.timeout ?? this.timeout,
      });

      const latencyMs = Date.now() - startTime;

      return {
        stream,
        metadata: {
          provider: this.primaryProvider.getName() as 'gemini' | 'azure',
          fallbackTriggered: false,
          latencyMs,
        },
      };
    } catch (error) {
      console.error(
        `[AI Manager] Primary provider failed: ${this.primaryProvider.getName()}`,
        error,
      );

      // Check if we should try fallback
      if (!this.shouldTryFallback(error)) {
        throw error;
      }

      // Try fallback provider
      if (this.fallbackProvider && this.fallbackProvider.isAvailable()) {

        try {
          const fallbackStartTime = Date.now();
          const stream = await this.fallbackProvider.generateStream(prompt, {
            ...options,
            timeout: options?.timeout ?? this.timeout,
          });

          const latencyMs = Date.now() - fallbackStartTime;
          const totalLatencyMs = Date.now() - startTime;

          return {
            stream,
            metadata: {
              provider: this.fallbackProvider.getName() as 'gemini' | 'azure',
              fallbackTriggered: true,
              latencyMs: totalLatencyMs,
            },
          };
        } catch (fallbackError) {
          console.error(
            `[AI Manager] Fallback provider also failed: ${this.fallbackProvider.getName()}`,
            fallbackError,
          );
          throw fallbackError;
        }
      }

      // No fallback available, throw original error
      throw error;
    }
  }

  /**
   * Generate non-streaming response with automatic fallback
   *
   * @param prompt - Input prompt
   * @param options - Generation options
   * @returns AI response with text and metadata
   */
  async generate(prompt: string, options?: AIOptions): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await this.primaryProvider.generate(prompt, {
        ...options,
        timeout: options?.timeout ?? this.timeout,
      });

      const latencyMs = Date.now() - startTime;

      return {
        ...response,
        metadata: {
          ...response.metadata,
          fallbackTriggered: false,
          latencyMs,
        },
      };
    } catch (error) {
      console.error(
        `[AI Manager] Primary provider failed: ${this.primaryProvider.getName()}`,
        error,
      );

      // Check if we should try fallback
      if (!this.shouldTryFallback(error)) {
        throw error;
      }

      // Try fallback provider
      if (this.fallbackProvider && this.fallbackProvider.isAvailable()) {

        try {
          const response = await this.fallbackProvider.generate(prompt, {
            ...options,
            timeout: options?.timeout ?? this.timeout,
          });

          const totalLatencyMs = Date.now() - startTime;

          return {
            ...response,
            metadata: {
              ...response.metadata,
              fallbackTriggered: true,
              latencyMs: totalLatencyMs,
            },
          };
        } catch (fallbackError) {
          console.error(
            `[AI Manager] Fallback provider also failed: ${this.fallbackProvider.getName()}`,
            fallbackError,
          );
          throw fallbackError;
        }
      }

      // No fallback available, throw original error
      throw error;
    }
  }

  /**
   * Check if we should try fallback based on error type
   */
  private shouldTryFallback(error: unknown): boolean {
    if (!this.enableFallback) {
      return false;
    }

    if (!this.fallbackProvider) {
      return false;
    }

    if (!this.fallbackProvider.isAvailable()) {
      return false;
    }

    // Check if error is retryable
    if (error instanceof AIProviderError) {
      if (error.isRetryable()) {
        return true;
      }
      return false;
    }

    // For unknown errors, try fallback as a safety measure
    return true;
  }

  /**
   * Get current primary provider
   */
  getPrimaryProvider(): AIProvider {
    return this.primaryProvider;
  }

  /**
   * Get current fallback provider
   */
  getFallbackProvider(): AIProvider | undefined {
    return this.fallbackProvider;
  }

  /**
   * Check if fallback is enabled
   */
  isFallbackEnabled(): boolean {
    return this.enableFallback;
  }

  /**
   * Enable or disable fallback
   */
  setFallbackEnabled(enabled: boolean): void {
    this.enableFallback = enabled;
  }
}
