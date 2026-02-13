/**
 * Daily Reminder Service
 *
 * Provides template-based daily reminders based on BaZi chart data and daily stem-branch.
 * No AI generation - uses simplified WuXing interaction logic with pre-defined templates.
 * Cost: $0
 */

import { getDayPillarFromLunar } from '../calculation/bazi/lunarAdapter';
import type { GanZhi } from '../calculation/core/ganZhi';

/**
 * Daily reminder tag
 */
export interface DailyTag {
  label: string;
  type: 'success' | 'warning' | 'info';
}

/**
 * Daily reminder result
 */
export interface DailyReminder {
  text: string;
  tags: DailyTag[];
}

/**
 * WuXing (Five Elements) enumeration
 */
enum WuXing {
  Wood = '木',
  Fire = '火',
  Earth = '土',
  Metal = '金',
  Water = '水'
}

/**
 * Stem to WuXing mapping
 * 甲乙=木, 丙丁=火, 戊己=土, 庚辛=金, 壬癸=水
 */
const STEM_TO_WUXING: Record<string, WuXing> = {
  '甲': WuXing.Wood,
  '乙': WuXing.Wood,
  '丙': WuXing.Fire,
  '丁': WuXing.Fire,
  '戊': WuXing.Earth,
  '己': WuXing.Earth,
  '庚': WuXing.Metal,
  '辛': WuXing.Metal,
  '壬': WuXing.Water,
  '癸': WuXing.Water
};

/**
 * Branch to WuXing mapping (simplified, using main element)
 * 寅卯=木, 巳午=火, 辰戌丑未=土, 申酉=金, 亥子=水
 */
const BRANCH_TO_WUXING: Record<string, WuXing> = {
  '子': WuXing.Water,
  '丑': WuXing.Earth,
  '寅': WuXing.Wood,
  '卯': WuXing.Wood,
  '辰': WuXing.Earth,
  '巳': WuXing.Fire,
  '午': WuXing.Fire,
  '未': WuXing.Earth,
  '申': WuXing.Metal,
  '酉': WuXing.Metal,
  '戌': WuXing.Earth,
  '亥': WuXing.Water
};

/**
 * WuXing interaction types
 */
enum InteractionType {
  Generate = 'generate',    // 相生 (生我)
  Overcome = 'overcome',    // 相剋 (剋我)
  Same = 'same',            // 同類
  Neutral = 'neutral'       // 中性
}

/**
 * WuXing generation cycle (相生)
 * Wood -> Fire -> Earth -> Metal -> Water -> Wood
 */
const GENERATION_CYCLE: Record<WuXing, WuXing> = {
  [WuXing.Wood]: WuXing.Fire,
  [WuXing.Fire]: WuXing.Earth,
  [WuXing.Earth]: WuXing.Metal,
  [WuXing.Metal]: WuXing.Water,
  [WuXing.Water]: WuXing.Wood
};

/**
 * WuXing overcoming cycle (相剋)
 * Wood -> Earth, Earth -> Water, Water -> Fire, Fire -> Metal, Metal -> Wood
 */
const OVERCOMING_CYCLE: Record<WuXing, WuXing> = {
  [WuXing.Wood]: WuXing.Earth,
  [WuXing.Earth]: WuXing.Water,
  [WuXing.Water]: WuXing.Fire,
  [WuXing.Fire]: WuXing.Metal,
  [WuXing.Metal]: WuXing.Wood
};

/**
 * Calculate daily stem-branch for a given date
 *
 * @param date - The date to calculate (local time)
 * @returns GanZhi (stem-branch) for the day
 *
 * @example
 * const dailyStemBranch = calculateDailyStemBranch(new Date('2025-12-06'));
 * // Returns: { stem: '甲', branch: '子' }
 */
export function calculateDailyStemBranch(date: Date): GanZhi {
  return getDayPillarFromLunar(date);
}

/**
 * Detect WuXing interaction type between two elements
 *
 * @param element1 - First WuXing element
 * @param element2 - Second WuXing element
 * @returns Interaction type
 */
function detectWuXingInteraction(element1: WuXing, element2: WuXing): InteractionType {
  if (element1 === element2) {
    return InteractionType.Same;
  }

  // Check if element2 generates element1 (生我)
  if (GENERATION_CYCLE[element2] === element1) {
    return InteractionType.Generate;
  }

  // Check if element2 overcomes element1 (剋我)
  if (OVERCOMING_CYCLE[element2] === element1) {
    return InteractionType.Overcome;
  }

  return InteractionType.Neutral;
}

/**
 * Detect daily interactions between chart data and daily stem-branch
 *
 * Uses simplified WuXing interaction logic:
 * - Compares daily stem with day pillar stem from chart
 * - Compares daily branch with day pillar branch from chart
 * - Returns interaction summary
 *
 * @param chartData - Parsed chart data (must include fourPillars.day)
 * @param dailyStemBranch - Daily stem-branch
 * @returns Interaction summary object
 */
