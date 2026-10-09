# Design

## Context

nearby-search 已完成：`Restaurant` 表有搜尋欄位（名稱、地址、座標、類型、評分、營業狀態）與 `googleSyncedAt`；`lib/google/` 有注入 `fetch` 與金鑰的客戶端模式、`redactApiKey`、`GoogleClientDeps`；`/restaurants/[id]` 是只顯示店名地址的佔位頁（Server Component，`requireUser` + `notFound`）。動機見 proposal.md。

本次查核的事實（2026-10）：

- Place Details (New)：`GET https://places.googleapis.com/v1/places/{placeId}`，必填 `X-Goog-Api-Key` 與 `X-Goog-FieldMask`，`languageCode`／`regionCode` 用 query string。欄位名不加 `places.` 前綴（與 Nearby Search 不同）
- 計費看 FieldMask 最貴的欄位：`regularOpeningHours`、`priceLevel`、`nationalPhoneNumber`、`websiteUri`、`userRatingCount` 是 Enterprise（每月 1,000 次免費、$35/千次）；`utcOffsetMinutes` 是 Pro；`id`、`displayName` 等基本欄位更低。只要含一個 Enterprise 欄位整次就算 Enterprise，所以一次抓齊
- `regularOpeningHours` 結構：`periods[]`（`open`／`close` 各有 `day` 0–6、`hour`、`minute`；24 小時營業只有一個 `open` 為 `day 0, hour 0` 且沒有 `close` 的 period）與 `weekdayDescriptions[]`（依 `languageCode` 在地化的七行文字）
- `priceLevel` 是列舉字串：`PRICE_LEVEL_FREE`、`PRICE_LEVEL_INEXPENSIVE`、`PRICE_LEVEL_MODERATE`、`PRICE_LEVEL_EXPENSIVE`、`PRICE_LEVEL_VERY_EXPENSIVE`
- Next.js `after()`（`next/server`）可在 Server Component 內排程「回應送出後」執行的工作，`notFound`／`redirect` 後仍會執行，不會讓路由變成 dynamic（本頁本來就是 dynamic）
- Google Maps URLs（`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>&query_place_id=<id>`）免費、不需金鑰，在手機會開 Google 地圖 app

約束：行動優先、Server Components 為預設、每個 change 一個 migration、座標不入庫、Google 呼叫不經瀏覽器、不顯示照片（proposal 的決定）。

## Goals / Non-Goals

**Goals:**

- 詳情頁是純 Server Component：沒有 client state，展開整週營業時間用原生 `<details>`，不載入額外 JS
- 快取規則集中在一個函式（`getRestaurantDetail`），頁面只決定怎麼顯示，不管何時重抓
- 營業狀態的計算是純函式，用假的「現在」就能測跨午夜、24 小時、公休等情況
- 搜尋的 upsert 與詳情的更新各管各的欄位，互不覆蓋

**Non-Goals:**

- 不做 Google 的 `currentOpeningHours`（它的 `openNow` 是抓取當下的快照，快取 7 天後就錯了；自己用 `regularOpeningHours` 算）
- 不處理特殊營業日（`currentOpeningHours.specialDays`），正常週期以外的例外交給使用者看 Google 地圖
- 不做跨 instance 的重抓去重（記憶體內去重即可；多 instance 最多多抓一次）
- 不預先批次更新資料（只在有人看詳情時更新）

## Decisions

### D1. Place Details 客戶端：`lib/google/place-details.ts`

```ts
fetchPlaceDetails(placeId: string, deps?: GoogleClientDeps): Promise<PlaceDetails>
```

- FieldMask 常數 `PLACE_DETAILS_FIELD_MASK` 放 `lib/google/config.ts`，註解標明「這組是 Enterprise 計費，每月 1,000 次免費；加欄位前先看 proposal 的成本段落」：`id,displayName,formattedAddress,location,types,primaryType,rating,businessStatus,userRatingCount,priceLevel,regularOpeningHours,nationalPhoneNumber,websiteUri,utcOffsetMinutes`
- 跟 `places.ts` 同一套：注入 `fetch`／金鑰、8 秒逾時、非 2xx／逾時／形狀不符丟固定訊息的 `PlaceDetailsError`、log 前清金鑰。404（place_id 失效）另外丟 `PlaceNotFoundError`，讓呼叫端決定是否標示
- zod 驗證：必要欄位 `id`、`displayName.text`、`location`；其他缺了給 `null`。`regularOpeningHours` 原樣保留（`periods` + `weekdayDescriptions`），不在客戶端轉換
- `priceLevel` 在客戶端轉成 0–4 的整數（對照表在 config），資料庫存整數不存列舉字串

**替代方案**：把 Nearby Search 的 FieldMask 也升級成 Enterprise，搜尋時就把詳情抓齊。否決：每次搜尋 20 筆都算 Enterprise，免費額度從 5,000 次掉到 1,000 次，而且大多數店不會被點開。

### D2. 資料模型：詳情欄位與獨立的同步時間

