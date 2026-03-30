/**
 * useStreamingHeight
 *
 * Uses @chenglou/pretext to predict the rendered height of streaming Markdown
 * text WITHOUT touching the DOM, then exposes a reactive `estimatedHeightPx`
 * value. Bind this to `min-height` on the markdown container together with a
 * CSS transition so the container expands smoothly instead of jumping each
 * time a new SSE chunk arrives.
 *
 * Why pretext instead of DOM measurement:
 *   Reading `scrollHeight` / `offsetHeight` forces a browser layout reflow.
 *   Doing that once per SSE chunk causes visible jank. pretext measures via
 *   canvas and pure arithmetic — no reflow, ~0.1ms per call.
 */

import { ref, watch, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { prepare, layout } from '@chenglou/pretext'

// Must match .markdown-body { font-size: 0.9375rem; font-family: ... }
const BODY_FONT = '15px "Noto Sans TC", Inter, sans-serif'
// 15px × 1.75 line-height → 26.25px per line
const LINE_HEIGHT_PX = 26.25
// AI output mixes headings (larger font) + spacing, so plain-text height
// underestimates. A 40% buffer keeps min-height comfortably ahead.
const HEIGHT_FACTOR = 1.4

/**
 * Strip Markdown syntax to plain prose for height estimation.
 * Over-estimating is fine for min-height; under-estimating causes jumps.
 */
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')                 // heading markers
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')   // bold / italic
    .replace(/`{3}[\s\S]*?`{3}/g, '')             // fenced code blocks
    .replace(/`[^`\n]+`/g, '')                    // inline code
    .replace(/^\s*[-*+]\s+/gm, '')                // unordered list bullets
    .replace(/^\s*\d+\.\s+/gm, '')                // ordered list numbers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')      // links
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')         // images
    .replace(/^\s*>+\s*/gm, '')                   // blockquote markers
    .replace(/^\s*[-|]{3,}\s*$/gm, '')            // HR / table dividers
    .replace(/\|/g, ' ')                          // table cell separators
    .trim()
}

/**
 * @param text          Raw Markdown text accumulating from SSE
 * @param containerWidth  Pixel width of the target element (measured once by caller)
 * @param isStreaming   Only compute while streaming is active; resets on finish
 */
export function useStreamingHeight(
  text: Ref<string>,
  containerWidth: Ref<number>,
  isStreaming: Ref<boolean>,
) {
  const estimatedHeightPx = ref(0)

  const recalculate = useDebounceFn(() => {
    if (!isStreaming.value || !text.value || containerWidth.value <= 0) return

    // Skip if the primary font hasn't loaded yet — prevents measuring with
    // incorrect fallback metrics (document.fonts.check is synchronous).
    if (!document.fonts.check(BODY_FONT)) return

    const plain = stripMarkdown(text.value)
    if (!plain) return

    try {
      const prepared = prepare(plain, BODY_FONT)
      const { height } = layout(prepared, containerWidth.value, LINE_HEIGHT_PX)
      estimatedHeightPx.value = Math.ceil(height * HEIGHT_FACTOR)
    } catch {
      // Silently ignore — min-height simply won't be set for this chunk
    }
  }, 120) // 120ms debounce → ≤8 calculations/sec even with rapid SSE chunks

  watch(text, recalculate, { flush: 'post' })

  // Reset when streaming ends so the container settles to natural height
  watch(isStreaming, (active) => {
    if (!active) estimatedHeightPx.value = 0
  })

  return { estimatedHeightPx }
}
