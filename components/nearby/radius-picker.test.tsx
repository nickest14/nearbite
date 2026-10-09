import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RadiusPicker, radiusLabel } from "./radius-picker";

describe("radiusLabel", () => {
  it("未滿 1 公里顯示公尺，否則顯示公里", () => {
    expect(radiusLabel(500)).toBe("500 m");
    expect(radiusLabel(1000)).toBe("1 km");
    expect(radiusLabel(2000)).toBe("2 km");
  });
});

describe("RadiusPicker", () => {
  it("渲染三個 chip，只有目前值帶 aria-pressed=true", () => {
    render(<RadiusPicker value={1000} onChange={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["500 m", "1 km", "2 km"]);
    expect(screen.getByRole("button", { name: "1 km" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "500 m" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "2 km" })).toHaveAttribute("aria-pressed", "false");
  });

  it("點選時以該範圍呼叫 onChange", () => {
    const onChange = vi.fn();
    render(<RadiusPicker value={1000} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "2 km" }));

    expect(onChange).toHaveBeenCalledWith(2000);
  });

  it("每個 chip 都有最小觸控高度", () => {
    render(<RadiusPicker value={500} onChange={vi.fn()} />);

    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toContain("min-h-touch");
    }
  });
});
