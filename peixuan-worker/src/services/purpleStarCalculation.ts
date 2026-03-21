// peixuan-worker/src/services/purpleStarCalculation.ts
// Ported from bazi-app-vue/src/utils/ziweiCalc.ts

import type { Lunar } from 'lunar-typescript';
import { Solar } from 'lunar-typescript';

// 定義星曜和宮位的基本類型 (可以後續擴展)
export interface Star {
  // 新增 export
  name: string;
  type: 'main' | 'auxiliary' | 'minor'; // 主星, 輔星, 小星等
  palaceIndex: number; // 所在宮位的索引 (0-11) 標準地支索引，子=0
  transformations?: ('祿' | '權' | '科' | '忌')[]; // 星曜的四化狀態
  // 其他星曜屬性，如亮度、五行等
}

export interface Palace {
  // 新增 export
  name: string; // 宮位名稱，如命宮、兄弟宮
  index: number; // 宮位地支索引 (0-11, 子=0, 丑=1, ..., 亥=11)
  stars: Star[];
  gan?: string; // 宮干
  zhi?: string; // 宮支 (地支名稱)
  // 其他宮位屬性，如宮干、宮支、吉凶等
}

export interface DaXianInfo {
  // 新增 export
  startAge: number;
  endAge: number;
  palaceName: string;
  palaceZhi: string;
  palaceIndex: number; // 宮位的地支索引
}

export interface XiaoXianInfo {
  // 新增 export
  age: number; // 虛歲
  palaceName: string;
  palaceZhi: string;
  palaceIndex: number;
}

export interface LiuNianTaiSuiInfo {
  // 新增 export
  year: number; // 公曆年
  ganZhi: string; // 流年干支
  palaceName: string;
  palaceZhi: string;
  palaceIndex: number;
}

export interface PurpleStarChart {
  // 新增 export
  palaces: Palace[];
  mingPalaceIndex: number; // 命宮的地支索引 (子=0)
  shenPalaceIndex: number; // 身宮的地支索引 (子=0)
  mingGan?: string; // 命宮天干
  fiveElementsBureau?: string; // 五行局，例如 "水二局"
  daXian?: DaXianInfo[]; // 大限資訊
  xiaoXian?: XiaoXianInfo[]; // 小限資訊 (例如到100歲)
  liuNian?: LiuNianTaiSuiInfo[]; // 流年太歲宮資訊
  // 其他命盤資訊，如命主、身主等
}

export interface BirthInfo {
  // 新增 export
  solarDate: Date; // 公曆日期和時間
  gender: 'male' | 'female'; // 性別
  // 可能需要出生地點以校正真太陽時，但簡化版暫不處理
}

type TransformationType = '祿' | '權' | '科' | '忌';
interface FourTransformations {
  lu: string; // 化祿的星曜名稱
  quan: string; // 化權的星曜名稱
  ke: string; // 化科的星曜名稱
  ji: string; // 化忌的星曜名稱
}

class PurpleStarCalculator {
  private birthInfo: BirthInfo;
  private lunarDate: Lunar;
  private solarDate: Date;
  private mingPalaceStdIndex: number;
  private shenPalaceStdIndex: number;
  private fiveElementsBureau: string | undefined;
  private fiveElementsBureauNumber: number | undefined;
  private mingPalaceGan: string;