```prisma
model Restaurant {
  // 既有欄位不動 …
  priceLevel        Int?      // 0–4
  googleRatingCount Int?
  openingHours      Json?     // Google regularOpeningHours 原樣：{ periods, weekdayDescriptions }
  phone             String?
  website           String?
  utcOffsetMinutes  Int?
  detailsSyncedAt   DateTime? // null = 從未取得詳情
}
```

- `googleSyncedAt`（搜尋欄位）與 `detailsSyncedAt`（詳情欄位）分開：搜尋每次都刷新前者，詳情頁只看後者。合用一個會讓「剛被搜尋到」的店看起來詳情是新的
- 不加 `photoRefs`（proposal 決定不做照片）
- Migration 名稱 `add_restaurant_details`，純加欄位，既有資料的 `detailsSyncedAt` 為 null → 第一次開啟會抓

### D3. 搜尋的 upsert 不碰詳情欄位

`lib/restaurants.ts` 的 `update` 目前只含搜尋欄位，已經符合；加一個測試鎖住這個行為（斷言 `update` 不含 `openingHours`、`phone`、`detailsSyncedAt` 等鍵）。詳情的寫入另外寫 `updateRestaurantDetails(id, details)`，只更新詳情欄位與 `detailsSyncedAt`，順便更新 Google 也會回傳的搜尋欄位（評分、營業狀態）但不動 `googleSyncedAt`。

### D4. 新鮮度判斷：`lib/restaurant-sync.ts`

```ts
getRestaurantDetail(id: string, now = new Date()): Promise<RestaurantDetailView | null>
// RestaurantDetailView = Restaurant 欄位 + { freshness: "fresh" | "stale" | "unavailable" }
```

流程：

1. `db.restaurant.findUnique` → 沒有回 `null`（頁面 `notFound()`）
2. `age = now - detailsSyncedAt`：
   - `detailsSyncedAt` 為 null 或 age > 30 天 → `await refresh()`；成功回 `fresh`，失敗回既有資料並標 `unavailable`（從未取得）或 `stale`（有舊資料）
   - 7 天 < age ≤ 30 天 → `after(() => refresh())`，立即回既有資料標 `fresh`（對使用者而言是可用的）
   - age ≤ 7 天 → 直接回 `fresh`
3. `refresh()` = `fetchPlaceDetails(googlePlaceId)` → `updateRestaurantDetails`；`PlaceNotFoundError` 時把 `businessStatus` 設為 `CLOSED_PERMANENTLY` 並更新 `detailsSyncedAt`（place_id 失效幾乎都是歇業或合併），不再反覆重抓

去重：模組層級 `Map<placeId, { promise, startedAt }>`；一分鐘內同一 `placeId` 的重抓共用同一個 promise。`after` 的 callback 用同一個函式，所以前景與背景重抓也互相去重。只在單一 process 內有效，見 Risks。

`after()` 由 `next/server` 匯入，在 `lib/` 裡直接呼叫會讓單元測試依賴 Next 執行環境，所以 `getRestaurantDetail` 接受 `deps.schedule`（預設是 `after`），測試注入同步版本。

### D5. 營業狀態：`lib/opening-hours.ts` 純函式

```ts
openingStatus(hours: RegularOpeningHours | null, utcOffsetMinutes: number | null, now: Date): OpeningStatus
// OpeningStatus =
//   | { kind: "unknown" }
//   | { kind: "always" }
//   | { kind: "open"; closesAt: LocalTime }       // 今天或隔天的打烊時間
//   | { kind: "closed"; opensAt: LocalTime }      // 含 day，顯示「週三 11:00 開門」
formatWeek(hours, todayIndex): Array<{ label: string; text: string; isToday: boolean }>
```

- 店家當地時間 = UTC 時間 + `utcOffsetMinutes`；缺 `utcOffsetMinutes` 時用 +480（台灣），因為使用者與店家都在台灣是本產品的前提；之後支援國外再改
- 把每個 period 轉成「一週內的分鐘區間」（`day*1440 + hour*60 + minute`），`close` 小於 `open` 代表跨午夜，區間加 7 天後取模。判斷「現在」落在哪個區間就是營業中；否則找下一個 `open`
- 只有一個 period 且沒有 `close` → `always`
- 整週列表直接用 Google 的 `weekdayDescriptions`（已是繁中、已處理公休「休息」與多時段），只負責標示今天；`todayIndex` 依店家當地時間算。`weekdayDescriptions` 從週一開始、`periods.day` 從週日開始，對應時注意
- 顯示用的文字（「營業中 · 21:00 打烊」）在 `components/restaurant/opening-hours.tsx` 組，純函式只回結構

**替代方案**：用 `Intl.DateTimeFormat` + IANA 時區。否決：Google 只給 `utcOffsetMinutes` 不給時區名稱，自己算偏移最直接；台灣沒有日光節約時間，偏移固定。

### D6. 頁面結構：全部 Server Component

```
app/restaurants/[id]/page.tsx       requireUser → getRestaurantDetail → notFound / <RestaurantDetail />
components/restaurant/
  restaurant-detail.tsx             版面組合（Server Component）
  detail-header.tsx                 店名、類型圖示與中文、歇業標示、評分（N）、價位
  opening-hours.tsx                 狀態列 + <details> 整週（原生展開，不需 JS）
  action-links.tsx                  「在 Google 地圖開啟」、tel:、網站（顯示網域）
  freshness-notice.tsx              stale / unavailable 的提示文字
```

