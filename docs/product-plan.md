# Nearbite 產品規劃

> 最後更新：2026-10-02。這份文件是整個產品的總覽，各功能的細節規格放在 `openspec/` 的 change 與 spec 裡。

## 1. 一句話說明

Nearbite 是一個給自己和朋友用的「附近吃什麼」工具：打開就看到附近的餐廳，點進去看資訊，吃完留評論，想記住的存進清單。

## 2. 目標使用者與情境

**使用者**：自己與受邀的朋友（Google 帳號白名單），約 5–20 人。不對外公開。

**三個主要情境**：

1. **現在肚子餓**：站在路邊，想知道走路 10 分鐘內有什麼可以吃，依「正在營業」和「評價」快速挑一間。
2. **約吃飯**：朋友約在某區，事先用地址搜尋那附近，從收藏清單裡挑或找新的。
3. **吃完記錄**：剛吃完，留個評分和幾句話，之後朋友搜到這間店時能看到你的評論。

因為使用者是朋友圈，**自家評論的價值在於「我認識的人怎麼說」**，所以自家評分要和 Google 評分分開顯示，不混算。

## 3. 範圍

### V1（這次要做完的）

| 功能 | 說明 |
|---|---|
| Google 登入 | Auth.js + Google OAuth，email 白名單控制誰能進來 |
| 附近搜尋 | 取得定位 → 顯示附近餐廳的列表與地圖；拒絕定位時可手動輸入地址或地標 |
| 關鍵字搜尋 | 在目前位置附近搜「拉麵」「咖啡」等關鍵字 |
| 篩選與排序 | 料理類型、價位、最低評分、營業中、距離；依距離／Google 評分／自家評分／價位排序 |
| 餐廳詳情 | 名稱、照片、地址、電話、網站、營業時間、價位、Google 評分、自家評分、小地圖、一鍵導航 |
| 評論與評分 | 1–5 星 + 文字，每人每間餐廳一則，可編輯／刪除；詳情頁列出所有朋友的評論 |
| 收藏清單 | 多個清單（預設「我的最愛」），餐廳可加到多個清單並附備註；清單可產生分享連結給朋友看 |
| 個人頁 | 我的評論、我的清單、登出 |
| PWA | 可安裝到手機主畫面、有 icon 與啟動畫面、基本離線殼層 |

### V2（做完 V1 再說）

- 評論附照片（需圖片儲存服務）
- 多次造訪記錄（同一間店可記錄多次，含日期）
- 朋友動態：最近誰評論了什麼
- 「隨機挑一間」決策輔助
- 清單協作：多人共同編輯一個清單
- 通知：收藏的餐廳有新評論

### 非目標

- 不做 SEO、不做公開餐廳頁、不做社群分享預覽
- 不做餐廳老闆認領、不做訂位、不做外送
- 不做 iOS / Android 原生 App（PWA 就夠）
- 不自建餐廳資料庫、不做使用者新增餐廳（資料全來自 Google）
- 不做多語系（介面只有繁體中文）

## 4. 核心使用流程

### 流程 A：找附近的店

```
開啟 App
 └─ 已登入？否 → 登入頁 → Google OAuth → 白名單檢查 → 回首頁
 └─ 是 → 首頁
      └─ 請求定位
           ├─ 允許 → 以目前位置呼叫 Nearby Search → 顯示列表 + 地圖
           └─ 拒絕／失敗 → 顯示地址輸入框 → Geocoding → 以該座標搜尋
      └─ 調整篩選／排序（即時套用）
      └─ 點餐廳卡片 → 詳情頁
```

### 流程 B：看詳情並留評論

```
詳情頁
 ├─ 讀 DB 快取；若 Google 欄位過期 → 背景重抓 Place Details 並更新
 ├─ 顯示 Google 資訊 + 自家評分 + 朋友評論列表
 ├─ 「寫評論」→ 底部抽屜：星星 + 文字 → 送出（Server Action）→ 立即顯示
 └─ 「收藏」→ 底部抽屜：勾選要加入的清單、可加備註 → 儲存
```

### 流程 C：清單

```
清單頁（底部導覽「收藏」）
 ├─ 清單總覽：名稱、幾間店、封面
 ├─ 新增清單
 └─ 清單詳情：餐廳列表 + 地圖、每間店的備註、移除
      └─ 分享：產生 /share/[token] 唯讀連結，不需登入也能看
```

## 5. 技術架構

### 技術棧

| 層 | 選擇 | 備註 |
|---|---|---|
| 框架 | Next.js（App Router）+ React + TypeScript strict | 預設 Server Components |
| 樣式 | Tailwind CSS | 行動優先，375px 為基準 |
| 資料庫 | PostgreSQL 16 | 本機用 Docker Compose |
| ORM | Prisma | migrate + seed |
| 認證 | Auth.js (NextAuth v5) + Google provider | Prisma adapter，資料庫 session |
| 地圖 | Google Maps JavaScript API | 透過 `@vis.gl/react-google-maps` |
| 餐廳資料 | Google Places API (New) | Nearby Search、Text Search、Place Details、Place Photos |
| 地址轉座標 | Google Geocoding API | 拒絕定位時的替代方案 |
| 驗證 | Zod | Server Action 輸入驗證 |
| 測試 | Vitest + Testing Library；Playwright 做少量 E2E | |
| 部署 | 未定 | 先維持 Vercel 相容（無長駐程序、無本機檔案寫入） |

