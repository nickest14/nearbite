// Google Maps Platform 的設定集中在這裡：金鑰讀取、搜尋類型、FieldMask、逾時。
// 成本相關的常數都有註解說明為什麼是這個值，改之前先看 openspec/changes/nearby-search/design.md D12。

// Nearby Search 的 includedTypes：Table A「Food and Drink」類別裡我們要的七種
export const SEARCH_TYPES = [
  "restaurant",
  "cafe",
  "coffee_shop",
  "bakery",
  "dessert_shop",
  "ice_cream_shop",
  "bar",
] as const;

// 搜尋範圍（公尺）。UI 的三個 chip 與 Server Action 的驗證共用這一份
export const SEARCH_RADIUS_OPTIONS = [500, 1000, 2000] as const;
export type SearchRadius = (typeof SEARCH_RADIUS_OPTIONS)[number];
export const DEFAULT_SEARCH_RADIUS: SearchRadius = 1000;

// Nearby Search 單次上限就是 20
export const MAX_RESULT_COUNT = 20;

// Places API (New) 的計費看 FieldMask 裡「最貴」的欄位。下面全部是 Pro 等級（每月 5,000 次免費）。
// 加任何 Enterprise 欄位（currentOpeningHours、priceLevel、userRatingCount、電話、網站、photos 的取圖）
// 會讓每次搜尋從 5,000 次免費降到 1,000 次。
export const PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.rating",
  "places.businessStatus",
].join(",");

export const PLACES_SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
export const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// Place Details 的 FieldMask（欄位名不加 places. 前綴，與 Nearby Search 不同）。
// 這組含 Enterprise 欄位（regularOpeningHours、priceLevel、電話、網站、評論數），整次呼叫以 Enterprise 計費：
// 每月 1,000 次免費、之後 $35/千次。只有詳情頁會打，搭配 7 天快取與每日配額 50。
// 加欄位前先看 openspec/changes/restaurant-detail/proposal.md 的成本段落；photos 與 reviews 不要加。
export const PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "primaryType",
  "rating",
  "businessStatus",
  "userRatingCount",
  "priceLevel",
  "regularOpeningHours",
  "nationalPhoneNumber",
  "websiteUri",
  "utcOffsetMinutes",
].join(",");

export const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

// Google 的 priceLevel 列舉 → 0–4 的整數（資料庫存整數）
export const PRICE_LEVELS: Readonly<Record<string, number>> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// 對 Google 的伺服器端請求逾時。Server Action 本身沒有逾時，不設的話失敗時使用者會一直等
export const GOOGLE_REQUEST_TIMEOUT_MS = 8_000;

// Places 與 Geocoding 客戶端共用的注入點：測試時傳假的 fetch 與金鑰，不碰網路也不讀環境變數
export type GoogleClientDeps = {
  fetch?: typeof fetch;
  apiKey?: string;
};

// 伺服器端金鑰：只在 Server Action / 伺服器端程式碼讀取，絕不經過瀏覽器
export function getServerApiKey(): string {
  const key = process.env["GOOGLE_MAPS_SERVER_API_KEY"];
  if (!key) {
    throw new Error(
      "GOOGLE_MAPS_SERVER_API_KEY 未設定，請參考 README 的「Google Maps Platform 設定」",
    );
  }
  return key;
}

// 瀏覽器端設定。NEXT_PUBLIC_ 變數必須用 process.env.X 的寫法 Next.js 才會在建置時內嵌
export const browserApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY ?? "";
// AdvancedMarker 需要 Map ID；DEMO_MAP_ID 是 Google 提供給開發測試用，正式環境在 deployment change 建自己的
export const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

// 寫 log 之前把金鑰清掉：Google 的錯誤訊息有時會把請求網址（含 key=）原樣帶回來
export function redactApiKey(text: string, apiKey?: string): string {
  let result = text.replace(/([?&]key=)[^&\s"']+/gi, "$1[REDACTED]");
  result = result.replace(/(X-Goog-Api-Key["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, "$1[REDACTED]");
  if (apiKey) {
    result = result.split(apiKey).join("[REDACTED]");
  }
  return result;
}
