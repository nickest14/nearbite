"use server";

import { z } from "zod";

import { sortByDistance } from "@/lib/geo";
import { SEARCH_RADIUS_OPTIONS, type SearchRadius } from "@/lib/google/config";
import { geocodeAddress } from "@/lib/google/geocoding";
import { PlacesError, searchNearby } from "@/lib/google/places";
import { typeLabel } from "@/lib/place-types";
import { upsertRestaurants } from "@/lib/restaurants";
import { requireUser, UnauthorizedError } from "@/lib/session";

// 附近搜尋的 Server Actions（design D7）。所有 Google 呼叫都在這裡發生，瀏覽器不碰伺服器端金鑰。
// 回傳 discriminated union 而不是丟例外：訊息一律是固定中文，不帶技術細節。

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type RestaurantSummary = {
  id: string;
  name: string;
  primaryType: string | null;
  typeLabel: string;
  distanceMeters: number;
  rating: number | null;
  businessStatus: string | null;
  lat: number;
  lng: number;
};

export type SearchResult = {
  center: { lat: number; lng: number };
  radius: SearchRadius;
  results: RestaurantSummary[];
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

const SEARCH_FAILED_MESSAGE = "搜尋暫時無法使用，請稍後再試";
const GEOCODE_FAILED_MESSAGE = "地址解析暫時無法使用，請稍後再試";
const INVALID_INPUT_MESSAGE = "搜尋條件不正確";

const searchInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.literal(SEARCH_RADIUS_OPTIONS),
});

const geocodeInputSchema = z.object({
  query: z.string().trim().min(1).max(100),
});

export async function searchNearbyAction(input: unknown): Promise<ActionResult<SearchResult>> {
  // 沒 session 直接丟錯：首頁本身已由 requireUser({ returnTo }) 擋住，這裡是防直接 POST
  await requireUser();

  const parsed = searchInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: INVALID_INPUT_MESSAGE };
  }
  const { lat, lng, radius } = parsed.data;

  try {
    const places = await searchNearby({ lat, lng, radius });
    const rows = await upsertRestaurants(places);
    const idByPlaceId = new Map(rows.map((row) => [row.googlePlaceId, row.id]));

    // Google 以 DISTANCE 排序回來的結果已經有序，但顯示用的距離要跟排序一致，所以自己算一次再排
    const results = sortByDistance(places, { lat, lng }).flatMap((place) => {
      const id = idByPlaceId.get(place.placeId);
      if (!id) return [];
      return [
        {
          id,
          name: place.name,
          primaryType: place.primaryType,
          typeLabel: typeLabel(place.primaryType, place.types),
          distanceMeters: Math.round(place.distanceMeters),
          rating: place.rating,
          businessStatus: place.businessStatus,
          lat: place.lat,
          lng: place.lng,
        },
      ];
    });

    return { ok: true, data: { center: { lat, lng }, radius, results } };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    // PlacesError 已在客戶端 log 過；這裡補 DB 等其他錯誤。座標不寫進 log
    if (!(error instanceof PlacesError)) {
      console.error("[searchNearbyAction] 失敗：", error instanceof Error ? error.message : error);
    }
    return { ok: false, message: SEARCH_FAILED_MESSAGE };
  }
}

export async function geocodeAction(input: unknown): Promise<ActionResult<GeocodeResult | null>> {
  await requireUser();

  const parsed = geocodeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: INVALID_INPUT_MESSAGE };
  }

  try {
    const result = await geocodeAddress(parsed.data.query);
    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    return { ok: false, message: GEOCODE_FAILED_MESSAGE };
  }
}
