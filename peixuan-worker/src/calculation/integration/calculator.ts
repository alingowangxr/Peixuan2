/**
 * Unified Calculator
 *
 * Integrates all Sprint 1-3 modules (BaZi, ZiWei) into a single unified interface.
 * Reference: IMPLEMENTATION_PLAN_PHASE1.md Task 4.1
 */

import { Solar } from 'lunar-typescript';
import type {
  BirthInfo,
  CalculationResult,
  BaZiResult,
  ZiWeiResult,
  CalculationStep,
  CalculationMetadata,
  HiddenStems,
  StarSymmetry,
  TenGod
} from '../types';
import { validateBirthInfo } from './validator';
import { calculateTrueSolarTime, dateToJulianDay } from '../core/time';
import { ganZhiToIndex } from '../core/ganZhi';
import { getFourPillarsFromLunar, getTenGodsFromLunar } from '../bazi/lunarAdapter';
import { getHiddenStems as getHiddenStemsArray } from '../bazi/hiddenStems';
import { calculateLifePalace, calculateBodyPalace } from '../ziwei/palaces';
import { calculateBureau } from '../ziwei/bureau';
import { findZiWeiPosition } from '../ziwei/stars/ziwei';
import { findTianFuPosition } from '../ziwei/stars/tianfu';
import { findTimeStars, findMonthStars } from '../ziwei/stars/auxiliary';
import { calculateWuXingDistribution } from '../wuXing/distribution';
import { determineFortuneDirection, calculateQiYunDate } from '../fortune/qiyun';
import { generateDaYunList, getCurrentDaYun } from '../fortune/dayun';
import { getAnnualPillar } from '../annual/liuchun';
import { locateAnnualLifePalace, type Palace } from '../annual/palace';
import {
  detectStemCombinations,
  detectBranchClashes,
  detectHarmoniousCombinations,
} from '../annual/interaction';
import { analyzeTaiSui } from '../../services/annual/taiSuiAnalysis';
import { aggregateSiHua } from '../ziwei/sihua/aggregator';
import { getPalaceStem } from '../ziwei/sihua/edgeGenerator';
import { calculateCurrentDecade } from '../ziwei/decade';
import { calculateYearlyForecast } from '../../services/annualFortune';

/**
 * Convert HiddenStem[] from hiddenStems.ts to HiddenStems interface
 */
function convertHiddenStems(branch: string): HiddenStems {
  const stems = getHiddenStemsArray(branch);
  const result: HiddenStems = { primary: stems[0].stem };
  if (stems.length > 1) {result.middle = stems[1].stem;}
  if (stems.length > 2) {result.residual = stems[2].stem;}
  return result;
}

/**
 * Calculate star symmetry information
 */
function calculateStarSymmetry(
  ziWeiPos: number,
  tianFuPos: number,
  auxiliaryStars: { wenChang: number; wenQu: number; zuoFu: number; youBi: number }
): StarSymmetry[] {
  const symmetry: StarSymmetry[] = [];

  // ZiWei-TianFu opposition symmetry
  symmetry.push({
    star: '紫微',
    position: ziWeiPos,
    symmetryPair: '天府',
    symmetryPosition: tianFuPos,
    symmetryType: 'opposite'
  });

  symmetry.push({
    star: '天府',
    position: tianFuPos,
    symmetryPair: '紫微',
    symmetryPosition: ziWeiPos,
    symmetryType: 'opposite'
  });

  // Auxiliary star pairs
  symmetry.push({
    star: '文昌',
    position: auxiliaryStars.wenChang,
    symmetryPair: '文曲',
    symmetryPosition: auxiliaryStars.wenQu,
    symmetryType: 'pair'
  });

  symmetry.push({
    star: '文曲',
    position: auxiliaryStars.wenQu,
    symmetryPair: '文昌',
    symmetryPosition: auxiliaryStars.wenChang,
    symmetryType: 'pair'
  });

  symmetry.push({
    star: '左辅',
    position: auxiliaryStars.zuoFu,
    symmetryPair: '右弼',
    symmetryPosition: auxiliaryStars.youBi,
    symmetryType: 'pair'
  });

  symmetry.push({
    star: '右弼',
    position: auxiliaryStars.youBi,
    symmetryPair: '左辅',
    symmetryPosition: auxiliaryStars.zuoFu,
    symmetryType: 'pair'
  });

  return symmetry;
}

