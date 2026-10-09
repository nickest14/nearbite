import { z } from "zod";

import type { RegularOpeningHours } from "@/lib/opening-hours";

import {
  getServerApiKey,
  GOOGLE_REQUEST_TIMEOUT_MS,
  PLACE_DETAILS_FIELD_MASK,
  PLACE_DETAILS_URL,
  PRICE_LEVELS,
  redactApiKey,
  type GoogleClientDeps,
} from "./config";

// Place Details (New) 的伺服器端客戶端（design D1）。跟 places.ts 同一套注入與錯誤處理。
// 這支是 Enterprise 計費，只有詳情頁在快取過期時才呼叫。

export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[];
  rating: number | null;
  businessStatus: string | null;
  ratingCount: number | null;
  priceLevel: number | null; // 0–4
  openingHours: RegularOpeningHours | null;
  phone: string | null;
  website: string | null;
  utcOffsetMinutes: number | null;
};

export class PlaceDetailsError extends Error {
  constructor() {
    super("詳細資訊暫時無法取得");
    this.name = "PlaceDetailsError";
  }
}

// place_id 失效（店家被 Google 移除或合併）：呼叫端會標記歇業，不再反覆重抓
export class PlaceNotFoundError extends Error {
  constructor(placeId: string) {
    super(`place_id 已失效：${placeId}`);
    this.name = "PlaceNotFoundError";
  }
}

const pointSchema = z.object({
  day: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

const openingHoursSchema = z.object({
  periods: z.array(z.object({ open: pointSchema, close: pointSchema.nullish() })).nullish(),
  weekdayDescriptions: z.array(z.string()).nullish(),
});

const detailsSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({ text: z.string().min(1) }),
  formattedAddress: z.string().nullish(),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  types: z.array(z.string()).nullish(),
  primaryType: z.string().nullish(),
  rating: z.number().nullish(),
  businessStatus: z.string().nullish(),
  userRatingCount: z.number().nullish(),
  priceLevel: z.string().nullish(),
  regularOpeningHours: openingHoursSchema.nullish(),
  nationalPhoneNumber: z.string().nullish(),
  websiteUri: z.string().nullish(),
  utcOffsetMinutes: z.number().nullish(),
});

function toPlaceDetails(raw: z.infer<typeof detailsSchema>): PlaceDetails {
  const hours = raw.regularOpeningHours;
  return {
    placeId: raw.id,
    name: raw.displayName.text,
    address: raw.formattedAddress ?? null,
    lat: raw.location.latitude,
    lng: raw.location.longitude,
    primaryType: raw.primaryType ?? null,
    types: raw.types ?? [],
    rating: raw.rating ?? null,
    businessStatus: raw.businessStatus ?? null,
    ratingCount: raw.userRatingCount ?? null,
    priceLevel: raw.priceLevel ? (PRICE_LEVELS[raw.priceLevel] ?? null) : null,
    openingHours: hours
      ? {
          periods: (hours.periods ?? []).map((period) => ({
            open: period.open,
            close: period.close ?? null,
          })),
          weekdayDescriptions: hours.weekdayDescriptions ?? [],
        }
      : null,
    phone: raw.nationalPhoneNumber ?? null,
    website: raw.websiteUri ?? null,
    utcOffsetMinutes: raw.utcOffsetMinutes ?? null,
  };
}

export async function fetchPlaceDetails(
  placeId: string,
  deps: GoogleClientDeps = {},
): Promise<PlaceDetails> {
  const doFetch = deps.fetch ?? fetch;
  const apiKey = deps.apiKey ?? getServerApiKey();

  const url = new URL(`${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", "zh-TW");
  url.searchParams.set("regionCode", "TW");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await doFetch(url.toString(), {
      method: "GET",
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK },
      signal: controller.signal,
    });
  } catch (error) {
    console.error("[place-details] 請求失敗：", redactApiKey(String(error), apiKey));
    throw new PlaceDetailsError();
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();

  if (response.status === 404) {
    throw new PlaceNotFoundError(placeId);
  }
  if (!response.ok) {
    console.error(`[place-details] HTTP ${response.status}：`, redactApiKey(text, apiKey));
    throw new PlaceDetailsError();
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("[place-details] 回應不是 JSON：", redactApiKey(text.slice(0, 200), apiKey));
    throw new PlaceDetailsError();
  }

  const parsed = detailsSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[place-details] 回應形狀不符：", parsed.error.message);
    throw new PlaceDetailsError();
  }

  return toPlaceDetails(parsed.data);
}