### 外部服務與金鑰

兩把 Google API 金鑰，分開限制：

- **伺服器端金鑰**（`GOOGLE_MAPS_SERVER_API_KEY`）：只開 Places API (New) 與 Geocoding API，只在 Server Actions / Route Handlers 使用，永遠不送到瀏覽器。
- **瀏覽器端金鑰**（`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`）：只開 Maps JavaScript API，限制 HTTP referrer 為 `localhost:3000` 與正式網域。

### Google Places 資料的快取策略

Places 條款允許 **永久保存 place_id**，其他欄位（含座標）最多暫存 30 天。所以：

1. `Restaurant` 表以 `googlePlaceId` 為唯一鍵，所有自家資料（評論、收藏）都掛在這張表上。
2. 搜尋結果回來時 upsert 進 `Restaurant`，記錄 `googleSyncedAt`。
3. 詳情頁讀取時若 `googleSyncedAt` 超過 7 天，背景重抓 Place Details 更新；超過 30 天則視為過期，先重抓再顯示。
4. 搜尋走 Google 即時結果，不從自家 DB 搜；自家 DB 只負責「這間店我們有哪些評論／收藏」。
5. 照片只存 photo reference，顯示時透過自家 Route Handler 代理 Place Photos（避免把伺服器金鑰暴露到前端）。

### 成本控制

個人專案的流量很小，但 Places API (New) 的 Nearby Search 與 Place Details 每千次約 US$17–32，免費額度有限。做法：

- 搜尋請求加 300ms debounce，地圖拖曳不自動重搜，改為「在此區域搜尋」按鈕
- Place Details 只要「詳情頁需要的欄位」（用 FieldMask 控制），不要全抓
- 詳情頁優先讀快取，7 天內不重抓
- 在 Google Cloud Console 設每日配額上限，避免意外爆帳單

### 資料流

```
瀏覽器 (Client Component)
  │ 定位 / 篩選狀態
  ▼
Server Action: searchNearby(lat, lng, filters)
  │ 伺服器端金鑰
  ▼
Google Places Nearby Search ──► upsert Restaurant ──► 合併自家評分 ──► 回傳
                                                              ▲
                                                   Review / FavoriteItem
```

## 6. 資料模型

```prisma
// Auth.js 標準表：User、Account、Session、VerificationToken（由 adapter 管理）

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())

  reviews       Review[]
  favoriteLists FavoriteList[]
  accounts      Account[]
  sessions      Session[]
}

model Restaurant {
  id              String   @id @default(cuid())
  googlePlaceId   String   @unique
  name            String
  address         String?
  lat             Float
  lng             Float
  priceLevel      Int?     // 0–4，對應 Google PRICE_LEVEL_*
  cuisineTypes    String[] // Google place types，例如 ["ramen_restaurant", "japanese_restaurant"]
  phone           String?
  website         String?
  openingHours    Json?    // Google regularOpeningHours 原樣保存
  photoRefs       String[] // Place Photo resource names
  googleRating    Float?
  googleRatingCount Int?
  googleSyncedAt  DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  reviews       Review[]
  favoriteItems FavoriteItem[]

  @@index([lat, lng])
}

model Review {
  id           String   @id @default(cuid())
  restaurantId String
  userId       String
  rating       Int      // 1–5
  body         String?
  visitedAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  restaurant Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, restaurantId]) // V1：每人每間一則；V2 多次造訪時拿掉
  @@index([restaurantId])
}

model FavoriteList {
  id          String   @id @default(cuid())
  ownerId     String
  name        String
  description String?
  isDefault   Boolean  @default(false) // 「我的最愛」，不可刪除
  shareToken  String?  @unique         // 有值表示已開啟分享
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner User           @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  items FavoriteItem[]

  @@index([ownerId])
}

model FavoriteItem {
  listId       String
  restaurantId String
  note         String?
  addedAt      DateTime @default(now())

  list       FavoriteList @relation(fields: [listId], references: [id], onDelete: Cascade)
  restaurant Restaurant   @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  @@id([listId, restaurantId])
}
```

**距離計算**：V1 在應用層用 Haversine 算，資料量小不需要 PostGIS。若之後要「我收藏過的店裡哪些在附近」這類 DB 端查詢再考慮加 `earthdistance` 擴充。

## 7. 頁面與路由

