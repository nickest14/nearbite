## 1. 相依、設定與文件

- [ ] 1.1 安裝 `@vis.gl/react-google-maps` 與 `zod`；建立 `lib/google/config.ts`（讀取兩把金鑰與 Map ID、七個搜尋類型、Pro FieldMask 常數、8 秒逾時；缺伺服器端金鑰時丟出明確訊息）；`.env.example` 新增 `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`（可留空，開發用 DEMO_MAP_ID）並補上兩把金鑰的限制說明
      驗證：`pnpm typecheck` 通過；`config.test.ts` 確認缺金鑰時的錯誤訊息與 FieldMask 不含任何 Enterprise 欄位名
- [ ] 1.2 README 新增「Google Maps Platform 設定」段落：啟用帳單、啟用 Places API (New)／Maps JavaScript API／Geocoding API、建立兩把金鑰與各自的 API 限制與 referrer 限制、每日配額（Nearby Search 150、Geocoding 300、Maps JavaScript 300）、免費額度與為什麼卡片不放照片
      驗證：照段落從零設定一次，`.env` 兩把金鑰填好後搜尋可用

## 2. 資料模型

- [ ] 2.1 依 design D5 在 `prisma/schema.prisma` 新增 `Restaurant`
      驗證：`pnpm prisma validate` 通過
- [ ] 2.2 執行 `pnpm db:migrate --name add_restaurant`（script 會接著 generate）
      驗證：`prisma/migrations/` 出現新資料夾；`psql \d "Restaurant"` 看到欄位與 `(lat, lng)` 索引；`pnpm typecheck` 通過

## 3. 純函式

- [ ] 3.1 建立 `lib/geo.ts`：`haversineMeters`、`formatDistance`、`sortByDistance`
      驗證：`lib/geo.test.ts` 涵蓋已知距離（誤差 1% 內）、`999 m` / `1.0 km` 邊界、排序穩定
- [ ] 3.2 建立 `lib/place-types.ts`：`SEARCH_TYPES`、`typeLabel(primaryType, types)`、`typeIcon(primaryType, types)`，含七個搜尋類型與常見料理類型的中文對照與 lucide 圖示
      驗證：`lib/place-types.test.ts` 涵蓋主要類型命中、fallback 到 `types`、未知類型回「餐飲」與預設圖示

## 4. Google 伺服器端客戶端

- [ ] 4.1 建立 `lib/google/places.ts`：`searchNearby({ lat, lng, radius }, deps)`，注入 `fetch` 與金鑰；固定 header、body（含 `rankPreference: "DISTANCE"`、`languageCode: "zh-TW"`、`regionCode: "TW"`）；zod 解析回應為 `PlaceResult[]`；逾時與非 2xx 丟 `PlacesError`；log 前清除金鑰
      驗證：`lib/google/places.test.ts` 以假 `fetch` 斷言 URL、`X-Goog-FieldMask` 精確值、body；缺欄位給 null；429／500／逾時都丟固定訊息；log 內容不含金鑰
- [ ] 4.2 建立 `lib/google/geocoding.ts`：`geocodeAddress(query, deps)`，`region=tw`、`language=zh-TW`；`ZERO_RESULTS` 回 `null`；其他錯誤丟 `GeocodingError`
      驗證：`lib/google/geocoding.test.ts` 涵蓋成功解析、`ZERO_RESULTS`、`REQUEST_DENIED`、逾時；log 不含金鑰

## 5. 資料寫入與 Server Actions

- [ ] 5.1 建立 `lib/restaurants.ts`：`upsertRestaurants(places)` 去重後在交易內逐筆 upsert，回傳 `{ id, googlePlaceId }[]`
      驗證：`lib/restaurants.test.ts` mock `db`：重複 placeId 只 upsert 一次、`update` 不含 `createdAt`、交易失敗向上丟錯
- [ ] 5.2 建立 `app/actions/search.ts`：`searchNearbyAction` 與 `geocodeAction`，`requireUser()` + zod 驗證 + 固定錯誤訊息；成功時回傳依距離排序的 `RestaurantSummary[]`（含 `typeLabel`、`distanceMeters`）與中心資訊
      驗證：`app/actions/search.test.ts` mock `requireUser`、Places、upsert：非法 radius 被拒、未登入丟錯、成功路徑排序與距離正確、Places 失敗回 `{ ok: false }` 且訊息不含技術細節

## 6. 搜尋頁 UI

