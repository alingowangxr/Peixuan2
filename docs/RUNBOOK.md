# 營運手冊 (Runbook)

> 自動從 `package.json` 和 `wrangler.jsonc` 生成 — 2026-02-13

---

## 部署流程

### Staging 部署

```bash
# 1. 建置前端
cd bazi-app-vue && npm run build
cp -r dist/* ../peixuan-worker/public/

# 2. 部署 Worker (含前端靜態檔案)
cd ../peixuan-worker
npm run deploy:staging
# 等同於: npm run build && wrangler deploy --env staging

# 3. 資料庫遷移（如有新遷移）
npm run db:migrate:staging
```

### Production 部署

```bash
# 1. 確認 Staging 測試通過

# 2. 建置前端
cd bazi-app-vue && npm run build
cp -r dist/* ../peixuan-worker/public/

# 3. 部署 Worker
cd ../peixuan-worker
npm run deploy:production

# 4. 資料庫遷移（如有新遷移）
npm run db:migrate:production

# 5. 驗證健康檢查
curl https://<production-url>/health
```

### 快速部署腳本

```bash
./scripts/quick-deploy.sh
```

---

## Secret 管理

敏感密鑰透過 `wrangler secret` 設定，不存入版本控制：

```bash
# 設定 Gemini API Key
npx wrangler secret put GEMINI_API_KEY --env production

# 設定 Azure OpenAI API Key
npx wrangler secret put AZURE_OPENAI_API_KEY --env production

# Staging 環境
npx wrangler secret put GEMINI_API_KEY --env staging
npx wrangler secret put AZURE_OPENAI_API_KEY --env staging
```

---

## 監控與告警

### 健康檢查

- **端點**: `GET /health`
- **預期回應**: 200 OK

### Cloudflare 觀測

Wrangler 已啟用 observability (`"observability": { "enabled": true }`)，可在 Cloudflare Dashboard 查看：

- Workers Analytics（請求數、錯誤率、延遲）
- D1 Analytics（查詢數、資料庫大小）
- Real-time Logs

### AI 服務監控

- `ENABLE_ANALYTICS_LOGGING=true` 記錄 AI 提供者使用情況
- `ANALYTICS_SAMPLE_RATE=1.0` 控制取樣率
- 監控 `analyticsService.ts` 記錄的 fallback 事件

### Cron 排程

| 排程 | 時間 | 說明 |
|------|------|------|
| 資料清理 | `0 2 * * *` (每日 UTC 02:00) | 清除 6 個月前的命盤紀錄 |

---

## 常見問題與修復

### 1. D1 資料庫遷移失敗

**症狀**: `npm run db:migrate:*` 報錯

**處理**:
```bash
# 檢查遷移狀態
npx wrangler d1 migrations list peixuan-db --env production

# 如果遷移檔案有問題，修正後重新生成
npm run db:generate
```

### 2. AI 服務全部失敗

**症狀**: 分析請求返回 500 或超時

**檢查**:
1. 確認 `GEMINI_API_KEY` 和 `AZURE_OPENAI_API_KEY` 已設定
2. 檢查 API 額度是否用盡
3. 確認 `ENABLE_AI_FALLBACK=true` 已啟用自動降級
4. 檢查 `AI_PROVIDER_TIMEOUT_MS` 是否合理（預設 45 秒）

**緊急處理**:
```bash
# 更新 API Key
npx wrangler secret put GEMINI_API_KEY --env production
```

### 3. 前端建置失敗

**症狀**: `npm run build` TypeScript 錯誤

**處理**:
```bash
# 跳過型別檢查先部署
npm run build:skip-check

# 後續修復型別問題
npx vue-tsc --noEmit
```

### 4. Worker 部署後 404

**症狀**: 前端頁面 404

**檢查**:
1. 確認 `bazi-app-vue/dist/*` 已複製到 `peixuan-worker/public/`
2. 確認 `wrangler.jsonc` 中 `assets.directory` 為 `./public`
3. 重新建置並部署

### 5. 本地開發 D1 錯誤

**症狀**: `wrangler dev` 報 D1 相關錯誤

**處理**:
```bash
# 重新套用本地遷移
npx wrangler d1 migrations apply peixuan-db --local

# 如需重建，刪除本地 D1 資料
rm -rf .wrangler/state
npx wrangler d1 migrations apply peixuan-db --local
```

---

## 回滾流程

### Worker 回滾

```bash
# Cloudflare Workers 支援版本回滾
# 方式 1: 從 Cloudflare Dashboard 回滾到上一版本

# 方式 2: 重新部署指定 commit
git checkout <previous-commit>
cd bazi-app-vue && npm run build
cp -r dist/* ../peixuan-worker/public/
cd ../peixuan-worker && npm run deploy:production
```

### 資料庫回滾

D1 不支援自動回滾遷移。需要手動：

1. 撰寫反向 SQL 遷移
2. 透過 `wrangler d1 execute` 執行

```bash
npx wrangler d1 execute peixuan-db --env production --command "DROP TABLE IF EXISTS <table_name>"
```

---

## 架構概覽

```
使用者 → Cloudflare CDN → Workers (Hono Router)
                              ├─ 靜態檔案 (Vue SPA)
                              ├─ /api/v1/calculate → 計算引擎
                              ├─ /api/v1/analyze/* → AI 分析 (SSE)
                              │     ├─ Gemini (主要)
                              │     └─ Azure OpenAI (備援)
                              ├─ /api/v1/daily-insight/* → 每日問答
                              └─ D1 SQLite (Drizzle ORM)
```