/**
 * Place a star in the appropriate palace
 *
 * @param palaces - Palace array
 * @param starName - Name of the star
 * @param palaceIndex - Palace index (0-11) where star should be placed
 */
function placeStar(palaces: Palace[], starName: string, palaceIndex: number): void {
  const palace = palaces.find((p) => p.position === palaceIndex);
  if (palace) {
    if (!palace.stars) {
      palace.stars = [];
    }
    palace.stars.push({
      name: starName,
      brightness: 'neutral' // Default brightness, can be enhanced later
    });
  }
}

/**
 * Populate palaces with ZiWei system stars
 *
 * ZiWei system: 紫微, 天機, 太陽, 武曲, 天同, 廉貞
 * Follows purpleStarCalculation.ts pattern with offsets: [0, -1, -3, -4, -5, -8]
 *
 * @param palaces - Palace array to populate
 * @param ziWeiPosition - ZiWei star position (0-11)
 */
function populateZiWeiSystemStars(palaces: Palace[], ziWeiPosition: number): void {
  const ZIWEI_STAR_SYSTEM = ['紫微', '天機', '太陽', '武曲', '天同', '廉貞'];
  const ziweiSystemOffsets = [0, -1, -3, -4, -5, -8];

  for (let i = 0; i < ZIWEI_STAR_SYSTEM.length; i++) {
    const starName = ZIWEI_STAR_SYSTEM[i];
    const palaceIndex = (ziWeiPosition + ziweiSystemOffsets[i] + 12) % 12;
    placeStar(palaces, starName, palaceIndex);
  }
}

/**
 * Populate palaces with TianFu system stars
 *
 * TianFu system: 天府, 太陰, 貪狼, 巨門, 天相, 天梁, 七殺, 破軍
 * Follows purpleStarCalculation.ts pattern with offsets: [0, 1, 2, 3, 4, 5, 6, 10]
 *
 * @param palaces - Palace array to populate
 * @param tianFuPosition - TianFu star position (0-11)
 */
function populateTianFuSystemStars(palaces: Palace[], tianFuPosition: number): void {
  const TIANFU_STAR_SYSTEM = ['天府', '太陰', '貪狼', '巨門', '天相', '天梁', '七殺', '破軍'];
  const tianfuSystemOffsets = [0, 1, 2, 3, 4, 5, 6, 10];

  for (let i = 0; i < TIANFU_STAR_SYSTEM.length; i++) {
    const starName = TIANFU_STAR_SYSTEM[i];
    const palaceIndex = (tianFuPosition + tianfuSystemOffsets[i]) % 12;
    placeStar(palaces, starName, palaceIndex);
  }
}

/**
 * Populate palaces with auxiliary stars
 *
 * Auxiliary stars: 文昌, 文曲 (based on hour), 左輔, 右弼 (based on month)
 * Follows purpleStarCalculation.ts pattern
 *
 * @param palaces - Palace array to populate
 * @param hourBranch - Hour branch index (0-11)
 * @param lunarMonth - Lunar month (1-12)
 */
function populateAuxiliaryStars(
  palaces: Palace[],
  hourBranch: number,
  lunarMonth: number
): void {
  const CHEN_PALACE_STD_INDEX = 4; // 辰
  const XU_PALACE_STD_INDEX = 10; // 戌

  // 左輔: starts from 辰, advances by (lunarMonth - 1)
  const zuoFuPalaceIndex = (CHEN_PALACE_STD_INDEX + (lunarMonth - 1) + 12) % 12;
  placeStar(palaces, '左輔', zuoFuPalaceIndex);

  // 右弼: starts from 戌, retreats by (lunarMonth - 1)
  const youBiPalaceIndex = (XU_PALACE_STD_INDEX - (lunarMonth - 1) + 12) % 12;
  placeStar(palaces, '右弼', youBiPalaceIndex);

  // 文昌: starts from 戌, retreats by hourBranch
  const wenChangPalaceIndex = (XU_PALACE_STD_INDEX - hourBranch + 12) % 12;
  placeStar(palaces, '文昌', wenChangPalaceIndex);

  // 文曲: starts from 辰, advances by hourBranch
  const wenQuPalaceIndex = (CHEN_PALACE_STD_INDEX + hourBranch + 12) % 12;
  placeStar(palaces, '文曲', wenQuPalaceIndex);
}

