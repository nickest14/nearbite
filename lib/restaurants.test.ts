// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlaceResult } from "@/lib/google/places";

const { upsert, $transaction } = vi.hoisted(() => {
  const upsert = vi.fn();
  // 模擬 Prisma 的互動式交易：直接把 tx 交給 callback 執行
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ restaurant: { upsert } }),
  );
  return { upsert, $transaction };
});

vi.mock("@/lib/db", () => ({ db: { $transaction } }));

import { dedupeByPlaceId, upsertRestaurants } from "./restaurants";

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

  it("交易失敗時向上丟錯", async () => {
    upsert.mockRejectedValueOnce(new Error("connection lost"));

    await expect(upsertRestaurants([place()], now)).rejects.toThrow("connection lost");
  });
});
