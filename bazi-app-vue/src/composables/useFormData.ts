/**
 * Form data management composable
 */
import { ref, reactive, computed } from 'vue';
import { Solar, Lunar } from 'lunar-typescript';

export interface CityOption {
  label: string;
  value: string;
  longitude: number;
  latitude: number;
  timezone: string;
}

export interface TimezoneOption {
  label: string;
  value: string;
}

export interface BirthFormData {
  calendarMode: 'solar' | 'lunar';
  birthDate: string;
  birthTime: string;
  gender: 'male' | 'female';
  longitude: number | null;
  latitude: number | null;
  timezone: string;
  isLeapMonth: boolean;
  lunarYear?: number;
  lunarMonth?: number;
  lunarDay?: number;
}

export function useFormData() {
  // 時區選項
  const timezones = ref<TimezoneOption[]>([
    { label: '亞洲/台北 (GMT+8)', value: 'Asia/Taipei' },
    { label: '亞洲/上海 (GMT+8)', value: 'Asia/Shanghai' },
    { label: '亞洲/香港 (GMT+8)', value: 'Asia/Hong_Kong' },
    { label: '亞洲/東京 (GMT+9)', value: 'Asia/Tokyo' },
    { label: '亞洲/首爾 (GMT+9)', value: 'Asia/Seoul' },
    { label: '亞洲/新加坡 (GMT+8)', value: 'Asia/Singapore' },
    { label: '澳洲/悉尼 (GMT+10)', value: 'Australia/Sydney' },
    { label: '歐洲/倫敦 (GMT+0)', value: 'Europe/London' },
    { label: '歐洲/巴黎 (GMT+1)', value: 'Europe/Paris' },
    { label: '美洲/紐約 (GMT-5)', value: 'America/New_York' },
    { label: '美洲/洛杉磯 (GMT-8)', value: 'America/Los_Angeles' },
    { label: '美洲/溫哥華 (GMT-8)', value: 'America/Vancouver' },
  ]);

  // 主要城市座標資料 - 擴展列表作為地理編碼失敗時的備選方案
  const majorCities = ref<CityOption[]>([
    // 台灣地區
    {
      label: '台北, 台灣',
      value: 'taipei',
      longitude: 121.5654,
      latitude: 25.033,
      timezone: 'Asia/Taipei',
    },
    {
      label: '高雄, 台灣',
      value: 'kaohsiung',
      longitude: 120.3014,
      latitude: 22.6273,
      timezone: 'Asia/Taipei',
    },
    {
      label: '台中, 台灣',
      value: 'taichung',
      longitude: 120.6736,
      latitude: 24.1477,
      timezone: 'Asia/Taipei',
    },
    {
      label: '台南, 台灣',
      value: 'tainan',
      longitude: 120.2133,
      latitude: 22.9999,
      timezone: 'Asia/Taipei',
    },
    {
      label: '新竹, 台灣',
      value: 'hsinchu',
      longitude: 120.9647,
      latitude: 24.8138,
      timezone: 'Asia/Taipei',
    },
    // 中國大陸
    {
      label: '上海, 中國',
      value: 'shanghai',
      longitude: 121.4737,
      latitude: 31.2304,
      timezone: 'Asia/Shanghai',
    },
    {
      label: '北京, 中國',
      value: 'beijing',
      longitude: 116.4074,
      latitude: 39.9042,
      timezone: 'Asia/Shanghai',
    },
    {
      label: '廣州, 中國',
      value: 'guangzhou',
      longitude: 113.2644,
      latitude: 23.1291,
      timezone: 'Asia/Shanghai',
    },
    {
      label: '深圳, 中國',
      value: 'shenzhen',
      longitude: 114.0579,
      latitude: 22.5431,
      timezone: 'Asia/Shanghai',
    },
    {
      label: '成都, 中國',
      value: 'chengdu',
      longitude: 104.0668,
      latitude: 30.5728,
      timezone: 'Asia/Shanghai',
    },
    // 港澳地區
    {
      label: '香港',
      value: 'hongkong',
      longitude: 114.1694,
      latitude: 22.3193,
      timezone: 'Asia/Hong_Kong',
    },
    {
      label: '澳門',
      value: 'macau',
      longitude: 113.5439,
      latitude: 22.1987,
      timezone: 'Asia/Macau',
    },
    // 亞洲其他地區
    {
      label: '東京, 日本',
      value: 'tokyo',
      longitude: 139.6917,
      latitude: 35.6895,
      timezone: 'Asia/Tokyo',
    },
    {
      label: '首爾, 韓國',
      value: 'seoul',
      longitude: 126.978,
      latitude: 37.5665,
      timezone: 'Asia/Seoul',
    },
    {
      label: '新加坡',
      value: 'singapore',
      longitude: 103.8198,
      latitude: 1.3521,
      timezone: 'Asia/Singapore',
    },
    {
      label: '曼谷, 泰國',
      value: 'bangkok',
      longitude: 100.5018,
      latitude: 13.7563,
      timezone: 'Asia/Bangkok',
    },
    {
      label: '吉隆坡, 馬來西亞',
      value: 'kualalumpur',
      longitude: 101.6869,
      latitude: 3.139,
      timezone: 'Asia/Kuala_Lumpur',
    },
    // 歐洲
    {
      label: '倫敦, 英國',
      value: 'london',
      longitude: -0.1276,
      latitude: 51.5074,
      timezone: 'Europe/London',
    },
    {
      label: '巴黎, 法國',
      value: 'paris',
      longitude: 2.3522,
      latitude: 48.8566,
      timezone: 'Europe/Paris',
    },
    // 美洲
    {
      label: '紐約, 美國',
      value: 'newyork',
      longitude: -74.006,
      latitude: 40.7128,
      timezone: 'America/New_York',
    },
    {
      label: '洛杉磯, 美國',
      value: 'losangeles',
      longitude: -118.2437,
      latitude: 34.0522,
      timezone: 'America/Los_Angeles',
    },
    {
      label: '舊金山, 美國',
      value: 'sanfrancisco',
      longitude: -122.4194,
      latitude: 37.7749,
      timezone: 'America/Los_Angeles',
    },
    {
      label: '溫哥華, 加拿大',
      value: 'vancouver',
      longitude: -123.1207,
      latitude: 49.2827,
      timezone: 'America/Vancouver',
    },
    // 大洋洲
    {
      label: '悉尼, 澳洲',
      value: 'sydney',
      longitude: 151.2093,
      latitude: -33.8688,
      timezone: 'Australia/Sydney',
    },
    {
      label: '墨爾本, 澳洲',
      value: 'melbourne',
      longitude: 144.9631,
      latitude: -37.8136,
      timezone: 'Australia/Melbourne',
    },
  ]);

  const formData = reactive<BirthFormData>({
    calendarMode: 'solar',
    birthDate: '',
    birthTime: '',
    gender: 'male',
    longitude: null,
    latitude: null,
    timezone: 'Asia/Taipei',
    isLeapMonth: false,
    lunarYear: new Date().getFullYear(),
    lunarMonth: 1,
    lunarDay: 1,
  });

  const selectedCity = ref('');
  const leapMonthInfo = ref('');

  // 獲取目前年份的農曆月份列表 (包含閏月)
  const lunarMonths = computed(() => {
    const year = formData.lunarYear || new Date().getFullYear();
    const months = [];
    try {
      const leapMonth = Lunar.fromYmd(year, 1, 1).getYearLeapMonth();
      for (let m = 1; m <= 12; m++) {
        months.push({ label: `${m}月`, value: m });
        if (m === leapMonth) {
          months.push({ label: `閏${m}月`, value: -m });
        }
      }
    } catch (e) {
      // Fallback
      for (let m = 1; m <= 12; m++) {
        months.push({ label: `${m}月`, value: m });
      }
    }
    return months;
  });

  // 獲取目前農曆月份的天數
  const lunarDays = computed(() => {
    const year = formData.lunarYear || new Date().getFullYear();
    const month = formData.lunarMonth || 1;
    try {
      // 透過 lunar-typescript 獲取該月實際天數
      const lunar = Lunar.fromYmd(year, month, 1);
      // 獲取該農曆月的天數 (29 或 30)
      const dayCount = lunar.getMonthLeap() === (month < 0) ? 
                       Lunar.fromYmd(year, month, 1).getDaysInMonth() : 30;
      
      // 簡單一點的做法：lunar-typescript 的 Lunar 物件有 getMonth().getDays() 嗎？
      // 其實最準確是從 Lunar 物件獲取，這裡我們用一個循環或已知屬性
      return lunar.getDaysInMonth();
    } catch (e) {
      return 30;
    }
  });

  // 填入城市座標
  const fillCityCoordinates = (cityValue: string) => {
    const city = majorCities.value.find((c) => c.value === cityValue);
    if (city) {
      formData.longitude = city.longitude;
      formData.latitude = city.latitude;
      formData.timezone = city.timezone;
    }
  };

  // 自動判斷閏月 (公曆模式下用)
  const detectLeapMonth = () => {
    if (!formData.birthDate) {
      formData.isLeapMonth = false;
      leapMonthInfo.value = '';
      return;
    }

    try {
      const [year, month, day] = formData.birthDate.split('-').map(Number);
      if (!year || !month || !day) return;
      const solar = Solar.fromYmd(year, month, day);
      const lunar = solar.getLunar();
      const lunarMonth = lunar.getMonth();

      formData.isLeapMonth = lunarMonth < 0;
      leapMonthInfo.value = lunarMonth < 0 ? `閏${Math.abs(lunarMonth)}月` : '';
    } catch (error) {
      formData.isLeapMonth = false;
      leapMonthInfo.value = '';
    }
  };

  // 同步農曆到公曆
  const syncLunarToSolar = () => {
    if (
      formData.lunarYear &&
      formData.lunarMonth &&
      formData.lunarDay
    ) {
      try {
        const lunar = Lunar.fromYmd(
          formData.lunarYear,
          formData.lunarMonth,
          formData.lunarDay,
        );
        const solar = lunar.getSolar();
        formData.birthDate = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`;
        
        formData.isLeapMonth = formData.lunarMonth < 0;
        leapMonthInfo.value = formData.lunarMonth < 0 ? `閏${Math.abs(formData.lunarMonth)}月` : '';
      } catch (e) {
        // Silently ignore or set reasonable defaults
      }
    }
  };

  // 同步公曆到農曆
  const syncSolarToLunar = () => {
    if (formData.birthDate) {
      try {
        const parts = formData.birthDate.split('-');
        if (parts.length !== 3) return;
        
        const [year, month, day] = parts.map(Number);
        if (!year || !month || !day) return;
        
        const solar = Solar.fromYmd(year, month, day);
        const lunar = solar.getLunar();
        formData.lunarYear = lunar.getYear();
        formData.lunarMonth = lunar.getMonth();
        formData.lunarDay = lunar.getDay();
        formData.isLeapMonth = lunar.getMonth() < 0;
        leapMonthInfo.value = lunar.getMonth() < 0 ? `閏${Math.abs(lunar.getMonth())}月` : '';
      } catch (e) {
        // Silently ignore
      }
    }
  };

  return {
    formData,
    timezones,
    majorCities,
    selectedCity,
    leapMonthInfo,
    fillCityCoordinates,
    detectLeapMonth,
    syncLunarToSolar,
    syncSolarToLunar,
    lunarMonths,
    lunarDays,
  };
}
