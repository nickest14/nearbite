import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn<() => string>() }));

vi.mock("next/navigation", () => ({ usePathname }));

import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  afterEach(() => {
    usePathname.mockReset();
  });

  it("渲染四個導覽連結", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/search",
      "/lists",
      "/me",
    ]);
  });

  it("在 /lists 時只有「收藏」帶 aria-current=page", () => {
    usePathname.mockReturnValue("/lists");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "收藏" })).toHaveAttribute("aria-current", "page");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
  });

  it("在子路徑 /lists/abc 時「收藏」仍然 active", () => {
    usePathname.mockReturnValue("/lists/abc");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "收藏" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "探索" })).not.toHaveAttribute("aria-current");
  });
});
