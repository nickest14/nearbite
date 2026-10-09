// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PLACE_DETAILS_FIELD_MASK, PLACE_DETAILS_URL } from "./config";
import { fetchPlaceDetails, PlaceDetailsError, PlaceNotFoundError } from "./place-details";

const API_KEY = "server-secret-key";
const PLACE_ID = "ChIJ-detail";

const fullResponse = {
  id: PLACE_ID,
  displayName: { text: "好吃拉麵", languageCode: "zh-TW" },
  formattedAddress: "台北市中正區北平西路3號",
  location: { latitude: 25.048, longitude: 121.518 },
  types: ["ramen_restaurant", "restaurant"],
  primaryType: "ramen_restaurant",
  rating: 4.3,
  businessStatus: "OPERATIONAL",
  userRatingCount: 128,
  priceLevel: "PRICE_LEVEL_MODERATE",
  regularOpeningHours: {
    openNow: true,
    periods: [
      { open: { day: 2, hour: 11, minute: 0 }, close: { day: 2, hour: 21, minute: 0 } },
      { open: { day: 0, hour: 0, minute: 0 } },
    ],
    weekdayDescriptions: ["星期一: 休息", "星期二: 11:00 – 21:00"],
  },
  nationalPhoneNumber: "02 2345 6789",
  websiteUri: "https://www.example.com/menu",
  utcOffsetMinutes: 480,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchPlaceDetails", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("以 GET 打 places/{id}，帶 languageCode、regionCode 與精確的 FieldMask", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fullResponse));

    await fetchPlaceDetails(PLACE_ID, { fetch: fetchMock, apiKey: API_KEY });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(`${PLACE_DETAILS_URL}/${PLACE_ID}`);
    expect(parsed.searchParams.get("languageCode")).toBe("zh-TW");
    expect(parsed.searchParams.get("regionCode")).toBe("TW");
    expect(parsed.searchParams.has("key")).toBe(false);
    expect(init?.method).toBe("GET");
    expect(init?.headers).toEqual({
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
    });
  });

  it("攤平完整回應：priceLevel 轉整數、營業時間原樣保留、openNow 不帶出", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fullResponse));

    const details = await fetchPlaceDetails(PLACE_ID, { fetch: fetchMock, apiKey: API_KEY });

    expect(details).toEqual({
      placeId: PLACE_ID,
      name: "好吃拉麵",
      address: "台北市中正區北平西路3號",
      lat: 25.048,
      lng: 121.518,
      primaryType: "ramen_restaurant",
      types: ["ramen_restaurant", "restaurant"],
      rating: 4.3,
      businessStatus: "OPERATIONAL",
      ratingCount: 128,
      priceLevel: 2,
      openingHours: {
        periods: [
          { open: { day: 2, hour: 11, minute: 0 }, close: { day: 2, hour: 21, minute: 0 } },
          { open: { day: 0, hour: 0, minute: 0 }, close: null },
        ],
        weekdayDescriptions: ["星期一: 休息", "星期二: 11:00 – 21:00"],
      },
      phone: "02 2345 6789",
      website: "https://www.example.com/menu",
      utcOffsetMinutes: 480,
    });
  });

  it("缺選填欄位時給 null", async () => {
    const minimal = {
      id: PLACE_ID,
      displayName: { text: "無名小店" },
      location: { latitude: 25, longitude: 121 },
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(minimal));

    const details = await fetchPlaceDetails(PLACE_ID, { fetch: fetchMock, apiKey: API_KEY });

    expect(details).toMatchObject({
      name: "無名小店",
      address: null,
      types: [],
      rating: null,
      ratingCount: null,
      priceLevel: null,
      openingHours: null,
      phone: null,
      website: null,
      utcOffsetMinutes: null,
    });
  });

  it("未知的 priceLevel 列舉值給 null", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ ...fullResponse, priceLevel: "PRICE_LEVEL_UNSPECIFIED" }));

    const details = await fetchPlaceDetails(PLACE_ID, { fetch: fetchMock, apiKey: API_KEY });

    expect(details.priceLevel).toBeNull();
  });

  it("404 丟 PlaceNotFoundError", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: { code: 404, message: "Not found" } }, 404));

    await expect(
      fetchPlaceDetails(PLACE_ID, { fetch: fetchMock, apiKey: API_KEY }),
    ).rejects.toBeInstanceOf(PlaceNotFoundError);
  });

  it.each([429, 500])("HTTP %i 丟 PlaceDetailsError，log 不含金鑰", async (status) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: { message: `denied ${API_KEY}` } }, status));

    await expect(
      fetchPlaceDetails(PLACE_ID, { fetch: fetchMock, apiKey: API_KEY }),
    ).rejects.toThrow(new PlaceDetailsError());
    const logged = consoleError.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(API_KEY);
  });

  it("逾時與非 JSON 回應都丟 PlaceDetailsError", async () => {
    vi.useFakeTimers();
    const hanging = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    const promise = fetchPlaceDetails(PLACE_ID, { fetch: hanging, apiKey: API_KEY });
    const assertion = expect(promise).rejects.toBeInstanceOf(PlaceDetailsError);
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
    vi.useRealTimers();

    const notJson = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));
    await expect(
      fetchPlaceDetails(PLACE_ID, { fetch: notJson, apiKey: API_KEY }),
    ).rejects.toBeInstanceOf(PlaceDetailsError);
  });

  it("錯誤訊息是固定中文", () => {
    expect(new PlaceDetailsError().message).toBe("詳細資訊暫時無法取得");
  });
});
