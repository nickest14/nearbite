// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GEOCODING_URL } from "./config";
import { geocodeAddress, GeocodingError } from "./geocoding";

const API_KEY = "server-secret-key";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const okBody = {
  status: "OK",
  results: [
    {
      formatted_address: "100台灣台北市中正區北平西路3號",
      geometry: { location: { lat: 25.0478, lng: 121.517 } },
    },
    {
      formatted_address: "第二筆不該被用到",
      geometry: { location: { lat: 0, lng: 0 } },
    },
  ],
};

describe("geocodeAddress", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("以 region=tw、language=zh-TW 查詢並取第一筆", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(okBody));

    const result = await geocodeAddress("台北車站", { fetch: fetchMock, apiKey: API_KEY });

    expect(result).toEqual({
      lat: 25.0478,
      lng: 121.517,
      formattedAddress: "100台灣台北市中正區北平西路3號",
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(GEOCODING_URL);
    expect(parsed.searchParams.get("address")).toBe("台北車站");
    expect(parsed.searchParams.get("region")).toBe("tw");
    expect(parsed.searchParams.get("language")).toBe("zh-TW");
    expect(parsed.searchParams.get("key")).toBe(API_KEY);
    expect(init?.method).toBe("GET");
  });

  it("ZERO_RESULTS 回 null 而不是丟錯", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ status: "ZERO_RESULTS", results: [] }));

    await expect(
      geocodeAddress("asdfghjkl", { fetch: fetchMock, apiKey: API_KEY }),
    ).resolves.toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("REQUEST_DENIED 丟出 GeocodingError，log 不含金鑰", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        status: "REQUEST_DENIED",
        results: [],
        error_message: `This API key is not authorized: ?address=x&key=${API_KEY}`,
      }),
    );

    await expect(geocodeAddress("台北", { fetch: fetchMock, apiKey: API_KEY })).rejects.toThrow(
      new GeocodingError(),
    );
    const logged = consoleError.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(API_KEY);
  });

  it("非 2xx 丟出 GeocodingError", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("Internal error", { status: 500 }));

    await expect(geocodeAddress("台北", { fetch: fetchMock, apiKey: API_KEY })).rejects.toThrow(
      new GeocodingError(),
    );
  });

  it("逾時丟出 GeocodingError", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const promise = geocodeAddress("台北", { fetch: fetchMock, apiKey: API_KEY });
    const assertion = expect(promise).rejects.toBeInstanceOf(GeocodingError);
    await vi.advanceTimersByTimeAsync(8_000);

    await assertion;
    const logged = consoleError.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(API_KEY);
  });

  it("錯誤訊息是固定中文", () => {
    expect(new GeocodingError().message).toBe("地址解析暫時無法使用，請稍後再試");
  });
});