/**
 * Create palace array for ZiWei chart
 *
 * Generates the 12 palaces array using life palace position and branch.
 * Uses EARTHLY_BRANCHES rotation starting from life palace position.
 *
 * @param lifePalacePosition - Life palace position (0-11)
 * @param lifePalaceBranch - Life palace earthly branch
 * @returns Array of 12 palaces with position and branch
 */
function createPalaceArrayFromLifePalace(
  lifePalacePosition: number,
  lifePalaceBranch: string
): Palace[] {
  const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // Find the index of life palace branch in EARTHLY_BRANCHES
  const lifePalaceBranchIndex = EARTHLY_BRANCHES.indexOf(lifePalaceBranch);
  if (lifePalaceBranchIndex === -1) {
    return [];
  }

  // Generate 12 palaces by rotating EARTHLY_BRANCHES to align with positions
  // At lifePalacePosition, we should have lifePalaceBranch
  const palaces: Palace[] = [];
  for (let i = 0; i < 12; i++) {
    // Calculate branch index: start from life palace branch, advance by (position - lifePalacePosition)
    const branchIndex = (lifePalaceBranchIndex + (i - lifePalacePosition) + 12) % 12;
    palaces.push({
      position: i,
      branch: EARTHLY_BRANCHES[branchIndex],
      stars: []
    });
  }

  return palaces;
}

/**
 * Unified Calculator Class
 *
 * Provides a single entry point for all astrological calculations.
 *
 * @example
 * const calculator = new UnifiedCalculator();
 * const result = calculator.calculate({
 *   solarDate: new Date(2024, 0, 1, 12, 0),
 *   longitude: 121.5,
 *   gender: 'male'
 * });
 */
