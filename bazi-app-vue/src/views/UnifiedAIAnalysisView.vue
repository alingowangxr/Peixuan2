<script setup lang="ts">
/* eslint-disable no-undef */
// Browser APIs: IntersectionObserver, AbortController, TextDecoder
/* eslint-disable complexity, max-depth, max-lines */
// SSE streaming logic requires complex state management

import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useChartStore } from '@/stores/chartStore';
import { parseReportMarkdown } from '@/utils/markdown';
import QuickSetupForm from '@/components/QuickSetupForm.vue';
import AnalysisSkeleton from '@/components/AnalysisSkeleton.vue';
import CacheIndicator from '@/components/CacheIndicator.vue';
import { Icon } from '@iconify/vue';
import { useStreamingHeight } from '@/composables/useStreamingHeight';

// Phase 3: Intersection Observer for scroll-triggered animations
let intersectionObserver: IntersectionObserver | null = null;

// Phase 1: Smooth height animation during SSE streaming
const markdownBodyRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

const router = useRouter();
const route = useRoute();
const chartStore = useChartStore();
const { t, locale } = useI18n();

// 分析類型：personality 或 fortune
const analysisType = computed(() => route.name as 'personality' | 'fortune');

const analysisText = ref('');
const isLoading = ref(true);
const hasContent = ref(false); // true once first meaningful text arrives
const error = ref<string | null>(null);
const progress = ref(0);
const loadingMessage = ref('');
const loadingHint = ref('');
const cacheTimestamp = ref<string | null>(null);
const isCached = ref(false);

// AbortController for canceling fetch streams
let streamAbortController: AbortController | null = null;

// Function to stop the current streaming connection
const stopStreaming = () => {
  if (streamAbortController) {
    streamAbortController.abort();
    streamAbortController = null;
  }
};

// 動態 API 端點
const getApiEndpoints = () => {
  const base =
    analysisType.value === 'personality' ? 'analyze' : 'analyze/advanced';
  return {
    stream: `/api/v1/${base}/stream`,
    check: `/api/v1/${base}/check`,
  };
};

// Phase 1: pretext-based height estimation for smooth streaming expansion
const { estimatedHeightPx } = useStreamingHeight(
  analysisText,
  containerWidth,
  isLoading,
);

// Applied to .markdown-body via :style — grows smoothly via CSS transition
const minHeightStyle = computed(() => {
  if (!isLoading.value || !hasContent.value || estimatedHeightPx.value === 0) {
    return {};
  }
  return { minHeight: `${estimatedHeightPx.value}px` };
});

// Rendered HTML with an inline blinking cursor during streaming
const renderedHtml = computed(() => {
  if (!analysisText.value) return '';

  const sanitized = parseReportMarkdown(analysisText.value);

  if (!isLoading.value || !hasContent.value) return sanitized;

  // Insert the cursor before the last closing block tag so it appears
  // inline with the last sentence, not floating below the paragraph.
  // Covers p, li, headings, blockquote, and table cells (td/th).
  const cursor = '<span class="writing-cursor" aria-hidden="true">▋</span>';
  const lastClose = sanitized.match(/(<\/(p|li|h[1-6]|blockquote|td|th)>)\s*$/);
  if (lastClose) {
    const idx = sanitized.lastIndexOf(lastClose[1]);
    return sanitized.slice(0, idx) + cursor + sanitized.slice(idx);
  }
  return sanitized + cursor;
});

const checkCache = async (chartId: string): Promise<boolean> => {
  try {
    const endpoints = getApiEndpoints();
    const { check } = endpoints;
    const response = await fetch(
      `${check}?chartId=${chartId}&locale=${locale.value}`,
    );
    const data = await response.json();
    const { cached, timestamp } = data;

    // Store cache information
    isCached.value = cached || false;
    if (cached && timestamp) {
      cacheTimestamp.value = timestamp;
    } else {
      cacheTimestamp.value = null;
    }

    return cached || false;
  } catch (err) {
    console.error('[checkCache] Error:', err);
    isCached.value = false;
    cacheTimestamp.value = null;
    return false;
  }
};

