<template>
  <el-form
    ref="unifiedForm"
    :model="formData"
    :rules="formRules"
    :validate-on-rule-change="false"
    label-position="top"
    class="improved-form"
    @submit.prevent="submitForm"
  >
    <!-- 1. 核心資訊卡片 -->
    <el-card class="form-section-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="header-title">{{ $t('unifiedForm.birth_info') }}</span>
          <el-radio-group v-model="formData.calendarMode" size="small" class="mode-switch">
            <el-radio-button value="solar">{{ $t('unifiedForm.calendar_solar') }}</el-radio-button>
            <el-radio-button value="lunar">{{ $t('unifiedForm.calendar_lunar') }}</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <div class="form-grid">
        <!-- 性別選擇 -->
        <el-form-item :label="$t('unifiedForm.gender')" prop="gender" class="gender-item">
          <el-radio-group v-model="formData.gender" class="gender-radio-group">
            <el-radio-button value="male">
              <el-icon><Male /></el-icon> {{ $t('unifiedForm.gender_male') }}
            </el-radio-button>
            <el-radio-button value="female">
              <el-icon><Female /></el-icon> {{ $t('unifiedForm.gender_female') }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- 日期選擇 -->
        <div class="input-row">
          <div class="label-with-mode">
            <span class="field-label">{{ formData.calendarMode === 'solar' ? $t('unifiedForm.birth_date') : '農曆生日' }}</span>
          </div>

          <!-- 公曆模式佈局 -->
          <div v-if="formData.calendarMode === 'solar'" class="solar-input-container">
            <el-form-item prop="birthDate" label-width="0">
              <el-date-picker
                v-model="formData.birthDate"
                type="date"
                :placeholder="$t('unifiedForm.birth_date_placeholder')"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </div>

          <!-- 農曆模式佈局 -->
          <div v-else class="lunar-input-container">
            <div class="lunar-grid">
              <el-input-number 
                v-model="formData.lunarYear" 
                :min="1900" 
                :max="2100" 
                controls-position="right" 
                @change="syncLunarToSolar" 
                placeholder="年"
              />
              <el-select v-model="formData.lunarMonth" @change="syncLunarToSolar" placeholder="月">
                <el-option 
                  v-for="m in lunarMonths" 
                  :key="m.value" 
                  :label="m.label" 
                  :value="m.value" 
                />
              </el-select>
              <el-select v-model="formData.lunarDay" @change="syncLunarToSolar" placeholder="日">
                <el-option 
                  v-for="d in lunarDays" 
                  :key="d" 
                  :label="d + '日'" 
                  :value="d" 
                />
              </el-select>
            </div>
          </div>
        </div>

        <!-- 時間選擇 -->
        <el-form-item :label="$t('unifiedForm.birth_time')" prop="birthTime" class="time-item">
          <el-time-picker
            v-model="formData.birthTime"
            :placeholder="$t('unifiedForm.birth_time_placeholder')"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%"
          />
        </el-form-item>
      </div>
    </el-card>

    <!-- 2. 地點資訊卡片 -->
    <el-card class="form-section-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="header-title">{{ $t('unifiedForm.location_input_label') }}</span>
          <el-button type="primary" link @click="useCurrentLocation" :loading="locating">
            <el-icon><Location /></el-icon> {{ $t('unifiedForm.use_current_location') }}
          </el-button>
        </div>
      </template>

      <el-form-item>
        <el-autocomplete
          v-model="addressInput"
          :fetch-suggestions="querySearch"
          :placeholder="$t('unifiedForm.location_input_placeholder')"
          :loading="geocoding"
          clearable
          class="full-width"
          @select="handleLocationSelect"
        >
          <template #default="{ item }">
            <div class="autocomplete-item">
              <span class="autocomplete-label">{{ item.label }}</span>
            </div>
          </template>
        </el-autocomplete>
        
        <div class="field-hint">
          <el-text type="info" size="small">{{ $t('unifiedForm.location_input_hint') }}</el-text>
        </div>
      </el-form-item>

      <!-- Advanced Options -->
      <el-button
        text
        size="small"
        class="advanced-toggle"
        @click="showAdvancedOptions = !showAdvancedOptions"
      >
        {{ showAdvancedOptions ? $t('unifiedForm.hide_coords') : $t('unifiedForm.show_coords') }}
        <el-icon><ArrowDown v-if="!showAdvancedOptions" /><ArrowUp v-else /></el-icon>
      </el-button>

      <el-collapse-transition>
        <div v-show="showAdvancedOptions" class="advanced-coords">
          <div class="coord-row">
            <el-input v-model.number="formData.longitude" :placeholder="$t('unifiedForm.longitude')" type="number">
              <template #prepend>{{ $t('unifiedForm.longitude') }}</template>
            </el-input>
            <el-input v-model.number="formData.latitude" :placeholder="$t('unifiedForm.latitude')" type="number">
              <template #prepend>{{ $t('unifiedForm.latitude') }}</template>
            </el-input>
          </div>
          <el-select v-model="formData.timezone" :placeholder="$t('unifiedForm.timezone')" class="full-width">
            <el-option v-for="tz in timezones" :key="tz.value" :label="tz.label" :value="tz.value" />
          </el-select>
        </div>
      </el-collapse-transition>
    </el-card>

    <!-- 4. 提交按鈕區域 -->
    <div class="submit-section">
      <el-button
        type="primary"
        size="large"
        :disabled="hasCache"
        class="main-submit-btn"
        @click="submitForm"
      >
        <el-icon><MagicStick /></el-icon>
        {{ hasCache ? $t('unifiedForm.submit_button_cached') : $t('unifiedForm.submit_btn_long') }}
      </el-button>
      
      <el-button
        v-if="hasCache"
        type="warning"
        plain
        size="large"
        class="clear-cache-btn"
        @click="clearCache"
      >
        {{ $t('unifiedForm.clear_cache') }}
      </el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { 
  Male, Female, Location, ArrowDown, ArrowUp, MagicStick 
} from '@element-plus/icons-vue';
import { Solar, Lunar } from 'lunar-typescript';
import { saveTimeZoneInfo, getTimeZoneInfo } from '../utils/storageService';
import { useChartStore } from '../stores/chartStore';
import { useFormData } from '../composables/useFormData';
import { useFormValidation } from '../composables/useFormValidation';
import {
  useGeocoding,
  type AutocompleteOption,
} from '../composables/useGeocoding';

const chartStore = useChartStore();
const showAdvancedOptions = ref(false);
const locating = ref(false);

const { 
  formData, timezones, majorCities, 
  detectLeapMonth, syncLunarToSolar, syncSolarToLunar,
  lunarMonths, lunarDays
} = useFormData();

// 切換模式時同步資料
watch(() => formData.calendarMode, (newMode) => {
  if (newMode === 'lunar') {
    syncSolarToLunar();
  } else {
    syncLunarToSolar();
  }
});

const { createFormRules } = useFormValidation();
const {
  addressInput,
  geocoding,
  queryAutocompleteSearch,
  handleAutocompleteSelect,
} = useGeocoding();

const hasCache = computed(() => !!chartStore.chartId);

const formRules = createFormRules(formData);

const querySearch = (queryString: string, cb: any) => {
  queryAutocompleteSearch(queryString, cb, majorCities.value);
};

const handleLocationSelect = (item: AutocompleteOption) => {
  const coords = handleAutocompleteSelect(item);
  if (coords) {
    formData.longitude = coords.longitude;
    formData.latitude = coords.latitude;
    if (coords.timezone) formData.timezone = coords.timezone;
  }
};

const useCurrentLocation = () => {
  if (!navigator.geolocation) {
    ElMessage.error('您的瀏覽器不支援定位功能');
    return;
  }
  
  locating.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      formData.longitude = Number(position.coords.longitude.toFixed(6));
      formData.latitude = Number(position.coords.latitude.toFixed(6));
      locating.value = false;
      ElMessage.success('已成功獲取目前位置');
    },
    (error) => {
      locating.value = false;
      ElMessage.warning('無法取得位置，請手動輸入');
    }
  );
};

