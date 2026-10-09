import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailHeader, priceLabel, statusBadge } from "./detail-header";

type Props = Parameters<typeof DetailHeader>[0];

function renderHeader(overrides: Partial<Props> = {}) {
  const props: Props = {
    name: "好吃拉麵",
    primaryType: "ramen_restaurant",
    types: ["ramen_restaurant", "restaurant"],
    rating: 4.3,
    ratingCount: 128,
    priceLevel: 2,
    businessStatus: "OPERATIONAL",
    ...overrides,
  };
  return render(<DetailHeader {...props} />);
}

describe("priceLabel", () => {
  it("1–4 轉成 $ 符號，0 與 null 不顯示", () => {
    expect(priceLabel(1)).toBe("$");
    expect(priceLabel(4)).toBe("$$$$");
    expect(priceLabel(0)).toBeNull();
    expect(priceLabel(null)).toBeNull();
  });
});

describe("statusBadge", () => {
  it("只有非營業中的狀態有標示", () => {
    expect(statusBadge("OPERATIONAL")).toBeNull();
    expect(statusBadge(null)).toBeNull();
    expect(statusBadge("CLOSED_PERMANENTLY")).toBe("已歇業");
    expect(statusBadge("CLOSED_TEMPORARILY")).toBe("暫停營業");
  });
});

describe("DetailHeader", () => {
  it("顯示店名、類型、評分（評論數）與價位", () => {
    const { container } = renderHeader();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("好吃拉麵");
    expect(container).toHaveTextContent("拉麵");
    expect(container).toHaveTextContent("4.3（128）");
    expect(container).toHaveTextContent("$$");
    expect(container).not.toHaveTextContent("已歇業");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("沒有評分時顯示「尚無評分」", () => {
    const { container } = renderHeader({ rating: null, ratingCount: null });

    expect(container).toHaveTextContent("尚無評分");
  });

  it("價位為 null 或 0 時不顯示 $", () => {
    expect(renderHeader({ priceLevel: null }).container).not.toHaveTextContent("$");
    expect(renderHeader({ priceLevel: 0 }).container).not.toHaveTextContent("$");
  });

  it("已歇業的店顯示標示", () => {
    const { container } = renderHeader({ businessStatus: "CLOSED_PERMANENTLY" });

    expect(container).toHaveTextContent("已歇業");
  });
});
