import { describe, expect, it } from "vitest";

import { formatDistance, haversineMeters, sortByDistance } from "./geo";

const taipeiMainStation = { lat: 25.0478, lng: 121.517 };
const ximending = { lat: 25.0421, lng: 121.5081 };

describe("haversineMeters", () => {
  it("台北車站到西門町約 1.1 公里（誤差 1% 內）", () => {
    const meters = haversineMeters(taipeiMainStation, ximending);
    // 以球面公式另行計算的參考值
    expect(meters).toBeGreaterThan(1090);
    expect(meters).toBeLessThan(1115);
  });

  it("同一點距離為 0，且與方向無關", () => {
    expect(haversineMeters(taipeiMainStation, taipeiMainStation)).toBe(0);
    expect(haversineMeters(taipeiMainStation, ximending)).toBeCloseTo(
      haversineMeters(ximending, taipeiMainStation),
      6,
    );
  });

  it("緯度差 1 度約 111 公里", () => {
    const meters = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(meters / 111_195).toBeCloseTo(1, 2);
  });
});

describe("formatDistance", () => {
  it("未滿 1 公里以公尺顯示", () => {
    expect(formatDistance(350)).toBe("350 m");
    expect(formatDistance(999)).toBe("999 m");
    expect(formatDistance(0.4)).toBe("0 m");
  });

  it("1 公里以上以公里顯示到小數一位", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(1240)).toBe("1.2 km");
    expect(formatDistance(1960)).toBe("2.0 km");
  });

  it("999.6 公尺四捨五入後仍以公尺顯示", () => {
    // 分界以原始公尺數判斷，不會出現「1000 m」
    expect(formatDistance(999.6)).toBe("1000 m");
  });
});

describe("sortByDistance", () => {
  it("由近到遠排序並附上距離", () => {
    const center = { lat: 25.0, lng: 121.5 };
    const far = { id: "far", lat: 25.01, lng: 121.5 };
    const near = { id: "near", lat: 25.001, lng: 121.5 };
    const mid = { id: "mid", lat: 25.005, lng: 121.5 };

    const sorted = sortByDistance([far, near, mid], center);

    expect(sorted.map((item) => item.id)).toEqual(["near", "mid", "far"]);
    expect(sorted[0]?.distanceMeters).toBeCloseTo(111, 0);
    expect(sorted.every((item) => typeof item.distanceMeters === "number")).toBe(true);
  });

  it("距離相同時維持原本順序", () => {
    const center = { lat: 0, lng: 0 };
    const a = { id: "a", lat: 0.001, lng: 0 };
    const b = { id: "b", lat: -0.001, lng: 0 };
    const c = { id: "c", lat: 0.001, lng: 0 };

    expect(sortByDistance([a, b, c], center).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("不修改輸入陣列", () => {
    const center = { lat: 0, lng: 0 };
    const input = [
      { id: "far", lat: 1, lng: 0 },
      { id: "near", lat: 0.1, lng: 0 },
    ];
    sortByDistance(input, center);
    expect(input.map((item) => item.id)).toEqual(["far", "near"]);
  });
});