export class UnifiedCalculator {
  /**
   * Calculate complete BaZi and ZiWei chart
   *
   * @param input - Birth information
   * @returns Complete calculation result
   * @throws Error if validation fails or calculation error occurs
   */
  calculate(input: BirthInfo): CalculationResult {
    // Step 1: Validate input
    const validation = validateBirthInfo(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Step 2: Calculate BaZi
    const bazi = this.calculateBaZi(input);

    // Step 3: Calculate Annual Fortune (using current date as query date)
    const queryDate = new Date();
    const annualPillar = getAnnualPillar(queryDate);

    // Step 4: Calculate ZiWei (pass annualStem for SiHua aggregation)
    const ziwei = this.calculateZiWei(input, bazi, annualPillar.stem);
    const annualLifePalaceIndex = locateAnnualLifePalace(
      annualPillar.branch,
      ziwei.palaces || []
    );

    // Detect interactions
    const stemCombinations = detectStemCombinations(annualPillar.stem, bazi.fourPillars);
    const branchClashes = detectBranchClashes(annualPillar.branch, bazi.fourPillars);
    const harmoniousCombinations = detectHarmoniousCombinations(
      annualPillar.branch,
      bazi.fourPillars,
      bazi.fortuneCycles.currentDayun?.branch
    );

    // Analyze Tai Sui (太歲分析)
    const taiSuiAnalysis = analyzeTaiSui(annualPillar, bazi.fourPillars);

    // Calculate yearly forecast (Phase 2)
    const currentDayunGanZhi = bazi.fortuneCycles.currentDayun
      ? { stem: bazi.fortuneCycles.currentDayun.stem, branch: bazi.fortuneCycles.currentDayun.branch }
      : undefined;
    const yearlyForecast = calculateYearlyForecast({
      birthDate: input.solarDate,
      queryDate,
      palaces: ziwei.palaces,
      fourPillars: bazi.fourPillars,
      currentDayun: currentDayunGanZhi,
    });

    // Step 5: Return unified result
    return {
      input,
      bazi,
      ziwei,
      annualFortune: {
        annualPillar,
        annualLifePalaceIndex,
        interactions: {
          stemCombinations,
          branchClashes,
          harmoniousCombinations,
        },
        taiSuiAnalysis,
        yearlyForecast,
      },
      timestamp: new Date()
    };
  }

  /**
   * Calculate BaZi (八字) components
   *
   * @param input - Birth information
   * @returns BaZi calculation result
   */
  private calculateBaZi(input: BirthInfo): BaZiResult {
    const { solarDate, longitude } = input;
    const calculationSteps: CalculationStep[] = [];

    // Calculate true solar time
    const trueSolarTimeResult = calculateTrueSolarTime(solarDate, longitude);
    const {trueSolarTime} = trueSolarTimeResult;
    calculationSteps.push({
      step: 'trueSolarTime',
      input: { solarDate: solarDate.toISOString(), longitude },
      output: trueSolarTime.toISOString(),
      description: 'Calculate true solar time based on longitude'
    });

    // Get Julian day for day pillar
    const julianDay = dateToJulianDay(solarDate);
    calculationSteps.push({
      step: 'julianDay',
      input: { solarDate: solarDate.toISOString() },
      output: julianDay,
      description: 'Convert solar date to Julian day number'
    });

    // Calculate four pillars using lunar-typescript (community-validated)
    const fourPillarsFromLunar = getFourPillarsFromLunar({ solarDate: trueSolarTime });
    const {year} = fourPillarsFromLunar;
    const {month} = fourPillarsFromLunar;
    const {day} = fourPillarsFromLunar;
    const {hour} = fourPillarsFromLunar;

    const yearStemIndex = ganZhiToIndex(year) % 10;
    const dayStemIndex = ganZhiToIndex(day) % 10;

    calculationSteps.push({
      step: 'fourPillars',
      input: { trueSolarTime: trueSolarTime.toISOString() },
      output: { year, month, day, hour },
      description: 'Calculate four pillars using lunar-typescript (true solar time corrected)'
    });

    // Extract stems and branches
    const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

    const yearBranch = EARTHLY_BRANCHES[ganZhiToIndex(year) % 12];
    const monthBranch = EARTHLY_BRANCHES[ganZhiToIndex(month) % 12];
    const dayBranch = EARTHLY_BRANCHES[ganZhiToIndex(day) % 12];
    const hourBranch = EARTHLY_BRANCHES[ganZhiToIndex(hour) % 12];
    const dayStem = HEAVENLY_STEMS[dayStemIndex];

    // Calculate hidden stems (using hiddenStems.ts, converted to HiddenStems interface)
    const hiddenStems = {
      year: convertHiddenStems(yearBranch),
      month: convertHiddenStems(monthBranch),
      day: convertHiddenStems(dayBranch),
      hour: convertHiddenStems(hourBranch)
    };

    // Calculate ten gods using lunar-typescript
    const yearStem = HEAVENLY_STEMS[yearStemIndex];
    const monthStem = HEAVENLY_STEMS[ganZhiToIndex(month) % 10];
    const hourStem = HEAVENLY_STEMS[ganZhiToIndex(hour) % 10];

    const tenGods = getTenGodsFromLunar(trueSolarTime) as {
      year: TenGod;
      month: TenGod;
      hour: TenGod;
    };

    // Calculate WuXing distribution
    const wuxingDistribution = calculateWuXingDistribution({
      year: { stem: yearStem, branch: yearBranch },
      month: { stem: monthStem, branch: monthBranch },
      day: { stem: dayStem, branch: dayBranch },
      hour: { stem: hourStem, branch: hourBranch }
    });
    calculationSteps.push({
      step: 'wuxingDistribution',
      input: { fourPillars: { year, month, day, hour } },
      output: wuxingDistribution,
      description: 'Calculate WuXing distribution with seasonality adjustment'
    });

    // Calculate fortune cycles (起運 & 大運)
    const direction = determineFortuneDirection(yearStem, input.gender);
    const qiyunDate = calculateQiYunDate(solarDate, yearStem, input.gender, trueSolarTime);
    calculationSteps.push({
      step: 'qiyunCalculation',
      input: { birthDate: solarDate.toISOString(), yearStem, gender: input.gender, trueSolarTime: trueSolarTime.toISOString() },
      output: { qiyunDate: qiyunDate.toISOString(), direction },
      description: 'Calculate QiYun date and fortune direction'
    });

    const dayunList = generateDaYunList(
      { stem: monthStem, branch: monthBranch },
      solarDate,
      qiyunDate,
      direction,
      10
    );
    const currentDayun = getCurrentDaYun(dayunList, new Date());
    calculationSteps.push({
      step: 'dayunGeneration',
      input: { monthPillar: month, birthDate: solarDate.toISOString(), qiyunDate: qiyunDate.toISOString(), direction, count: 10 },
      output: { dayunList: dayunList.map(d => ({ stem: d.stem, branch: d.branch, startAge: d.startAge, endAge: d.endAge })), currentDayun },
      description: 'Generate 10-year fortune cycles and identify current cycle'
    });

    const fortuneCycles = {
      qiyunDate,
      direction,
      dayunList,
      currentDayun
    };

    // Metadata
    const metadata: CalculationMetadata = {
      algorithms: ['JulianDayMethod', 'TrueSolarTimeCorrection', 'LichunBoundary'],
      references: ['渊海子平', '三命通会', '滴天髓'],
      methods: ['FourPillarsCalculation', 'HiddenStemsExtraction', 'TenGodsMatrix', 'SeasonalityAdjustment', 'MetabolicConversion', 'FortuneDirection']
    };

    return {
      fourPillars: {
        year,
        month,
        day,
        hour
      },
      trueSolarTime,
      julianDay,
      hiddenStems,
      tenGods,
      wuxingDistribution,
      fortuneCycles,
      calculationSteps,
      metadata
    };
  }

  /**
   * Calculate ZiWei (紫微斗數) components
   *
   * @param input - Birth information
   * @param bazi - BaZi calculation result (for hour branch)
   * @param annualStem - Annual fortune's heavenly stem (optional)
   * @returns ZiWei calculation result
   */
  private calculateZiWei(input: BirthInfo, bazi: BaZiResult, annualStem?: string): ZiWeiResult {
    const { solarDate, isLeapMonth } = input;
    const calculationSteps: CalculationStep[] = [];

    // Convert to lunar calendar
    const solar = Solar.fromDate(solarDate);
    const lunar = solar.getLunar();
    const lunarMonth = lunar.getMonth();
    const lunarDay = lunar.getDay();
    calculationSteps.push({
      step: 'lunarConversion',
      input: { solarDate: solarDate.toISOString() },
      output: { lunarMonth, lunarDay },
      description: 'Convert solar date to lunar calendar'
    });

    // Get hour branch index from BaZi hour pillar
    const hourBranch = ganZhiToIndex(bazi.fourPillars.hour) % 12;

    // Calculate palaces
    const lifePalace = calculateLifePalace(
      lunarMonth,
      hourBranch,
      { leapMonthAdjustment: isLeapMonth ? 1 : 0 }
    );
    calculationSteps.push({
      step: 'lifePalace',
      input: { lunarMonth, hourBranch, isLeapMonth },
      output: lifePalace,
      description: 'Calculate life palace (命宫) position'
    });

    const bodyPalace = calculateBodyPalace(lunarMonth, hourBranch);
    calculationSteps.push({
      step: 'bodyPalace',
      input: { lunarMonth, hourBranch },
      output: bodyPalace,
      description: 'Calculate body palace (身宫) position'
    });

    // Calculate bureau (五行局)
    // Life palace stem via 五虎遁 (Wu-Hu-Dun) method
    const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const yearStemIndex = ganZhiToIndex(bazi.fourPillars.year) % 10;
    const yearStem = HEAVENLY_STEMS[yearStemIndex];
    const lifePalaceStem = getPalaceStem(yearStem, lifePalace.position) || HEAVENLY_STEMS[0];
    const bureau = calculateBureau(lifePalaceStem, lifePalace.branch);
    calculationSteps.push({
      step: 'bureau',
      input: { lifePalaceStem, lifePalaceBranch: lifePalace.branch },
      output: bureau,
      description: 'Calculate five elements bureau (五行局)'
    });

    // Calculate star positions
    const ziWeiPosition = findZiWeiPosition(lunarDay, bureau);
    calculationSteps.push({
      step: 'ziWeiPosition',
      input: { lunarDay, bureau },
      output: ziWeiPosition,
      description: 'Calculate ZiWei star (紫微星) position'
    });

    const tianFuPosition = findTianFuPosition(ziWeiPosition);
    calculationSteps.push({
      step: 'tianFuPosition',
      input: { ziWeiPosition },
      output: tianFuPosition,
      description: 'Calculate TianFu star (天府星) position based on ZiWei'
    });

    const { wenChang, wenQu } = findTimeStars(hourBranch);
    calculationSteps.push({
      step: 'timeStars',
      input: { hourBranch },
      output: { wenChang, wenQu },
      description: 'Calculate time-based auxiliary stars (文昌/文曲)'
    });

    const { zuoFu, youBi } = findMonthStars(lunarMonth);
    calculationSteps.push({
      step: 'monthStars',
      input: { lunarMonth },
      output: { zuoFu, youBi },
      description: 'Calculate month-based auxiliary stars (左辅/右弼)'
    });

    // Calculate star symmetry
    const auxiliaryStars = { wenChang, wenQu, zuoFu, youBi };
    const starSymmetry = calculateStarSymmetry(ziWeiPosition, tianFuPosition, auxiliaryStars);

    // Generate palaces array using life palace position and branch
    const palaces = createPalaceArrayFromLifePalace(lifePalace.position, lifePalace.branch);
    calculationSteps.push({
      step: 'palacesArray',
      input: { lifePalacePosition: lifePalace.position, lifePalaceBranch: lifePalace.branch },
      output: palaces,
      description: 'Generate 12 palaces array with earthly branches'
    });

    // Populate palaces with stars
    populateZiWeiSystemStars(palaces, ziWeiPosition);
    populateTianFuSystemStars(palaces, tianFuPosition);
    populateAuxiliaryStars(palaces, hourBranch, lunarMonth);
    calculationSteps.push({
      step: 'starPlacement',
      input: { ziWeiPosition, tianFuPosition, hourBranch, lunarMonth },
      output: { totalStars: palaces.reduce((sum, p) => sum + (p.stars?.length || 0), 0) },
      description: 'Populate palaces with main stars (ZiWei + TianFu systems) and auxiliary stars'
    });

    // Calculate current decade stem
    const decadeStem = calculateCurrentDecade(
      solarDate,
      bureau,
      yearStem,
      input.gender,
      palaces
    );
    calculationSteps.push({
      step: 'decadeCalculation',
      input: { birthDate: solarDate.toISOString(), bureau, yearStem, gender: input.gender },
      output: decadeStem,
      description: 'Calculate current decade (大限) palace stem'
    });

    // Calculate SiHua Flying Stars aggregation
    // Pass lifePalaceStem as first parameter, decadeStem as second parameter, annualStem as third parameter
    const sihuaAggregation = aggregateSiHua(palaces, lifePalaceStem, decadeStem, annualStem);
    calculationSteps.push({
      step: 'sihuaAggregation',
      input: { palaces, lifePalaceStem, decadeStem, annualStem },
      output: sihuaAggregation,
      description: 'Aggregate SiHua flying stars analysis (cycles, centrality, graph statistics)'
    });

    // Metadata
    const metadata: CalculationMetadata = {
      algorithms: ['ZiWeiPositioning', 'BureauCalculation', 'PalacePositioning', 'SiHuaGraphAnalysis'],
      references: ['紫微斗数全书', '紫微斗数讲义', '骨髓赋'],
      methods: ['LunarCalendar', 'StarSymmetry', 'AuxiliaryStarPlacement', 'FlyingStarCycleDetection', 'CentralityAnalysis']
    };

    return {
      lifePalace,
      bodyPalace,
      bureau,
      ziWeiPosition,
      tianFuPosition,
      auxiliaryStars,
      starSymmetry,
      palaces,
      sihuaAggregation,
      calculationSteps,
      metadata
    };
  }
}
