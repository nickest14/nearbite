import { Coffee, Soup, Utensils } from "lucide-react";
import { describe, expect, it } from "vitest";

import { SEARCH_TYPES, typeIcon, typeLabel } from "./place-types";

describe("typeLabel", () => {
  it("primaryType 命中時直接使用", () => {
    expect(typeLabel("ramen_restaurant", ["restaurant", "food"])).toBe("拉麵");
    expect(typeLabel("cafe", [])).toBe("咖啡廳");
  });

  it("primaryType 查不到時依序 fallback 到 types", () => {
    expect(typeLabel("unknown_type", ["point_of_interest", "coffee_shop", "restaurant"])).toBe(
      "咖啡廳",
    );
    expect(typeLabel(null, ["bar"])).toBe("酒吧");
    expect(typeLabel(undefined, ["food", "restaurant"])).toBe("餐廳");
  });

  it("都查不到時回「餐飲」", () => {
    expect(typeLabel("unknown_type", ["point_of_interest", "establishment"])).toBe("餐飲");
    expect(typeLabel(null, [])).toBe("餐飲");
    expect(typeLabel(null)).toBe("餐飲");
  });

  it("實測常見的細分類型有對照", () => {
    expect(typeLabel("cake_shop")).toBe("蛋糕");
    expect(typeLabel("japanese_curry_restaurant")).toBe("日式咖哩");
    expect(typeLabel("yakiniku_restaurant")).toBe("燒肉");
  });

  it("七個搜尋類型都有對照", () => {
    for (const type of SEARCH_TYPES) {
      expect(typeLabel(type)).not.toBe("餐飲");
    }
  });
});

describe("typeIcon", () => {
  it("回傳對應圖示，未知類型回預設圖示", () => {
    expect(typeIcon("coffee_shop")).toBe(Coffee);
    expect(typeIcon("ramen_restaurant")).toBe(Soup);
    expect(typeIcon(null, ["coffee_shop"])).toBe(Coffee);
    expect(typeIcon("unknown_type", [])).toBe(Utensils);
  });
});
