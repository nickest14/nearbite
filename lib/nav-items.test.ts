import { describe, expect, it } from "vitest";

import { isActivePath, isNavHidden, navItems } from "./nav-items";

describe("navItems", () => {
  it("有四個導覽項目", () => {
    expect(navItems).toHaveLength(4);
  });

  it("href 不重複", () => {
    const hrefs = navItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("每個項目都有標籤與圖示", () => {
    for (const item of navItems) {
      expect(item.label.trim()).not.toBe("");
      expect(item.icon).toBeTypeOf("object");
    }
  });
});

describe("isActivePath", () => {
  it("首頁只在路徑完全相同時 active", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/search", "/")).toBe(false);
  });

  it("其他項目連同子路徑一起 active", () => {
    expect(isActivePath("/lists", "/lists")).toBe(true);
    expect(isActivePath("/lists/abc", "/lists")).toBe(true);
    expect(isActivePath("/listsx", "/lists")).toBe(false);
    expect(isActivePath("/me", "/lists")).toBe(false);
  });
});

describe("isNavHidden", () => {
  it("登入頁不顯示導覽", () => {
    expect(isNavHidden("/login")).toBe(true);
  });

  it("一般頁面顯示導覽", () => {
    expect(isNavHidden("/")).toBe(false);
    expect(isNavHidden("/lists")).toBe(false);
    expect(isNavHidden("/foo")).toBe(false);
  });
});