const startStreaming = async () => {
  stopStreaming();

  analysisText.value = '';
  error.value = null;
  isLoading.value = true;
  hasContent.value = false;
  progress.value = 0;

  const { chartId } = chartStore;

  if (!chartId) {
    error.value = t(`${analysisType.value}.error_no_chart`);
    isLoading.value = false;
    return;
  }

  // Check cache first
  const hasCached = await checkCache(chartId);
  loadingMessage.value = hasCached
    ? t(`${analysisType.value}.loading_cached`)
    : t(`${analysisType.value}.loading_message`);
  loadingHint.value = hasCached
    ? t(`${analysisType.value}.loading_hint_cached`)
    : t(`${analysisType.value}.loading_hint`);

  // Use fetch with streaming instead of EventSource to access headers
  const { origin } = window.location;
  const endpoints = getApiEndpoints();
  const { stream } = endpoints;
  const apiUrl = `${origin}${stream}?chartId=${chartId}&locale=${locale.value}`;

  // Create new AbortController for this stream
  streamAbortController = new AbortController();

  try {
    const response = await fetch(apiUrl, {
      signal: streamAbortController.signal,
    });

    // Read X-Generated-At header if present
    const generatedAt = response.headers.get('X-Generated-At');
    if (generatedAt) {
      cacheTimestamp.value = generatedAt;
      isCached.value = true;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    // Buffer incomplete SSE events that span multiple TCP chunks.
    // SSE events are delimited by \n\n — splitting by \n alone loses data
    // when a chunk boundary cuts through the middle of a data: line.
    let sseBuffer = '';

    const loadingPrefixes = [
      '好我看看～讓我仔細分析一下你的命盤...\n\n',
      'Let me see~ I am analyzing your chart carefully...\n\n',
    ];

    const processEvent = (raw: string) => {
      const line = raw.trim();
      if (!line.startsWith('data: ')) return;

      const eventData = line.slice(6);
      if (eventData === '[DONE]') return;

      const data = JSON.parse(eventData); // throws on malformed — caught by caller

      if (data.error) {
        console.error('[SSE] Backend error:', data.error);
        error.value = data.error;
        isLoading.value = false;
        return;
      }

      if (data.text && !loadingPrefixes.includes(data.text)) {
        analysisText.value += data.text;
        if (!hasContent.value && analysisText.value.trim().length > 0) {
          hasContent.value = true;
        }
        progress.value = Math.min(progress.value + 2, 95);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        progress.value = 100;
        isLoading.value = false;
        break;
      }

      sseBuffer += decoder.decode(value, { stream: true });

      // Split on the SSE event separator \n\n.
      // The last element may be an incomplete event — keep it in the buffer.
      const events = sseBuffer.split('\n\n');
      sseBuffer = events.pop() ?? '';

      for (const event of events) {
        try {
          processEvent(event);
        } catch {
          if (import.meta.env.DEV) {
            console.debug('[SSE] Parse error for event:', event);
          }
        }
      }
    }
  } catch (err) {
    console.error('[SSE] Connection error:', err);
    error.value = t(`${analysisType.value}.error_connection`);
    isLoading.value = false;
  }
};

const showQuickSetupModal = ref(false);

const handleChartCreated = () => {
  showQuickSetupModal.value = false;
  chartStore.loadFromLocalStorage();
  // Restart streaming with new chart
  if (chartStore.chartId) {
    startStreaming();
  }
};

// Watch for analysisType changes to restart the stream
watch(
  analysisType,
  async (newType, oldType) => {
    if (newType && newType !== oldType) {
      await startStreaming();
    }
  },
  { immediate: true },
); // immediate: true to run on initial component mount

// Phase 3: Setup Intersection Observer for scroll-triggered animations
const setupScrollAnimations = () => {
  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  if (prefersReducedMotion) {
    return; // Skip animations if user prefers reduced motion
  }

  // Create Intersection Observer
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    },
    {
      threshold: 0.1, // Trigger when 10% of element is visible
      rootMargin: '0px 0px -50px 0px', // Trigger slightly before element enters viewport
    },
  );

  // Observe all elements that should animate on scroll
  const observeElements = () => {
    const markdownBody = document.querySelector('.markdown-body');
    if (!markdownBody) {
      return;
    }

    // Add scroll-reveal class to elements
    const revealElements = markdownBody.querySelectorAll(
      'h2, h3, table, blockquote, pre',
    );
    revealElements.forEach((el) => {
      el.classList.add('scroll-reveal');
      intersectionObserver?.observe(el);
    });
  };

  // Wait for content to be rendered, then observe
  nextTick(() => {
    observeElements();
  });
};

watch(analysisText, () => {
  if (analysisText.value) {
    nextTick(() => {
      setupScrollAnimations();
    });
  }
});

