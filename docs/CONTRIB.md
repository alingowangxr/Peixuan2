# 開發者指南 (Contributing Guide)

> 自動從 `package.json` 和 `.env.example` 生成 — 2026-02-13

---

## 環境需求

| 工具 | 版本 |
|------|------|
| Node.js | >= 18 |
| npm | >= 9 |
| Wrangler CLI | >= 4.x |

---

## 快速開始

```bash
# 1. Clone 專案
git clone <repo-url> && cd peixuan

# 2. 安裝後端依賴
cd peixuan-worker && npm install

# 3. 安裝前端依賴
cd ../bazi-app-vue && npm install

# 4. 設定環境變數
cp peixuan-worker/.dev.vars.example peixuan-worker/.dev.vars
# 編輯 .dev.vars，填入 GEMINI_API_KEY 和 AZURE_OPENAI_API_KEY

# 5. 初始化本地資料庫
cd peixuan-worker
npx wrangler d1 migrations apply peixuan-db --local

# 6. 啟動後端 (http://localhost:8787)
npm run dev

# 7. 啟動前端 (http://localhost:5173，自動代理 /api → :8787)
cd ../bazi-app-vue
npm run dev
```

---

## 可用腳本

### 後端 (`peixuan-worker/`)

| 腳本 | 指令 | 說明 |
|------|------|------|
| `dev` | `npx wrangler dev` | 啟動本地開發伺服器 (含 D1 + .dev.vars) |
| `build` | `esbuild src/index.ts → dist/index.js` | 打包為 ESM 格式 Worker |
| `test` | `vitest run` | 執行所有測試 |
| `test:unit` | `vitest run test --exclude integration` | 僅執行單元測試 |
| `test:integration` | `vitest run test/integration` | 僅執行整合測試 |
| `lint` | `eslint . --fix` | ESLint 檢查並自動修復 |
| `deploy:staging` | `build + wrangler deploy --env staging` | 部署至 Staging 環境 |
| `deploy:production` | `build + wrangler deploy --env production` | 部署至 Production 環境 |
| `db:generate` | `drizzle-kit generate` | 生成 Drizzle 遷移檔案 |
| `db:migrate:staging` | `wrangler d1 migrations apply … --env staging` | 套用 Staging 資料庫遷移 |
| `db:migrate:production` | `wrangler d1 migrations apply … --env production` | 套用 Production 資料庫遷移 |

### 前端 (`bazi-app-vue/`)

| 腳本 | 指令 | 說明 |
|------|------|------|
| `dev` | `npx vite` | 啟動 Vite 開發伺服器 |
| `build` | `vue-tsc && vite build` | TypeScript 檢查 + 生產建置 |
| `build:skip-check` | `vite build` | 跳過 TypeScript 檢查的建置 |
| `test` | `vitest run` | 執行測試（無 watch） |
| `test:ui` | `vitest --ui` | 啟動 Vitest UI 介面 |
| `test:coverage` | `vitest run --coverage` | 執行測試並產生覆蓋率報告 |
| `lint` | `eslint . --fix` | ESLint 檢查並自動修復 |
| `format` | `prettier --write src/` | Prettier 格式化 |
| `analyze` | `vite build --mode analyze` | 建置並分析 bundle 大小 |

---

## 環境變數參考

### 後端 — `peixuan-worker/.dev.vars`

| 變數 | 說明 | 來源 |
|------|------|------|
| `GEMINI_API_KEY` | Google Gemini API 密鑰 | [ai.google.dev](https://ai.google.dev/) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API 密鑰 | Azure Portal → OpenAI Resource |

### 後端 — `wrangler.jsonc` vars（非敏感）

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `AZURE_OPENAI_ENDPOINT` | `https://iim20-m9w1b4wx-eastus2.cognitiveservices.azure.com/` | Azure OpenAI 端點 |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4.1-mini` | Azure 部署模型名稱 |
| `AZURE_OPENAI_API_VERSION` | `2024-04-01-preview` | Azure API 版本 |
| `AI_PROVIDER_TIMEOUT_MS` | `45000` | AI 請求超時（毫秒） |
| `ENABLE_AI_FALLBACK` | `true` | 啟用 AI 提供者自動降級 |
| `ENABLE_ANALYTICS_LOGGING` | `true` | 啟用分析日誌 |
| `ANALYTICS_SAMPLE_RATE` | `1.0` | 分析取樣率 (0.0–1.0) |

### 前端 — `bazi-app-vue/.env.example`

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | API 基礎 URL |
| `VITE_ENABLE_ANALYTICS` | `false` | 啟用分析功能 |
| `VITE_ENABLE_PREMIUM_FEATURES` | `false` | 啟用高級功能 |
| `VITE_ENABLE_DEBUG_MODE` | `false` | 啟用調試模式 |
| `VITE_DEFAULT_LOCALE` | `zh-TW` | 預設語言 |
| `VITE_AVAILABLE_LOCALES` | `zh-TW,en-US` | 可用語言列表 |
| `VITE_DEFAULT_THEME` | `light` | 預設主題 |
| `VITE_STORAGE_PREFIX` | `peixuan_` | 本地存儲前綴 |
| `VITE_STORAGE_EXPIRY` | `604800` | 存儲過期秒數（7 天） |
| `VITE_GEOCODE_API_KEY` | — | 地理編碼 API 密鑰 |
| `VITE_TIMEZONE_API_URL` | — | 時區 API URL |

### 根目錄 — `.env.example`（Docker Compose 用）

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PROJECT_NAME` | `peixuan` | 專案名稱 |
| `PROJECT_VERSION` | `1.0.0` | 專案版本 |
| `POSTGRES_USER` | `postgres` | PostgreSQL 使用者 |
| `POSTGRES_PASSWORD` | `devpassword` | PostgreSQL 密碼 |
| `POSTGRES_DB` | `peixuan_dev` | PostgreSQL 資料庫名稱 |
| `POSTGRES_PORT` | `5432` | PostgreSQL 埠 |
| `REDIS_PORT` | `6379` | Redis 埠 |
| `REDIS_PASSWORD` | — | Redis 密碼 |
| `BACKEND_PORT` | `3000` | 後端埠 |
| `NODE_ENV` | `development` | Node 環境 |
| `FRONTEND_PORT` | `5173` | 前端埠 |
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | 前端 API URL |
| `ENABLE_MONITORING` | `false` | 啟用監控 |
| `GRAFANA_PORT` | `3001` | Grafana 埠 |
| `PROMETHEUS_PORT` | `9090` | Prometheus 埠 |

---

## 測試流程

```bash
# 後端全部測試
cd peixuan-worker && npm test

# 後端單元測試
npm run test:unit

# 後端整合測試
npm run test:integration

# 前端測試
cd bazi-app-vue && npm test

# 前端覆蓋率
npm run test:coverage

# 執行單一測試檔
cd peixuan-worker && npx vitest run src/calculation/bazi/__tests__/tenGods.test.ts
cd bazi-app-vue && npx vitest run src/components/__tests__/BaziChart.spec.ts
```

### 提交前檢查

1. 確保所有測試通過
2. 執行 `npm run lint` 修正程式碼風格
3. 前端額外執行 `npm run format`

---

## 資料庫遷移

```bash
# 1. 修改 schema (peixuan-worker/src/db/schema.ts)
# 2. 生成遷移
cd peixuan-worker && npm run db:generate

# 3. 本地測試
npx wrangler d1 migrations apply peixuan-db --local

# 4. 套用至 Staging
npm run db:migrate:staging

# 5. 套用至 Production
npm run db:migrate:production
```
