# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Peixuan (佩璇) is an intelligent astrological analysis platform combining traditional Chinese astrology (BaZi 八字 and Purple Star 紫微斗數) with AI-powered analysis. Cloud-native serverless architecture on Cloudflare.

## Architecture

- **Frontend**: Vue 3 + TypeScript + Vite in `bazi-app-vue/`
- **Backend**: Cloudflare Workers + Hono router in `peixuan-worker/`
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **AI**: Multi-provider (Google Gemini primary, Azure OpenAI fallback) with automatic failover via `aiServiceManager.ts`

## Development Commands

### Local Development
```bash
# 1. Install dependencies
cd peixuan-worker && npm install
cd ../bazi-app-vue && npm install

# 2. Setup: copy secrets template and fill in API keys
cp peixuan-worker/.dev.vars.example peixuan-worker/.dev.vars

# 3. Apply D1 migrations to local database (required on first run)
cd peixuan-worker
npx wrangler d1 migrations apply peixuan-db --local

# 4. Start backend (Wrangler dev server, auto-creates local D1)
npm run dev              # wrangler dev → http://localhost:8787

# 5. Start frontend (Vite dev server, proxies /api to :8787)
cd ../bazi-app-vue
npm run dev              # vite → http://localhost:5173
```

### Frontend (`bazi-app-vue/`)
```bash
cd bazi-app-vue
npm run dev              # Vite dev server (proxies /api → localhost:8787)
npm run build            # vue-tsc + vite build
npm run build:skip-check # vite build without TypeScript checking
npm run test             # Vitest (no watch)
npm run test:coverage    # Vitest with coverage
npm run lint             # ESLint with auto-fix
npm run format           # Prettier formatting
```

### Backend (`peixuan-worker/`)
```bash
cd peixuan-worker
npm run dev                    # wrangler dev (local D1 + env vars from .dev.vars)
npm run build                  # esbuild → dist/index.js
npm run test                   # All tests (Vitest)
npm run test:unit              # Unit tests only (excludes integration/)
npm run test:integration       # Integration tests only
npm run lint                   # ESLint with auto-fix
npm run deploy:staging         # Build + deploy to Staging
npm run deploy:production      # Build + deploy to Production
npm run db:generate            # Generate Drizzle migrations
npm run db:migrate:staging     # Apply migrations to Staging D1
npm run db:migrate:production  # Apply migrations to Production D1
```

### Running a Single Test
```bash
cd peixuan-worker
npx vitest run src/calculation/bazi/__tests__/tenGods.test.ts

cd bazi-app-vue
npx vitest run src/components/__tests__/BaziChart.spec.ts
```

## Backend Calculation Architecture

The calculation engine is modular, organized under `peixuan-worker/src/calculation/`:

- **Unified Calculator**: `integration/calculator.ts` — orchestrates all subsystems, single entry point used by controllers
- **Validation**: `integration/validator.ts` — input validation before calculation
- **BaZi (八字)**:
  - `bazi/fourPillars.ts` — four pillars (year/month/day/hour)
  - `bazi/tenGods.ts` — ten gods relationships
  - `bazi/hiddenStems.ts` — hidden stems in earthly branches
  - `bazi/lunarAdapter.ts` — bridges `lunar-typescript` library
- **ZiWei (紫微斗數)**:
  - `ziwei/bureau.ts` — bureau (局) determination
  - `ziwei/palaces.ts` — 12 palace positioning
  - `ziwei/stars/ziwei.ts`, `tianfu.ts`, `auxiliary.ts` — star placement
  - `ziwei/sihua/` — Four Transformations system (aggregator, graph analysis, edge generator, cycle detection)
  - `ziwei/decade.ts` — decade fortune calculations
- **Annual Fortune**: `annual/palace.ts`, `interaction.ts`, `liuchun.ts`
- **Core Utilities**: `core/ganZhi/` (stem-branch), `core/time/` (solar terms, true solar time, Julian day), `core/wuXing/` (five elements)
- **Fortune**: `fortune/dayun.ts` (major fortune periods), `fortune/qiyun.ts` (starting age)
- **WuXing Distribution**: `wuXing/distribution.ts`, `seasonality.ts`
- **Types**: `types/index.ts` — shared calculation types (imported by 19+ files)

