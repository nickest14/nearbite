import { describe, expect, it } from "vitest";

import { canSignIn, parseAllowlist } from "./allowlist";

describe("parseAllowlist", () => {
  it("以逗號切分並去除空白、轉小寫", () => {
    const list = parseAllowlist(" Friend@Example.com ,me@gmail.com");
    expect(list).toEqual(new Set(["friend@example.com", "me@gmail.com"]));
  });

  it("忽略空項目", () => {
    expect(parseAllowlist("a@x.com,, ,b@x.com,")).toEqual(new Set(["a@x.com", "b@x.com"]));
  });

  it("未設定或空字串回傳空集合", () => {
    expect(parseAllowlist(undefined).size).toBe(0);
    expect(parseAllowlist(null).size).toBe(0);
    expect(parseAllowlist("").size).toBe(0);
    expect(parseAllowlist("   ").size).toBe(0);
  });
});

describe("canSignIn", () => {
  const allowlist = parseAllowlist("friend@example.com");

  it("沒有 email 一律拒絕", () => {
    expect(canSignIn(undefined, { allowlist, isProduction: false })).toBe(false);
    expect(canSignIn("", { allowlist, isProduction: false })).toBe(false);
  });

  it("名單非空：在名單內才放行，且不分大小寫與空白", () => {
    expect(canSignIn("friend@example.com", { allowlist, isProduction: true })).toBe(true);
    expect(canSignIn(" Friend@Example.COM ", { allowlist, isProduction: true })).toBe(true);
    expect(canSignIn("stranger@example.com", { allowlist, isProduction: true })).toBe(false);
    expect(canSignIn("stranger@example.com", { allowlist, isProduction: false })).toBe(false);
  });

  it("名單為空 + 正式環境：拒絕所有人", () => {
    expect(canSignIn("anyone@example.com", { allowlist: new Set(), isProduction: true })).toBe(
      false,
    );
  });

  it("名單為空 + 開發環境：放行所有人", () => {
    expect(canSignIn("anyone@example.com", { allowlist: new Set(), isProduction: false })).toBe(
      true,
    );
  });
});
