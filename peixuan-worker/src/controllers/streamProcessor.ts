/**
 * Stream Processor
 * Handles AI stream processing for different providers
 */

/**
 * Process Azure OpenAI text stream
 * @param aiStream - ReadableStream from Azure
 * @param controller - ReadableStream controller
 * @param logPrefix - Prefix for console logs
 * @returns Full text accumulated
 */
export async function processAzureStream(
  aiStream: ReadableStream,
  controller: ReadableStreamDefaultController,
  logPrefix: string
): Promise<string> {
  const reader = aiStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const text = decoder.decode(value, { stream: true });
    if (text) {
      fullText += text;
      const sseData = `data: ${JSON.stringify({ text })}\n\n`;
      controller.enqueue(encoder.encode(sseData));
    }
  }

  return fullText;
}

/**
 * Process Gemini JSON array stream
 * @param aiStream - ReadableStream from Gemini
 * @param controller - ReadableStream controller
 * @param logPrefix - Prefix for console logs
 * @returns Full text accumulated
 */
export async function processGeminiStream(
  aiStream: ReadableStream,
  controller: ReadableStreamDefaultController,
  logPrefix: string
): Promise<string> {
  const reader = aiStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  // Step 1: Accumulate entire buffer
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
  }

  // Step 2: Parse and send JSON array (async — adds inter-chunk delays)
  return await parseAndSendGeminiResponse(buffer, controller, encoder, logPrefix);
}

/**
 * Parse Gemini JSON response and send via SSE with streaming delays.
 * Gemini returns the full response as a JSON array after buffering; we
 * replay it chunk-by-chunk with a short delay so the frontend receives
 * events spread over time, enabling the cursor animation and preventing
 * Vue from batch-collapsing all updates into a single render tick.
 *
 * @param buffer - Accumulated response buffer
 * @param controller - ReadableStream controller
 * @param encoder - TextEncoder instance
 * @param logPrefix - Prefix for console logs
 * @returns Full text extracted
 */
export async function parseAndSendGeminiResponse(
  buffer: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  logPrefix: string
): Promise<string> {
  let fullText = '';

  try {
    const jsonArray = JSON.parse(buffer);

    if (!Array.isArray(jsonArray)) {
      throw new Error('Expected JSON array from Gemini API');
    }

    // Extract and send text from each object, with a delay between chunks
    // so the browser receives events spread over time rather than all at once.
    for (const obj of jsonArray) {
      const text: string = obj?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (text) {
        fullText += text;
        const sseData = `data: ${JSON.stringify({ text })}\n\n`;
        controller.enqueue(encoder.encode(sseData));
        // ~15ms delay gives ~65 chunks/sec — visible streaming without lag
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    }

  } catch (parseError) {
    console.error(`${logPrefix} JSON parse failed:`, parseError);
    console.error(`${logPrefix} Buffer preview:`, buffer.substring(0, 500));
    throw new Error(`Failed to parse Gemini response: ${parseError}`);
  }

  return fullText;
}

/**
 * Accumulate stream buffer from reader
 * @param reader - ReadableStreamDefaultReader
 * @param decoder - TextDecoder instance
 * @returns Accumulated buffer string
 */
export async function accumulateStreamBuffer(
  reader: ReadableStreamDefaultReader,
  decoder: TextDecoder
): Promise<string> {
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
  }

  return buffer;
}

/**
 * Create SSE stream from cached analysis
 * @param cachedText - The cached analysis text
 * @returns ReadableStream in SSE format
 */
export function createCachedSSEStream(cachedText: string, forceRequested?: boolean): ReadableStream {
  const encoder = new TextEncoder();
  // Split by lines to preserve Markdown formatting
  const lines = cachedText.split('\n');

  return new ReadableStream({
    async start(controller) {

      // Send consistency metadata if force was requested but ignored
      if (forceRequested) {
        const metaData = `data: ${JSON.stringify({ 
          meta: { 
            consistency_enforced: true,
            message: "今日運勢已定 (Daily destiny is set)"
          }
        })}\n\n`;
        controller.enqueue(encoder.encode(metaData));
      }

      for (const line of lines) {
        // Send each line with newline preserved
        const sseData = `data: ${JSON.stringify({ text: `${line}\n` })}\n\n`;
        controller.enqueue(encoder.encode(sseData));
        // Shorter delay for faster playback
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Send [DONE] signal
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
}
