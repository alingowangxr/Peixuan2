<template>
  <div class="daily-question-panel">
    <!-- Header with Avatar and Status -->
    <div class="panel-header">
      <div class="avatar-section">
        <div class="peixuan-avatar">
          <span class="avatar-emoji">🔮</span>
          <div v-if="isAsking" class="status-indicator" />
        </div>
        <div class="header-text">
          <h3>{{ $t('dailyQuestion.askPeixuan') }}</h3>
          <p class="subtitle">{{ $t('dailyQuestion.oncePerDay') }}</p>
        </div>
      </div>

      <!-- Dynamic Status Indicator -->
      <transition name="fade">
        <div v-if="isAsking && currentStatus" class="status-display">
          <el-icon class="status-icon">
            <component :is="getStatusIcon(currentStatus)" />
          </el-icon>
          <span class="status-text">{{ getStatusText(currentStatus) }}</span>
        </div>
      </transition>
    </div>

    <!-- Chat Messages Area -->
    <div ref="messagesContainer" class="messages-container">
      <!-- Welcome Message -->
      <ChatBubble
        v-if="!hasAskedToday && !response && !validationError"
        type="system"
        :content="$t('dailyQuestion.welcomeMessage')"
      />

      <!-- User Question -->
      <ChatBubble v-if="userQuestion" type="user" :content="userQuestion" />

      <!-- AI Thinking Animation -->
      <div
        v-if="isAsking && chatBubbles.length === 0"
        class="message ai-message thinking-message"
      >
        <div class="thinking-dots">
          <span class="will-change-transform" />
          <span class="will-change-transform" />
          <span class="will-change-transform" />
        </div>
      </div>

      <!-- AI Response Bubbles (Progressive Display) -->
      <ChatBubble
        v-for="(bubble, index) in chatBubbles"
        :key="index"
        type="ai"
        :content="bubble"
        :delay="index * 100"
        :has-memory-context="index === 0 && hasMemoryContext"
        :memory-reference="index === 0 ? memoryReference : ''"
      />

      <!-- Typing Indicator (while streaming) -->
      <div
        v-if="isAsking && chatBubbles.length > 0"
        class="message ai-message thinking-message"
      >
        <div class="thinking-dots">
          <span class="will-change-transform" />
          <span class="will-change-transform" />
          <span class="will-change-transform" />
        </div>
      </div>

      <!-- Daily Limit Notice - Immersive Style -->
      <ChatBubble
        v-if="hasAskedToday && !isAsking && !response"
        type="system"
        :content="$t('dailyQuestion.dailyLimit.immersiveMessage')"
      />

      <!-- Validation Error - Immersive Style -->
      <ChatBubble
        v-if="validationError"
        type="system"
        :content="validationError"
      />
    </div>

    <!-- Input Section -->
    <div v-if="!hasAskedToday" class="input-section">
      <!-- Daily Limit Display -->
      <div class="daily-limit-display">
        <el-icon class="limit-icon"><ChatDotRound /></el-icon>
        <span class="limit-text">{{
          $t('dailyQuestion.questionsRemaining', {
            current: hasAskedToday ? 0 : 1,
            total: 1,
          })
        }}</span>
      </div>

      <!-- Quick Prompts -->
      <div v-if="!userQuestion && !isAsking" class="quick-prompts">
        <button
          v-for="prompt in quickPrompts"
          :key="prompt"
          class="quick-prompt-btn"
          @click="useQuickPrompt(prompt)"
        >
          {{ prompt }}
        </button>
      </div>

      <!-- Text Input -->
      <div class="input-area">
        <el-input
          v-model="question"
          type="textarea"
          :placeholder="$t('dailyQuestion.placeholder')"
          :rows="3"
          maxlength="200"
          show-word-limit
          :disabled="isAsking"
          class="question-input"
          @keydown.enter.prevent="askQuestion"
        />

        <el-button
          type="primary"
          size="large"
          :disabled="!question.trim() || question.length < 3 || isAsking"
          :loading="isAsking"
          class="ask-button"
          @click="askQuestion"
        >
          <el-icon><ChatDotRound /></el-icon>
          {{ $t('dailyQuestion.askButton') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import { useDailyQuestion } from '@/composables/useDailyQuestion';
import ChatBubble from './ChatBubble.vue';
import { splitIntoSentences, chunkSentences } from '@/utils/textSplitter';
import {
  ChatDotRound,
  MagicStick,
  Compass,
  Cpu,
  Loading,
} from '@element-plus/icons-vue';

interface Props {
  chartId: string;
}

const props = defineProps<Props>();
const { t, locale } = useI18n();
const messagesContainer = ref<HTMLElement>();
const userQuestion = ref('');
const validationError = ref('');
const chatBubbles = ref<string[]>([]);
let bubbleTimers: number[] = [];

const {
  question,
  response,
  isAsking,
  currentStatus,
  hasAskedToday,
  dailyLimitMessage,
  hasMemoryContext,
  memoryReference,
  askQuestion: performAsk,
  checkDailyLimit,
} = useDailyQuestion(props.chartId);

// Watch response changes and split into chat bubbles
// Uses pure complete processing approach for consistent sentence boundaries
watch(response, (newResponse) => {
  if (!newResponse) {
    chatBubbles.value = [];
    bubbleTimers.forEach((timer) => clearTimeout(timer));
    bubbleTimers = [];
    return;
  }

  // Always process the complete response for consistent sentence boundaries
  const sentences = splitIntoSentences(newResponse);
  const chunks = chunkSentences(sentences, 2); // Max 2 sentences per bubble

  // 清除現有的計時器
  bubbleTimers.forEach((timer) => clearTimeout(timer));
  bubbleTimers.length = 0;

  // 完全替換聊天氣泡陣列以確保內容同步
  chatBubbles.value = [...chunks];

  // 滾動到底部
  nextTick(() => scrollToBottom());
});

// Status mapping based on doc specification
const statusMap: Record<string, { text: string; icon: any }> = {
  REASONING: { text: '佩璇正在解讀問題意圖...', icon: MagicStick },
  FETCHING_DATA: { text: '正在調閱您的命盤卷宗...', icon: Compass },
  ANALYZING: { text: '結合時空能量編寫啟示中...', icon: Cpu },
  COMPLETED: { text: '分析完成', icon: ChatDotRound },
};

const getStatusIcon = (status: string) => {
  // Parse backend status format like "[思考中] 第 1 輪推理..."
  if (status.includes('思考中') || status.includes('Thinking')) {
    return statusMap['REASONING'].icon;
  }
  if (status.includes('執行中') || status.includes('Executing')) {
    return statusMap['FETCHING_DATA'].icon;
  }
  if (status.includes('切換中') || status.includes('Switching')) {
    return statusMap['ANALYZING'].icon;
  }
  return Loading;
};

const getStatusText = (status: string) => {
  // Convert technical status to warm Peixuan messages
  if (status.includes('思考中')) {
    return '佩璇正在仔細思考您的問題...';
  }
  if (status.includes('Thinking')) {
    return 'Peixuan is carefully considering your question...';
  }
  if (status.includes('執行中')) {
    return '正在為您調閱命盤資料...';
  }
  if (status.includes('Executing')) {
    return 'Retrieving your chart data...';
  }
  if (status.includes('切換中')) {
    return '佩璇換個角度來分析...';
  }
  if (status.includes('Switching')) {
    return 'Peixuan is trying a different approach...';
  }
  return status;
};

const quickPrompts = [
  '我今天的運勢如何？',
  '適合在今天做重大決定嗎？',
  '最近工作壓力大，有什麼建議？',
];

const useQuickPrompt = (prompt: string) => {
  question.value = prompt;
  askQuestion();
};

const askQuestion = async () => {
  if (!question.value.trim() || isAsking.value) {
    return;
  }

  // Clear previous validation errors
  validationError.value = '';

  // Validate question length
  if (question.value.trim().length < 3) {
    validationError.value = t('dailyQuestion.validation.tooShort');
    await nextTick();
    scrollToBottom();
    return;
  }

  try {
    // Show confirmation dialog
    await ElMessageBox.confirm(
      t('dailyQuestion.confirmation.message'),
      t('dailyQuestion.confirmation.title'),
      {
        confirmButtonText: t('dailyQuestion.confirmation.confirm'),
        cancelButtonText: t('dailyQuestion.confirmation.cancel'),
        type: 'warning',
        center: true,
        customClass: 'daily-question-confirm-dialog',
        confirmButtonClass: 'daily-question-confirm-btn',
        cancelButtonClass: 'daily-question-cancel-btn',
      },
    );

    // User confirmed, proceed with question
    userQuestion.value = question.value;
    await performAsk(question.value, locale.value);
    question.value = '';

    // Scroll to bottom after response
    await nextTick();
    scrollToBottom();
  } catch (error) {
    // User canceled, do nothing
    // User canceled, nothing to do
  }
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

onMounted(() => {
  checkDailyLimit();
});

onUnmounted(() => {
  // Clean up timers on component unmount
  bubbleTimers.forEach((timer) => clearTimeout(timer));
  bubbleTimers = [];
});
</script>

<style scoped>
.daily-question-panel {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  max-width: 800px;
  margin: 0 auto;
  position: relative;
}

/* Header Section - Cosmic Color Scheme */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  background: linear-gradient(
    135deg,
    var(--purple-star) 0%,
    var(--purple-star-dark) 100%
  );
  position: relative;
  overflow: hidden;
  min-height: 70px;
}

/* Cosmic Starfield Effect */
.panel-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(2px 2px at 20% 30%, white, transparent),
    radial-gradient(2px 2px at 60% 70%, white, transparent),
    radial-gradient(1px 1px at 50% 50%, white, transparent),
    radial-gradient(1px 1px at 80% 10%, white, transparent),
    radial-gradient(2px 2px at 90% 60%, white, transparent),
    radial-gradient(1px 1px at 33% 80%, white, transparent),
    radial-gradient(1px 1px at 15% 15%, white, transparent);
  background-size: 200% 200%;
  background-position: 0% 0%;
  opacity: 0.5;
  pointer-events: none;
  animation: starfield 60s linear infinite;
}

@keyframes starfield {
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: 100% 100%;
  }
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  position: relative;
  z-index: 1;
}

