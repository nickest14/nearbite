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

## Google OAuth 設定

登入只支援 Google 帳號，需要一組 OAuth client（免費，不用綁信用卡）：

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立或選擇一個專案
2. **APIs & Services → OAuth consent screen**：User type 選 External，填應用名稱與聯絡 email；Publishing status 維持 **Testing**，在 Test users 加入自己和朋友的 Google 帳號（上限 100 人，夠用）
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**：Application type 選 Web application，Authorized redirect URIs 填 `http://localhost:3000/api/auth/callback/google`（正式環境再加一筆正式網址）
4. 把 Client ID 與 Client Secret 填進 `.env` 的 `AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`
5. `AUTH_SECRET` 用 `openssl rand -base64 32` 產生
6. `ALLOWED_EMAILS` 填允許登入的 email，逗號分隔、不分大小寫。**正式環境必填**：留空時正式環境會拒絕所有登入；開發環境留空則任何 Google 帳號都能登入

Google 不會對 OAuth 登入收費。同意畫面維持 Testing 狀態時 refresh token 會在 7 天後過期，但本專案只用 Google 做登入、不保存需要長期有效的 token，不受影響。

## Google Maps Platform 設定

附近搜尋用 Google Places API (New) 找店家、Geocoding API 把地址轉座標、Maps JavaScript API 畫地圖。三個都需要啟用帳單，但正常使用量在免費額度內（見下方「成本」）。

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 選擇與 OAuth 相同的專案，**Billing** 啟用帳單（需要信用卡，免費額度內不會扣款）
2. **APIs & Services → Library** 啟用三個 API：**Places API (New)**（注意不是舊的 Places API）、**Maps JavaScript API**、**Geocoding API**
3. **APIs & Services → Credentials → Create Credentials → API key**，建立**兩把**金鑰並各自設限制：
   - **伺服器端金鑰** → 填 `.env` 的 `GOOGLE_MAPS_SERVER_API_KEY`
     - Application restrictions：**None**（Server Action 的請求沒有 referrer）
     - API restrictions：只勾 **Places API (New)** 與 **Geocoding API**
   - **瀏覽器端金鑰** → 填 `.env` 的 `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`
     - Application restrictions：**Websites**，加入 `http://localhost:3000/*`（正式環境再加正式網域）
     - API restrictions：只勾 **Maps JavaScript API**
4. **APIs & Services → Enabled APIs → 各 API → Quotas and System Limits** 設每日上限，避免被刷或程式出錯時超出免費額度：
   - Places API (New) 的 Nearby Search（`SearchNearbyRequest per day`）：**150 次／日**（≈ 4,500／月）
   - Places API (New) 的 Place Details（`GetPlaceRequest per day`）：**50 次／日**（詳情頁用，Enterprise 等級每月只有 1,000 次免費）
   - Geocoding API：**300 次／日**
   - Maps JavaScript API 的 Map loads：**300 次／日**
5. （建議）**Billing → Budgets & alerts** 設一個 1 美元的預算警示，超過就寄信
6. `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` 開發時可留空，程式會用 Google 的 `DEMO_MAP_ID`；正式環境到 **Google Maps Platform → Map Management** 建一個 Map ID 再填入

**成本**：Places API (New) 依 FieldMask 中「最貴」的欄位計費。搜尋只要求 Pro 等級欄位（店名、地址、座標、類型、評分、營業狀態），每月 5,000 次免費；營業時間、價位、評論數、電話、網站屬 Enterprise 等級（每月只有 1,000 次免費），只在店家詳情頁用 Place Details 取得，並在資料庫快取 7 天（7–30 天背景更新、超過 30 天重抓）。照片每月只有 1,000 張免費，所以**整個 app 不顯示店家照片**，用類型圖示代替。Geocoding 每月 10,000 次免費、Maps JavaScript 每月 10,000 次地圖載入免費。

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
