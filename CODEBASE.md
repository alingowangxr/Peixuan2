# CODEBASE.md

> **Auto-generated project context file.** Refreshed on every session start.
>
> **Purpose:** Provides Claude AI with project structure, OS info, and coding standards automatically.

---

# 📁 Project Context

**Project:** `Peixuan`
**Framework:** `node`
**Type:** `node`
**Path:** `D:\vibecode\Peixuan`
**Detected:** 2026-02-11 17:24:39

---

## 🖥️ Operating System

| Property | Value |
|----------|-------|
| **OS** | Windows |
| **Shell** | PowerShell / CMD |

---

## ⚡ Terminal Commands (Current OS)

#### 🪟 Windows Terminal Commands

##### PowerShell
```powershell
ls                    # List files
cd <path>             # Change directory
pwd                   # Current directory
mkdir <dir>            # Create directory
rm <file>             # Remove file
rm -r <dir>           # Remove directory
cat <file>            # View file
echo $env:PATH        # Show environment variables
```

##### Common Tasks
- **File Explorer**: `start .`
- **Open with default app**: `start <file>`
- **Process manager**: `taskmgr` or `Get-Process`
- **Network info**: `ipconfig` or `Get-NetIPAddress`
- **System info**: `systeminfo`

##### Package Managers
```powershell
winget install <app>     # Install application
winget search <app>      # Search for application
winget upgrade <app>     # Upgrade application
winget list              # List installed apps
```

---


## 🎯 Project Environment

| Property | Value |
|----------|-------|
| **Project Type** | NODE |
| **Framework** | NODE |
| **Platform** | GENERAL |

---

## 📋 Quick Project Commands

#### Package Management
```bash
npm install              # Install dependencies
npm install <package>    # Add package
```

#### Development
```bash
npm run dev              # Start dev server
npm run build            # Build for production
```


---

## 📂 Project Structure

> **Legend:** `file.ts ← A.tsx, B.tsx` = This file is **imported by** A.tsx and B.tsx.
> Changing this file will affect those files.
>
> ⚠️ **Note:** If a file has no ← annotation but you see imports in the actual code, this dependency is not yet tracked or is incomplete in CODEBASE.md.