.peixuan-avatar {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md);
}

.avatar-emoji {
  font-size: 24px;
}

.status-indicator {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  background: var(--success);
  border: 2px solid var(--text-inverse);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.header-text h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--space-xs) 0;
  color: var(--text-inverse);
}

.subtitle {
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.status-display {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: var(--bg-tertiary);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-full);
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
}

.status-icon {
  font-size: var(--font-size-md);
  animation: spin 2s linear infinite;
}

.status-text {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-inverse);
}

/* Messages Container */
.messages-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden; /* 防止水平滾動 */
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

/* Keep only the thinking message styles, as it's not converted to ChatBubble */
.message {
  display: flex;
  max-width: 85%;
}

.ai-message {
  justify-content: flex-start;
}

.thinking-message {
  justify-content: flex-start;
}

.thinking-dots {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  border-top-left-radius: var(--radius-xs);
}

.thinking-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--info);
  animation: thinking 1.4s infinite ease-in-out both;
}

.thinking-dots span:nth-child(1) {
  animation-delay: -0.32s;
}
.thinking-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes thinking {
  0%,
  80%,
  100% {
    transform: scale(0) translateZ(0);
  }
  40% {
    transform: scale(1) translateZ(0);
  }
}

/* Input Section */
.input-section {
  padding: var(--space-sm) var(--space-lg);
  background: var(--bg-primary);
  border-top: 1px solid var(--border-light);
}

