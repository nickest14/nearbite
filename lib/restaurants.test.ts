// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlaceResult } from "@/lib/google/places";

const { upsert, update, $transaction } = vi.hoisted(() => {
  const upsert = vi.fn();
  const update = vi.fn();
  // 模擬 Prisma 的互動式交易：直接把 tx 交給 callback 執行
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ restaurant: { upsert } }),
  );
  return { upsert, update, $transaction };
});

vi.mock("@/lib/db", () => ({ db: { $transaction, restaurant: { update } } }));

import { Prisma } from "@/generated/prisma/client";
import type { PlaceDetails } from "@/lib/google/place-details";

import {
  dedupeByPlaceId,
  markRestaurantGone,
  updateRestaurantDetails,
  upsertRestaurants,
} from "./restaurants";

const DETAIL_FIELDS = [
  "openingHours",
  "phone",
  "website",
  "priceLevel",
  "googleRatingCount",
  "utcOffsetMinutes",
  "detailsSyncedAt",
];

function place(overrides: Partial<PlaceResult> = {}): PlaceResult {
  return {
    placeId: "ChIJ-a",
    name: "好吃拉麵",
    address: "台北市中正區北平西路3號",
    lat: 25.048,
    lng: 121.518,
    primaryType: "ramen_restaurant",
    types: ["ramen_restaurant", "restaurant"],
    rating: 4.3,
    businessStatus: "OPERATIONAL",
    ...overrides,
  };
}

describe("dedupeByPlaceId", () => {
  it("同一個 placeId 只保留第一筆", () => {
    const first = place({ name: "第一筆" });
    const dup = place({ name: "重複" });
    const other = place({ placeId: "ChIJ-b" });

    expect(dedupeByPlaceId([first, dup, other])).toEqual([first, other]);
  });
});

describe("upsertRestaurants", () => {
  const now = new Date("2026-10-09T00:00:00.000Z");

  beforeEach(() => {
    upsert.mockReset();
    $transaction.mockClear();
    upsert.mockImplementation(({ where }: { where: { googlePlaceId: string } }) =>
      Promise.resolve({ id: `id-${where.googlePlaceId}`, googlePlaceId: where.googlePlaceId }),
    );
  });

  it("以 googlePlaceId 為鍵 upsert，update 不含 googlePlaceId 與 createdAt", async () => {
    const rows = await upsertRestaurants([place()], now);

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    const expectedGoogleFields = {
      name: "好吃拉麵",
      address: "台北市中正區北平西路3號",
      lat: 25.048,
      lng: 121.518,
      primaryType: "ramen_restaurant",
      types: ["ramen_restaurant", "restaurant"],
      googleRating: 4.3,
      businessStatus: "OPERATIONAL",
      googleSyncedAt: now,
    };
    expect(upsert).toHaveBeenCalledWith({
      where: { googlePlaceId: "ChIJ-a" },
      update: expectedGoogleFields,
      create: { googlePlaceId: "ChIJ-a", ...expectedGoogleFields },
      select: { id: true, googlePlaceId: true },
    });
    const updateArg = upsert.mock.calls[0]?.[0].update;
    expect(updateArg).not.toHaveProperty("createdAt");
    expect(updateArg).not.toHaveProperty("googlePlaceId");
    expect(rows).toEqual([{ id: "id-ChIJ-a", googlePlaceId: "ChIJ-a" }]);
  });

  it("重複的 placeId 只 upsert 一次", async () => {
    const rows = await upsertRestaurants([place(), place(), place({ placeId: "ChIJ-b" })], now);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(rows.map((row) => row.googlePlaceId)).toEqual(["ChIJ-a", "ChIJ-b"]);
  });

  it("空輸入不開交易", async () => {
    await expect(upsertRestaurants([], now)).resolves.toEqual([]);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("搜尋的 update 不含任何詳情欄位（不覆蓋 Place Details 寫入的資料）", async () => {
    await upsertRestaurants([place()], now);

    const { update: updateArg, create: createArg } = upsert.mock.calls[0]?.[0] ?? {};
    for (const field of DETAIL_FIELDS) {
      expect(updateArg).not.toHaveProperty(field);
      expect(createArg).not.toHaveProperty(field);
    }
  });

  it("交易失敗時向上丟錯", async () => {
    upsert.mockRejectedValueOnce(new Error("connection lost"));

    await expect(upsertRestaurants([place()], now)).rejects.toThrow("connection lost");
  });
});

function details(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    placeId: "ChIJ-a",
    name: "好吃拉麵",
    address: "台北市中正區北平西路3號",
    lat: 25.048,
    lng: 121.518,
    primaryType: "ramen_restaurant",
    types: ["ramen_restaurant"],
    rating: 4.5,
    businessStatus: "OPERATIONAL",
    ratingCount: 128,
    priceLevel: 2,
    openingHours: { periods: [], weekdayDescriptions: ["星期一: 休息"] },
    phone: "02 2345 6789",
    website: "https://example.com",
    utcOffsetMinutes: 480,
    ...overrides,
  };
}

describe("updateRestaurantDetails", () => {
  const now = new Date("2026-10-09T00:00:00.000Z");

  beforeEach(() => {
    update.mockReset();
    update.mockResolvedValue({});
  });

  it("只更新詳情欄位、評分與營業狀態，不動搜尋的同步時間", async () => {
    await updateRestaurantDetails("r1", details(), now);

    expect(update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: {
        googleRating: 4.5,
        businessStatus: "OPERATIONAL",
        googleRatingCount: 128,
        priceLevel: 2,
        openingHours: { periods: [], weekdayDescriptions: ["星期一: 休息"] },
        phone: "02 2345 6789",
        website: "https://example.com",
        utcOffsetMinutes: 480,
        detailsSyncedAt: now,
      },
    });
    const data = update.mock.calls[0]?.[0].data;
    for (const field of ["name", "address", "lat", "lng", "googleSyncedAt", "googlePlaceId"]) {
      expect(data).not.toHaveProperty(field);
    }
  });

  it("沒有營業時間時以 DbNull 清空 Json 欄位", async () => {
    await updateRestaurantDetails("r1", details({ openingHours: null }), now);

    expect(update.mock.calls[0]?.[0].data.openingHours).toBe(Prisma.DbNull);
  });
});

describe("markRestaurantGone", () => {
  it("標記歇業並更新詳情同步時間", async () => {
    update.mockReset();
    update.mockResolvedValue({});
    const now = new Date("2026-10-09T00:00:00.000Z");

    await markRestaurantGone("r1", now);

    expect(update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { businessStatus: "CLOSED_PERMANENTLY", detailsSyncedAt: now },
    });
  });
});
