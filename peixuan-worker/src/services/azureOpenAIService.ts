/**
 * Azure OpenAI Service
 * Adapter for Azure OpenAI API compatible with AIProvider interface
 */

import { AIProviderError, AIErrorCode, type AIProvider, type AIOptions, type AIResponse, type TokenUsage } from '../types/aiTypes';

/**
 * Azure OpenAI configuration
 */
export interface AzureOpenAIConfig {
  /** Azure OpenAI endpoint (e.g., https://your-resource.openai.azure.com) */
  endpoint: string;
  /** API key for authentication */
  apiKey: string;
  /** Deployment name (e.g., gpt-4o-mini) */
  deployment: string;
  /** API version (e.g., 2024-08-01-preview) */
  apiVersion?: string;
  /** Default request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
}

/**
 * Azure OpenAI API response structure
 */
interface AzureOpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Azure OpenAI streaming chunk structure
 */
interface AzureOpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * Azure OpenAI Service implementing AIProvider interface
 */
export class AzureOpenAIService implements AIProvider {
  private endpoint: string;
  private apiKey: string;
  private deployment: string;
  private apiVersion: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: AzureOpenAIConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.deployment = config.deployment;
    this.apiVersion = config.apiVersion || '2024-08-01-preview';
    this.timeout = config.timeout || 45000;
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Get provider name
   */
  getName(): string {
    return 'azure';
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    return !!(this.endpoint && this.apiKey && this.deployment);
  }

  /**
   * Generate streaming response from Azure OpenAI
   */
  async generateStream(prompt: string, options?: AIOptions): Promise<ReadableStream> {
    const url = this.buildUrl();
    const body = this.buildRequestBody(prompt, options, true);

    return this.streamWithRetry(url, body, options?.timeout);
  }

  /**
   * Generate non-streaming response from Azure OpenAI
   */
  async generate(prompt: string, options?: AIOptions): Promise<AIResponse> {
    const startTime = Date.now();
    const url = this.buildUrl();
    const body = this.buildRequestBody(prompt, options, false);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, body, options?.timeout);

        if (!response.ok) {
          await this.handleErrorResponse(response, attempt);
          continue;
        }

        const data = (await response.json()) as AzureOpenAIResponse;
        const text = data.choices?.[0]?.message?.content || '';

        if (!text) {
          throw new AIProviderError(
            'No content in Azure OpenAI response',
            AIErrorCode.UNKNOWN_ERROR,
          );
        }

        const latencyMs = Date.now() - startTime;

        // Extract usage info
        const usage: TokenUsage | undefined = data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined;

        // Log performance
        if (usage) {
          const estimatedCost =
            (usage.promptTokens * 0.15 + usage.completionTokens * 0.6) / 1000000;
        }