.daily-limit-display {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: linear-gradient(
    135deg,
    var(--info-alpha-10) 0%,
    var(--purple-alpha-10) 100%
  );
  border: 1px solid var(--info-alpha-20);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.limit-icon {
  font-size: var(--font-size-md);
  color: var(--info);
}

.limit-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.quick-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.quick-prompt-btn {
  padding: var(--space-xs) var(--space-sm);
  background: var(--info-lightest);
  color: var(--info);
  border: 1px solid var(--info-lighter);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 32px;
}

.quick-prompt-btn:hover {
  background: var(--info-lighter);
  transform: translateY(-1px);
}

.input-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.question-input {
  font-size: var(--font-size-md);
}

/* Elevated Ask Button - Purple Cosmic Theme */
.ask-button {
  align-self: flex-end;
  padding: var(--space-md) var(--space-xl);
  font-size: var(--font-size-md);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: 48px;
  background: var(--gradient-purple);
  border: none;
  box-shadow: var(--shadow-purple);
  position: relative;
  overflow: hidden;
  transition: all var(--transition-normal);
}

.ask-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: var(--bg-overlay);
  transform: translate(-50%, -50%);
  transition:
    width 0.6s,
    height 0.6s;
}

.ask-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-purple);
}

.ask-button:hover:not(:disabled)::before {
  width: 300px;
  height: 300px;
}

.ask-button:active:not(:disabled) {
  transform: translateY(0);
}

