import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

export function useDailyQuestion(chartId: string) {
  const { t } = useI18n();

  const question = ref('');
  const response = ref('');
  const isAsking = ref(false);
  const currentStatus = ref('');
  const hasAskedToday = ref(false);
  const error = ref('');
  const estimatedTime = ref(0);
  const progressPhase = ref(0);
  const hasMemoryContext = ref(false);
  const memoryReference = ref('');

  const dailyLimitMessage = computed(() => {
    return t('dailyQuestion.dailyLimit.message');
  });

  // Smart time estimation based on question complexity
  const estimateResponseTime = (questionText: string): number => {
    const { length } = questionText.trim();
    if (length < 20) {
      return 30;
    } // Short question: 30s
    if (length < 50) {
      return 45;
    } // Medium question: 45s
    return 60; // Long/complex question: 60s
  };

  const checkDailyLimit = async () => {
    try {
      const response = await fetch(`/api/v1/daily-insight/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartId }),
      });

      const data = await response.json();
      hasAskedToday.value = data.hasAskedToday;
    } catch (err) {
      console.error('Failed to check daily limit:', err);
    }
  };

  const askQuestion = async (questionText: string, locale: string) => {
    if (!questionText.trim() || hasAskedToday.value) {
      return;
    }

    // Reset state for new question
    isAsking.value = true;
    response.value = '';
    currentStatus.value = '';
    error.value = '';
    progressPhase.value = 0;
    estimatedTime.value = estimateResponseTime(questionText);
    hasMemoryContext.value = false;
    memoryReference.value = '';

    // Progressive status messaging for warm UX
    const statusTimeline = [
      { delay: 0, phase: 0, key: 'status.analyzing' },
      {
        delay: estimatedTime.value * 0.25 * 1000,
        phase: 1,
        key: 'status.consulting',
      },
      {
        delay: estimatedTime.value * 0.5 * 1000,
        phase: 2,
        key: 'status.interpreting',
      },
      {
        delay: estimatedTime.value * 0.75 * 1000,
        phase: 3,
        key: 'status.finalizing',
      },
    ];

    const timers: number[] = [];
    statusTimeline.forEach(({ delay, phase, key }) => {
      const timer = window.setTimeout(() => {
        if (isAsking.value) {
          progressPhase.value = phase;
          currentStatus.value = t(`dailyQuestion.${key}`);
        }
      }, delay);
      timers.push(timer);
    });

    try {
      const fetchResponse = await fetch('/api/v1/daily-insight/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chartId,
          question: questionText,
          locale,
        }),
      });

      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status}`);
      }

      const reader = fetchResponse.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      // eslint-disable-next-line no-undef
      const decoder = new TextDecoder();

      // Stream response chunks and accumulate
      // The watcher in DailyQuestionPanel will split this into chat bubbles
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              // Handle memory metadata events
              if (data.type === 'meta' && data.data) {
                if (data.data.hasMemoryContext) {
                  hasMemoryContext.value = true;
                  memoryReference.value = data.data.memoryReference || '';
                  if (import.meta.env.DEV) {
                    console.log('[useDailyQuestion] Memory metadata received:', {
                      hasMemoryContext: hasMemoryContext.value,
                      memoryReference: memoryReference.value,
                    });
                  }
                }
              } else if (data.state) {
                // Handle state updates from agentic backend
                currentStatus.value = data.state;
              } else if (data.text) {
                // Handle text content chunks
                response.value += data.text;
              } else if (data.content) {
                // Handle content updates
                response.value += data.content;
              }
            } catch {
              // Handle plain text responses (non-JSON)
              const textContent = line.slice(6);
              if (textContent && textContent !== '[DONE]') {
                response.value += textContent;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to start question:', err);
      error.value = t('dailyQuestion.errors.requestFailed');
      isAsking.value = false;
      currentStatus.value = '';
    } finally {
      // Clean up timers and state
      timers.forEach((timer) => window.clearTimeout(timer));
      isAsking.value = false;
      currentStatus.value = '';
      progressPhase.value = 0;
      if (response.value) {
        hasAskedToday.value = true;
      }
    }
  };

  return {
    question,
    response,
    isAsking,
    currentStatus,
    hasAskedToday,
    dailyLimitMessage,
    error,
    estimatedTime,
    progressPhase,
    hasMemoryContext,
    memoryReference,
    askQuestion,
    checkDailyLimit,
  };
}