export function detectDailyInteractions(chartData: any, dailyStemBranch: GanZhi): {
  stemInteraction: InteractionType;
  branchInteraction: InteractionType;
  overall: 'favorable' | 'unfavorable' | 'neutral';
} {
  // Extract day pillar from chart data
  const dayPillar = chartData?.bazi?.fourPillars?.day;

  if (!dayPillar) {
    console.warn('[detectDailyInteractions] No day pillar found in chart data, using neutral defaults');
    return {
      stemInteraction: InteractionType.Neutral,
      branchInteraction: InteractionType.Neutral,
      overall: 'neutral'
    };
  }

  // Get WuXing elements
  const chartStemElement = STEM_TO_WUXING[dayPillar.stem];
  const dailyStemElement = STEM_TO_WUXING[dailyStemBranch.stem];
  const chartBranchElement = BRANCH_TO_WUXING[dayPillar.branch];
  const dailyBranchElement = BRANCH_TO_WUXING[dailyStemBranch.branch];

  // Detect interactions
  const stemInteraction = detectWuXingInteraction(chartStemElement, dailyStemElement);
  const branchInteraction = detectWuXingInteraction(chartBranchElement, dailyBranchElement);

  // Determine overall favorability
  let overall: 'favorable' | 'unfavorable' | 'neutral';

  if (stemInteraction === InteractionType.Overcome || branchInteraction === InteractionType.Overcome) {
    overall = 'unfavorable';
  } else if (stemInteraction === InteractionType.Generate || branchInteraction === InteractionType.Generate) {
    overall = 'favorable';
  } else if (stemInteraction === InteractionType.Same || branchInteraction === InteractionType.Same) {
    overall = 'favorable';
  } else {
    overall = 'neutral';
  }

  return {
    stemInteraction,
    branchInteraction,
    overall
  };
}

/**
 * Template-based reminder texts (Chinese Traditional)
 */
const REMINDER_TEMPLATES_ZH = {
  favorable: [
    '今日宜動宜進取,適合推進計畫與合作 ✨',
    '今日運勢順遂,把握機會展現自我 🌟',
    '今日氣場相合,適合重要決策與交流 💫',
    '今日能量充沛,適合開展新事物 🎯'
  ],
  unfavorable: [
    '今日宜靜不宜動,保持平常心即可 🍃',
    '今日宜低調行事,避免冒進與衝突 🌙',
    '今日宜修養沉潛,以靜制動為佳 ⛰️',
    '今日宜謹慎保守,穩紮穩打為上 🛡️'
  ],
  neutral: [
    '今日平穩如常,順勢而為即可 ☁️',
    '今日運勢平和,隨緣應對為佳 🌾',
    '今日無大吉凶,按部就班即可 🌸',
    '今日平安順遂,保持平常心 ✨'
  ]
};

/**
 * Template-based reminder texts (English)
 */
const REMINDER_TEMPLATES_EN = {
  favorable: [
    'Today is favorable for action and progress ✨',
    'Today brings good fortune, seize opportunities to shine 🌟',
    'Today\'s energy aligns well, ideal for important decisions and communication 💫',
    'Today is full of vitality, perfect for starting new endeavors 🎯'
  ],
  unfavorable: [
    'Today calls for caution and patience 🍃',
    'Today favors a low profile, avoid risks and conflicts 🌙',
    'Today is best for rest and reflection, stay calm and steady ⛰️',
    'Today requires prudence and conservative approach 🛡️'
  ],
  neutral: [
    'Today is calm and steady ☁️',
    'Today brings balanced energy, go with the flow 🌾',
    'Today is neither particularly fortunate nor challenging, maintain your routine 🌸',
    'Today is peaceful and smooth, keep a calm mind ✨'
  ]
};

/**
 * Tag templates based on overall favorability (Chinese Traditional)
 */
const TAG_TEMPLATES_ZH: Record<'favorable' | 'unfavorable' | 'neutral', DailyTag[]> = {
  favorable: [
    { label: '宜動', type: 'success' },
    { label: '吉順', type: 'success' }
  ],
  unfavorable: [
    { label: '宜靜', type: 'warning' },
    { label: '謹慎', type: 'warning' }
  ],
  neutral: [
    { label: '平穩', type: 'info' },
    { label: '平安', type: 'info' }
  ]
};

/**
 * Tag templates based on overall favorability (English)
 */
const TAG_TEMPLATES_EN: Record<'favorable' | 'unfavorable' | 'neutral', DailyTag[]> = {
  favorable: [
    { label: 'Active', type: 'success' },
    { label: 'Auspicious', type: 'success' }
  ],
  unfavorable: [
    { label: 'Cautious', type: 'warning' },
    { label: 'Careful', type: 'warning' }
  ],
  neutral: [
    { label: 'Stable', type: 'info' },
    { label: 'Peaceful', type: 'info' }
  ]
};

/**
 * Generate daily reminder text and tags based on interactions
 *
 * Uses template-based approach (no AI):
 * - Selects template based on overall favorability
 * - Uses simple hash to ensure same date always gets same template
 * - Adds appropriate tags
 * - Supports multiple locales (zh-TW, en)
 *
 * @param interactions - Interaction summary from detectDailyInteractions()
 * @param date - The date for the reminder (used for consistent template selection)
 * @param locale - Locale for templates ('zh-TW' or 'en', default: 'zh-TW')
 * @returns Daily reminder object with text and tags
 */
export function generateDailyReminder(
  interactions: { overall: 'favorable' | 'unfavorable' | 'neutral' },
  date: Date = new Date(),
  locale: 'zh-TW' | 'en' = 'zh-TW'
): DailyReminder {
  const { overall } = interactions;

  // Select templates based on locale
  const reminderTemplates = locale === 'en' ? REMINDER_TEMPLATES_EN : REMINDER_TEMPLATES_ZH;
  const tagTemplates = locale === 'en' ? TAG_TEMPLATES_EN : TAG_TEMPLATES_ZH;

  // Select template based on date (ensures consistency)
  const templates = reminderTemplates[overall];
  const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const hash = dateKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const templateIndex = hash % templates.length;

  const text = templates[templateIndex];
  const tags = tagTemplates[overall];

  return {
    text,
    tags
  };
}