.ask-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Animations - Loading states only (acceptable continuous animations) */
@keyframes thinking {
  0%,
  80%,
  100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Accessibility: Disable animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  .status-indicator,
  .status-icon,
  .thinking-dots span,
  .panel-header::before,
  .streaming-response.is-streaming,
  .streaming-response.is-streaming::after {
    animation: none !important;
  }

  .status-indicator {
    opacity: 1; /* Show as static indicator */
  }

  .status-icon {
    transform: none; /* Show as static icon */
  }

  .panel-header::before {
    opacity: 0.3; /* Show static starfield */
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .panel-header {
    padding: var(--space-lg);
    flex-direction: column;
    gap: var(--space-md);
    text-align: center;
  }

  .messages-container {
    padding: var(--space-md);
    max-height: 300px;
  }

  .message {
    max-width: 95%;
  }

  .input-section {
    padding: var(--space-md);
  }

  .quick-prompts {
    justify-content: center;
  }

  .ask-button {
    align-self: stretch;
  }
}

/* 移動端動畫優化 */
@media (max-width: 768px) {
  .panel-header {
    padding: var(--space-sm) var(--space-md);
    min-height: 60px;
  }

  .messages-container {
    padding: var(--space-sm);
  }

  .input-section {
    padding: var(--space-xs) var(--space-md);
  }

  .quick-prompts {
    justify-content: flex-start;
    gap: var(--space-xs);
  }

  .quick-prompt-btn {
    font-size: 11px;
    padding: 6px 10px;
    min-height: 28px;
  }

  .ask-button {
    align-self: stretch;
  }

  /* 移動端動畫速度調整 */
  .panel-header::before {
    animation-duration: 80s;
  }

  .status-indicator {
    animation-duration: 3s;
  }

  .status-icon {
    animation-duration: 3s;
  }

  .thinking-dots span {
    animation-duration: 1.8s;
  }
}

/* 減少動畫偏好設定 */
@media (prefers-reduced-motion: reduce) {
  .panel-header::before,
  .status-indicator,
  .status-icon,
  .thinking-dots span {
    animation: none !important;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .quick-prompts {
    justify-content: center;
  }
}

@media (min-width: 1025px) {
  .messages-container {
    padding: var(--space-lg);
  }

  .quick-prompts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-sm);
  }
}

/* 深色模式文字對比度優化 */
:global(html.dark) .daily-question-panel {
  color: var(--text-primary);
}

/* 確認對話框美化 */
:deep(.daily-question-confirm-dialog) {
  border-radius: var(--radius-lg) !important;
  background: var(--bg-primary) !important;
  box-shadow: 0 20px 40px rgba(139, 69, 19, 0.15) !important;
  border: 1px solid var(--primary-alpha-20) !important;
}

:deep(.daily-question-confirm-dialog .el-message-box__header) {
  background: linear-gradient(
    135deg,
    var(--primary-color),
    var(--primary-light)
  ) !important;
  color: var(--text-inverse) !important;
  padding: var(--space-lg) !important;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0 !important;
  border-bottom: none !important;
}

:deep(.daily-question-confirm-dialog .el-message-box__title) {
  color: var(--text-inverse) !important;
  font-weight: 600 !important;
  font-size: 1.1rem !important;
}

:deep(.daily-question-confirm-dialog .el-message-box__content) {
  padding: var(--space-lg) !important;
  color: var(--text-primary) !important;
  font-size: 1rem !important;
  line-height: 1.6 !important;
}

:deep(.daily-question-confirm-dialog .el-message-box__btns) {
  padding: var(--space-md) var(--space-lg) var(--space-lg) !important;
  border-top: 1px solid var(--border-color) !important;
}

:deep(.daily-question-confirm-btn) {
  background: linear-gradient(
    135deg,
    var(--primary-color),
    var(--primary-light)
  ) !important;
  border: none !important;
  color: var(--text-inverse) !important;
  padding: var(--space-sm) var(--space-lg) !important;
  border-radius: var(--radius-md) !important;
  font-weight: 600 !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 2px 8px var(--primary-alpha-30) !important;
}

:deep(.daily-question-confirm-btn:hover) {
  transform: translateY(-1px) !important;
  box-shadow:
    0 4px 12px var(--primary-alpha-30),
    0 8px 16px var(--primary-alpha-20) !important;
}

:deep(.daily-question-cancel-btn) {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-secondary) !important;
  padding: var(--space-sm) var(--space-lg) !important;
  border-radius: var(--radius-md) !important;
  font-weight: 500 !important;
  transition: all 0.3s ease !important;
}

:deep(.daily-question-cancel-btn:hover) {
  background: var(--bg-tertiary) !important;
  border-color: var(--text-secondary) !important;
}

/* 深色模式下的確認對話框 */
:global(html.dark) :deep(.daily-question-confirm-dialog) {
  background: var(--bg-secondary) !important;
  border-color: var(--border-light) !important;
}

:global(html.dark)
  :deep(.daily-question-confirm-dialog .el-message-box__content) {
  color: var(--text-secondary) !important;
}

:global(html.dark) :deep(.daily-question-confirm-dialog .el-message-box__btns) {
  border-top-color: var(--border-light) !important;
}

:global(html.dark) :deep(.daily-question-cancel-btn) {
  background: var(--bg-tertiary) !important;
  border-color: var(--border-medium) !important;
  color: var(--text-secondary) !important;
}

:global(html.dark) :deep(.daily-question-cancel-btn:hover) {
  background: var(--border-medium) !important;
  border-color: var(--border-dark) !important;
}
</style>