const clearCache = () => {
  chartStore.clearCurrentChart();
  ElMessage.success('已清除快取，可以重新計算');
};

const unifiedForm = ref();

onMounted(() => {
  const savedTimezone = getTimeZoneInfo();
  if (savedTimezone?.timeZone) {
    formData.timezone = savedTimezone.timeZone;
  }
});

watch(() => formData.birthDate, () => {
  detectLeapMonth();
});

const submitForm = async () => {
  if (!unifiedForm.value) return;

  try {
    const isValid = await unifiedForm.value.validate();
    if (isValid) {
      const [year] = formData.birthDate.split('-').map(Number);
      saveTimeZoneInfo(formData.timezone, year);
      
      emit('submit', {
        birthDate: formData.birthDate,
        birthTime: formData.birthTime,
        gender: formData.gender,
        longitude: formData.longitude,
        latitude: formData.latitude,
        timezone: formData.timezone,
        isLeapMonth: formData.isLeapMonth
      });
    }
  } catch (error) {
    ElMessage.error('請檢查輸入資料是否正確');
  }
};

const emit = defineEmits(['submit']);
</script>

<style scoped>
.improved-form {
  max-width: 600px;
  margin: 0 auto;
}

.form-section-card {
  margin-bottom: 20px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-row {
  width: 100%;
}

.label-with-mode {
  margin-bottom: 8px;
}

.field-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.lunar-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 8px;
}

.lunar-grid :deep(.el-input-number),
.lunar-grid :deep(.el-select) {
  width: 100%;
}

.time-item {
  width: 100%;
  margin-bottom: 0;
}

@media (min-width: 768px) {
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .gender-item, .input-row {
    grid-column: 1 / -1;
  }
}

.full-width {
  width: 100%;
}

.advanced-toggle {
  margin-bottom: 10px;
}

.advanced-coords {
  padding: 15px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  margin-bottom: 15px;
}

.coord-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.submit-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 30px;
}

.main-submit-btn {
  height: 54px;
  font-size: 18px;
  font-weight: 600;
  border-radius: 27px;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-3));
  border: none;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.main-submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
}

.clear-cache-btn {
  height: 44px;
  border-radius: 22px;
}

.field-hint {
  margin-top: 4px;
}
</style>