## AI Services Architecture

Located in `peixuan-worker/src/services/`:

- **`aiServiceManager.ts`** — selects AI provider with automatic fallback (`ENABLE_AI_FALLBACK=true`)
- **`geminiService.ts`** — Google Gemini API (primary provider)
- **`azureOpenAIService.ts`** — Azure OpenAI API (fallback, uses `gpt-4.1-mini`)
- **Agentic Services** (multi-step reasoning for daily questions):
  - `agenticGeminiService.ts`, `agenticAzureService.ts`
- **Caching**: `analysisCacheService.ts`, `advancedAnalysisCacheService.ts`, `chartCacheService.ts`
- **Analytics**: `analyticsService.ts` — logs AI provider usage, fallback events, performance
- **Formatters**: `formatters/markdownFormatter.ts`, `advancedMarkdownFormatter.ts`

## API Endpoints

### Calculation
- `POST /api/v1/calculate` — unified chart calculation (BaZi + ZiWei)
- `POST /api/v1/purple-star/calculate` — Purple Star only

### AI Analysis (SSE streaming)
- `GET /api/v1/analyze/stream` — personality analysis
- `GET /api/v1/analyze/check` — check cache for existing analysis
- `GET /api/v1/analyze/advanced/stream` — fortune/advanced analysis
- `GET /api/v1/analyze/advanced/check` — check cache for advanced analysis

### Daily Insight (Agentic AI)
- `POST /api/v1/daily-insight/stream` — daily question with agentic reasoning (SSE)
- `POST /api/v1/daily-insight/check` — rate limit check (one per day)

### Chart CRUD
- `GET/POST /api/charts` — list/save charts
- `GET/DELETE /api/charts/:id` — get/delete chart

### System
- `GET /health` — health check

## Database Schema

Defined in `peixuan-worker/src/db/schema.ts` using Drizzle ORM. Tables: `users`, `chart_records`, `analysis_records`, `advanced_analysis_records`, `daily_question_logs`, `agent_execution_traces`.

Cron trigger `0 2 * * *` cleans up charts older than 6 months.

## Frontend Architecture

- **Single Pinia store**: `stores/chartStore.ts` — manages chart state, no separate analysis store
- **Views**: `HomeView.vue`, `UnifiedView.vue` (calculate), `UnifiedAIAnalysisView.vue` (AI results), `DailyQuestionView.vue`
- **Key composables**: `useFormValidation.ts`, `useGeocoding.ts`, `useFormData.ts`, `useDailyQuestion.ts`, `useTheme.ts`
- **i18n**: Vue i18n with `zh_TW` and `en` locales in `src/i18n/locales/`

## Key File Locations

- **Backend Entry**: `peixuan-worker/src/index.ts`
- **Wrangler Config**: `peixuan-worker/wrangler.jsonc`
- **DB Schema**: `peixuan-worker/src/db/schema.ts`
- **Unified Calculator**: `peixuan-worker/src/calculation/integration/calculator.ts`
- **Frontend Entry**: `bazi-app-vue/src/main.ts`
- **Router**: `bazi-app-vue/src/router/index.ts`

## Deployment

Frontend is built and copied into the Worker's `public/` directory, then deployed together:
```bash
cd bazi-app-vue && npm run build
cp -r dist/* ../peixuan-worker/public/
cd ../peixuan-worker && npm run deploy:staging  # or deploy:production
```

## Environment Variables

### Local Development
Copy `peixuan-worker/.dev.vars.example` to `peixuan-worker/.dev.vars` and fill in API keys. Wrangler reads this automatically during `npm run dev`.

### Cloud (wrangler.jsonc)
Secrets (set via `wrangler secret`): `GEMINI_API_KEY`, `AZURE_OPENAI_API_KEY`

Config vars: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT` (`gpt-4.1-mini`), `AI_PROVIDER_TIMEOUT_MS` (45000), `ENABLE_AI_FALLBACK` (true), `ENABLE_ANALYTICS_LOGGING`, `ANALYTICS_SAMPLE_RATE`