/**
 * Type Definitions for Unified Calculator
 *
 * Defines core input/output interfaces for the integrated calculation system.
 * Reference: IMPLEMENTATION_PLAN_PHASE1.md Task 4.1
 */

import type { GanZhi } from '../core/ganZhi';
import type { PalacePosition } from '../ziwei/palaces';
import type { Bureau } from '../ziwei/bureau';
import type { WuXingDistribution } from '../wuXing/distribution';
import type { DaYun } from '../fortune/dayun';
import type {
  StemCombination,
  BranchClash,
  HarmoniousCombination,
} from '../annual/interaction';
import type { Palace } from '../annual/palace';
import type { SiHuaAggregation } from '../ziwei/sihua/types';
import type { YearlyForecast, YearlyPeriod } from '../../services/annualFortune';

/**
 * Birth information input
 */
export interface BirthInfo {
  /** Solar date (Gregorian calendar) */
  solarDate: Date;

  /** Longitude in degrees (East positive: 0-180, West negative: -180-0) */
  longitude: number;

  /** Gender for ZiWei calculations */
  gender: 'male' | 'female';

  /** Optional: Leap month indicator for lunar calendar */
  isLeapMonth?: boolean;
}

/**
 * Calculation step record
 */
export interface CalculationStep {
  /** Step name/identifier */
  step: string;

  /** Input values */
  input: Record<string, unknown>;

  /** Output result */
  output: unknown;

  /** Description */
  description?: string;
}

/**
 * Calculation metadata
 */
export interface CalculationMetadata {
  /** Algorithms used */
  algorithms: string[];

  /** References/sources */
  references: string[];

  /** Calculation methods */
  methods: string[];
}

/**
 * Hidden stems (藏干) in earthly branches
 */
export interface HiddenStems {
  /** Primary hidden stem (本气) */
  primary: string;

  /** Middle hidden stem (中气, optional) */
  middle?: string;

  /** Residual hidden stem (余气, optional) */
  residual?: string;
}

/**
 * Ten Gods (十神) relationship
 */
export type TenGod = '比肩' | '劫財' | '食神' | '傷官' | '偏財' | '正財' | '七殺' | '正官' | '偏印' | '正印';

/**
 * BaZi calculation result
 */
export interface BaZiResult {
  /** Four pillars */
  fourPillars: {
    year: GanZhi;
    month: GanZhi;
    day: GanZhi;
    hour: GanZhi;
  };

  /** True solar time used for calculation */
  trueSolarTime: Date;

  /** Julian day number for day pillar */
  julianDay: number;

  /** Hidden stems details for each pillar's earthly branch */
  hiddenStems: {
    year: HiddenStems;
    month: HiddenStems;
    day: HiddenStems;
    hour: HiddenStems;
  };

  /** Ten Gods matrix (relationship of each stem to day stem) */
  tenGods: {
    year: TenGod;
    month: TenGod;
    hour: TenGod;
  };

  /** WuXing distribution with seasonality adjustment */
  wuxingDistribution: WuXingDistribution;

  /** Fortune cycles information */
  fortuneCycles: {
    /** QiYun date when fortune cycles begin */
    qiyunDate: Date;
    /** Direction of fortune progression */
    direction: 'forward' | 'backward';
    /** List of 10-year fortune cycles */
    dayunList: DaYun[];
    /** Current fortune cycle (null if outside all cycles) */
    currentDayun: DaYun | null;
  };

  /** Calculation steps */
  calculationSteps: CalculationStep[];

  /** Metadata */
  metadata: CalculationMetadata;
}

/**
 * Star symmetry information
 */
export interface StarSymmetry {
  /** Star name */
  star: string;

  /** Position */
  position: number;

  /** Symmetry pair star name (if applicable) */
  symmetryPair?: string;

  /** Symmetry pair position (if applicable) */
  symmetryPosition?: number;

  /** Symmetry type (e.g., "opposite", "mirror") */
  symmetryType?: string;
}

/**
 * ZiWei calculation result
 */
export interface ZiWeiResult {
  /** Life palace position */
  lifePalace: PalacePosition;

  /** Body palace position */
  bodyPalace: PalacePosition;

  /** Five elements bureau (2-6) */
  bureau: Bureau;

  /** ZiWei star position */
  ziWeiPosition: number;

  /** TianFu star position */
  tianFuPosition: number;

  /** Auxiliary stars */
  auxiliaryStars: {
    wenChang: number;
    wenQu: number;
    zuoFu: number;
    youBi: number;
  };

  /** Star symmetry information */
  starSymmetry: StarSymmetry[];

  /** 12 palaces array (命宮-父母宮) */
  palaces: Palace[];

  /** SiHua flying stars aggregation (optional) */
  sihuaAggregation?: SiHuaAggregation;

  /** Calculation steps */
  calculationSteps: CalculationStep[];

  /** Metadata */
  metadata: CalculationMetadata;
}

/**
 * Unified calculation result
 */
export interface CalculationResult {
  /** Input information */
  input: BirthInfo;

  /** BaZi calculation result */
  bazi: BaZiResult;

  /** ZiWei calculation result */
  ziwei: ZiWeiResult;

  /** Annual fortune (optional, requires query date) */
  annualFortune?: {
    /** Annual pillar (stem + branch) */
    annualPillar: { stem: string; branch: string };

    /** Annual life palace index in ZiWei chart (0-11) */
    annualLifePalaceIndex: number;

    /** Interactions between annual and natal chart */
    interactions: {
      /** Stem combinations (天干五合) */
      stemCombinations: StemCombination[];

      /** Branch clashes (地支六沖) */
      branchClashes: BranchClash[];

      /** Harmonious combinations (三合/三會) */
      harmoniousCombinations: HarmoniousCombination[];
    };

    /** Tai Sui analysis (太歲分析) */
    taiSuiAnalysis?: {
      /** 值太歲 (same branch as natal year) */
      zhi: boolean;
      /** 沖太歲 (six clashes) */
      chong: boolean;
      /** 刑太歲 (three punishments) */
      xing: {
        hasXing: boolean;
        xingType?: 'san_xing' | 'zi_xing' | 'wu_en_xing';
        description?: string;
      };
      /** 破太歲 (six destructions) */
      po: boolean;
      /** 害太歲 (six harms) */
      hai: boolean;
      /** Overall severity */
      severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
      /** Types of Tai Sui violations */
      types: string[];
      /** Recommendations */
      recommendations: string[];
    };

    /**
     * Yearly forecast with Lichun boundary splitting
     * @since Phase 2
     */
    yearlyForecast?: YearlyForecast;

    /**
     * @deprecated Use yearlyForecast instead. Kept for backward compatibility.
     * This field will be removed in a future version.
     */
    nextYear?: {
      annualPillar: { stem: string; branch: string };
      annualLifePalaceIndex: number;
    };
  };

  /** Calculation timestamp */
  timestamp: Date;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Validation passed */
  valid: boolean;

  /** Error messages (if any) */
  errors: string[];
}

/**
 * Re-export YearlyForecast and YearlyPeriod from annualFortune service
 */
export type { YearlyForecast, YearlyPeriod };
