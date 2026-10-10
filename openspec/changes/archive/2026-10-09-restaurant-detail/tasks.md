# Tasks

## 1. 設定與資料模型

- [x] 1.1 在 `lib/google/config.ts` 新增 `PLACE_DETAILS_FIELD_MASK`（design D1 的欄位、附 Enterprise 計費註解）、`PLACE_DETAILS_URL`、`priceLevel` 列舉→整數對照表；README 的 Google Maps Platform 段落補上「Place Details requests per day 50」與 Enterprise 額度說明
      驗證：`config.test.ts` 斷言 FieldMask 精確值、不含 `photos`／`reviews`／`currentOpeningHours`，對照表五個值對應 0–4
- [x] 1.2 依 design D2 在 `prisma/schema.prisma` 新增七個詳情欄位，執行 `pnpm db:migrate --name add_restaurant_details`
      驗證：`pnpm prisma validate` 通過、`prisma/migrations/` 出現新資料夾、`psql \d "Restaurant"` 看到新欄位且全部可空、`pnpm typecheck` 通過

## 2. Place Details 客戶端

- [x] 2.1 建立 `lib/google/place-details.ts`：`fetchPlaceDetails(placeId, deps)`、`PlaceDetailsError`、`PlaceNotFoundError`、zod 解析為 `PlaceDetails`（`regularOpeningHours` 原樣保留、`priceLevel` 轉整數、缺欄位給 null）、8 秒逾時、log 前清金鑰
      驗證：`place-details.test.ts` 以假 `fetch` 斷言 URL 含 `languageCode=zh-TW`／`regionCode=TW`、`X-Goog-FieldMask` 精確值；完整回應攤平正確；缺選填欄位給 null；404 丟 `PlaceNotFoundError`；429／500／逾時／非 JSON 丟 `PlaceDetailsError`；log 不含金鑰

## 3. 營業狀態

- [x] 3.1 建立 `lib/opening-hours.ts`：`openingStatus(hours, utcOffsetMinutes, now)` 與 `formatWeek(hours, todayIndex)`，含 period→分鐘區間轉換、跨午夜處理、24 小時判斷、缺 `utcOffsetMinutes` 時用 +480
      驗證：`opening-hours.test.ts` 涵蓋營業中（含打烊時間）、已打烊（含下次開門的星期與時間）、跨午夜在凌晨開啟、24 小時、公休日、無資料、週日→週一邊界、多時段（午休）、`utcOffsetMinutes` 為 null

## 4. 快取與同步

- [x] 4.1 在 `lib/restaurants.ts` 新增 `updateRestaurantDetails(id, details, now)`（只更新詳情欄位、評分、營業狀態與 `detailsSyncedAt`），並補測試鎖住搜尋 upsert 的 `update` 不含詳情欄位
      驗證：`restaurants.test.ts` 斷言兩個函式各自的 `data` 鍵集合；搜尋 upsert 的 `update` 不含 `openingHours`、`phone`、`website`、`priceLevel`、`googleRatingCount`、`utcOffsetMinutes`、`detailsSyncedAt`
- [x] 4.2 建立 `lib/restaurant-sync.ts`：`getRestaurantDetail(id, { now, schedule })` 依 design D4 判斷新鮮度、前景／背景重抓、一分鐘內去重、`PlaceNotFoundError` 標記歇業、失敗時回 `stale`／`unavailable`
      驗證：`restaurant-sync.test.ts` mock `db` 與 `fetchPlaceDetails`，注入同步 `schedule`：≤7 天不呼叫 Google；7–30 天立即回傳且 `schedule` 被呼叫一次並更新 DB；>30 天或 null 先抓再回；失敗分別回 `stale`（有舊資料）與 `unavailable`（無）；同一 id 一分鐘內兩次呼叫只抓一次；404 後 `businessStatus` 為 `CLOSED_PERMANENTLY`

## 5. 詳情頁

- [x] 5.1 建立 `components/restaurant/detail-header.tsx`（店名、類型圖示與中文、歇業／暫停營業標示、「4.3（128）」或「尚無評分」、價位 `$` 符號或不顯示）與 `freshness-notice.tsx`
      驗證：`detail-header.test.tsx` 涵蓋完整資訊、尚無評分、價位為 null／0 不顯示、`CLOSED_PERMANENTLY` 顯示「已歇業」；沒有任何 `<img>`
- [x] 5.2 建立 `components/restaurant/opening-hours.tsx`：狀態列（「營業中 · 21:00 打烊」／「已打烊 · 週三 11:00 開門」／「24 小時營業」／「營業時間未提供」／歇業時不顯示營業中）與 `<details>` 整週列表（今天標示、`min-h-touch` 的 summary）
      驗證：`opening-hours.test.tsx` 以固定 `now` 涵蓋五種狀態文案、整週七行與今天標示、歇業店不顯示營業中
- [x] 5.3 建立 `components/restaurant/action-links.tsx`：「在 Google 地圖開啟」（design D7 的網址、新分頁）、`tel:`（去空白與連字號）、網站（顯示去掉 `www.` 的網域、新分頁），缺項不渲染，全部 `min-h-touch`
      驗證：`action-links.test.tsx` 斷言三個連結的 `href`／`target`／`rel`、網域顯示、缺電話與網站時只有導航連結；導航網址不含任何使用者座標
- [x] 5.4 建立 `components/restaurant/restaurant-detail.tsx` 組合版面（含預留評論／收藏的空區塊），改寫 `app/restaurants/[id]/page.tsx` 改用 `getRestaurantDetail`，新增 `app/restaurants/[id]/loading.tsx` 骨架
      驗證：`pnpm typecheck`、`pnpm lint` 通過；未登入開啟仍 307 到 `/login?callbackUrl=…`；`/restaurants/not-a-real-id` 仍 404

## 6. 真實環境驗證與收尾

- [x] 6.1 在 Cloud Console 設 Place Details 每日配額 50（你操作）後，用真實金鑰手動走過：從搜尋點進一間從未開過的店（等待後顯示完整資訊、DB 的 `detailsSyncedAt` 有值）→ 重新整理（不再呼叫 Google，server log 無 `[place-details]`）→ 用 psql 把 `detailsSyncedAt` 改成 10 天前再開（立即顯示、log 顯示背景重抓、DB 時間更新）→ 改成 40 天前再開（前景重抓）→ 把 `GOOGLE_MAPS_SERVER_API_KEY` 改錯再開一間 40 天前的店（顯示「資料可能不是最新」）；DevTools 檢查回應不含伺服器端金鑰
      驗證：每一步符合 spec；`Restaurant` 表沒有新增重複記錄
- [x] 6.2 375px 截圖：資訊完整的營業中店家、已打烊店家（含展開整週）、缺電話網站的店、第一次載入的骨架；最後 `pnpm check` 全綠
      驗證：截圖存到 `docs/screenshots/restaurant-detail/`；觸控區域與版面符合 spec；`pnpm check` 退出碼 0

## Workflow follow-up

- 完成後封存：同步 `restaurant-detail`（新）與 `restaurant-cache`（修改）主 spec
