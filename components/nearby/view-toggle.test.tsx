import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ViewToggle } from "./view-toggle";

describe("ViewToggle", () => {
  it("目前檢視帶 aria-pressed=true", () => {
    render(<ViewToggle value="map" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "地圖" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "列表" })).toHaveAttribute("aria-pressed", "false");
  });

  it("點選另一個檢視時呼叫 onChange", () => {
    const onChange = vi.fn();
    render(<ViewToggle value="list" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "地圖" }));

    expect(onChange).toHaveBeenCalledWith("map");
  });

  it("兩個按鈕都有最小觸控尺寸", () => {
    render(<ViewToggle value="list" onChange={vi.fn()} />);

    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toContain("min-h-touch");
      expect(button.className).toContain("min-w-touch");
    }
  });
});
