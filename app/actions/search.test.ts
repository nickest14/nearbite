// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlaceResult } from "@/lib/google/places";

const { requireUser, searchNearby, geocodeAddress, upsertRestaurants, UnauthorizedError } =
  vi.hoisted(() => ({
    requireUser: vi.fn(),
    searchNearby: vi.fn(),
    geocodeAddress: vi.fn(),
    upsertRestaurants: vi.fn(),
    // 不能 importOriginal：@/lib/session 會拉進 next-auth，在 vitest 的 node 環境下無法載入
    UnauthorizedError: class UnauthorizedError extends Error {},
  }));

vi.mock("@/lib/session", () => ({ requireUser, UnauthorizedError }));
vi.mock("@/lib/google/places", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/google/places")>();
  return { ...actual, searchNearby };
});
vi.mock("@/lib/google/geocoding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/google/geocoding")>();
  return { ...actual, geocodeAddress };
});
vi.mock("@/lib/restaurants", () => ({ upsertRestaurants }));

import { GeocodingError } from "@/lib/google/geocoding";
import { PlacesError } from "@/lib/google/places";

import { geocodeAction, searchNearbyAction } from "./search";

const center = { lat: 25.0478, lng: 121.517 };
const user = { id: "u1", email: "me@example.com", name: "Nick", image: null };

function place(overrides: Partial<PlaceResult>): PlaceResult {
  return {
    placeId: "ChIJ-x",
    name: "店",
    address: null,
    lat: center.lat,
    lng: center.lng,
    primaryType: "restaurant",
    types: ["restaurant"],
    rating: null,
    businessStatus: "OPERATIONAL",
    ...overrides,
  };
}

beforeEach(() => {
  requireUser.mockReset();
  searchNearby.mockReset();
  geocodeAddress.mockReset();
  upsertRestaurants.mockReset();
  requireUser.mockResolvedValue(user);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("searchNearbyAction", () => {
  it("未登入時丟出 UnauthorizedError，不呼叫 Google", async () => {
    requireUser.mockRejectedValue(new UnauthorizedError());

    await expect(searchNearbyAction({ ...center, radius: 1000 })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it.each<{ input: unknown; label: string }>([
    { input: { ...center, radius: 750 }, label: "非法 radius" },
    { input: { lat: 91, lng: 0, radius: 1000 }, label: "lat 超出範圍" },
    { input: { lat: 0, lng: -181, radius: 1000 }, label: "lng 超出範圍" },
    { input: { lat: "25", lng: 121, radius: 1000 }, label: "型別錯誤" },
    { input: null, label: "null" },
  ])("$label 被拒絕且不呼叫 Google", async ({ input }) => {
    const result = await searchNearbyAction(input);

    expect(result).toEqual({ ok: false, message: "搜尋條件不正確" });
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it("成功路徑：呼叫 Places → upsert → 依距離排序並附上自家 id 與中文類型", async () => {
    const far = place({ placeId: "far", name: "遠", lat: center.lat + 0.01, primaryType: "cafe" });
    const near = place({
      placeId: "near",
      name: "近",
      lat: center.lat + 0.001,
      primaryType: "ramen_restaurant",
      rating: 4.5,
    });
    searchNearby.mockResolvedValue([far, near]);
    upsertRestaurants.mockResolvedValue([
      { id: "id-far", googlePlaceId: "far" },
      { id: "id-near", googlePlaceId: "near" },
    ]);

    const result = await searchNearbyAction({ ...center, radius: 2000 });

    expect(searchNearby).toHaveBeenCalledWith({ ...center, radius: 2000 });
    expect(upsertRestaurants).toHaveBeenCalledWith([far, near]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.center).toEqual(center);
    expect(result.data.radius).toBe(2000);
    expect(result.data.results.map((r) => r.id)).toEqual(["id-near", "id-far"]);
    expect(result.data.results[0]).toEqual({
      id: "id-near",
      name: "近",
      primaryType: "ramen_restaurant",
      typeLabel: "拉麵",
      distanceMeters: 111,
      rating: 4.5,
      businessStatus: "OPERATIONAL",
      lat: center.lat + 0.001,
      lng: center.lng,
    });
    expect(result.data.results[1]?.typeLabel).toBe("咖啡廳");
    expect(result.data.results[1]?.distanceMeters).toBeGreaterThan(1000);
  });

  it("空結果回傳空陣列", async () => {
    searchNearby.mockResolvedValue([]);
    upsertRestaurants.mockResolvedValue([]);

    await expect(searchNearbyAction({ ...center, radius: 500 })).resolves.toEqual({
      ok: true,
      data: { center, radius: 500, results: [] },
    });
  });

  it("Places 失敗時回固定訊息，不含技術細節", async () => {
    searchNearby.mockRejectedValue(new PlacesError());

    await expect(searchNearbyAction({ ...center, radius: 1000 })).resolves.toEqual({
      ok: false,
      message: "搜尋暫時無法使用，請稍後再試",
    });
    expect(upsertRestaurants).not.toHaveBeenCalled();
  });

  it("資料庫寫入失敗時也回固定訊息", async () => {
    searchNearby.mockResolvedValue([place({})]);
    upsertRestaurants.mockRejectedValue(new Error("connection refused at 10.0.0.1"));

    const result = await searchNearbyAction({ ...center, radius: 1000 });

    expect(result).toEqual({ ok: false, message: "搜尋暫時無法使用，請稍後再試" });
  });
});

describe("geocodeAction", () => {
  it("未登入時丟出 UnauthorizedError", async () => {
    requireUser.mockRejectedValue(new UnauthorizedError());

    await expect(geocodeAction({ query: "台北車站" })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(geocodeAddress).not.toHaveBeenCalled();
  });

  it("空白或過長的輸入被拒絕", async () => {
    await expect(geocodeAction({ query: "   " })).resolves.toEqual({
      ok: false,
      message: "搜尋條件不正確",
    });
    await expect(geocodeAction({ query: "x".repeat(101) })).resolves.toEqual({
      ok: false,
      message: "搜尋條件不正確",
    });
    expect(geocodeAddress).not.toHaveBeenCalled();
  });

  it("去除前後空白後查詢並回傳結果", async () => {
    const geocoded = { lat: 25.0478, lng: 121.517, formattedAddress: "台北市中正區北平西路3號" };
    geocodeAddress.mockResolvedValue(geocoded);

    await expect(geocodeAction({ query: "  台北車站 " })).resolves.toEqual({
      ok: true,
      data: geocoded,
    });
    expect(geocodeAddress).toHaveBeenCalledWith("台北車站");
  });

  it("找不到地點時 data 為 null", async () => {
    geocodeAddress.mockResolvedValue(null);

    await expect(geocodeAction({ query: "asdfgh" })).resolves.toEqual({ ok: true, data: null });
  });

  it("Geocoding 失敗時回固定訊息", async () => {
    geocodeAddress.mockRejectedValue(new GeocodingError());

    await expect(geocodeAction({ query: "台北" })).resolves.toEqual({
      ok: false,
      message: "地址解析暫時無法使用，請稍後再試",
    });
  });
});
