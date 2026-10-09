import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RestaurantSummary } from "@/app/actions/search";

import { RestaurantCard } from "./restaurant-card";

function summary(overrides: Partial<RestaurantSummary> = {}): RestaurantSummary {
  return {
    id: "r1",
    name: "好吃拉麵",
    primaryType: "ramen_restaurant",
    typeLabel: "拉麵",
    distanceMeters: 350,
    rating: 4.3,
    businessStatus: "OPERATIONAL",
    lat: 25.048,
    lng: 121.518,
    ...overrides,
  };
}

describe("RestaurantCard", () => {
  it("顯示店名、類型、距離與評分，並連到店家頁", () => {
    render(<RestaurantCard restaurant={summary()} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/restaurants/r1");
    expect(link).toHaveTextContent("好吃拉麵");
    expect(link).toHaveTextContent("拉麵");
    expect(link).toHaveTextContent("350 m");
    expect(screen.getByLabelText("Google 評分 4.3")).toHaveTextContent("4.3");
    expect(link).not.toHaveTextContent("已歇業");
  });

  it("1 公里以上以公里顯示", () => {
    render(<RestaurantCard restaurant={summary({ distanceMeters: 1240 })} />);

    expect(screen.getByRole("link")).toHaveTextContent("1.2 km");
  });

  it("沒有評分時顯示「尚無評分」", () => {
    render(<RestaurantCard restaurant={summary({ rating: null })} />);

    expect(screen.getByRole("link")).toHaveTextContent("尚無評分");
  });

  it("已歇業的店標示「已歇業」", () => {
    render(<RestaurantCard restaurant={summary({ businessStatus: "CLOSED_PERMANENTLY" })} />);

    expect(screen.getByRole("link")).toHaveTextContent("已歇業");
  });

  it("不載入任何圖片", () => {
    const { container } = render(<RestaurantCard restaurant={summary()} />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("選取時帶 aria-current", () => {
    render(<RestaurantCard restaurant={summary()} selected />);

    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "true");
  });
});
