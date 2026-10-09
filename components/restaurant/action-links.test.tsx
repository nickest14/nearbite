import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContactLinks, mapsUrl, NavigateButton, telHref, websiteLabel } from "./action-links";

describe("mapsUrl / telHref / websiteLabel", () => {
  it("導航網址帶店家座標與 place_id", () => {
    const url = new URL(mapsUrl(25.0478, 121.517, "ChIJ-abc"));
    expect(`${url.origin}${url.pathname}`).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("25.0478,121.517");
    expect(url.searchParams.get("query_place_id")).toBe("ChIJ-abc");
    expect([...url.searchParams.keys()]).toEqual(["api", "query", "query_place_id"]);
  });

  it("電話去掉空白與連字號", () => {
    expect(telHref("02 2345-6789")).toBe("tel:0223456789");
  });

  it("網站只顯示網域並去掉 www.", () => {
    expect(websiteLabel("https://www.example.com/menu?x=1")).toBe("example.com");
    expect(websiteLabel("https://shop.example.tw")).toBe("shop.example.tw");
    expect(websiteLabel("not a url")).toBe("not a url");
  });
});

describe("NavigateButton", () => {
  it("在新分頁開啟 Google 地圖", () => {
    render(<NavigateButton lat={25.0478} lng={121.517} googlePlaceId="ChIJ-abc" />);

    const link = screen.getByRole("link", { name: /在 Google 地圖開啟/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("query_place_id=ChIJ-abc"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
    expect(link.className).toContain("min-h-touch");
  });
});

describe("ContactLinks", () => {
  it("有電話與網站時渲染兩個連結", () => {
    render(
      <ContactLinks
        phone="02 2345 6789"
        website="https://www.example.com/menu"
        freshness="fresh"
      />,
    );

    const phone = screen.getByRole("link", { name: "02 2345 6789" });
    expect(phone).toHaveAttribute("href", "tel:0223456789");
    const site = screen.getByRole("link", { name: "example.com" });
    expect(site).toHaveAttribute("href", "https://www.example.com/menu");
    expect(site).toHaveAttribute("target", "_blank");
    expect(site).toHaveAttribute("rel", "noopener");
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-touch");
    }
  });

  it("只有電話時不渲染網站", () => {
    render(<ContactLinks phone="02 2345 6789" website={null} freshness="fresh" />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("都沒有時不渲染區塊", () => {
    const { container } = render(<ContactLinks phone={null} website={null} freshness="fresh" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("詳情從未取得時顯示提示", () => {
    render(<ContactLinks phone={null} website={null} freshness="unavailable" />);

    expect(screen.getByText("詳細資訊暫時無法取得")).toBeInTheDocument();
  });
});
