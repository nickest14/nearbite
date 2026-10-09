## Context

骨架與登入已完成：`requireUser()` 慣例、`AppShell`、設計 token、Prisma 7（`db:migrate` 會自動 generate）。首頁目前是佔位內容，資料庫沒有任何店家相關的表。動機見 proposal.md。

本次查核的事實（2026-10）：

- Nearby Search (New)：`POST https://places.googleapis.com/v1/places:searchNearby`，必填 `X-Goog-Api-Key` 與 `X-Goog-FieldMask`；`locationRestriction.circle` 半徑 0–50,000 公尺；`maxResultCount` 1–20；`rankPreference` 預設 `POPULARITY`，可設 `DISTANCE`；`includedTypes` 最多 50 個 Table A 類型；`languageCode` 預設 `en`
- 計費看 FieldMask 中最貴的欄位：Pro（`displayName`、`formattedAddress`、`location`、`types`、`primaryType`、`rating`、`businessStatus`、`photos` 等）每月 5,000 次免費、$32/千次；Enterprise（`currentOpeningHours`、`priceLevel`、`userRatingCount`、電話、網站）每月 1,000 次免費、$35/千次；照片（Place Details Photos）屬 Enterprise、每月 1,000 張、$7/千張
- Geocoding 每月 10,000 次免費、$5/千次；Maps JavaScript API 的 Dynamic Maps 每月 10,000 次地圖載入免費、$7/千次
- Places 政策：只有 place_id 可永久保存，其他內容不得長期快取；在沒有 Google 地圖的畫面上顯示 Places 資料必須標示 Google Maps（logo 最小 16dp，空間不足可用「Google Maps」文字）
- `restaurant`、`cafe`、`coffee_shop`、`bakery`、`dessert_shop`、`ice_cream_shop`、`bar` 都在 Table A 的 Food and Drink 類別
- `@vis.gl/react-google-maps` 1.10（Google 官方維護的 React 封裝）；`AdvancedMarker` 需要 Map ID，開發可用 `DEMO_MAP_ID`

約束：行動優先、Server Components 為預設、每個 change 一個 migration、座標不入庫、所有 Google 伺服器端呼叫不經瀏覽器。

## Goals / Non-Goals

**Goals:**

- 「按一下就看到附近有什麼」在 375px 寬度上順手：一個主要按鈕、三個範圍 chip、列表與地圖一鍵切換
- 搜尋成本可預測：固定 Pro 欄位、固定 20 筆、不自動重搜、每日配額上限，正常使用不會超過免費額度
- `Restaurant` 表與 upsert 函式成為後續 change 的穩定介面：詳情頁只需補 Enterprise 欄位，評論與收藏直接用 `restaurant.id`
- Google API 客戶端是可單元測試的純函式（注入 `fetch` 與金鑰），不依賴網路

**Non-Goals:**

- 不做結果快取（同一位置短時間內重搜仍打 Google）；`Restaurant` 表是資料掛載點，不是搜尋快取
- 不做 Server Component 層級的搜尋（搜尋由 Server Action 驅動，見 D1）
- 不做地圖樣式客製、聚合（clustering）或路線

## Decisions

### D1. 搜尋走 Server Action，座標不進網址，結果在 client state，`sessionStorage` 記住上次搜尋

兩種做法：（a）搜尋參數放在 `/?lat=&lng=&r=`，Server Component 直接查 Google 再渲染；（b）client 持有狀態，透過 Server Action 搜尋。

選（b）。原因是隱私：（a）會讓使用者座標進入瀏覽器歷史、伺服器存取記錄與任何分享出去的網址；proposal 承諾座標只用於當次搜尋。（b）的代價是重新整理會失去結果，用 `sessionStorage`（分頁關閉即清除）記住上次的搜尋中心、標籤與範圍，重新整理時自動重搜一次，符合 spec「重新整理後保留搜尋」與「新分頁回到初始狀態」。

狀態用一個 `useNearbySearch()` hook（`useReducer`）集中：`{ center, centerLabel, radius, view, status, results, error, mapCenter }`。所有元件只讀 state、發 action，不各自呼叫 Server Action。

### D2. Places 客戶端：`lib/google/places.ts`

```ts
searchNearby(params: { lat; lng; radius }, deps = { fetch, apiKey }): Promise<PlaceResult[]>
```