- 版面由上到下：header → 營業狀態列 → 導航按鈕（主要操作，`bg-accent`、`min-h-touch`、全寬）→ 地址 → 電話／網站 → 營業時間 `<details>` → 「回到搜尋」。評論與收藏之後插在導航按鈕下方，本次預留 `<section>` 位置但不渲染內容
- `generateMetadata` 沿用現有寫法（先 `requireUser` 再查 DB），只讀 `name`，不觸發重抓
- 回到搜尋用 `<Link href="/">`；首頁本身會從 `sessionStorage` 恢復搜尋，不需要在網址帶參數
- 頁面在 `getRestaurantDetail` 需要前景重抓時會等 Google（最多 8 秒）；用 `loading.tsx` 顯示骨架，避免白屏

### D7. 導航連結

`https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${googlePlaceId}`，`target="_blank" rel="noopener"`。不帶使用者位置。網站連結同樣開新分頁並顯示 `new URL(website).hostname`（去掉 `www.`）；`tel:` 用 Google 給的 `nationalPhoneNumber` 去掉空白與連字號。

### D8. 文案與狀態

| 情況 | 顯示 |
| --- | --- |
| `freshness: "stale"` | 頁首下方一行「資料可能不是最新」 |
| `freshness: "unavailable"` | 營業時間與聯絡區塊各顯示「詳細資訊暫時無法取得」 |
| `openingHours` 為 null（已取得但 Google 沒給） | 「營業時間未提供」 |
| `businessStatus` 非 `OPERATIONAL` | 店名旁標示「已歇業」／「暫停營業」，狀態列不顯示營業中 |
| `rating` 為 null | 「尚無評分」 |
| `priceLevel` 為 null 或 0 | 不顯示價位 |

### D9. 測試

- `lib/google/place-details.test.ts`：假 `fetch` 斷言 URL（含 `languageCode`、`regionCode`）、FieldMask 精確值、缺欄位給 null、`priceLevel` 轉整數、404 丟 `PlaceNotFoundError`、其他錯誤與逾時丟 `PlaceDetailsError`、log 不含金鑰
- `lib/opening-hours.test.ts`：spec 的六個 scenario 各一個測試（營業中、已打烊、跨午夜、24 小時、公休、無資料），加上週日／週一邊界與 `utcOffsetMinutes` 缺省
- `lib/restaurant-sync.test.ts`：mock `db` 與 `fetchPlaceDetails`，注入 `schedule` 與 `now`：三個年齡區間的行為、失敗時的 `stale`／`unavailable`、一分鐘內去重、`PlaceNotFoundError` 標記歇業
- `lib/restaurants.test.ts`：補「搜尋 upsert 的 `update` 不含詳情欄位」
- `components/restaurant/*.test.tsx`：header 的歇業標示與尚無評分、opening-hours 的四種狀態文案與今天標示、action-links 的連結格式與缺項不渲染
- 頁面本身不寫單元測試（依賴 DB 與 session），由真實金鑰的手動走查與截圖驗證

## Risks / Trade-offs

- [前景重抓時頁面要等 Google，最差 8 秒] → `loading.tsx` 骨架；只有第一次開啟或超過 30 天才會發生
- [記憶體去重在多 instance 或 dev 熱重載時失效] → 最壞情況是同一店在一分鐘內多抓一次，成本可忽略；每日配額 50 是最後防線
- [`after()` 的 callback 在 serverless 平台可能被提前終止] → 失敗只影響背景更新，下次開啟會再試；`detailsSyncedAt` 只在寫入成功後更新，不會留下假的新鮮時間
- [`utcOffsetMinutes` 缺省時假設 +480] → 國外店家的營業狀態可能錯；本產品前提是台灣，proposal 已列多語系／國外為非目標
- [Google 的 `weekdayDescriptions` 格式可能變動] → 只拿來顯示，不解析；狀態計算只依賴 `periods`
- [place_id 失效被標成歇業可能誤判（Google 合併店家）] → 標示文案用「已歇業」但仍顯示既有資訊與導航連結，使用者可以自行確認
- [Enterprise 免費額度 1,000 次／月] → 7 天快取 + 每日配額 50；超過配額時 Google 回錯，頁面走 `stale`／`unavailable` 路徑不會壞

## Migration Plan

1. 套用 migration `add_restaurant_details`（純新增可空欄位，既有資料不受影響）
2. 在 Cloud Console 把 Places API (New) 的 **Place Details requests per day** 設為 50（手動，README 有步驟）
3. 部署程式碼；既有店家第一次被開啟時自動取得詳情

回滾：`git revert`；新欄位可留著，或以反向 migration 移除。

## Open Questions

- 價位要顯示 `$`～`$$$$` 還是文字（「平價」「中等」「高價」）：先用 `$` 符號，之後做篩選（第 7 個 change）時統一；不影響資料模型與任務拆分
