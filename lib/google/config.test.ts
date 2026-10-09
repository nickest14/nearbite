// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { getServerApiKey, PLACES_FIELD_MASK, redactApiKey, SEARCH_TYPES } from "./config";

describe("getServerApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("缺金鑰時丟出指名變數的錯誤", () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "");
    expect(() => getServerApiKey()).toThrow("GOOGLE_MAPS_SERVER_API_KEY 未設定");
  });

  it("有金鑰時原樣回傳", () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "server-key");
    expect(getServerApiKey()).toBe("server-key");
  });
});

describe("PLACES_FIELD_MASK", () => {
  it("不含任何 Enterprise 欄位", () => {
    const enterpriseFields = [
      "currentOpeningHours",
      "regularOpeningHours",
      "priceLevel",
      "userRatingCount",
      "nationalPhoneNumber",
      "internationalPhoneNumber",
      "websiteUri",
      "reviews",
      "photos",
    ];
    for (const field of enterpriseFields) {
      expect(PLACES_FIELD_MASK).not.toContain(field);
    }
  });

  it("包含卡片需要的 Pro 欄位", () => {
    expect(PLACES_FIELD_MASK.split(",")).toEqual([
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.location",
      "places.types",
      "places.primaryType",
      "places.rating",
      "places.businessStatus",
    ]);
  });
});

describe("SEARCH_TYPES", () => {
  it("是七個 Food and Drink 類型", () => {
    expect(SEARCH_TYPES).toHaveLength(7);
    expect(SEARCH_TYPES).toContain("restaurant");
    expect(SEARCH_TYPES).toContain("bar");
  });
});

describe("redactApiKey", () => {
  it("清掉網址中的 key= 參數值", () => {
    expect(redactApiKey("https://x/geocode/json?address=a&key=SECRET123&region=tw")).toBe(
      "https://x/geocode/json?address=a&key=[REDACTED]&region=tw",
    );
  });

  it("清掉 X-Goog-Api-Key header 的值", () => {
    expect(redactApiKey('{"X-Goog-Api-Key":"SECRET123"}')).toBe('{"X-Goog-Api-Key":"[REDACTED]"}');
    expect(redactApiKey("X-Goog-Api-Key: SECRET123")).toBe("X-Goog-Api-Key: [REDACTED]");
  });

  it("給定金鑰時無論出現在哪裡都清掉", () => {
    expect(redactApiKey("failed with SECRET123 somewhere", "SECRET123")).toBe(
      "failed with [REDACTED] somewhere",
    );
  });
});
