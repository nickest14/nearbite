import { z } from "zod";

import {
  GEOCODING_URL,
  getServerApiKey,
  GOOGLE_REQUEST_TIMEOUT_MS,
  redactApiKey,
  type GoogleClientDeps,
} from "./config";

// Geocoding API 的伺服器端客戶端（design D3）：地址／地標 → 座標。
// region=tw 是偏好不是限制，輸入國外地址仍可用。

export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

export class GeocodingError extends Error {
  constructor() {
    super("地址解析暫時無法使用，請稍後再試");
    this.name = "GeocodingError";
  }
}

const responseSchema = z.object({
  status: z.string(),
  results: z
    .array(
      z.object({
        formatted_address: z.string(),
        geometry: z.object({
          location: z.object({ lat: z.number(), lng: z.number() }),
        }),
      }),
    )
    .nullish(),
});

// 找不到時回 null（UI 顯示「找不到這個地點」），其他失敗丟 GeocodingError
export async function geocodeAddress(
  query: string,
  deps: GoogleClientDeps = {},
): Promise<GeocodeResult | null> {
  const doFetch = deps.fetch ?? fetch;
  const apiKey = deps.apiKey ?? getServerApiKey();

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("region", "tw");
  url.searchParams.set("language", "zh-TW");
  url.searchParams.set("key", apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await doFetch(url.toString(), { method: "GET", signal: controller.signal });
  } catch (error) {
    // 使用者輸入的地址在 url 裡，log 只記錯誤本身
    console.error("[geocoding] 請求失敗：", redactApiKey(String(error), apiKey));
    throw new GeocodingError();
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();

  if (!response.ok) {
    console.error(`[geocoding] HTTP ${response.status}：`, redactApiKey(text, apiKey));
    throw new GeocodingError();
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("[geocoding] 回應不是 JSON：", redactApiKey(text.slice(0, 200), apiKey));
    throw new GeocodingError();
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[geocoding] 回應形狀不符：", parsed.error.message);
    throw new GeocodingError();
  }

  const { status, results } = parsed.data;
  if (status === "ZERO_RESULTS") return null;

  const first = results?.[0];
  if (status !== "OK" || !first) {
    // REQUEST_DENIED、OVER_QUERY_LIMIT、INVALID_REQUEST 等。error_message 可能含網址，一樣清金鑰
    console.error(`[geocoding] 狀態 ${status}：`, redactApiKey(text.slice(0, 300), apiKey));
    throw new GeocodingError();
  }

  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formattedAddress: first.formatted_address,
  };
}