        return {
          text,
          metadata: {
            provider: 'azure',
            fallbackTriggered: false,
            latencyMs,
            usage,
          },
        };
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        // Exponential backoff
        const backoff = Math.pow(2, attempt) * 1000;
        await this.sleep(backoff);
      }
    }

    throw new AIProviderError(
      'Unexpected error in Azure OpenAI generate',
      AIErrorCode.UNKNOWN_ERROR,
    );
  }

  /**
   * Build Azure OpenAI API URL
   */
  private buildUrl(): string {
    return `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
  }

  /**
   * Build request body for Azure OpenAI
   */
  private buildRequestBody(
    prompt: string,
    options?: AIOptions,
    stream = false,
  ): string {
    return JSON.stringify({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: options?.temperature ?? 0.85,
      max_tokens: options?.maxTokens ?? 6144,
      top_p: options?.topP ?? 0.95,
      stream,
    });
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    url: string,
    body: string,
    customTimeout?: number,
  ): Promise<Response> {
    const controller = new globalThis.AbortController();
    const timeoutMs = customTimeout ?? this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new AIProviderError(
          'Azure OpenAI request timeout',
          AIErrorCode.TIMEOUT,
        );
      }
      throw error;
    }
  }

  /**
   * Handle streaming with retry logic
   */
  private async streamWithRetry(
    url: string,
    body: string,
    customTimeout?: number,
  ): Promise<ReadableStream> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {

        const response = await this.fetchWithTimeout(url, body, customTimeout);

        if (response.ok) {
          if (!response.body) {
            throw new AIProviderError(
              'No response body from Azure OpenAI streaming API',
              AIErrorCode.UNKNOWN_ERROR,
            );
          }
          return this.transformStream(response.body);
        }

        await this.handleErrorResponse(response, attempt);
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        const backoff = Math.pow(2, attempt) * 1000;
        await this.sleep(backoff);
      }
    }

    throw new AIProviderError(
      'Unexpected error in Azure OpenAI stream',
      AIErrorCode.UNKNOWN_ERROR,
    );
  }

  /**
   * Transform Azure OpenAI SSE stream to plain text stream
   */
  private transformStream(stream: ReadableStream): ReadableStream {
    const reader = stream.getReader();
    const decoder = new globalThis.TextDecoder();
    const processStreamLines = this.processStreamLines.bind(this);

    return new ReadableStream({
      async start(controller) {
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            processStreamLines(lines, controller);
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });
  }

  /**
   * Process SSE stream lines
   */
  private processStreamLines(
    lines: string[],
    controller: globalThis.ReadableStreamDefaultController,
  ): void {
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and done markers
      if (!trimmed || trimmed === 'data: [DONE]') {
        continue;
      }

      // Process data lines
      if (trimmed.startsWith('data: ')) {
        this.processStreamChunk(trimmed, controller);
      }
    }
  }

  /**
   * Process individual stream chunk
   */
  private processStreamChunk(
    trimmed: string,
    controller: globalThis.ReadableStreamDefaultController,
  ): void {
    try {
      const jsonStr = trimmed.slice(6); // Remove 'data: ' prefix
      const chunk = JSON.parse(jsonStr) as AzureOpenAIStreamChunk;
      const content = chunk.choices?.[0]?.delta?.content;

      if (content) {
        controller.enqueue(new globalThis.TextEncoder().encode(content));
      }
    } catch {
      console.error('[Azure OpenAI Stream] Failed to parse chunk:', trimmed);
    }
  }

  /**
   * Handle error response from Azure OpenAI
   */
  private async handleErrorResponse(response: Response, attempt: number): Promise<void> {
    const errorText = await response.text();
    console.error(
      `[Azure OpenAI] Error response (Attempt ${attempt}/${this.maxRetries}): ${errorText}`,
    );

    let errorCode = AIErrorCode.UNKNOWN_ERROR;
    let retryAfter: number | undefined;

    // Map HTTP status codes to AI error codes
    switch (response.status) {
      case 429:
        errorCode = AIErrorCode.RATE_LIMIT_EXCEEDED;
        retryAfter = this.parseRetryAfter(response.headers.get('retry-after'));
        break;
      case 503:
        errorCode = AIErrorCode.SERVICE_UNAVAILABLE;
        break;
      case 401:
      case 403:
        errorCode = AIErrorCode.AUTH_ERROR;
        break;
      case 400:
        errorCode = AIErrorCode.INVALID_REQUEST;
        break;
    }

    const error = new AIProviderError(
      `Azure OpenAI API error (${response.status} ${response.statusText}): ${errorText}`,
      errorCode,
      response.status,
      retryAfter,
    );

    // Don't retry on client errors (except rate limit)
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      throw error;
    }

    // On last attempt, throw the error
    if (attempt === this.maxRetries) {
      throw error;
    }
  }

  /**
   * Parse retry-after header
   */
  private parseRetryAfter(header: string | null): number | undefined {
    if (!header) {
      return undefined;
    }

    const seconds = parseInt(header);
    return isNaN(seconds) ? undefined : seconds * 1000; // Convert to milliseconds
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