// Phase 1: Measure container width once the markdown body is first rendered,
// then keep it updated via ResizeObserver (handles window resize / sidebar collapse).
watch(hasContent, (visible) => {
  if (!visible) return;
  nextTick(() => {
    if (!markdownBodyRef.value) return;
    containerWidth.value = markdownBodyRef.value.offsetWidth;
    resizeObserver = new ResizeObserver((entries) => {
      containerWidth.value = Math.round(entries[0].contentRect.width);
    });
    resizeObserver.observe(markdownBodyRef.value);
  });
});

onMounted(() => {
  // startStreaming is now handled by the immediate watcher, so this can be empty
  // or used for other non-streaming related on-mount setup.
  setupScrollAnimations();
});

onUnmounted(() => {
  stopStreaming(); // Ensure stream is closed when component is unmounted

  // Phase 1: Cleanup ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // Phase 3: Cleanup Intersection Observer
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
});
</script>

<template>
  <div class="unified-ai-analysis-view">
    <!-- 背景漸層 -->
    <div class="view-bg" />

    <div class="container-full">
      <!-- 主要內容區域 -->
      <div class="content-grid">
        <!-- 左側：分析報告 -->
        <main class="main-content">
          <!-- 錯誤狀態 -->
          <div v-if="error" class="glass-card error-card" role="alert">
            <Icon
              icon="mdi:alert-circle-outline"
              width="64"
              class="error-icon"
            />
            <h2 class="error-title">分析中斷了</h2>
            <p class="error-message">{{ error }}</p>
            <el-button
              type="primary"
              size="large"
              class="retry-btn"
              @click="startStreaming"
            >
              重新連接星塵
            </el-button>
          </div>

          <!-- 主內容卡片 -->
          <div v-else class="glass-card main-card">
            <!-- 標題區 -->
            <div class="card-header">
              <div class="icon-container">
                <Icon
                  :icon="
                    analysisType === 'personality'
                      ? 'mdi:account-star'
                      : 'mdi:crystal-ball'
                  "
                  width="48"
                  role="img"
                  :aria-label="$t(`${analysisType}.title`)"
                />
              </div>
              <div class="header-text">
                <p class="header-subtitle">
                  {{ $t(`${analysisType}.subtitle`) }}
                </p>
                <h1 class="header-title">{{ $t(`${analysisType}.title`) }}</h1>
              </div>
            </div>

            <!-- 載入中 (骨架屏) — 僅在無內容時顯示 -->
            <AnalysisSkeleton v-if="isLoading && !hasContent" />

            <!-- 分析內容 — 串流期間即時顯示 -->
            <div v-if="hasContent || !isLoading" class="analysis-content">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
                ref="markdownBodyRef"
                class="markdown-body"
                :style="minHeightStyle"
                aria-live="polite"
                v-html="renderedHtml"
              />

              <!-- 快取指示器 -->
              <CacheIndicator
                v-if="!isLoading && isCached && cacheTimestamp"
                :timestamp="cacheTimestamp"
                :analysis-type="analysisType"
                @refresh="startStreaming"
              />
            </div>
          </div>
        </main>

        <!-- 右側：佩璇互動區 -->
        <aside class="sidebar">
          <div class="sidebar-sticky">
            <div class="peixuan-whisper">
              <Icon
                icon="fluent-emoji-flat:unicorn"
                width="64"
                class="whisper-icon"
                role="img"
                aria-label="佩璇形象"
              />
              <h4 class="whisper-title">佩璇的悄悄話</h4>
              <div class="whisper-text">
                {{ $t(`${analysisType}.whisper`) }}
              </div>
            </div>

            <!-- 返回按鈕 -->
            <el-button class="back-btn" @click="router.push('/unified')">
              <Icon icon="lucide:arrow-left" width="18" />
              返回命盤
            </el-button>
          </div>
        </aside>
      </div>
    </div>

    <!-- Quick Setup Modal -->
    <el-dialog
      v-model="showQuickSetupModal"
      :title="$t('dailyQuestion.noChart.quickSetupTitle')"
      width="90%"
      :style="{ maxWidth: '600px' }"
      center
      append-to-body
    >
      <QuickSetupForm @chart-created="handleChartCreated" />
    </el-dialog>
  </div>
</template>

<style scoped>
/* ========== 容器 ========== */
.unified-ai-analysis-view {
  position: relative;
  min-height: 100vh;
}

.view-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(
      circle at top right,
      rgba(147, 112, 219, 0.1),
      transparent 50%
    ),
    radial-gradient(
      circle at bottom left,
      rgba(210, 105, 30, 0.08),
      transparent 50%
    ),
    linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%);
  z-index: -1;
}

