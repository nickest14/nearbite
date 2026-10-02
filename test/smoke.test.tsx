import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// 確認 Vitest + jsdom + Testing Library + jest-dom 整條鏈都接好
describe("測試環境", () => {
  it("能渲染 React 元件並使用 DOM matcher", () => {
    render(<h1>Nearbite</h1>);
    expect(screen.getByRole("heading", { name: "Nearbite" })).toBeInTheDocument();
  });
});