- FieldMask 固定為 Pro 欄位：`places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.rating,places.businessStatus`。常數集中一處並加註解「加任何 Enterprise 欄位會讓每次搜尋從 5,000 次免費降到 1,000 次」
- body：`includedTypes` 七個類型、`maxResultCount: 20`、`rankPreference: "DISTANCE"`、`locationRestriction.circle`、`languageCode: "zh-TW"`、`regionCode: "TW"`
- 8 秒 `AbortController` 逾時；非 2xx 或逾時都丟 `PlacesError`（固定訊息），原始回應只在伺服器端 log，且 log 前以正則移除 `key=` 與 `X-Goog-Api-Key` 的值
- 回傳前把 Google 的巢狀結構攤平成 `PlaceResult`（`placeId`、`name`、`address`、`lat`、`lng`、`primaryType`、`types`、`rating`、`businessStatus`）；用 zod 驗證回應形狀，欄位缺失給 `null` 而非整批失敗

`fetch` 與 `apiKey` 用參數注入，測試時傳假的 `fetch`，可斷言 header、body 與錯誤處理，不碰網路。

### D3. Geocoding 客戶端：`lib/google/geocoding.ts`

`geocodeAddress(query, deps)`：呼叫 `https://maps.googleapis.com/maps/api/geocode/json?address=…&region=tw&language=zh-TW`，取第一筆結果的 `geometry.location` 與 `formatted_address`。`region=tw` 是偏好而非限制，朋友出國時輸入國外地址仍可用。`ZERO_RESULTS` 回傳 `null`（由 UI 顯示「找不到這個地點」），其他狀態丟 `GeocodingError`。同樣注入 `fetch` 與金鑰、同樣的金鑰清洗。

**替代方案**：用 Places Text Search 找地標。否決：Text Search 是 Pro/Enterprise 計費且較貴；Geocoding 對地址與知名地標（車站、捷運站）的解析在台灣已經夠用。

### D4. 距離在應用層算，不用 PostGIS

`lib/geo.ts`：`haversineMeters(a, b)` 與 `formatDistance(meters)`（`< 1000` → `350 m`，否則 `1.2 km`）。Google 以 `DISTANCE` 排序回來的結果已經有序，但我們仍自己算距離並重排一次——顯示用的距離要跟排序一致，而且「在此區域搜尋」後的中心是地圖中心，不是使用者位置。資料量 20 筆，沒有用資料庫算的理由。

### D5. 資料模型：`Restaurant` 只放這個 change 會填的欄位

```prisma
model Restaurant {
  id             String   @id @default(cuid())
  googlePlaceId  String   @unique
  name           String
  address        String?
  lat            Float
  lng            Float
  primaryType    String?
  types          String[]
  googleRating   Float?
  businessStatus String?  // OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY
  googleSyncedAt DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([lat, lng])
}
```

Enterprise 欄位（價位、評論數、營業時間、電話、網站、照片參照）由第 4 個 change 的 migration 加入，維持「每個 change 的 migration 對應它自己的功能」。Migration 名稱 `add_restaurant`。

### D6. Upsert：`lib/restaurants.ts`

`upsertRestaurants(places: PlaceResult[])`：先以 `placeId` 去重，再在一個 `db.$transaction` 內逐筆 `upsert`（`where: { googlePlaceId }`，`update` 只碰 Google 欄位與 `googleSyncedAt`，`create` 全部）。回傳 `{ id, googlePlaceId }[]` 讓 Server Action 把自家 `id` 併進結果。交易失敗整批回滾，Server Action 回報固定錯誤——結果沒有自家 `id` 就不能導向店家頁，所以不做「寫入失敗仍回傳結果」的半成功。

20 筆逐一 upsert 在本機 Postgres 約數十毫秒，不需要原生 SQL 的批次 upsert。

### D7. Server Actions：`app/actions/search.ts`

```ts
searchNearbyAction(input: { lat; lng; radius }): Promise<ActionResult<SearchResult>>
geocodeAction(input: { query }): Promise<ActionResult<GeocodeResult | null>>
```

- 第一行 `await requireUser()`（不帶 `returnTo`，沒 session 直接丟錯；首頁本身已由 `requireUser({ returnTo: "/" })` 擋住，這裡是防直接呼叫）
- zod 驗證：`lat` −90–90、`lng` −180–180、`radius` 只能是 `500 | 1000 | 2000`、`query` 1–100 字去空白
- 回傳 discriminated union `{ ok: true, data } | { ok: false, message }`，不丟例外到 client；`message` 一律是固定中文
- `searchNearbyAction` 流程：Places → upsert → 以中心算距離、排序 → 回傳 `RestaurantSummary[]`（`id`、`name`、`primaryType`、`typeLabel`、`distanceMeters`、`rating`、`businessStatus`、`lat`、`lng`）

### D8. UI 結構：`app/page.tsx` 是 Server Component，內容是一個 Client Component 樹

