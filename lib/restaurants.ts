import { db } from "@/lib/db";
import type { PlaceResult } from "@/lib/google/places";

// 把 Places 搜尋結果寫進 Restaurant 表（design D6）。
// 以 googlePlaceId 為鍵 upsert；update 只碰 Google 欄位與 googleSyncedAt，自家 id 與 createdAt 不變。
// 整批在一個交易內，失敗就整批回滾——結果沒有自家 id 就不能導向店家頁，所以不做半成功。

export type UpsertedRestaurant = {
  id: string;
  googlePlaceId: string;
};

// 同一批結果裡同一個 place_id 出現兩次時只保留第一筆，避免交易內對同一列 upsert 兩次
export function dedupeByPlaceId(places: readonly PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>();
  const result: PlaceResult[] = [];
  for (const place of places) {
    if (seen.has(place.placeId)) continue;
    seen.add(place.placeId);
    result.push(place);
  }
  return result;
}

export async function upsertRestaurants(
  places: readonly PlaceResult[],
  now: Date = new Date(),
): Promise<UpsertedRestaurant[]> {
  const unique = dedupeByPlaceId(places);
  if (unique.length === 0) return [];

  return db.$transaction(async (tx) => {
    const rows: UpsertedRestaurant[] = [];
    for (const place of unique) {
      const googleFields = {
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        primaryType: place.primaryType,
        types: place.types,
        googleRating: place.rating,
        businessStatus: place.businessStatus,
        googleSyncedAt: now,
      };
      const row = await tx.restaurant.upsert({
        where: { googlePlaceId: place.placeId },
        update: googleFields,
        create: { googlePlaceId: place.placeId, ...googleFields },
        select: { id: true, googlePlaceId: true },
      });
      rows.push(row);
    }
    return rows;
  });
}
