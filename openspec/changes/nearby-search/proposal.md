## Why

登入做好了，但打開 Nearbite 還是四個空頁面。「附近有什麼可以吃」是這個產品存在的理由，也是評論、收藏之後要掛上去的骨幹——沒有餐廳資料，後面的 change 都做不了。這是路線圖的第 3 個 change。

## What Changes

- 首頁 `/` 變成附近搜尋：請求定位 → 以 Google Places API (New) Nearby Search 找附近的店 → 列表與地圖兩種檢視可切換
- 店家類型固定為餐廳、咖啡廳、麵包甜點冰品、酒吧（Google 類型 `restaurant`、`cafe`、`coffee_shop`、`bakery`、`dessert_shop`、`ice_cream_shop`、`bar`）
- 搜尋範圍可切換 500m / 1km / 2km，預設 1km，結果依距離由近到遠
- 拒絕定位或定位失敗時，提供地址／地標輸入框，透過 Geocoding API 轉成座標後搜尋
- 地圖用 Google Maps JavaScript API 顯示使用者位置與結果 marker；拖曳地圖後出現「在此區域搜尋」按鈕，不自動重搜
- 搜尋結果 upsert 進 `Restaurant` 資料表（以 `googlePlaceId` 為鍵），記錄 `googleSyncedAt`，作為後續評論與收藏的掛載點
- 餐廳卡片顯示名稱、類型（含類型圖示）、距離、Google 評分，已歇業的店會標示；點擊進入 `/restaurants/[id]` 的最小佔位頁（完整詳情是第 4 個 change）
- 搜尋只要求 Places API 的 Pro 等級欄位（每月 5,000 次免費）。營業中、價位、評論數屬 Enterprise 等級（每月 1,000 次免費）、照片每月只有 1,000 張免費，兩者都留給詳情頁用 Place Details 取得並快取，卡片不放照片
- 新增 `Restaurant` 資料表的 migration

## Capabilities

### New Capabilities

- `nearby-search`：取得使用者位置（含拒絕時的替代方案）、依位置與範圍查詢附近店家、結果的列表與地圖呈現、範圍切換、「在此區域搜尋」。
- `restaurant-cache`：Google 店家資料在自家資料庫的快取規則：以 place_id 為鍵的 upsert、同步時間戳、符合 Google 條款的保存期限，以及伺服器端金鑰不外洩。

### Modified Capabilities

無。`app-shell` 的首頁路由與導覽不變；`user-auth` 的 `requireUser` 慣例照用。

## Non-goals

- 不做關鍵字搜尋（`/search` 仍是佔位，屬第 7 個 change）
- 不做料理類型、價位、評分、營業中的篩選與排序切換（第 7 個 change）；本 change 只有固定的距離排序
- 不做完整的餐廳詳情頁（第 4 個 change），只做能驗證導航的最小佔位
- 不做分頁或「載入更多」：Nearby Search 單次最多 20 筆，本 change 以此為上限
- 不做自家評分的計算與顯示（第 5 個 change）
- 不顯示店家照片、不做照片代理端點（第 4 個 change，照片額度只有每月 1,000 張）
- 不做離線快取或地圖的離線瓦片

## 對行動裝置體驗與定位／隱私的影響

- **定位是本 change 的核心**。只在使用者按下「找附近的店」時才請求定位權限，不在頁面載入時就跳出系統對話框；拒絕後整個功能仍可用（手動輸入地址）。定位座標只用於當次搜尋，不存進資料庫、不記錄在 log。
- **行動體驗**：列表⇄地圖切換放在頁面頂部，範圍切換是三個並排的 chip（各至少 44px 高）；地圖模式下結果以底部可左右滑的卡片列呈現，不用彈窗；地圖手勢設定為單指可拖曳。
- **隱私與第三方**：載入 Google Maps JavaScript API 會讓瀏覽器直接向 Google 發出請求（這是使用地圖無法避免的）；Places 與 Geocoding 的呼叫都在伺服器端，瀏覽器金鑰只開 Maps JavaScript API 並限制 referrer。
- **成本**：每次搜尋一次 Nearby Search 呼叫；用 FieldMask 控制欄位、300ms debounce、拖曳不自動重搜、每日配額上限，細節在 design.md。

## Impact

- **新增**：`lib/google/places.ts`、`lib/google/geocoding.ts`（伺服器端 API 客戶端）、`lib/geo.ts`（距離計算與格式）、`lib/place-types.ts`（類型中文對照）、`lib/restaurants.ts`（upsert）、`app/actions/search.ts`（Server Action）、`components/nearby/*`（搜尋頁的 client 元件與 hook）、`components/map/*`、`app/restaurants/[id]/page.tsx`（佔位）、相關測試
- **修改**：`app/page.tsx`（從佔位變成搜尋頁）、`prisma/schema.prisma` + migration、`.env.example`（兩把 Google Maps 金鑰的說明已存在，補 referrer 與 API 限制的提醒）、README（Google Maps Platform 啟用與金鑰設定）
- **新相依**：`@vis.gl/react-google-maps`（React 的 Google Maps 元件）、`zod`（Server Action 輸入驗證）
- **外部設定**：在 Google Cloud 啟用帳單、啟用 Places API (New)、Maps JavaScript API、Geocoding API，建立兩把金鑰並設定限制與每日配額——你要做的一次性手動步驟