```
app/page.tsx                       requireUser({ returnTo: "/" }) → <NearbySearch />
components/nearby/
  nearby-search.tsx                "use client"；用 useNearbySearch()，依 state 組合下列元件
  use-nearby-search.ts             reducer + sessionStorage 同步 + 呼叫 Server Actions
  location-prompt.tsx              「找附近的店」按鈕、定位錯誤訊息、地址表單
  radius-picker.tsx                三個 chip
  view-toggle.tsx                  列表 / 地圖
  results-list.tsx                 卡片列表 + Google Maps 標示 + 空結果 / 錯誤 / 載入狀態
  restaurant-card.tsx              單張卡片（Link 到 /restaurants/[id]）
components/map/
  map-view.tsx                     APIProvider + Map + 標記 + 底部卡片列 + 在此區域搜尋
```

定位用 `navigator.geolocation.getCurrentPosition`，`{ enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }`。錯誤碼對應：`PERMISSION_DENIED` → 顯示地址表單；`TIMEOUT` → 「定位花太久了」+ 重試；`POSITION_UNAVAILABLE` → 「無法取得位置」+ 地址表單。`maximumAge: 60_000` 讓一分鐘內的重試不用重新定位。

### D9. 地圖：`@vis.gl/react-google-maps`

- `APIProvider` 的 `apiKey` 用 `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`；`Map` 的 `mapId` 用 `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`，未設定時以 `DEMO_MAP_ID` 代替（Google 提供給開發測試用，正式環境在 `deployment` change 建立自己的 Map ID）
- 用 `AdvancedMarker`（`google.maps.Marker` 已被 Google 標記為 deprecated）；搜尋中心用不同顏色的標記
- `gestureHandling="greedy"`（單指拖曳）、`disableDefaultUI`（手機上不要一堆控制項）
- **地圖元件在列表檢視時不卸載，只用 CSS 隱藏**：每次 `Map` 掛載都算一次 Dynamic Maps 載入，來回切換不該重複計費；但地圖在使用者第一次切到地圖檢視前不掛載（lazy），純用列表的人不載入 Maps JS
- 「在此區域搜尋」：監聽 `onCameraChanged`，300ms debounce 後若地圖中心與搜尋中心距離 > 100 公尺就顯示按鈕；按下後 dispatch 新中心（`centerLabel` 改為「地圖上的位置」）並搜尋
- 底部卡片列：`overflow-x-auto` + `scroll-snap-type: x mandatory`，點標記時以 `scrollIntoView({ inline: "center" })` 定位對應卡片並設定 `selectedId` 高亮

### D10. 類型中文對照：`lib/place-types.ts`

`typeLabel(primaryType, types)`：先查 `primaryType`，查不到再依序查 `types`，都查不到就回「餐飲」。對照表只放七個搜尋類型加常見料理類型（`ramen_restaurant` 拉麵、`japanese_restaurant` 日式料理、`chinese_restaurant` 中式料理、`italian_restaurant` 義式料理、`pizza_restaurant` 披薩、`hamburger_restaurant` 漢堡、`sushi_restaurant` 壽司、`korean_restaurant` 韓式料理、`thai_restaurant` 泰式料理、`vegetarian_restaurant` 素食、`steak_house` 牛排、`seafood_restaurant` 海鮮、`breakfast_restaurant` 早餐、`brunch_restaurant` 早午餐、`fast_food_restaurant` 速食、`noodle` 麵食…）。每個類型搭一個 lucide 圖示（`Utensils`、`Coffee`、`Croissant`、`IceCream`、`Beer`、`Pizza` 等），卡片用圖示取代照片。第 7 個 change 的篩選會擴充這張表。

### D11. Google 標示

列表檢視底部固定一行「資料來源：Google Maps」（文字形式符合政策「空間不足可用 Google Maps 文字」；之後若要放 logo，改這一處）。地圖檢視由 Google 地圖本身帶 logo，不另外加。

### D12. 成本控制與金鑰

- 程式層：固定 Pro FieldMask、`maxResultCount: 20`、拖曳不自動重搜、範圍切換會重搜但需使用者點擊、重新整理只重搜一次、地圖不重複掛載
- Cloud Console 層（寫在 README 與任務）：Places API (New) 的 Nearby Search 每日配額 150（≈ 4,500/月 < 5,000）、Geocoding 每日 300、Maps JavaScript API 每日 300；兩把金鑰分開限制——伺服器端金鑰只開 Places API (New) 與 Geocoding API 且不設 referrer（Server Action 沒有 referrer）；瀏覽器端金鑰只開 Maps JavaScript API，HTTP referrer 限 `http://localhost:3000/*` 與正式網域
- 所有 Google 相關的設定值集中在 `lib/google/config.ts`（金鑰讀取、類型清單、FieldMask、逾時），缺金鑰時在伺服器端丟出明確錯誤訊息（「GOOGLE_MAPS_SERVER_API_KEY 未設定」）

