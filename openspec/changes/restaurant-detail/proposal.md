# Proposal

## Why

搜尋找到店之後，點進去只有店名和地址，決定「要不要去」需要的營業時間、價位、電話、網站都沒有。這是路線圖的第 4 個 change，也是評論與收藏之後要掛上去的頁面。

## What Changes

- `/restaurants/[id]` 從佔位頁變成完整詳情：店名、類型、Google 評分與評論數、價位、地址、營業時間（含「現在營業中／已打烊」與下一次開關門時間）、電話、網站、「在 Google 地圖開啟」導航連結
- 新增 Place Details 的伺服器端客戶端，只要求詳情頁需要的欄位
- 快取邏輯：Google 欄位 7 天內直接用；超過 7 天先顯示舊資料並在回應後背景重抓；超過 30 天先重抓再顯示
- `Restaurant` 表新增詳情欄位（價位、評論數、營業時間、電話、網站、時區偏移、詳情同步時間）的 migration
- **決定：不顯示照片**。Place Photos 每月只有 1,000 張免費，而且照片對「朋友之間找吃的」幫助有限；卡片與詳情都用類型圖示。產品規劃裡的照片代理端點與 `photoRefs` 欄位不做

## Capabilities

### New Capabilities

- `restaurant-detail`：店家詳情頁的呈現：顯示哪些 Google 資訊、營業狀態如何判斷、缺資料時怎麼顯示、導航與聯絡的外部連結

### Modified Capabilities

- `restaurant-cache`：「保存的內容與期限」新增 7 天的背景更新規則與詳情欄位的同步時間；「以 place_id 為鍵保存店家」補上詳情欄位的更新規則（搜尋的 upsert 不得清掉詳情欄位）

## Non-goals

- 照片（見上）
- 評論、自家評分、收藏按鈕（第 5、6 個 change；本頁預留區塊位置但不實作）
- Google 的使用者評論內容（`reviews` 欄位，Enterprise 且非必要）
- 路線規劃或地圖內嵌（導航交給 Google 地圖 app）
- 多語系：固定 `zh-TW`

## 對行動裝置體驗與定位／隱私的影響

- **行動體驗**：單欄版面，營業狀態與導航按鈕放在最上方（進店前最常看的兩件事）；電話與網站用 `tel:` / 外部連結，觸控目標至少 44px；營業時間預設收合只顯示今天，展開看整週
- **定位／隱私**：詳情頁不需要也不請求使用者位置；不顯示距離。導航連結只帶店家的座標與 place_id
- **成本**：Place Details 要求的營業時間、價位、電話、網站、評論數屬 Enterprise 等級（每月 1,000 次免費）。靠 7 天快取與每日配額（50 次）控制；一個月看 200 間不同的店也在免費額度內

## Impact

- **新增**：`lib/google/place-details.ts`、`lib/opening-hours.ts`（營業狀態計算）、`lib/restaurant-sync.ts`（快取判斷與重抓）、`components/restaurant/*`、migration `add_restaurant_details`
- **修改**：`app/restaurants/[id]/page.tsx`（重寫）、`prisma/schema.prisma`、`lib/restaurants.ts`（搜尋 upsert 不覆蓋詳情欄位）、`lib/google/config.ts`（詳情 FieldMask）、README（Place Details 配額）
- **外部設定**：Cloud Console 設 Place Details 每日配額 50（你操作）
- **無新相依**