  private readonly ZHI_NAMES = [
    '子',
    '丑',
    '寅',
    '卯',
    '辰',
    '巳',
    '午',
    '未',
    '申',
    '酉',
    '戌',
    '亥',
  ];
  private readonly GAN_NAMES = [
    '甲',
    '乙',
    '丙',
    '丁',
    '戊',
    '己',
    '庚',
    '辛',
    '壬',
    '癸',
  ];
  private readonly PALACE_NAMES_ORDERED = [
    '命宮',
    '兄弟宮',
    '夫妻宮',
    '子女宮',
    '財帛宮',
    '疾厄宮',
    '遷移宮',
    '交友宮',
    '官祿宮',
    '田宅宮',
    '福德宮',
    '父母宮',
  ];
  private readonly ZIWEI_STAR_SYSTEM = [
    '紫微',
    '天機',
    '太陽',
    '武曲',
    '天同',
    '廉貞',
  ];
  private readonly TIANFU_STAR_SYSTEM = [
    '天府',
    '太陰',
    '貪狼',
    '巨門',
    '天相',
    '天梁',
    '七殺',
    '破軍',
  ];
  private readonly FOUR_TRANSFORMATIONS_MAP: Record<
    string,
    FourTransformations
  > = {
    甲: { lu: '廉貞', quan: '破軍', ke: '武曲', ji: '太陽' },
    乙: { lu: '天機', quan: '天梁', ke: '紫微', ji: '太陰' },
    丙: { lu: '天同', quan: '天機', ke: '文昌', ji: '廉貞' },
    丁: { lu: '太陰', quan: '天同', ke: '天機', ji: '巨門' },
    戊: { lu: '貪狼', quan: '太陰', ke: '右弼', ji: '天機' },
    己: { lu: '武曲', quan: '貪狼', ke: '天梁', ji: '文曲' },
    庚: { lu: '太陽', quan: '武曲', ke: '太陰', ji: '天同' },
    辛: { lu: '巨門', quan: '太陽', ke: '文曲', ji: '文昌' },
    壬: { lu: '天梁', quan: '紫微', ke: '左輔', ji: '武曲' },
    癸: { lu: '破軍', quan: '巨門', ke: '太陰', ji: '貪狼' },
  };

  constructor(birthInfo: BirthInfo) {
    this.birthInfo = birthInfo;
    this.solarDate = this.birthInfo.solarDate;
    const solarInstance = Solar.fromYmdHms(
      this.solarDate.getFullYear(),
      this.solarDate.getMonth() + 1,
      this.solarDate.getDate(),
      this.solarDate.getHours(),
      this.solarDate.getMinutes(),
      this.solarDate.getSeconds(),
    );
    this.lunarDate = solarInstance.getLunar();

    const palacesInfo = this.calculateMingAndShenPalaceIndices();
    this.mingPalaceStdIndex = palacesInfo.mingPalaceStdIndex;
    this.shenPalaceStdIndex = palacesInfo.shenPalaceStdIndex;
    this.mingPalaceGan = this.getMingPalaceGan();
    this.fiveElementsBureau = this.calculateFiveElementsBureau();
    this.fiveElementsBureauNumber = this.extractBureauNumber(
      this.fiveElementsBureau,
    );
  }

