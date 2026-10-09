import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RegularOpeningHours } from "@/lib/opening-hours";

import { OpeningHours } from "./opening-hours";

const TAIPEI = 480;

// 2026-10-06 是週二；台灣當地時間
function taipei(dateTime: string): Date {
  return new Date(`${dateTime}+08:00`);
}

const weekdays: RegularOpeningHours = {
  periods: [1, 2, 3, 4, 5, 6].map((day) => ({
    open: { day, hour: 11, minute: 0 },
    close: { day, hour: 21, minute: 0 },
  })),
  weekdayDescriptions: [
    "星期一: 11:00 – 21:00",
    "星期二: 11:00 – 21:00",
    "星期三: 11:00 – 21:00",
    "星期四: 11:00 – 21:00",
    "星期五: 11:00 – 21:00",
    "星期六: 11:00 – 21:00",
    "星期日: 休息",
  ],
};

type Props = Parameters<typeof OpeningHours>[0];

function renderHours(overrides: Partial<Props> = {}) {
  const props: Props = {
    hours: weekdays,
    utcOffsetMinutes: TAIPEI,
    businessStatus: "OPERATIONAL",
    freshness: "fresh",
    now: taipei("2026-10-06T14:30:00"),
    ...overrides,
  };
  return render(<OpeningHours {...props} />);
}

describe("OpeningHours", () => {
  it("營業中：顯示打烊時間", () => {
    renderHours();

    expect(screen.getByText("營業中 · 21:00 打烊")).toBeInTheDocument();
  });

  it("已打烊：下一次開門在隔天時帶星期", () => {
    renderHours({ now: taipei("2026-10-06T22:00:00") });

    expect(screen.getByText("已打烊 · 週三 11:00 開門")).toBeInTheDocument();
  });

  it("已打烊：下一次開門在今天時不帶星期", () => {
    renderHours({ now: taipei("2026-10-06T09:00:00") });

    expect(screen.getByText("已打烊 · 11:00 開門")).toBeInTheDocument();
  });

  it("24 小時營業", () => {
    renderHours({
      hours: {
        periods: [{ open: { day: 0, hour: 0, minute: 0 } }],
        weekdayDescriptions: ["星期一: 24 小時營業"],
      },
    });

    expect(screen.getByText("24 小時營業")).toBeInTheDocument();
  });

  it("沒有營業時間資料時顯示「營業時間未提供」", () => {
    renderHours({ hours: null });

    expect(screen.getByText("營業時間未提供")).toBeInTheDocument();
    expect(screen.queryByText(/營業中/)).not.toBeInTheDocument();
  });

  it("詳情從未取得時顯示「詳細資訊暫時無法取得」", () => {
    renderHours({ freshness: "unavailable" });

    expect(screen.getByText("詳細資訊暫時無法取得")).toBeInTheDocument();
  });

  it("整週七行，今天那一列有標示", () => {
    renderHours();

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(7);
    expect(rows[1]).toHaveTextContent("星期二: 11:00 – 21:00");
    expect(rows[1]).toHaveAttribute("aria-current", "date");
    expect(rows.filter((row) => row.getAttribute("aria-current") === "date")).toHaveLength(1);
    expect(rows[6]).toHaveTextContent("星期日: 休息");
  });

  it("已歇業的店不顯示「營業中」，仍可看整週", () => {
    renderHours({ businessStatus: "CLOSED_PERMANENTLY" });

    expect(screen.queryByText(/營業中/)).not.toBeInTheDocument();
    expect(screen.getByText("營業時間")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});