html.dark .view-bg {
  background:
    radial-gradient(
      circle at top right,
      rgba(147, 112, 219, 0.2),
      transparent 50%
    ),
    linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.container-full {
  min-height: 100vh;
  padding: var(--space-3xl) var(--space-2xl) var(--space-2xl);
  box-sizing: border-box;
}

/* ========== 雙欄佈局 ========== */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 280px; /* 縮小側邊欄 */
  gap: var(--space-2xl);
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== Glassmorphism 卡片 ========== */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur))
    saturate(var(--glass-saturate-enhanced));
  -webkit-backdrop-filter: blur(var(--glass-blur))
    saturate(var(--glass-saturate-enhanced));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3xl);
  box-shadow: var(--shadow-glass);
}

.main-card {
  border-radius: var(--radius-xl);
}

/* ========== 卡片標題 ========== */
.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  margin-bottom: var(--space-2xl);
}

.icon-container {
  width: 80px;
  height: 80px;
  background: rgba(147, 112, 219, 0.1);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-container :deep(svg) {
  color: var(--peixuan-purple);
}

.header-text {
  flex: 1;
}

.header-subtitle {
  font-size: var(--font-size-sm);
  color: var(--peixuan-purple);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 var(--space-xs) 0;
}

.header-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  line-height: var(--line-height-tight);
}

/* ========== 錯誤卡片 ========== */
.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-4xl);
  text-align: center;
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.2);
}

html.dark .error-card {
  background: rgba(69, 10, 10, 0.4);
}

.error-icon {
  color: var(--color-error);
}

.error-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-error);
  margin: 0;
}

.error-message {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  margin: 0;
}

.retry-btn {
  --el-button-bg-color: var(--color-error);
  --el-button-border-color: var(--color-error);
  padding: var(--space-lg) var(--space-3xl) !important;
  border-radius: var(--radius-lg) !important;
}


/* ========== 分析內容 ========== */
.analysis-content {
  line-height: 1.8;
  animation: contentFadeIn 0.4s ease-out;
}

@keyframes contentFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.markdown-body {
  font-size: 0.9375rem; /* 15px */
  line-height: 1.75;
  color: var(--text-primary);
  letter-spacing: 0.01em;
  text-align: left; /* 覆蓋 #app 的 text-align: center */
  /* Phase 1: smooth height expansion during SSE streaming */
  transition: min-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .markdown-body {
    transition: none;
  }
}

/* 串流打字游標 */
.markdown-body :deep(.writing-cursor) {
  color: var(--peixuan-purple);
  font-weight: 300;
  animation: cursorBlink 0.8s step-end infinite;
  user-select: none;
}

@keyframes cursorBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

/* ========== 段落 ========== */
.markdown-body :deep(p) {
  margin-bottom: 1.5em; /* 2倍字體大小 */
  line-height: 1.8;
}

/* ========== 標題層級 ========== */
.markdown-body :deep(h1) {
  font-size: 2em;
  font-weight: 700;
  margin: 1.5em 0 0.5em;
  color: var(--peixuan-purple);
  line-height: 1.3;
}

.markdown-body :deep(h2) {
  font-size: 1.5em;
  font-weight: 700;
  margin: 1.2em 0 0.4em;
  color: var(--peixuan-purple);
  line-height: 1.4;
}

.markdown-body :deep(h3) {
  font-size: 1.25em;
  font-weight: 600;
  margin: 1em 0 0.3em;
  color: var(--text-primary);
  line-height: 1.5;
}

/* ========== 列表 ========== */
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 1em 0 1.5em;
  padding-left: 2em;
}

.markdown-body :deep(li) {
  margin-bottom: 0.5em;
  line-height: 1.8;
}

.markdown-body :deep(li::marker) {
  color: var(--peixuan-purple);
  font-weight: 600;
}

/* ========== 引用區塊 ========== */
.markdown-body :deep(blockquote) {
  border-left: 4px solid var(--peixuan-purple);
  padding-left: 1.5em;
  margin: 1.5em 0;
  font-style: italic;
  opacity: 0.9;
  background: rgba(147, 112, 219, 0.05);
  padding: 1em 1.5em;
  border-radius: 0.5rem;
}

