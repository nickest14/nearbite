// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PLACES_FIELD_MASK, PLACES_SEARCH_NEARBY_URL, SEARCH_TYPES } from "./config";
import { PlacesError, searchNearby } from "./places";

const API_KEY = "server-secret-key";
const params = { lat: 25.0478, lng: 121.517, radius: 1000 };

const fullPlace = {
  id: "ChIJ-full",
  displayName: { text: "好吃拉麵", languageCode: "zh-TW" },
  formattedAddress: "台北市中正區北平西路3號",
  location: { latitude: 25.048, longitude: 121.518 },
  types: ["ramen_restaurant", "restaurant", "food"],
  primaryType: "ramen_restaurant",
  rating: 4.3,
  businessStatus: "OPERATIONAL",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("searchNearby", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("送出固定的 URL、header 與 body", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ places: [] }));

    await searchNearby(params, { fetch: fetchMock, apiKey: API_KEY });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(PLACES_SEARCH_NEARBY_URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": PLACES_FIELD_MASK,
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      includedTypes: [...SEARCH_TYPES],
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: { center: { latitude: 25.0478, longitude: 121.517 }, radius: 1000 },
      },
      languageCode: "zh-TW",
      regionCode: "TW",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("把 Google 的巢狀結構攤平成 PlaceResult", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ places: [fullPlace] }));

    const results = await searchNearby(params, { fetch: fetchMock, apiKey: API_KEY });

    expect(results).toEqual([
      {
        placeId: "ChIJ-full",
        name: "好吃拉麵",
        address: "台北市中正區北平西路3號",
        lat: 25.048,
        lng: 121.518,
        primaryType: "ramen_restaurant",
        types: ["ramen_restaurant", "restaurant", "food"],
        rating: 4.3,
        businessStatus: "OPERATIONAL",
      },
    ]);
  });

  it("缺少選填欄位時給 null，缺必要欄位的那筆略過", async () => {
    const minimal = {
      id: "ChIJ-min",
      displayName: { text: "無名小店" },
      location: { latitude: 25.0, longitude: 121.5 },
    };
    const broken = { id: "ChIJ-broken", displayName: { text: "沒座標" } };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ places: [minimal, broken, fullPlace] }));

    const results = await searchNearby(params, { fetch: fetchMock, apiKey: API_KEY });

    expect(results.map((place) => place.placeId)).toEqual(["ChIJ-min", "ChIJ-full"]);
    expect(results[0]).toEqual({
      placeId: "ChIJ-min",
      name: "無名小店",
      address: null,
      lat: 25.0,
      lng: 121.5,
      primaryType: null,
      types: [],
      rating: null,
      businessStatus: null,
    });
  });

  it("空結果（Google 回 {}）時回傳空陣列", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}));

    await expect(searchNearby(params, { fetch: fetchMock, apiKey: API_KEY })).resolves.toEqual([]);
  });

  it.each([429, 500])("HTTP %i 丟出固定訊息的 PlacesError，log 不含金鑰", async (status) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: { message: `denied for key ${API_KEY}` } }, status));

    await expect(searchNearby(params, { fetch: fetchMock, apiKey: API_KEY })).rejects.toThrow(
      new PlacesError(),
    );
    expect(consoleError).toHaveBeenCalled();
    const logged = consoleError.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(API_KEY);
    expect(logged).toContain("[REDACTED]");
  });

  it("逾時（AbortError）丟出 PlacesError", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const promise = searchNearby(params, { fetch: fetchMock, apiKey: API_KEY });
    const assertion = expect(promise).rejects.toBeInstanceOf(PlacesError);
    await vi.advanceTimersByTimeAsync(8_000);

    await assertion;
    expect(consoleError).toHaveBeenCalled();
  });

  it("回應不是 JSON 或形狀不符時丟出 PlacesError", async () => {
    const notJson = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));
    await expect(searchNearby(params, { fetch: notJson, apiKey: API_KEY })).rejects.toThrow(
      new PlacesError(),
    );

    const wrongShape = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ places: "not-an-array" }));
    await expect(searchNearby(params, { fetch: wrongShape, apiKey: API_KEY })).rejects.toThrow(
      new PlacesError(),
    );
  });

  it("錯誤訊息是固定中文，不含技術細節", () => {
    expect(new PlacesError().message).toBe("搜尋暫時無法使用，請稍後再試");
  });
});