  private getChineseHourZhiIndex(): number {
    return this.ZHI_NAMES.indexOf(this.lunarDate.getTimeZhi());
  }
  private calculateMingAndShenPalaceIndices(): {
    mingPalaceStdIndex: number;
    shenPalaceStdIndex: number;
  } {
    const YIN_PALACE_STD_INDEX = 2;
    const lunarMonth = this.lunarDate.getMonth();
    const chineseHourZhiIndex = this.getChineseHourZhiIndex();
    let mingPalaceStdIndex =
      YIN_PALACE_STD_INDEX + (lunarMonth - 1) - chineseHourZhiIndex;
    mingPalaceStdIndex = ((mingPalaceStdIndex % 12) + 12) % 12;
    const shenPalaceStdIndex =
      (YIN_PALACE_STD_INDEX + (lunarMonth - 1) + chineseHourZhiIndex) % 12;
    return { mingPalaceStdIndex, shenPalaceStdIndex };
  }
  private getMingPalaceGan(): string {
    const yearGan = this.lunarDate.getYearGan();
    let yinPalaceGan: string;
    if (['甲', '己'].includes(yearGan)) {
      yinPalaceGan = '丙';
    } else if (['乙', '庚'].includes(yearGan)) {
      yinPalaceGan = '戊';
    } else if (['丙', '辛'].includes(yearGan)) {
      yinPalaceGan = '庚';
    } else if (['丁', '壬'].includes(yearGan)) {
      yinPalaceGan = '壬';
    } else if (['戊', '癸'].includes(yearGan)) {
      yinPalaceGan = '甲';
    } else {
      throw new Error('Invalid year Gan');
    }
    const ganIndex = (gan: string) => this.GAN_NAMES.indexOf(gan);
    const yinPalaceGanIndex = ganIndex(yinPalaceGan);
    const mingPalaceZhiIndex = this.mingPalaceStdIndex;
    const yinPalaceStdIndex = 2;
    const diff = (mingPalaceZhiIndex - yinPalaceStdIndex + 12) % 12;
    const mingPalaceGanIndex = (yinPalaceGanIndex + diff) % 10;
    return this.GAN_NAMES[mingPalaceGanIndex];
  }
  private calculateFiveElementsBureau(): string {
    const { mingPalaceGan } = this;
    const mingPalaceZhi = this.ZHI_NAMES[this.mingPalaceStdIndex];
    const mingGanZhi = mingPalaceGan + mingPalaceZhi;

    // 完整的60甲子五行局對照表（基於傳統紫微斗數納音五行）
    if (
      [
        '甲子',
        '乙丑',
        '丙子',
        '丁丑',
        '甲寅',
        '乙卯',
        '甲申',
        '乙酉',
        '壬子',
        '癸丑',
        '壬戌',
        '癸亥',
      ].includes(mingGanZhi)
    ) {
      return '水二局';
    }
    if (
      [
        '戊辰',
        '己巳',
        '壬午',
        '癸未',
        '戊戌',
        '己亥',
        '壬申',
        '癸酉',
        '庚寅',
        '辛卯',
        '庚申',
        '辛酉',
      ].includes(mingGanZhi)
    ) {
      return '木三局';
    }
    if (
      [
        '甲午',
        '乙未',
        '壬寅',
        '癸卯',
        '庚辰',
        '辛巳',
        '庚戌',
        '辛亥',
        '甲辰',
        '乙巳',
        '丙申',
        '丁酉',
      ].includes(mingGanZhi)
    ) {
      return '金四局';
    }
    if (
      [
        '戊寅',
        '己卯',
        '丙戌',
        '丁亥',
        '庚午',
        '辛未',
        '戊申',
        '己酉',
        '庚子',
        '辛丑',
        '丙辰',
        '丁巳',
      ].includes(mingGanZhi)
    ) {
      return '土五局';
    }
    if (
      [
        '丙寅',
        '丁卯',
        '甲戌',
        '乙亥',
        '戊子',
        '己丑',
        '戊午',
        '己未',
        '丙午',
        '丁未',
        '壬辰',
        '癸巳',
      ].includes(mingGanZhi)
    ) {
      return '火六局';
    }

    // 如果找不到對應的五行局，拋出錯誤而非使用預設值
    throw new Error(
      `無法確定命宮干支 ${mingGanZhi} 的五行局，請檢查輸入資料是否正確。可能的原因：1) 農曆轉換錯誤 2) 命宮計算錯誤 3) 輸入資料不完整`,
    );
  }
  private extractBureauNumber(bureau: string | undefined): number | undefined {
    if (!bureau) {
      throw new Error('五行局資料為空，無法進行後續計算');
    }

    // 支援阿拉伯數字和中文數字
    const chineseNumbers: Record<string, number> = {
      '二': 2, '三': 3, '四': 4, '五': 5, '六': 6
    };

    // 先嘗試匹配阿拉伯數字
    const arabicMatch = bureau.match(/\d+/);
    if (arabicMatch) {
      const number = parseInt(arabicMatch[0], 10);
      if ([2, 3, 4, 5, 6].includes(number)) {
        return number;
      }
      throw new Error(`提取到的五行局數字 ${number} 無效，應該是2,3,4,5,6之一`);
    }

    // 嘗試匹配中文數字
    for (const [chinese, arabic] of Object.entries(chineseNumbers)) {
      if (bureau.includes(chinese)) {
        return arabic;
      }
    }

    throw new Error(`無法從五行局 "${bureau}" 中提取有效數字`);
  }
  private locateZiWeiStar(): number {
    const lunarDay = this.lunarDate.getDay();
    const bureauNum = this.fiveElementsBureauNumber;
    if (bureauNum === undefined) {
      throw new Error('五行局數字未定義');
    }
    let quotient = Math.floor(lunarDay / bureauNum);
    const remainder = lunarDay % bureauNum;
    let n = 0;
    if (remainder !== 0) {
      n = bureauNum - remainder;
      quotient = Math.floor((lunarDay + n) / bureauNum);
    }
    const YIN_PALACE_STD_INDEX = 2;
    let ziweiPalaceStdIndex = (YIN_PALACE_STD_INDEX + quotient - 1 + 12) % 12;
    if (n !== 0) {
      if (n % 2 === 1) {
        ziweiPalaceStdIndex = (ziweiPalaceStdIndex - 1 + 12) % 12;
      } else {
        ziweiPalaceStdIndex = (ziweiPalaceStdIndex + 1) % 12;
      }
    }
    return ziweiPalaceStdIndex;
  }
  private calculatePalaces(mingPalaceStdIndex: number): Palace[] {
    const palaces: Palace[] = [];
    for (let i = 0; i < 12; i++) {
      const currentPalaceStdZhiIndex = (mingPalaceStdIndex - i + 12) % 12;
      palaces.push({
        name: this.PALACE_NAMES_ORDERED[i],
        index: currentPalaceStdZhiIndex,
        zhi: this.ZHI_NAMES[currentPalaceStdZhiIndex],
        stars: [],
      });
    }
    return palaces;
  }
  private placeStar(
    palaces: Palace[],
    starName: string,
    starType: 'main' | 'auxiliary' | 'minor',
    palaceIndex: number,
  ): Star {
    const star: Star = {
      name: starName,
      type: starType,
      palaceIndex,
      transformations: [],
    };
    const palace = palaces.find((p) => p.index === palaceIndex);
    if (palace) {
      palace.stars.push(star);
    } else {
      console.error(
        `無法找到地支索引為 ${palaceIndex} 的宮位來安放 ${starName} 星`,
      );
    }
    return star;
  }
  private calculateMainStars(
    palaces: Palace[],
    ziweiPalaceStdIndex: number,
  ): Star[] {
    const allMainStars: Star[] = [];
    const ziweiSystemOffsets = [0, -1, -3, -4, -5, -8];
    for (let i = 0; i < this.ZIWEI_STAR_SYSTEM.length; i++) {
      const starName = this.ZIWEI_STAR_SYSTEM[i];
      const palaceIndex =
        (ziweiPalaceStdIndex + ziweiSystemOffsets[i] + 12) % 12;
      allMainStars.push(this.placeStar(palaces, starName, 'main', palaceIndex));
    }
    const tianfuLocationMap: Record<number, number> = {
      [2]: 2,
      [8]: 8,
      [1]: 3,
      [3]: 1,
      [0]: 4,
      [4]: 0,
      [11]: 5,
      [5]: 11,
      [10]: 6,
      [6]: 10,
      [9]: 7,
      [7]: 9,
    };
    const tianfuPalaceStdIndex = tianfuLocationMap[ziweiPalaceStdIndex];
    if (tianfuPalaceStdIndex === undefined) {
      throw new Error('無法定位天府星');
    }
    const tianfuSystemOffsets = [0, 1, 2, 3, 4, 5, 6, 10];
    for (let i = 0; i < this.TIANFU_STAR_SYSTEM.length; i++) {
      const starName = this.TIANFU_STAR_SYSTEM[i];
      const palaceIndex = (tianfuPalaceStdIndex + tianfuSystemOffsets[i]) % 12;
      allMainStars.push(this.placeStar(palaces, starName, 'main', palaceIndex));
    }
    return allMainStars;
  }
  private calculateAuxiliaryStars(palaces: Palace[]): Star[] {
    const auxiliaryStars: Star[] = [];
    const lunarMonth = this.lunarDate.getMonth();
    const chineseHourZhiIndex = this.getChineseHourZhiIndex();
    const CHEN_PALACE_STD_INDEX = 4;
    const zuoFuPalaceIndex =
      (CHEN_PALACE_STD_INDEX + (lunarMonth - 1) + 12) % 12;
    auxiliaryStars.push(
      this.placeStar(palaces, '左輔', 'auxiliary', zuoFuPalaceIndex),
    );
    const XU_PALACE_STD_INDEX = 10;
    const youBiPalaceIndex = (XU_PALACE_STD_INDEX - (lunarMonth - 1) + 12) % 12;
    auxiliaryStars.push(
      this.placeStar(palaces, '右弼', 'auxiliary', youBiPalaceIndex),
    );
    const wenChangPalaceIndex =
      (XU_PALACE_STD_INDEX - chineseHourZhiIndex + 12) % 12;
    auxiliaryStars.push(
      this.placeStar(palaces, '文昌', 'auxiliary', wenChangPalaceIndex),
    );
    const wenQuPalaceIndex =
      (CHEN_PALACE_STD_INDEX + chineseHourZhiIndex + 12) % 12;
    auxiliaryStars.push(
      this.placeStar(palaces, '文曲', 'auxiliary', wenQuPalaceIndex),
    );
    const HAI_PALACE_STD_INDEX = 11;
    const tianKongPalaceIndex =
      (HAI_PALACE_STD_INDEX - chineseHourZhiIndex + 12) % 12;
    auxiliaryStars.push(
      this.placeStar(palaces, '天空', 'auxiliary', tianKongPalaceIndex),
    );
    const diJiePalaceIndex =
      (HAI_PALACE_STD_INDEX + chineseHourZhiIndex + 12) % 12;
    auxiliaryStars.push(
      this.placeStar(palaces, '地劫', 'auxiliary', diJiePalaceIndex),
    );
    return auxiliaryStars;
  }
  private applyFourTransformations(palaces: Palace[], targetGan: string): void {
    const transformations = this.FOUR_TRANSFORMATIONS_MAP[targetGan];
    if (!transformations) {
      console.warn(`找不到天干 ${targetGan} 的四化表`);
      return;
    }
    const applyTransform = (
      starName: string,
      transformType: TransformationType,
    ) => {
      palaces.forEach((palace) => {
        palace.stars.forEach((star) => {
          if (star.name === starName) {
            if (!star.transformations) {
              star.transformations = [];
            }
            star.transformations.push(transformType);
          }
        });
      });
    };
    applyTransform(transformations.lu, '祿');
    applyTransform(transformations.quan, '權');
    applyTransform(transformations.ke, '科');
    applyTransform(transformations.ji, '忌');
  }

