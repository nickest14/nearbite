import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("有圖片時顯示圖片並以名稱作為替代文字", () => {
    render(<Avatar name="Nick" image="https://lh3.googleusercontent.com/a/photo" />);

    const img = screen.getByRole("img", { name: "Nick" });
    expect(img.tagName).toBe("IMG");
  });

  it("沒有圖片時顯示名稱首字", () => {
    render(<Avatar name="Nick" image={null} />);

    const fallback = screen.getByRole("img", { name: "Nick" });
    expect(fallback.tagName).toBe("DIV");
    expect(fallback).toHaveTextContent("N");
  });

  it("中文名稱取第一個字", () => {
    render(<Avatar name="郭小明" image={null} />);

    expect(screen.getByRole("img", { name: "郭小明" })).toHaveTextContent("郭");
  });

  it("沒有名稱時用預設文字", () => {
    render(<Avatar name={null} image={null} />);

    expect(screen.getByRole("img", { name: "使用者" })).toHaveTextContent("使");
  });
});
