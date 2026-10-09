// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Restaurant } from "@/generated/prisma/client";
import type { PlaceDetails } from "@/lib/google/place-details";

const { findUnique, fetchPlaceDetails, updateRestaurantDetails, markRestaurantGone, after } =
  vi.hoisted(() => ({
    findUnique: vi.fn(),
    fetchPlaceDetails: vi.fn(),
    updateRestaurantDetails: vi.fn(),
    markRestaurantGone: vi.fn(),
    after: vi.fn(),
  }));

vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/db", () => ({ db: { restaurant: { findUnique } } }));
vi.mock("@/lib/google/place-details", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/google/place-details")>();
  return { ...actual, fetchPlaceDetails };
});
vi.mock("@/lib/restaurants", () => ({ updateRestaurantDetails, markRestaurantGone }));

import { PlaceDetailsError, PlaceNotFoundError } from "@/lib/google/place-details";

import { getRestaurantDetail, resetInFlightForTests } from "./restaurant-sync";

const NOW = new Date("2026-10-09T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: "r1",
    googlePlaceId: "ChIJ-1",
    name: "好吃拉麵",
    address: null,
    lat: 25,
    lng: 121,
    primaryType: "ramen_restaurant",
    types: [],
    googleRating: 4.2,
    businessStatus: "OPERATIONAL",
    googleSyncedAt: NOW,
    priceLevel: null,
    googleRatingCount: null,
    openingHours: null,
    phone: null,
    website: null,
    utcOffsetMinutes: null,
    detailsSyncedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function details(): PlaceDetails {
  return {
    placeId: "ChIJ-1",
    name: "好吃拉麵",
    address: null,
    lat: 25,
    lng: 121,
    primaryType: "ramen_restaurant",
    types: [],
    rating: 4.5,
    businessStatus: "OPERATIONAL",
    ratingCount: 10,
    priceLevel: 2,
    openingHours: null,
    phone: "02 1234 5678",
    website: null,
    utcOffsetMinutes: 480,
  };
}

// 同步執行背景工作，讓測試可以斷言它的效果
const runNow = (work: () => Promise<void>) => {
  void work();
};

beforeEach(() => {
  findUnique.mockReset();
  fetchPlaceDetails.mockReset();
  updateRestaurantDetails.mockReset();
  markRestaurantGone.mockReset();
  after.mockReset();
  resetInFlightForTests();
  updateRestaurantDetails.mockResolvedValue(undefined);
  markRestaurantGone.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("getRestaurantDetail", () => {
  it("找不到店家回 null，不呼叫 Google", async () => {
    findUnique.mockResolvedValue(null);

    await expect(getRestaurantDetail("nope", { now: NOW })).resolves.toBeNull();
    expect(fetchPlaceDetails).not.toHaveBeenCalled();
  });

  it("7 天內：直接回資料庫內容，不呼叫 Google、不排程", async () => {
    findUnique.mockResolvedValue(
      restaurant({ detailsSyncedAt: new Date(NOW.getTime() - 6 * DAY) }),
    );
    const schedule = vi.fn();

    const view = await getRestaurantDetail("r1", { now: NOW, schedule });

    expect(view?.freshness).toBe("fresh");
    expect(fetchPlaceDetails).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });

  it("7–30 天：立即回舊資料，背景重抓並更新資料庫", async () => {
    findUnique.mockResolvedValue(
      restaurant({ detailsSyncedAt: new Date(NOW.getTime() - 10 * DAY) }),
    );
    fetchPlaceDetails.mockResolvedValue(details());
    const schedule = vi.fn(runNow);

    const view = await getRestaurantDetail("r1", { now: NOW, schedule });

    expect(view?.freshness).toBe("fresh");
    expect(schedule).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(updateRestaurantDetails).toHaveBeenCalledWith("r1", details(), NOW),
    );
    expect(fetchPlaceDetails).toHaveBeenCalledWith("ChIJ-1");
  });

  it("預設排程器是 next/server 的 after", async () => {
    findUnique.mockResolvedValue(
      restaurant({ detailsSyncedAt: new Date(NOW.getTime() - 10 * DAY) }),
    );

    await getRestaurantDetail("r1", { now: NOW });

    expect(after).toHaveBeenCalledTimes(1);
    expect(fetchPlaceDetails).not.toHaveBeenCalled();
  });

  it("從未取得詳情：先抓再回更新後的資料", async () => {
    const before = restaurant();
    const afterUpdate = restaurant({ phone: "02 1234 5678", detailsSyncedAt: NOW });
    findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(afterUpdate);
    fetchPlaceDetails.mockResolvedValue(details());
    const schedule = vi.fn();

    const view = await getRestaurantDetail("r1", { now: NOW, schedule });

    expect(fetchPlaceDetails).toHaveBeenCalledTimes(1);
    expect(updateRestaurantDetails).toHaveBeenCalledWith("r1", details(), NOW);
    expect(view).toMatchObject({ phone: "02 1234 5678", freshness: "fresh" });
    expect(schedule).not.toHaveBeenCalled();
  });

  it("超過 30 天：先抓再回", async () => {
    findUnique.mockResolvedValue(
      restaurant({ detailsSyncedAt: new Date(NOW.getTime() - 31 * DAY) }),
    );
    fetchPlaceDetails.mockResolvedValue(details());

    const view = await getRestaurantDetail("r1", { now: NOW, schedule: vi.fn() });

    expect(fetchPlaceDetails).toHaveBeenCalledTimes(1);
    expect(view?.freshness).toBe("fresh");
  });

  it("超過 30 天且重抓失敗：回舊資料並標 stale", async () => {
    const old = restaurant({
      phone: "舊電話",
      detailsSyncedAt: new Date(NOW.getTime() - 40 * DAY),
    });
    findUnique.mockResolvedValue(old);
    fetchPlaceDetails.mockRejectedValue(new PlaceDetailsError());

    const view = await getRestaurantDetail("r1", { now: NOW, schedule: vi.fn() });

    expect(view).toMatchObject({ phone: "舊電話", freshness: "stale" });
    expect(updateRestaurantDetails).not.toHaveBeenCalled();
  });

  it("從未取得詳情且失敗：標 unavailable", async () => {
    findUnique.mockResolvedValue(restaurant());
    fetchPlaceDetails.mockRejectedValue(new PlaceDetailsError());

    const view = await getRestaurantDetail("r1", { now: NOW, schedule: vi.fn() });

    expect(view?.freshness).toBe("unavailable");
  });

  it("place_id 失效（404）：標記歇業並視為已更新", async () => {
    const before = restaurant();
    const gone = restaurant({ businessStatus: "CLOSED_PERMANENTLY", detailsSyncedAt: NOW });
    findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(gone);
    fetchPlaceDetails.mockRejectedValue(new PlaceNotFoundError("ChIJ-1"));

    const view = await getRestaurantDetail("r1", { now: NOW, schedule: vi.fn() });

    expect(markRestaurantGone).toHaveBeenCalledWith("r1", NOW);
    expect(view).toMatchObject({ businessStatus: "CLOSED_PERMANENTLY", freshness: "fresh" });
  });

  it("同一間店一分鐘內多次需要重抓時只向 Google 發一次請求", async () => {
    findUnique.mockResolvedValue(restaurant());
    let resolveFetch: (value: PlaceDetails) => void = () => undefined;
    fetchPlaceDetails.mockImplementation(
      () =>
        new Promise<PlaceDetails>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = getRestaurantDetail("r1", { now: NOW, schedule: vi.fn() });
    const second = getRestaurantDetail("r1", {
      now: new Date(NOW.getTime() + 30_000),
      schedule: vi.fn(),
    });
    await vi.waitFor(() => expect(fetchPlaceDetails).toHaveBeenCalledTimes(1));
    resolveFetch(details());
    await Promise.all([first, second]);

    expect(fetchPlaceDetails).toHaveBeenCalledTimes(1);
  });

  it("成功後若立即再被判定過期（例如手動改了同步時間），會再抓一次", async () => {
    findUnique.mockResolvedValue(restaurant());
    fetchPlaceDetails.mockResolvedValue(details());

    await getRestaurantDetail("r1", { now: NOW, schedule: vi.fn() });
    await getRestaurantDetail("r1", { now: new Date(NOW.getTime() + 5_000), schedule: vi.fn() });

    expect(fetchPlaceDetails).toHaveBeenCalledTimes(2);
  });

  it("失敗後一分鐘內不再對 Google 重試", async () => {
    findUnique.mockResolvedValue(restaurant());
    fetchPlaceDetails.mockRejectedValue(new PlaceDetailsError());

    const first = await getRestaurantDetail("r1", { now: NOW, schedule: vi.fn() });
    const second = await getRestaurantDetail("r1", {
      now: new Date(NOW.getTime() + 30_000),
      schedule: vi.fn(),
    });

    expect(fetchPlaceDetails).toHaveBeenCalledTimes(1);
    expect(first?.freshness).toBe("unavailable");
    expect(second?.freshness).toBe("unavailable");
  });

  it("失敗超過一分鐘後可以再次重抓", async () => {
    findUnique.mockResolvedValue(restaurant());
    fetchPlaceDetails.mockRejectedValue(new PlaceDetailsError());

    await getRestaurantDetail("r1", { now: NOW, schedule: vi.fn() });
    await getRestaurantDetail("r1", {
      now: new Date(NOW.getTime() + 61_000),
      schedule: vi.fn(),
    });

    expect(fetchPlaceDetails).toHaveBeenCalledTimes(2);
  });
});