```
CLAUDE.md
CODEBASE.md
LICENSE
LICENSES.md
README.md
bazi-app-vue/
  CLEANUP_SUMMARY_2025-11-30.md
  COMPONENT_FIX_ANALYSIS.md
  COMPONENT_UPDATE_FIXES.md
  Dockerfile.dev
  PERFORMANCE_OPTIMIZATION.md
  README.md
  TESTING_GUIDELINES.md
  check-lint.sh
  index.html
  package-lock.json
  package.json
  public/
    apple-touch-icon.svg
    favicon.svg
    js/
      lunar.min.js
    vite.svg
  src/
    App.vue ← main.ts
    assets/
      styles/
        global.css
      vue.svg
    components/
      AnalysisSkeleton.vue ← UnifiedAIAnalysisView.vue
      AnnualFortuneCard.vue ← UnifiedResultView.vue
      AnnualInteraction.vue ← UnifiedResultView.vue
      AppFooter.vue
      AppHeader.vue
      BaziChart.vue ← UnifiedResultView.vue, BaziChart.spec.ts
      CHAT_UI_IMPLEMENTATION.md
      CacheIndicator.vue ← UnifiedAIAnalysisView.vue
      ChatBubble.vue ← DailyQuestionPanel.vue
      DailyQuestionPanel.vue ← DailyQuestionView.vue
      DailyReminderCard.vue
      DeveloperCard.vue ← UnifiedResultView.vue
      FortuneTimeline.vue ← UnifiedResultView.vue
      JourneyStep.vue ← HomeView.vue
      LanguageSelector.vue ← LanguageSelector.spec.ts
      NarrativeSummary.vue ← UnifiedResultView.vue
      PurpleStarChartDisplay.vue.bak
      QuickSetupForm.vue ← DailyQuestionView.vue, UnifiedAIAnalysisView.vue
      ServiceCard.vue ← HomeView.vue
      SiHuaAggregationCard.vue ← UnifiedResultView.vue
      StarBrightnessIndicator.vue ← UnifiedResultView.vue
      StarSymmetryDisplay.vue ← UnifiedResultView.vue
      TaiSuiCard.vue ← UnifiedResultView.vue
      TechnicalDetailsCard.vue ← UnifiedResultView.vue
      TrustCard.vue
      UnifiedInputForm.vue ← UnifiedView.vue
      UnifiedResultView.vue ← UnifiedView.vue
      WuXingChart.vue ← UnifiedResultView.vue, WuXingChart.spec.ts
      __tests__/
        BaziChart.spec.ts
        LanguageSelector.spec.ts
        WuXingChart.spec.ts
      visualizations/
        ARCHITECTURE.md
        README.md
        WuXingRadar.vue ← WuXingChart.vue, index.ts, WuXingChart.spec.ts +1 more
        __tests__/
          WuXingRadar.spec.ts
        constants.ts ← WuXingChart.vue, index.ts, WuXingRadar.vue +2 more
        index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
    composables/
      useDailyQuestion.ts ← DailyQuestionPanel.vue
      useDisplayMode.ts
      useFormData.ts ← QuickSetupForm.vue
      useFormValidation.ts ← UnifiedInputForm.vue
      useGeocoding.ts ← UnifiedInputForm.vue
      useLayeredReading.ts ← useSharedLayeredReading.ts
      useSharedLayeredReading.ts
      useTheme.ts ← App.vue, AppHeader.vue
    i18n/
      index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
      locales/
        en.json ← index.ts
        zh_TW.json ← index.ts
    lunar-javascript.global.d.ts
    main.ts
    plugins/
      errorHandler.ts ← main.ts
    router/
      index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
    services/
      apiService.ts
      astrologyIntegrationService.ts
      geocodeService.ts ← useGeocoding.ts
      unifiedApiService.ts ← DailyReminderCard.vue, DailyReminderCard.vue, chartStore.ts
    stores/
      chartStore.ts ← App.vue, AppHeader.vue, QuickSetupForm.vue +3 more
    style.css
    styles/
      UnifiedInputForm.css
      animations.css
      design-tokens.css
      dialog.css
      element-plus-buttons.css
      element-plus-dark.css
      element-plus.css
      markdown.css
    types/
      astrologyTypes.ts ← apiService.ts, astrologyIntegrationService.ts
      baziTypes.ts ← BaziChart.vue, UnifiedResultView.vue, baziCalculators.ts +2 more
      displayModes.ts ← useDisplayMode.ts
      formValidation.ts ← useFormValidation.ts
      global.d.ts
      layeredReading.ts ← useLayeredReading.ts, useSharedLayeredReading.ts
    utils/
      __tests__/
        textSplitter.test.ts
      baziCalculators.ts
      chartCache.ts ← UnifiedView.vue
      frontendValidation.ts
      keywordHighlighting.ts ← markdown.ts
      markdown.ts ← ChatBubble.vue, NarrativeSummary.vue, UnifiedAIAnalysisView.vue
      storageService.ts ← UnifiedInputForm.vue
      textSplitter.ts ← DailyQuestionPanel.vue
      yearlyInteractionUtils.ts
    views/
      DailyQuestionView.vue
      HomeView.vue
      UnifiedAIAnalysisView.vue
      UnifiedView.vue
    vite-env.d.ts
  tsconfig.app.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
doc/
  ARCHITECTURE_ANALYSIS.md
  LLM記憶模組實作指南.md
  LLM記憶模組產品設計評估.md
package-lock.json
package.json
peixuan-worker/
  QUICKSTART.md
  dist/
    index.js ← test-star-positioning.js
  drizzle/
    0000_luxuriant_luckman.sql
    0001_powerful_shadow_king.sql
    0002_add_advanced_analysis.sql
    0003_add_analysis_type_to_advanced.sql
    meta/
      0000_snapshot.json
      0001_snapshot.json
      _journal.json
  drizzle.config.ts
  eslint.config.js
  nul
  package-lock.json
  package.json
  public/
  scripts/
    verify-bazi.ts
  setup-staging.sh
  src/
    calculation/
      __tests__/
        verification.test.ts
      annual/
        __tests__/
          interaction.test.ts
          liuchun.test.ts
          palace.test.ts
        interaction.ts ← calculateYearlyForecast.ts, calculator.ts, index.ts +1 more
        liuchun.ts ← calculateYearlyForecast.ts, nextYearCalculator.ts, calculator.ts +1 more
        nextYearCalculator.ts
        palace.ts ← calculateYearlyForecast.ts, manual-verify.ts, yearlyForecast.test.ts +8 more
      bazi/
        __tests__/
          fourPillars.integration.test.ts
          hiddenStems.test.ts
          hourPillar.trueSolarTime.test.ts
          tenGods.test.ts
        fourPillars.legacy.ts
        fourPillars.test.ts
        fourPillars.ts ← verify-bazi.ts, dailyReminderService.ts, calculateYearlyForecast.ts +8 more
        hiddenStems.legacy.ts
        hiddenStems.ts ← index.ts, distribution.ts, verification.test.ts +1 more
        index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
        lunarAdapter.ts ← fourPillars.ts, calculator.ts
        lunarHiddenStemsAdapter.ts
        lunarTenGodsAdapter.ts
        tenGods.legacy.ts
        tenGods.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
        verify-lunar-output.test.ts
      core/
        ganZhi/
          conversion.ts ← liuchun.ts, dayun.ts, dayun.ts +2 more
          index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
          modulo.ts ← index.ts
        time/
          index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
          julianDay.ts ← fourPillars.test.ts, index.ts, fourPillars.integration.test.ts
          monthBranch.ts ← calculator.ts, index.ts
          solarTerms.ts ← verify-bazi.ts, getLichunDatesBetween.ts, manual-verify.ts +7 more
          trueSolarTime.ts ← trueSolarTime.test.ts, index.ts
        wuXing/
          index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
          relations.ts ← interaction.ts, distribution.ts, distribution.ts +5 more
      fortune/
        __tests__/
          dayun.test.ts
          qiyun.test.ts
        dayun.ts ← calculator.ts, index.ts, dayun.test.ts
        index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
        qiyun.ts ← index.ts, calculator.ts, qiyun.test.ts
      integration/
        __tests__/
          calculator.test.ts
          validator.test.ts
        calculator.ts ← analyzeController.ts, purpleStarController.ts, unifiedController.ts +2 more
        validator.ts ← calculator.ts, validator.test.ts
      types/
        index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
      wuXing/
        __tests__/
          distribution.test.ts
          seasonality.test.ts
        distribution.ts ← calculator.ts, index.ts, distribution.test.ts
        seasonality.ts ← distribution.ts, seasonality.test.ts
      ziwei/
        bureau.test.ts
        bureau.ts ← apiResponse.ts, calculator.ts, index.ts +4 more
        decade.ts ← calculator.ts
        palaces.test.ts
        palaces.ts ← apiResponse.ts, calculator.ts, index.ts +1 more
        sihua/
          aggregator.ts ← calculator.ts, index.ts
          edgeGenerator.ts ← aggregator.ts, index.ts, edgeGenerator.test.ts
          graphAnalysis.ts ← aggregator.ts, index.ts
          index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
          types.ts ← advancedMarkdownFormatter.ts, markdownFormatter.ts, index.ts +4 more
        stars/
          auxiliary.test.ts
          auxiliary.ts ← calculator.ts, auxiliary.test.ts
          tianfu.test.ts
          tianfu.ts ← calculator.ts, tianfu.test.ts
          ziwei.test.ts
          ziwei.ts ← calculator.ts, ziwei.test.ts
    controllers/
      analyzeController.ts ← analyzeRoutes.ts
      cacheUtilities.ts ← analyzeController.ts
      chartController.ts ← index.ts, chartRoutes.ts, purpleStarRoutes.ts
      dailyReminderController.ts ← dailyReminderRoutes.ts
      promptBuilder.ts ← analyzeController.ts
      purpleStarController.ts
      streamProcessor.ts ← analyzeController.ts
      unifiedController.ts ← unifiedRoutes.ts
    db/
      schema.ts ← index.ts, chartController.ts, dailyReminderController.ts +6 more
    formatters/
      __tests__/
        markdownFormatter.test.ts
      advancedMarkdownFormatter.ts ← analyzeController.ts
      markdownFormatter.ts ← analyzeController.ts, unifiedController.ts, agenticGeminiService.ts +1 more
    index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
    routes/
      analyzeRoutes.ts ← index.ts
      chartRoutes.ts ← index.ts
      dailyReminderRoutes.ts ← index.ts
      purpleStarRoutes.ts
      unifiedRoutes.ts ← index.ts
    services/
      __tests__/
        agenticAzureService.test.ts
        agenticGeminiService.test.ts
        aiServiceManager.test.ts
        azureOpenAIService.test.ts
      advancedAnalysisCacheService.ts ← analyzeController.ts
      agenticAzureService.ts ← analyzeRoutes.ts, agenticAzureService.test.ts
      agenticGeminiService.ts ← parallel-execution.test.ts, react-flow.test.ts, analyzeRoutes.ts +1 more
      aiServiceManager.ts ← analyzeController.ts, analyzeRoutes.ts, aiServiceManager.test.ts
      analysisCacheService.ts ← analyzeController.ts
      analyticsService.ts ← analyzeRoutes.ts, agenticAzureService.ts, agenticGeminiService.ts
      annual/
        __tests__/
          taiSuiAnalysis.test.ts
          taiSuiDetection.test.ts
        taiSuiAnalysis.ts ← calculateYearlyForecast.ts, taiSuiAnalysis.test.ts, calculator.ts
        taiSuiDetection.ts ← taiSuiAnalysis.ts, taiSuiDetection.test.ts
      annualFortune/
        __tests__/
          manual-verify.ts
          yearlyForecast.test.ts
        calculateYearlyForecast.ts ← index.ts, manual-verify.ts, yearlyForecast.test.ts
        getLichunDatesBetween.ts ← calculateYearlyForecast.ts, index.ts, manual-verify.ts +1 more
        index.ts ← test-integration-fixes.ts, index.ts, calculator.ts +2 more
      azureOpenAIService.ts ← analyzeRoutes.ts, azureOpenAIService.test.ts
      cacheService.ts ← chartController.ts
      chartCacheService.ts ← analyzeController.ts, unifiedController.ts, analyzeRoutes.ts
      dailyQuestionLimitService.ts ← analyzeRoutes.ts
      dailyReminderService.ts ← dailyReminderController.ts
      geminiService.ts ← analyzeRoutes.ts
      purpleStarCalculation.ts ← purpleStarController.ts, apiResponse.ts
    types/
      aiTypes.ts ← analyzeController.ts, aiServiceManager.ts, azureOpenAIService.ts +5 more
      apiResponse.ts ← purpleStarController.ts
  test/
    conversion.test.ts
    env.d.ts
    index.spec.ts
    integration/
      README.md
      helpers/
        mockLLMProvider.ts ← parallel-execution.test.ts, react-flow.test.ts
        testFixtures.ts ← parallel-execution.test.ts, react-flow.test.ts
      parallel-execution.test.ts
      react-flow.test.ts
    relations.test.ts
    trueSolarTime.test.ts
    tsconfig.json
  test-integration-fixes.ts
  test-star-positioning.js
  tsconfig.json
  tsconfig.json.bak
  vitest.config.mts
  wrangler.jsonc
scripts/
  quick-deploy.sh
vfor-backup-20251129-210944.tar.gz
```


## 📊 File Dependencies

> Scanned 200 files

### API Endpoints Used

```
/api/v1/calculate
/api/v1/daily-insight/check
/api/v1/daily-insight/stream
```

### High-Impact Files

*Files imported by multiple other files:*

| File | Imported by |
|------|-------------|
| `peixuan-worker/src/calculation/types` | 19 files |
| `peixuan-worker/src/calculation/core/ganZhi` | 14 files |
| `peixuan-worker/src/calculation/bazi/fourPillars` | 11 files |
| `peixuan-worker/src/calculation/annual/palace` | 11 files |
| `peixuan-worker/src/calculation/core/time/solarTerms` | 10 files |



---

*This file is auto-generated by Maestro session hooks. Do not edit manually.*
