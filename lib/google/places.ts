import { z } from "zod";

import {
  getServerApiKey,
  GOOGLE_REQUEST_TIMEOUT_MS,
  MAX_RESULT_COUNT,
  PLACES_FIELD_MASK,
  PLACES_SEARCH_NEARBY_URL,
  redactApiKey,
  SEARCH_TYPES,
  type GoogleClientDeps,
} from "./config";

// Places API (New) Nearby Search 的伺服器端客戶端（design D2）。
// fetch 與金鑰用參數注入，測試時傳假的 fetch 就能斷言 header、body 與錯誤處理，不碰網路。

export type PlaceResult = {
  placeId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[];
  rating: number | null;
  businessStatus: string | null;
};

export class PlacesError extends Error {
  constructor() {
    super("搜尋暫時無法使用，請稍後再試");
    this.name = "PlacesError";
  }
}

export type SearchNearbyParams = {
  lat: number;
  lng: number;
  radius: number;
};

// 只驗證我們會用到的形狀，缺欄位給 null 而不是整批失敗。
// id、displayName.text、location 是卡片與 upsert 的必要條件，缺了這筆就略過。
const placeSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({ text: z.string().min(1) }),
  formattedAddress: z.string().nullish(),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  types: z.array(z.string()).nullish(),
  primaryType: z.string().nullish(),
  rating: z.number().nullish(),
  businessStatus: z.string().nullish(),
});

const responseSchema = z.object({
  places: z.array(z.unknown()).nullish(),
});

function toPlaceResult(raw: unknown): PlaceResult | null {
  const parsed = placeSchema.safeParse(raw);
  if (!parsed.success) return null;
  const place = parsed.data;
  return {
    placeId: place.id,
    name: place.displayName.text,
    address: place.formattedAddress ?? null,
    lat: place.location.latitude,
    lng: place.location.longitude,
    primaryType: place.primaryType ?? null,
    types: place.types ?? [],
    rating: place.rating ?? null,
    businessStatus: place.businessStatus ?? null,
  };
}

export async function searchNearby(
  params: SearchNearbyParams,
  deps: GoogleClientDeps = {},
): Promise<PlaceResult[]> {
  const doFetch = deps.fetch ?? fetch;
  const apiKey = deps.apiKey ?? getServerApiKey();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await doFetch(PLACES_SEARCH_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: SEARCH_TYPES,
        maxResultCount: MAX_RESULT_COUNT,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: params.lat, longitude: params.lng },
            radius: params.radius,
          },
        },
        languageCode: "zh-TW",
        regionCode: "TW",
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // 逾時（AbortError）或網路錯誤。使用者的座標在 params 裡，不寫進 log
    console.error("[places] 請求失敗：", redactApiKey(String(error), apiKey));
    throw new PlacesError();
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();

  if (!response.ok) {
    console.error(`[places] HTTP ${response.status}：`, redactApiKey(text, apiKey));
    throw new PlacesError();
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("[places] 回應不是 JSON：", redactApiKey(text.slice(0, 200), apiKey));
    throw new PlacesError();
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[places] 回應形狀不符：", parsed.error.message);
    throw new PlacesError();
  }

  // 空結果時 Google 回 {}，places 會是 undefined
  return (parsed.data.places ?? [])
    .map(toPlaceResult)
    .filter((place): place is PlaceResult => place !== null);
}