### D13. 店家佔位頁：`app/restaurants/[id]/page.tsx`

Server Component：`requireUser({ returnTo: \`/restaurants/${id}\` })` → `db.restaurant.findUnique` → 沒有就 `notFound()` → 顯示店名、地址、「回到搜尋」連結。第 4 個 change 會整個改寫，這裡只求導航鏈完整。`metadata` 用 `generateMetadata` 帶店名。

### D14. 測試

- `lib/geo.test.ts`：已知兩點的距離（台北車站到西門町約 1.2 km）、格式邊界（999 m / 1000 m）
- `lib/place-types.test.ts`：對照、fallback 順序、未知類型
- `lib/google/places.test.ts`、`geocoding.test.ts`：假 `fetch` 斷言 URL、header（FieldMask 字串精確比對）、body；回應解析；非 2xx、逾時、形狀錯誤的處理；錯誤訊息與 log 不含金鑰
- `lib/restaurants.test.ts`：mock `db`，斷言去重、upsert 的 `where/update/create`、交易失敗時丟錯
- `app/actions/search.test.ts`：mock `requireUser`、Places、upsert；驗證 zod 拒絕非法輸入、成功路徑的排序與距離、失敗路徑回固定訊息
- `components/nearby/use-nearby-search.test.ts`：reducer 的狀態轉移（含 sessionStorage 讀寫）
- `components/nearby/*.test.tsx`：`RadiusPicker` 的選取與 `aria-pressed`、`RestaurantCard` 的欄位與已歇業標示、`LocationPrompt` 在 mock `geolocation` 拒絕時顯示地址表單
- 地圖元件不寫單元測試（依賴 Google Maps 執行環境），以手動與截圖驗證
- 真實的 Google 呼叫是手動驗證任務，需要你先完成 Cloud Console 設定

## Risks / Trade-offs

- [`AdvancedMarker` 需要 Map ID；`DEMO_MAP_ID` 只適合開發] → 正式環境在 `deployment` change 建立 Map ID，`.env.example` 預留變數
- [iOS Safari 的定位只在 HTTPS 或 localhost 可用] → 本機開發不受影響；部署後必然是 HTTPS。手機實測要用電腦的 localhost 轉發（例如 `ssh -R` 或 Safari 遠端）或等部署
- [Google 回傳的 `CLOSED_PERMANENTLY` 店家仍會出現在結果] → 卡片標示「已歇業」而非過濾掉，避免使用者以為那間店不存在；第 7 個 change 的篩選可以隱藏
- [`rankPreference: DISTANCE` 搭配 `includedTypes` 時，Google 可能回傳少於 20 筆即使範圍內更多] → 這是 Google 的行為，UI 的空結果訊息已引導擴大範圍
- [Dynamic Maps 每次掛載計費，React 開發模式的 StrictMode 會雙重掛載] → 只影響開發環境的本機計數；正式 build 不會。每日配額 300 已留餘裕
- [`sessionStorage` 在無痕模式或被停用時會丟例外] → 讀寫都包 try/catch，失敗時退回不記憶
- [Server Action 回應體積：20 筆店家 × 十個欄位] → 約 5 KB，可忽略
- [Geocoding 對模糊輸入（「附近的麥當勞」）會回奇怪的結果] → 顯示解析後的地址讓使用者確認，錯了可以重輸；關鍵字搜尋是第 7 個 change

## Migration Plan

1. 套用 migration `add_restaurant`（純新增表，無既有資料影響）
2. 在 Google Cloud 啟用帳單與三個 API、建立兩把金鑰並設定限制與每日配額（手動，README 有步驟）
3. 填入 `.env` 的 `GOOGLE_MAPS_SERVER_API_KEY`、`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`（`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` 可留空）
4. 部署程式碼

回滾：`git revert` 本 change 的 commit；`Restaurant` 表可留著（後續 change 會用），或以反向 migration 移除。金鑰可在 Cloud Console 停用。

## Open Questions

- 正式環境的 Map ID 與金鑰的正式網域 referrer，等 `deployment` change 決定部署平台後設定
- Geocoding 是否要加 `components=country:TW` 硬性限制在台灣：目前用偏好即可，若實測發現常解析到國外再加，不影響任務拆分