```
/                       首頁：附近搜尋（列表 ⇄ 地圖切換）、篩選列
/search?q=&lat=&lng=    關鍵字搜尋結果（與首頁共用元件）
/restaurants/[id]       餐廳詳情
/lists                  我的收藏清單總覽
/lists/[id]             清單詳情
/share/[token]          分享的清單（唯讀，不需登入）
/me                     個人頁：我的評論、設定、登出
/login                  登入頁
/api/auth/[...nextauth] Auth.js
/api/photos/[ref]       Place Photos 代理
```

**底部導覽列**（四個 tab）：探索 `/`、搜尋 `/search`、收藏 `/lists`、我 `/me`。

**行動優先設計原則**：

- 觸控目標至少 44×44px
- 主要操作放在螢幕下半部（底部抽屜、固定底部按鈕）
- 列表卡片一行一間店，資訊密度適中：名稱、料理類型、距離、價位、兩種評分、營業狀態
- 地圖模式下底部用可拖曳的卡片輪播顯示結果，不用彈窗
- 桌面版（≥1024px）改為左列表右地圖的雙欄，屬漸進增強

## 8. 開發環境

```bash
cp .env.example .env          # 填入 Google 金鑰與 AUTH_SECRET
docker compose up -d          # 啟動 Postgres（localhost:5432）
pnpm install
pnpm prisma migrate dev       # 建立資料表
pnpm dev                      # http://localhost:3000
```

Docker Compose 只負責 Postgres；Next.js 直接在本機跑，熱更新最快。Postgres 資料存在 named volume `nearbite_db-data`，`docker compose down -v` 會清掉。

## 9. 開發路線圖

每一項對應一個 OpenSpec change，依序進行。括號內是粗估的工作量（一個人、每天幾小時）。

| # | Change | 內容 | 完成的定義 |
|---|---|---|---|
| 1 | `scaffold-nextjs-app` | Next.js + TS strict + Tailwind + Prisma + ESLint/Prettier + Vitest；連上 Compose 的 Postgres；底部導覽與頁面殼層；設計 token（顏色、間距、字級） | `pnpm dev` 能跑、四個 tab 可切換、`prisma migrate dev` 成功（1–2 天） |
| 2 | `google-auth` | Auth.js + Google provider + Prisma adapter；白名單；登入頁；受保護路由；個人頁顯示名稱／頭像／登出 | 白名單內的帳號能登入，白名單外被拒並看到說明（1 天） |
| 3 | `nearby-search` | 定位請求與拒絕的 fallback（地址輸入 + Geocoding）；Nearby Search Server Action；Restaurant upsert；結果列表卡片；Google Maps 顯示結果 marker；列表⇄地圖切換 | 允許與拒絕定位兩條路都能搜到結果並顯示在列表和地圖上（3–4 天） |
| 4 | `restaurant-detail` | Place Details 抓取與 7/30 天快取邏輯；詳情頁版面；照片代理 Route Handler；營業時間與「現在營業中」判斷；導航連結 | 從列表點進詳情，資訊完整、照片可見、過期資料會自動更新（2–3 天） |
| 5 | `reviews` | 評論 CRUD Server Actions + Zod；底部抽屜表單；詳情頁評論列表；自家評分計算並顯示在卡片與詳情 | 能新增、編輯、刪除自己的評論，卡片上看得到朋友圈平均（2 天） |
| 6 | `favorite-lists` | 預設清單自動建立；清單 CRUD；加入／移除餐廳與備註；清單詳情含地圖；分享連結 `/share/[token]` | 能建多個清單、一間店加進多個清單、分享連結不登入可看（2–3 天） |
| 7 | `search-filters` | 關鍵字搜尋頁（Text Search）；篩選：料理類型、價位、最低評分、營業中、距離；排序：距離、Google 評分、自家評分、價位；URL 同步篩選狀態 | 篩選與排序即時生效、重新整理後狀態保留（2 天） |
| 8 | `pwa` | manifest、icons、啟動畫面；Service Worker 離線殼層；安裝提示；iOS 的 meta 標籤 | 手機能「加入主畫面」，離線開啟看到殼層與友善提示（1 天） |
| 9 | `deployment` | 選定平台（傾向 Vercel + Neon）；正式環境變數；DB 備份策略；錯誤監控；Google 金鑰 referrer 與配額設定 | 朋友能用正式網址登入並使用（1–2 天，待決定平台後進行） |

總計約 15–20 個工作天。1–2 是基礎，3–4 是核心體驗，5–7 是差異化功能，8–9 是上線。

## 10. 待決定事項

| 事項 | 選項 | 預計何時決定 |
|---|---|---|
| 正式環境部署平台 | Vercel + Neon／Supabase；或自己的 VPS 全 Docker | Change 8 完成後 |
| 評論是否開放「匿名給朋友看、但顯示名字給自己看」 | 目前假設所有評論都實名 | Change 5 前 |
| 清單分享連結是否要有效期限 | 目前假設永久有效、可手動關閉 | Change 6 前 |
| 料理類型篩選要用 Google 的 place types 還是自訂分類對照 | Google types 很細（`ramen_restaurant`），可能需要對照成「日式」「中式」 | Change 7 前 |
