/**
 * Uses @chenglou/pretext to predict the rendered height of streaming Markdown
 * text WITHOUT touching the DOM. Bind `estimatedHeightPx` to `min-height` on
 * the markdown container with a CSS transition so the container expands
 * smoothly instead of jumping on each SSE chunk.
 *
 * Why pretext instead of DOM measurement:
 *   Reading scrollHeight/offsetHeight forces a browser layout reflow on every
 *   chunk. pretext measures via canvas and pure arithmetic — no reflow.
 */

import { ref, watch, type Ref } from 'vue'
import { useDebounceFn, useResizeObserver } from '@vueuse/core'
import { prepare, layout } from '@chenglou/pretext'

const BODY_FONT = '15px "Noto Sans TC", Inter, sans-serif'
const LINE_HEIGHT_PX = 26.25 // matches .markdown-body: font-size 15px × line-height 1.75
// Plain-text estimate underestimates heading/spacing overhead; 40% buffer
// keeps min-height comfortably ahead and prevents visible jumps.
const HEIGHT_FACTOR = 1.4

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`[^`\n]+`/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^\s*>+\s*/gm, '')
    .replace(/^\s*[-|]{3,}\s*$/gm, '')
    .replace(/\|/g, ' ')
    .trim()
}

export function useStreamingHeight(
  text: Ref<string>,
  containerEl: Ref<HTMLElement | null>,
  isStreaming: Ref<boolean>,
) {
  const estimatedHeightPx = ref(0)
  const containerWidth = ref(0)

  // useResizeObserver auto-cleans up on unmount; no manual disconnect needed
  useResizeObserver(containerEl, (entries) => {
    containerWidth.value = Math.round(entries[0].contentRect.width)
  })

  const recalculate = useDebounceFn(() => {
    if (!isStreaming.value || !text.value || containerWidth.value <= 0) return
    // Skip if the primary font hasn't loaded yet — avoids measuring with
    // incorrect fallback metrics. document.fonts.check is synchronous.
    if (!document.fonts.check(BODY_FONT)) return

    const plain = stripMarkdown(text.value)
    if (!plain) return

    try {
      const prepared = prepare(plain, BODY_FONT)
      const { height } = layout(prepared, containerWidth.value, LINE_HEIGHT_PX)
      estimatedHeightPx.value = Math.ceil(height * HEIGHT_FACTOR)
    } catch (err) {
      if (import.meta.env.DEV) console.debug('[useStreamingHeight] pretext error:', err)
    }
  }, 120)

  watch(text, recalculate, { flush: 'post' })

  watch(isStreaming, (active) => {
    if (!active) estimatedHeightPx.value = 0
  })

  return { estimatedHeightPx }
}