  private isGanYang(gan: string): boolean {
    const yangGans = ['甲', '丙', '戊', '庚', '壬'];
    return yangGans.includes(gan);
  }

  public calculateDaXian(palaces: Palace[], maxAge = 120): DaXianInfo[] {
    const daXianList: DaXianInfo[] = [];
    if (this.fiveElementsBureauNumber === undefined) {
      throw new Error('五行局數字未定義，無法計算大限');
    }
    const startAge = this.fiveElementsBureauNumber;
    const yearGan = this.lunarDate.getYearGan();
    const isYearGanYang = this.isGanYang(yearGan);
    const isMale = this.birthInfo.gender === 'male';
    const isForward = (isYearGanYang && isMale) || (!isYearGanYang && !isMale);
    let currentAge = startAge;
    let palaceOrderOffset = 0;
    while (currentAge <= maxAge) {
      const currentMingPalaceRelativeIndex = 0;
      let daXianPalaceOrderIndex = 0;
      if (isForward) {
        daXianPalaceOrderIndex =
          (currentMingPalaceRelativeIndex + palaceOrderOffset + 12) % 12;
      } else {
        daXianPalaceOrderIndex =
          (currentMingPalaceRelativeIndex - palaceOrderOffset + 12) % 12;
      }
      const daXianPalace = palaces.find(
        (p) => p.name === this.PALACE_NAMES_ORDERED[daXianPalaceOrderIndex],
      );
      if (!daXianPalace) {
        console.error(
          `無法找到大限宮位: order index ${daXianPalaceOrderIndex}`,
        );
        break;
      }
      daXianList.push({
        startAge: currentAge,
        endAge: currentAge + 9,
        palaceName: daXianPalace.name,
        palaceZhi: this.ZHI_NAMES[daXianPalace.index],
        palaceIndex: daXianPalace.index,
      });
      currentAge += 10;
      palaceOrderOffset++;
    }
    return daXianList;
  }

