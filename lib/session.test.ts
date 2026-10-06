// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const { auth, redirect } = vi.hoisted(() => ({
  auth: vi.fn(),
  // 真實的 next/navigation redirect 會 throw 來中斷渲染，mock 也要 throw 才能驗證後續程式不會執行
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("next/navigation", () => ({ redirect }));

import { loginPath, requireUser, safeReturnTo, UnauthorizedError } from "./session";

describe("safeReturnTo", () => {
  it("接受站內相對路徑", () => {
    expect(safeReturnTo("/lists")).toBe("/lists");
    expect(safeReturnTo("/lists/abc?x=1")).toBe("/lists/abc?x=1");
    expect(safeReturnTo("/")).toBe("/");
  });

  it("拒絕外部網址與偽裝成相對路徑的網址", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
    expect(safeReturnTo("lists")).toBe("/");
    expect(safeReturnTo("/lists\r\nSet-Cookie: x")).toBe("/");
  });

  it("空值回首頁", () => {
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
    expect(safeReturnTo("")).toBe("/");
  });
});

describe("loginPath", () => {
  it("回首頁時不帶 callbackUrl", () => {
    expect(loginPath("/")).toBe("/login");
    expect(loginPath(undefined)).toBe("/login");
  });

  it("其他路徑經 URL 編碼後帶在 callbackUrl", () => {
    expect(loginPath("/lists")).toBe("/login?callbackUrl=%2Flists");
    expect(loginPath("https://evil.example")).toBe("/login");
  });
});

describe("requireUser", () => {
  afterEach(() => {
    auth.mockReset();
    redirect.mockClear();
  });

  it("有 session 時回傳使用者", async () => {
    auth.mockResolvedValue({
      user: { id: "u1", email: "me@example.com", name: "Nick", image: null },
      expires: "2099-01-01T00:00:00.000Z",
    });

    await expect(requireUser({ returnTo: "/lists" })).resolves.toEqual({
      id: "u1",
      email: "me@example.com",
      name: "Nick",
      image: null,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("沒有 session 且有 returnTo 時導向登入頁並帶回跳路徑", async () => {
    auth.mockResolvedValue(null);

    await expect(requireUser({ returnTo: "/lists" })).rejects.toThrow(
      "NEXT_REDIRECT:/login?callbackUrl=%2Flists",
    );
    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=%2Flists");
  });

  it("沒有 session 且沒有 returnTo 時丟出 UnauthorizedError", async () => {
    auth.mockResolvedValue(null);

    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("session 缺少 id 或 email 視為未登入", async () => {
    auth.mockResolvedValue({ user: { name: "匿名" }, expires: "2099-01-01T00:00:00.000Z" });

    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