/* ========== 代碼區塊 ========== */
.markdown-body :deep(code) {
  background: rgba(147, 112, 219, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
  font-size: 0.9em;
  font-family: 'Courier New', monospace;
}

.markdown-body :deep(pre) {
  background: rgba(147, 112, 219, 0.05);
  padding: 1em;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 1.5em 0;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
}

/* ========== 連結 ========== */
.markdown-body :deep(a) {
  color: var(--peixuan-purple);
  text-decoration: underline;
  text-decoration-color: rgba(147, 112, 219, 0.3);
  text-underline-offset: 0.2em;
  transition: all 0.2s ease;
}

.markdown-body :deep(a:hover) {
  text-decoration-color: var(--peixuan-purple);
  text-shadow: 0 0 10px rgba(147, 112, 219, 0.3);
}

/* ========== 分隔線 ========== */
.markdown-body :deep(hr) {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--peixuan-purple), transparent);
  margin: 2em 0;
  opacity: 0.3;
}

/* 粗體關鍵字高亮 - 2026 最佳實踐設計 */
/* 使用 :deep() 穿透 scoped 限制，應用到 v-html 動態生成的元素 */
.markdown-body :deep(b),
.markdown-body :deep(strong) {
  color: var(--peixuan-purple);
  font-weight: 700;
  /* 多層陰影創造深度和光暈效果 */
  text-shadow: 
    0 0 10px rgba(147, 112, 219, 0.4),
    0 0 20px rgba(147, 112, 219, 0.3),
    0 2px 4px rgba(147, 112, 219, 0.2);
  /* 輕微放大強調 */
  font-size: 1.05em;
  letter-spacing: 0.02em;
}

/* 深色模式優化 */
html.dark .markdown-body :deep(b),
html.dark .markdown-body :deep(strong) {
  color: #b794f6; /* 更亮的紫色 */
  text-shadow: 
    0 0 15px rgba(183, 148, 246, 0.6),
    0 0 30px rgba(183, 148, 246, 0.4),
    0 2px 6px rgba(183, 148, 246, 0.3);
}

html.dark .markdown-body :deep(h1),
html.dark .markdown-body :deep(h2) {
  color: #b794f6;
}

html.dark .markdown-body :deep(blockquote) {
  background: rgba(183, 148, 246, 0.1);
  border-left-color: #b794f6;
}

html.dark .markdown-body :deep(code) {
  background: rgba(183, 148, 246, 0.15);
}

html.dark .markdown-body :deep(a) {
  color: #b794f6;
}

/* ========== 側邊欄 ========== */
.sidebar-sticky {
  position: sticky;
  top: calc(var(--space-3xl) + var(--space-lg));
}

.peixuan-whisper {
  background: linear-gradient(135deg, var(--peixuan-purple), #7c3aed);
  color: white;
  padding: var(--space-xl); /* 從 2xl 改為 xl，更緊湊 */
  border-radius: var(--radius-lg);
  text-align: center;
  box-shadow: 0 20px 40px -10px rgba(124, 58, 237, 0.3);
  margin-bottom: var(--space-lg);
}

/* 深色模式優化 */
html.dark .peixuan-whisper {
  background: linear-gradient(135deg, #6b21a8, #5b21b6);
  box-shadow: 0 20px 40px -10px rgba(107, 33, 168, 0.5);
}

.whisper-icon {
  margin-bottom: var(--space-lg);
}

.whisper-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--space-lg) 0;
}

.whisper-text {
  background: rgba(255, 255, 255, 0.15);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 深色模式優化 */
html.dark .whisper-text {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.back-btn {
  width: 100%;
  height: 48px !important;
  border-radius: var(--radius-lg) !important;
  background: rgba(255, 255, 255, 0.6) !important;
  border: none !important;
}

.back-btn:hover {
  background: white !important;
}

/* 深色模式優化 */
html.dark .back-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  color: white !important;
}

html.dark .back-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

/* ========== 響應式 ========== */
@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .sidebar-sticky {
    position: static;
  }
}

@media (max-width: 767px) {
  .container-full {
    padding: var(--space-xl) var(--space-lg);
  }

  .glass-card {
    padding: var(--space-xl);
    border-radius: var(--radius-md);
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .icon-container {
    width: 64px;
    height: 64px;
  }

  .header-title {
    font-size: var(--font-size-2xl);
  }
}

/* ========== 深色模式 ========== */
html.dark .glass-card {
  background: rgba(30, 41, 59, 0.7);
  border-color: rgba(255, 255, 255, 0.1);
}

html.dark .header-subtitle {
  color: var(--peixuan-pink);
}

html.dark .markdown-body {
  color: rgba(255, 255, 255, 0.9);
}

/* ========== 無障礙 ========== */
@media (prefers-reduced-motion: reduce) {
  .content-grid {
    animation: none;
  }
}
</style>