  /**
   * 計算小限 (流年命)
   * @param palaces 命盤宮位
   * @param maxAge 計算到多少歲的小限 (虛歲)
   */
  public calculateXiaoXian(palaces: Palace[], maxAge = 100): XiaoXianInfo[] {
    const xiaoXianList: XiaoXianInfo[] = [];
    const yearZhi = this.lunarDate.getYearZhi(); // 出生年地支
    const isMale = this.birthInfo.gender === 'male';

    let startPalaceZhiIndex: number;
    // 口訣：寅午戌局從辰起；申子辰局從戌起；巳酉丑局從未起；亥卯未局從丑起。
    // 地支索引: 子0丑1寅2卯3辰4巳5午6未7申8酉9戌10亥11
    if (['寅', '午', '戌'].includes(yearZhi)) {
      startPalaceZhiIndex = this.ZHI_NAMES.indexOf('辰');
    } // 辰=4
    else if (['申', '子', '辰'].includes(yearZhi)) {
      startPalaceZhiIndex = this.ZHI_NAMES.indexOf('戌');
    } // 戌=10
    else if (['巳', '酉', '丑'].includes(yearZhi)) {
      startPalaceZhiIndex = this.ZHI_NAMES.indexOf('未');
    } // 未=7
    else if (['亥', '卯', '未'].includes(yearZhi)) {
      startPalaceZhiIndex = this.ZHI_NAMES.indexOf('丑');
    } // 丑=1
    else {
      throw new Error(`無法識別的年支用於小限起點: ${yearZhi}`);
    }

    for (let age = 1; age <= maxAge; age++) {
      let currentPalaceZhiIndex: number;
      if (isMale) {
        // 男順行
        currentPalaceZhiIndex = (startPalaceZhiIndex + (age - 1) + 12) % 12;
      } else {
        // 女逆行
        currentPalaceZhiIndex = (startPalaceZhiIndex - (age - 1) + 12) % 12;
      }

      // 找到地支索引對應的宮位在本命盤中的名稱
      const xiaoXianPalace = palaces.find(
        (p) => p.index === currentPalaceZhiIndex,
      );
      if (!xiaoXianPalace) {
        console.error(
          `無法找到小限宮位: age ${age}, zhi index ${currentPalaceZhiIndex}`,
        );
        continue;
      }

      xiaoXianList.push({
        age,
        palaceName: xiaoXianPalace.name, // 這是該地支在本命盤的宮位名
        palaceZhi: this.ZHI_NAMES[currentPalaceZhiIndex],
        palaceIndex: currentPalaceZhiIndex,
      });
    }
    return xiaoXianList;
  }

