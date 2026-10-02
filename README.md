# Nearbite

給自己和朋友用的「附近吃什麼」工具：打開就看到附近的餐廳，點進去看資訊，吃完留評論，想記住的存進清單。

完整規劃見 [docs/product-plan.md](docs/product-plan.md)，功能以 [openspec/](openspec/) 裡的 change 逐步實作。

## 技術棧

Next.js 16（App Router）・React 19・TypeScript strict・Tailwind CSS 4・Prisma 7 + PostgreSQL 16・Vitest

## 需求

- Node.js 20.19 以上（建議 22，見 `.nvmrc`）
- pnpm 12（透過 corepack 啟用，見下方）
- Docker（跑本機 Postgres）

## 本機啟動

```bash
# 1. 啟用 pnpm（只需一次）。Node 20 內建的 corepack 太舊，要先升級
npm install -g corepack@latest
corepack enable

# 2. 環境變數
cp .env.example .env          # 預設值即可連上 Docker Compose 的 Postgres

# 3. 資料庫
docker compose up -d          # Postgres 在 localhost:5432

# 4. 安裝相依並建立資料表
pnpm install                  # postinstall 會自動執行 prisma generate
pnpm db:migrate

# 5. 開發伺服器
pnpm dev                      # http://localhost:3000
```

確認一切正常：開啟 http://localhost:3000/api/health 應回傳 `{"status":"ok","database":"ok",...}`。

## 常用指令

| 指令               | 說明                                                         |
| ------------------ | ------------------------------------------------------------ |
| `pnpm dev`         | 開發伺服器                                                   |
| `pnpm check`       | 一次跑完 typecheck、lint、format 檢查、測試（commit 前執行） |
| `pnpm test`        | 跑測試；`pnpm test:watch` 進入 watch 模式                    |
| `pnpm lint:fix`    | 自動修 ESLint 問題                                           |
| `pnpm format`      | Prettier 排版全部檔案                                        |
| `pnpm db:migrate`  | 建立／套用 migration（`prisma migrate dev`）                 |
| `pnpm db:studio`   | 開 Prisma Studio 看資料                                      |
| `pnpm db:generate` | 重新產生 Prisma Client                                       |

## 專案結構

```
app/              路由與頁面（App Router）
  api/health/     健康檢查端點
components/       共用 UI 元件（殼層、導覽、頁首）
lib/              非 UI 的共用程式（Prisma 單例、導覽項目定義）
prisma/           schema 與 migrations
generated/prisma/ Prisma Client 產出（不進版控）
docs/             產品規劃
openspec/         規格與 change
```

## 注意事項

- **Prisma 版本鎖定**：`prisma` 套件在 npm 上的 `latest` 標籤目前指向 8.0 RC，請勿用 `pnpm add prisma` 升級；`package.json` 明確鎖在 `^7.10.0`。
- **Prisma 7 的連線方式**：不再使用內建 Rust 引擎，而是透過 `@prisma/adapter-pg` driver adapter，連線字串由 [prisma.config.ts](prisma.config.ts) 讀取 `DATABASE_URL`。見 [lib/db.ts](lib/db.ts)。
- **jsdom 版本**：鎖在 27.x，因為 jsdom 30 需要 Node 22.22 以上。
- **設計 token**：顏色、間距等定義在 [app/globals.css](app/globals.css) 的 `@theme`，元件只用語意 token（`bg-surface`、`text-text-muted`、`bg-accent` 等）。
- **Conventional Commits**：`feat:`、`fix:`、`chore:`、`refactor:`、`docs:`、`test:`。

## 疑難排解

- `docker compose up` 卡住、`docker pull` 停在「Pulling fs layer」沒有進度：通常是 Docker Desktop 的 VM 網路卡死（睡眠或切換 VPN 後常見），registry 連得到但 layer 下載不動。重啟 Docker Desktop 即可；若選單的 Restart 沒反應，用 `pkill -f com.docker.backend` 強制結束後再 `open -a Docker`。
- `pnpm` 執行時出現 `Cannot find module .../bin/pnpm.cjs`：corepack 版本太舊，執行 `npm install -g corepack@latest` 後重試。
