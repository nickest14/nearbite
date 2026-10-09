import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { PlaceDetails } from "@/lib/google/place-details";
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

// 詳情取得後的寫入（design D3）：只更新詳情欄位與 detailsSyncedAt，
// 順便更新 Google 也會回傳的評分與營業狀態，但不動搜尋的 googleSyncedAt。
export async function updateRestaurantDetails(
  id: string,
  details: PlaceDetails,
  now: Date = new Date(),
): Promise<void> {
  await db.restaurant.update({
    where: { id },
    data: {
      googleRating: details.rating,
      businessStatus: details.businessStatus,
      googleRatingCount: details.ratingCount,
      priceLevel: details.priceLevel,
      // Json? 欄位不能直接給 null，要用 Prisma.DbNull 才會存成 SQL NULL
      openingHours: details.openingHours ?? Prisma.DbNull,
      phone: details.phone,
      website: details.website,
      utcOffsetMinutes: details.utcOffsetMinutes,
      detailsSyncedAt: now,
    },
  });
}

// place_id 失效時標記歇業並視為已同步，避免每次開啟都重抓
export async function markRestaurantGone(id: string, now: Date = new Date()): Promise<void> {
  await db.restaurant.update({
    where: { id },
    data: { businessStatus: "CLOSED_PERMANENTLY", detailsSyncedAt: now },
  });
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