  // 流年太歲宮：每年太歲所在宮位由流年地支決定（流年地支對應命盤中相同地支的宮位）
  public calculateLiuNianTaiSui(
    palaces: Palace[],
    startYear?: number,
    count = 12,
  ): LiuNianTaiSuiInfo[] {
    const baseYear = startYear ?? (new Date().getFullYear() - 2);
    // Pre-index palaces by branch index for O(1) lookup
    const palaceByBranch = new Map(palaces.map((p) => [p.index, p]));
    const liuNianList: LiuNianTaiSuiInfo[] = [];

    for (let i = 0; i < count; i++) {
      const year = baseYear + i;
      // 4 CE (甲子) is the anchor of the 60-year stem-branch cycle
      const stemIndex = ((year - 4) % 10 + 10) % 10;
      const branchIndex = ((year - 4) % 12 + 12) % 12;
      const taiSuiPalace = palaceByBranch.get(branchIndex);
      if (!taiSuiPalace) continue;

      liuNianList.push({
        year,
        ganZhi: this.GAN_NAMES[stemIndex] + this.ZHI_NAMES[branchIndex],
        palaceName: taiSuiPalace.name,
        palaceZhi: this.ZHI_NAMES[branchIndex],
        palaceIndex: branchIndex,
      });
    }

    return liuNianList;
  }

  private determinePalaceAttributes(palaces: Palace[]): void {
    /* ... */
  }
  private assembleChart(palaces: Palace[]): PurpleStarChart {
    const daXian = this.calculateDaXian(palaces);
    const xiaoXian = this.calculateXiaoXian(palaces);
    const liuNian = this.calculateLiuNianTaiSui(palaces);
    return {
      palaces,
      mingPalaceIndex: this.mingPalaceStdIndex,
      shenPalaceIndex: this.shenPalaceStdIndex,
      mingGan: this.mingPalaceGan,
      fiveElementsBureau: this.fiveElementsBureau,
      daXian,
      xiaoXian,
      liuNian,
    };
  }
  public generateChart(): PurpleStarChart {
    const palaces = this.calculatePalaces(this.mingPalaceStdIndex);
    const ziweiLocationIndex = this.locateZiWeiStar();
    this.calculateMainStars(palaces, ziweiLocationIndex);
    this.calculateAuxiliaryStars(palaces);
    this.applyFourTransformations(palaces, this.mingPalaceGan);
    this.determinePalaceAttributes(palaces);
    const chart = this.assembleChart(palaces);
    return chart;
  }
}

export default PurpleStarCalculator;

// 簡易使用範例 (用於測試)
/*
const exampleBirthInfo: BirthInfo = {
  solarDate: new Date('1990-02-20 10:30:00'),
  gender: 'male',
};
const calculator = new PurpleStarCalculator(exampleBirthInfo);
const purpleStarChart = calculator.generateChart();
*/
