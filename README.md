# 佩璇 (Peixuan) - 智慧命理分析平台

![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)
![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)
![Vue](https://img.shields.io/badge/Vue.js-3.5-4FC08D.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020.svg)

> **結合傳統智慧與現代 AI 科技的命理分析平台**

佩璇 (Peixuan) 是一個現代化的智慧命理分析平台，融合傳統中國命理學（八字四柱、紫微斗數）與多供應商 AI 技術（Google Gemini + Azure OpenAI 備援），透過 Cloudflare Workers 邊緣運算架構，提供快速、精準的命理分析服務。

---

## 核心特色

### 雙系統命理引擎

- **八字四柱 (BaZi)**：基於 `lunar-typescript` 計算四柱八字，支援真太陽時經度校正、藏干、十神、五行能量分佈與季節修正
- **紫微斗數 (ZiWei DouShu)**：完整十二宮位排盤、108 顆星曜安星、四化飛星圖分析（DFS 環路檢測 + 度數中心性分析）
- **大限/流年系統**：起運計算、大運生成、流年命宮旋轉、太歲分析、天干五合/地支六沖/三合三會互動偵測

### 多供應商 AI 智慧分析

- **主引擎**：Google Gemini 3.0 Flash Preview
- **備援引擎**：Azure OpenAI GPT-4.1 Mini（429/503/500/timeout 自動降級）
- **Agentic AI 每日一問**：ReAct 模式 + Function Calling，5 個專業工具，最多 8 輪推理
- **SSE 串流回應**：Server-Sent Events 即時顯示分析內容
- **D1 快取策略**：同日快取一致性，降低 API 呼叫成本

### Edge-First 架構

- **Cloudflare Workers**：全球 300+ 邊緣節點，超低延遲
- **Cloudflare D1**：分散式 SQLite 資料庫 + Drizzle ORM
- **Serverless**：按需計費，自動擴展

---

## 技術棧

### 後端 (peixuan-worker/)
| 技術 | 用途 |
|------|------|
| Cloudflare Workers | Serverless 邊緣運算 |
| TypeScript 5.5+ | 型別安全開發 |
| itty-router 5.x | 輕量級路由 (< 1KB) |
| Cloudflare D1 | SQLite 分散式資料庫 |
| Drizzle ORM 0.44+ | 型別安全 SQL ORM |
| Google Gemini API | 主要 AI 引擎 |
| Azure OpenAI API | 備援 AI 引擎 |
| lunar-typescript 1.8+ | 農曆計算與八字排盤 |
| Zod 4.x | Schema 驗證 |

### 前端 (bazi-app-vue/)
| 技術 | 用途 |
|------|------|
| Vue 3.5+ | Composition API + `<script setup>` |
| Vite 6.x | 建置工具 |
| TypeScript 5.8+ | 型別安全開發 |
| Pinia 3.x | 狀態管理 |
| Element Plus 2.10+ | UI 組件庫 |
| Vue Router 4.5+ | 路由 |
| Vue I18n 9.x | 國際化 (zh_TW / en) |
| Axios 1.9+ | HTTP 客戶端 |
| marked 17.x | Markdown 渲染 |

### 開發工具
| 工具 | 版本 |
|------|------|
| Vitest 3.x | 測試框架（前端 + 後端） |
| ESLint 9.x | Linter |
| Prettier 3.x | 格式化 |
| Wrangler CLI 4.x | Cloudflare 部署工具 |

---

## 專案結構

```
Peixuan/
├── peixuan-worker/                    # 後端 Cloudflare Workers
│   ├── src/
│   │   ├── index.ts                   # Worker 入口 + AutoRouter
│   │   ├── calculation/               # 命理計算引擎
│   │   │   ├── integration/
│   │   │   │   ├── calculator.ts      # 統一計算器 (單一入口)
│   │   │   │   └── validator.ts       # 輸入驗證
│   │   │   ├── bazi/                  # 八字系統
│   │   │   │   ├── lunarAdapter.ts    # lunar-typescript 橋接器
│   │   │   │   ├── fourPillars.ts     # 四柱計算
│   │   │   │   ├── hiddenStems.ts     # 藏干
│   │   │   │   └── tenGods.ts         # 十神
│   │   │   ├── ziwei/                 # 紫微斗數系統
│   │   │   │   ├── palaces.ts         # 命宮/身宮
│   │   │   │   ├── bureau.ts          # 五行局
│   │   │   │   ├── decade.ts          # 大限
│   │   │   │   ├── stars/             # 星曜定位
│   │   │   │   │   ├── ziwei.ts       # 紫微星 (商餘補償)
│   │   │   │   │   ├── tianfu.ts      # 天府星 (鏡像)
│   │   │   │   │   └── auxiliary.ts   # 輔助星
│   │   │   │   └── sihua/             # 四化飛星分析
│   │   │   │       ├── edgeGenerator.ts   # 有向邊產生
│   │   │   │       ├── graphAnalysis.ts   # DFS 環路 + 中心性
│   │   │   │       └── aggregator.ts      # 多層聚合
│   │   │   ├── core/                  # 核心工具
│   │   │   │   ├── time/              # 真太陽時、節氣、儒略日
│   │   │   │   ├── ganZhi/            # 干支系統
│   │   │   │   └── wuXing/            # 五行關係
│   │   │   ├── fortune/               # 大運系統 (起運+大運)
│   │   │   ├── annual/                # 流年分析
│   │   │   ├── wuXing/                # 五行分布 + 季節修正
│   │   │   └── types/                 # 型別定義
│   │   ├── controllers/               # 控制器層
│   │   │   ├── analyzeController.ts   # AI 分析流程協調
│   │   │   ├── promptBuilder.ts       # AI 提示詞建構
│   │   │   └── streamProcessor.ts     # SSE 串流處理
│   │   ├── services/                  # AI 服務
│   │   │   ├── aiServiceManager.ts    # 多供應商管理器
│   │   │   ├── geminiService.ts       # Gemini API
│   │   │   ├── azureOpenAIService.ts  # Azure OpenAI API
│   │   │   ├── agenticGeminiService.ts    # Agentic AI (Gemini)
│   │   │   └── agenticAzureService.ts     # Agentic AI (Azure)
│   │   ├── routes/                    # API 路由
│   │   │   ├── analyzeRoutes.ts       # AI 分析路由 (SSE)
│   │   │   ├── unifiedRoutes.ts       # 統一計算路由
│   │   │   ├── chartRoutes.ts         # 命盤 CRUD
│   │   │   └── dailyReminderRoutes.ts # 每日提醒
│   │   └── db/
│   │       └── schema.ts             # Drizzle ORM Schema
│   ├── drizzle/                       # D1 遷移檔案
│   ├── public/                        # 前端靜態資源
│   ├── wrangler.jsonc                 # Cloudflare Workers 配置
│   ├── .dev.vars.example              # 本地開發環境變數範本
│   └── package.json
│
├── bazi-app-vue/                      # 前端 Vue 3 應用
│   ├── src/
│   │   ├── App.vue                    # 根組件
│   │   ├── main.ts                    # 應用入口
│   │   ├── views/                     # 頁面視圖
│   │   │   ├── HomeView.vue           # 首頁 (Glassmorphism)
│   │   │   ├── UnifiedView.vue        # 命盤計算頁
│   │   │   ├── UnifiedAIAnalysisView.vue  # AI 分析頁 (SSE)
│   │   │   └── DailyQuestionView.vue  # 每日一問 (Agentic AI)
│   │   ├── components/                # UI 組件
│   │   │   ├── UnifiedInputForm.vue   # 統一輸入表單
│   │   │   ├── UnifiedResultView.vue  # 統一結果顯示
│   │   │   └── BaziChart.vue          # 八字排盤顯示
│   │   ├── stores/
│   │   │   └── chartStore.ts          # Pinia 命盤狀態
│   │   ├── composables/               # 可組合函式
│   │   │   ├── useTheme.ts            # 主題切換
│   │   │   ├── useGeocoding.ts        # Esri 地理編碼
│   │   │   ├── useDailyQuestion.ts    # 每日問答狀態
│   │   │   └── useDisplayMode.ts      # 顯示模式
│   │   ├── services/
│   │   │   ├── apiService.ts          # Axios HTTP 客戶端
│   │   │   └── unifiedApiService.ts   # 統一 API + 欄位映射
│   │   ├── router/                    # Vue Router 配置
│   │   ├── i18n/locales/              # 語言檔 (zh_TW, en)
│   │   └── assets/                    # CSS, 圖片
│   ├── vite.config.ts
│   └── package.json
│
├── doc/
│   └── ARCHITECTURE_ANALYSIS.md       # 完整架構分析
├── CLAUDE.md                          # Claude Code 專案指引
├── README.md
└── LICENSE                            # CC BY-NC-SA 4.0
```

---

## API 端點

### 計算
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/v1/calculate` | 統一計算（BaZi + ZiWei） |
| POST | `/api/v1/purple-star/calculate` | 紫微單獨計算 |

### AI 分析（SSE 串流）
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/analyze/stream` | 個性分析串流 |
| GET | `/api/v1/analyze/check` | 個性分析快取檢查 |
| GET | `/api/v1/analyze/advanced/stream` | 運勢分析串流 |
| GET | `/api/v1/analyze/advanced/check` | 運勢分析快取檢查 |

### 每日洞察（Agentic AI）
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/v1/daily-insight/stream` | 每日問答串流 |
| POST | `/api/v1/daily-insight/check` | 每日限額檢查 |

### 命盤 CRUD
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/charts` | 命盤列表（分頁） |
| POST | `/api/charts` | 儲存命盤 |
| GET | `/api/charts/:id` | 取得單一命盤 |
| DELETE | `/api/charts/:id` | 刪除命盤 |
| GET | `/api/analyses` | 分析記錄列表 |
| POST | `/api/analyses` | 儲存分析記錄 |

### 系統
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/health` | 健康檢查 |
| GET | `/api/v1/daily-reminder` | 每日提醒（24hr 快取） |

---

## 快速開始

### 環境要求
- Node.js 20.x+
- npm 8+
- Cloudflare 帳號（用於雲端部署）

### 本地開發

本專案支援本地開發，前端與後端皆可在本機執行。

#### 1. 安裝依賴
```bash
# 後端
cd peixuan-worker
npm install

# 前端
cd ../bazi-app-vue
npm install
```

#### 2. 設定本地環境變數
```bash
cd peixuan-worker
cp .dev.vars.example .dev.vars
# 編輯 .dev.vars，填入 GEMINI_API_KEY 和 AZURE_OPENAI_API_KEY
```

#### 3. 初始化本地 D1 資料庫
```bash
cd peixuan-worker
npx wrangler d1 migrations apply peixuan-db --local
```

#### 4. 啟動開發伺服器
```bash
# 後端 (Terminal 1) - http://localhost:8787
cd peixuan-worker
npm run dev

# 前端 (Terminal 2) - http://localhost:5173
cd bazi-app-vue
npm run dev
```

### 雲端部署

#### Staging 環境
```bash
# 後端
cd peixuan-worker
npm run deploy:staging

# 前端 → 複製至 Worker public/ → 一起部署
cd ../bazi-app-vue
npm run build
cp -r dist/* ../peixuan-worker/public/
cd ../peixuan-worker
npm run deploy:staging
```

#### Production 環境
```bash
cd peixuan-worker
npm run deploy:production
```

#### 設定 Secrets
```bash
wrangler secret put GEMINI_API_KEY --env production
wrangler secret put AZURE_OPENAI_API_KEY --env production
```

---

## 測試

```bash
# 後端測試
cd peixuan-worker
npm run test

# 前端測試
cd bazi-app-vue
npm run test
```

---

## 關鍵架構模式

| 模式 | 說明 |
|------|------|
| 多供應商 AI 降級 | Gemini → Azure 自動切換 (429/503/500/timeout) |
| Agentic ReAct | 每日問答 Function Calling + 多輪推理（最多 8 輪） |
| SSE 串流 | 所有 AI 回應為即時串流，含快取模擬串流 |
| 圖論四化分析 | 有向圖建模 + DFS 環路檢測 + 度數中心性 |
| 真太陽時校正 | 經度校正 `(L_local - 120) x 4 分鐘`，標準子午線 120°E |
| 每日一致性快取 | 同一天快取結果永遠回傳，強制刷新無效 |
| 零影響 Analytics | `ctx.waitUntil()` 非同步寫入，不影響回應速度 |
| 匿名持久化 | localStorage 保持匿名使用者命盤跨會話 |
| 人設驅動 AI | 佩璇角色設定 + 安全規則 + token 預算分配 |

---

## 授權 (License)

本專案採用 **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License** (CC BY-NC-SA 4.0) 授權。

[![License: CC BY-NC-SA 4.0](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

- **姓名標示** — 必須給予適當表彰
- **非商業性** — 不得用於商業目的
- **相同方式分享** — 衍生作品須依相同授權散布

詳細條款請參閱 [LICENSE](LICENSE) 檔案。

---

## 致謝

- [lunar-typescript](https://github.com/6tail/lunar-typescript) - 農曆計算庫
- [Cloudflare](https://cloudflare.com/) - Edge Computing 平台
- [Google Gemini](https://ai.google.dev/) - AI 主引擎
- [Azure OpenAI](https://azure.microsoft.com/products/ai-services/openai-service) - AI 備援引擎
- [Vue.js](https://vuejs.org/) - 前端框架
- [Element Plus](https://element-plus.org/) - UI 組件庫
- [Esri ArcGIS](https://www.esri.com/) - 地理編碼服務

---

<div align="center">

**佩璇 (Peixuan)** - 結合傳統智慧與現代科技的命理分析平台

</div>
