import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RestaurantSummary } from "@/app/actions/search";

import { EMPTY_RESULTS_MESSAGE, ResultsList } from "./results-list";

function summary(id: string, name: string): RestaurantSummary {
  return {
    id,
    name,
    primaryType: "restaurant",
    typeLabel: "餐廳",
    distanceMeters: 100,
    rating: null,
    businessStatus: "OPERATIONAL",
    lat: 25,
    lng: 121,
  };
}

describe("ResultsList", () => {
  it("第一次搜尋中顯示載入骨架與 aria-busy", () => {
    render(<ResultsList status="searching" results={[]} error={null} onRetry={vi.fn()} />);

    expect(screen.getByLabelText("搜尋結果")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("載入中")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("成功但沒有結果時顯示擴大範圍的提示", () => {
    render(<ResultsList status="success" results={[]} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText(EMPTY_RESULTS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByLabelText("載入中")).not.toBeInTheDocument();
  });

  it("有結果時依序渲染卡片，底部有 Google Maps 標示", () => {
    render(
      <ResultsList
        status="success"
        results={[summary("a", "近的店"), summary("b", "遠的店")]}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("近的店"),
      expect.stringContaining("遠的店"),
    ]);
    expect(screen.getByText("資料來源：Google Maps")).toBeInTheDocument();
  });

  it("失敗時顯示錯誤與重試按鈕，之前的結果維持顯示", () => {
    const onRetry = vi.fn();
    render(
      <ResultsList
        status="error"
        results={[summary("a", "還在的店")]}
        error="搜尋暫時無法使用，請稍後再試"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("搜尋暫時無法使用，請稍後再試");
    expect(screen.getByRole("link")).toHaveTextContent("還在的店");
    fireEvent.click(screen.getByRole("button", { name: "重試" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("重搜中保留舊結果、不顯示骨架", () => {
    render(
      <ResultsList
        status="searching"
        results={[summary("a", "舊結果")]}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("link")).toHaveTextContent("舊結果");
    expect(screen.queryByLabelText("載入中")).not.toBeInTheDocument();
    expect(screen.getByLabelText("搜尋結果")).toHaveAttribute("aria-busy", "true");
  });
});
