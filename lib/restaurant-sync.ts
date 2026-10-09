import { after } from "next/server";

import type { Restaurant } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { fetchPlaceDetails, PlaceNotFoundError } from "@/lib/google/place-details";
import { markRestaurantGone, updateRestaurantDetails } from "@/lib/restaurants";

// 詳情資料的新鮮度判斷與重抓（design D4）。頁面只呼叫 getRestaurantDetail，不管何時該重抓。

export type Freshness =
  | "fresh" // 可直接顯示（含 7–30 天、已排程背景更新的情況）
  | "stale" // 超過 30 天且重抓失敗，顯示舊資料並提示
  | "unavailable"; // 從未取得詳情且重抓失敗，只有搜尋欄位

export type RestaurantDetailView = Restaurant & { freshness: Freshness };

const DAY_MS = 24 * 60 * 60 * 1000;
export const FRESH_MS = 7 * DAY_MS;
export const EXPIRED_MS = 30 * DAY_MS;
// 同一間店進行中的重抓共用同一個 promise（前景與背景共用）；失敗後一分鐘內不再重試
export const DEDUPE_MS = 60 * 1000;

type SyncDeps = {
  now?: Date;
  // 背景工作的排程器，預設是 Next 的 after()；測試注入同步版本
  schedule?: (work: () => Promise<void>) => void;
};

type InFlight = { promise: Promise<boolean>; startedAt: number };
// 只在單一 process 內有效；多 instance 最壞情況是多抓一次
const inFlight = new Map<string, InFlight>();

export function resetInFlightForTests(): void {
  inFlight.clear();
}

// 回傳 true 表示資料庫已更新（含標記歇業），false 表示失敗、資料庫未變
export function refreshRestaurantDetails(
  restaurant: Pick<Restaurant, "id" | "googlePlaceId">,
  now: Date = new Date(),
): Promise<boolean> {
  const existing = inFlight.get(restaurant.googlePlaceId);
  if (existing && now.getTime() - existing.startedAt < DEDUPE_MS) {
    return existing.promise;
  }

  const promise = (async () => {
    try {
      const details = await fetchPlaceDetails(restaurant.googlePlaceId);
      await updateRestaurantDetails(restaurant.id, details, now);
      return true;
    } catch (error) {
      if (error instanceof PlaceNotFoundError) {
        await markRestaurantGone(restaurant.id, now);
        return true;
      }
      // fetchPlaceDetails 已經 log 過 Google 端的錯誤；這裡補 DB 等其他失敗
      console.error(
        `[restaurant-sync] 重抓失敗 ${restaurant.id}：`,
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  })();

  inFlight.set(restaurant.googlePlaceId, { promise, startedAt: now.getTime() });
  // 成功就清掉：DB 已更新，之後不會再被判定需要重抓。失敗的紀錄留一分鐘，避免連續對 Google 重試
  void promise.then((updated) => {
    if (updated && inFlight.get(restaurant.googlePlaceId)?.promise === promise) {
      inFlight.delete(restaurant.googlePlaceId);
    }
  });
  return promise;
}

export async function getRestaurantDetail(
  id: string,
  deps: SyncDeps = {},
): Promise<RestaurantDetailView | null> {
  const now = deps.now ?? new Date();
  const schedule = deps.schedule ?? ((work) => after(work));

  const restaurant = await db.restaurant.findUnique({ where: { id } });
  if (!restaurant) return null;

  const age = restaurant.detailsSyncedAt
    ? now.getTime() - restaurant.detailsSyncedAt.getTime()
    : Number.POSITIVE_INFINITY;

  if (age <= FRESH_MS) {
    return { ...restaurant, freshness: "fresh" };
  }

  if (age <= EXPIRED_MS) {
    // 先回舊資料，回應送出後再更新；下次開啟看到新資料
    schedule(async () => {
      await refreshRestaurantDetails(restaurant, now);
    });
    return { ...restaurant, freshness: "fresh" };
  }

  const updated = await refreshRestaurantDetails(restaurant, now);
  if (updated) {
    const fresh = await db.restaurant.findUnique({ where: { id } });
    return { ...(fresh ?? restaurant), freshness: "fresh" };
  }
  return { ...restaurant, freshness: restaurant.detailsSyncedAt ? "stale" : "unavailable" };
}