- [ ] 6.1 建立 `components/nearby/use-nearby-search.ts`：reducer（`locate`、`located`、`locateFailed`、`setRadius`、`setView`、`searchStarted`、`searchSucceeded`、`searchFailed`、`mapMoved`、`searchHere`）、`sessionStorage` 讀寫（try/catch）、呼叫 Server Actions、重新整理時自動重搜
      驗證：`use-nearby-search.test.ts` 用 `renderHook` 涵蓋狀態轉移、`sessionStorage` 存取失敗不丟錯、重載時從 storage 還原並觸發搜尋
- [ ] 6.2 建立 `components/nearby/location-prompt.tsx`：「找附近的店」按鈕（`min-h-touch`）、`getCurrentPosition` 的三種錯誤對應訊息、地址表單（空白不送出、送出中 disabled、找不到地點的訊息、解析後地址顯示）
      驗證：`location-prompt.test.tsx` mock `navigator.geolocation`：拒絕時顯示地址表單、逾時顯示重試、空白地址不呼叫 action
- [ ] 6.3 建立 `components/nearby/radius-picker.tsx`（三個 chip、`aria-pressed`、`min-h-touch`）與 `view-toggle.tsx`（列表／地圖、`aria-pressed`）
      驗證：各自的測試確認選取狀態與 callback；375px 下三個 chip 不換行
- [ ] 6.4 建立 `components/nearby/restaurant-card.tsx`（`Link` 到 `/restaurants/[id]`、類型圖示、類型中文、距離、評分或「尚無評分」、「已歇業」標示）與 `results-list.tsx`（載入骨架、空結果訊息、錯誤訊息＋重試、底部「資料來源：Google Maps」）
      驗證：`restaurant-card.test.tsx` 與 `results-list.test.tsx` 涵蓋各狀態；卡片沒有任何 `<img>`
- [ ] 6.5 建立 `components/map/map-view.tsx`：`APIProvider`、`Map`（`mapId`、`gestureHandling="greedy"`、`disableDefaultUI`）、中心與結果的 `AdvancedMarker`、初始視野涵蓋範圍、`onCameraChanged` 300ms debounce 後距離 > 100m 顯示「在此區域搜尋」、底部 `scroll-snap` 卡片列、點標記捲到對應卡片並高亮；列表檢視時以 CSS 隱藏不卸載、第一次切到地圖才掛載
      驗證：手動：拖曳後出現按鈕且無新請求（Network 面板）、按下後更新、來回切換檢視不重複載入 Maps JS（Network 面板只有一次 `maps/api/js`）
- [ ] 6.6 建立 `components/nearby/nearby-search.tsx` 組合以上元件，改寫 `app/page.tsx`（保留 `requireUser({ returnTo: "/" })` 與 `PageHeader`）
      驗證：未登入仍 307；登入後首頁顯示「找附近的店」且沒有定位對話框（Chrome 權限圖示未出現）

## 7. 店家佔位頁

- [ ] 7.1 建立 `app/restaurants/[id]/page.tsx`：`requireUser`、`findUnique`、`notFound()`、店名、地址、「回到搜尋」連結、`generateMetadata` 帶店名
      驗證：以 DB 內既有店家 id 開啟顯示正確；`/restaurants/nope` 顯示 404 且導覽列仍在

## 8. 真實環境驗證與收尾

- [ ] 8.1 在 Google Cloud 完成 README 的設定（你操作）後，用真實金鑰手動走過：允許定位搜尋、拒絕定位改用地址（「台北車站」）、切換三種範圍、列表⇄地圖、拖曳後「在此區域搜尋」、重新整理後自動重搜、新分頁回到初始狀態、點卡片進店家頁；DevTools 檢查所有回應不含伺服器端金鑰
      驗證：每一步符合 spec；`Restaurant` 表有記錄且同一店重搜不重複
- [ ] 8.2 在 Cloud Console 設定每日配額上限與預算警示（Nearby Search 150／日、Geocoding 300／日、Maps JavaScript 300／日），確認金鑰限制生效（用伺服器端金鑰直接在瀏覽器載入 Maps JS 應被拒）
      驗證：Console 的 Quotas 頁面顯示上限；錯誤金鑰的請求被拒
- [ ] 8.3 375px 截圖：初始狀態、定位被拒的地址表單、列表結果、地圖檢視（含底部卡片列與「在此區域搜尋」）；最後 `pnpm check` 全綠
      驗證：截圖符合觸控尺寸與版面；`pnpm check` 退出碼 0
