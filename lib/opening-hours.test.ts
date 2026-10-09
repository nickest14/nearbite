import { describe, expect, it } from "vitest";

import {
  formatWeek,
  openingStatus,
  toLocalTime,
  type OpeningPeriod,
  type RegularOpeningHours,
} from "./opening-hours";

const TAIPEI = 480;

// 建立「台灣當地時間」的 Date：2026-10-06 是週二
function taipei(dateTime: string): Date {
  return new Date(`${dateTime}+08:00`);
}

function period(
  openDay: number,
  open: string,
  closeDay: number | null,
  close?: string,
): OpeningPeriod {
  const [oh, om] = open.split(":").map(Number) as [number, number];
  if (closeDay === null || !close) return { open: { day: openDay, hour: oh, minute: om } };
  const [ch, cm] = close.split(":").map(Number) as [number, number];
  return {
    open: { day: openDay, hour: oh, minute: om },
    close: { day: closeDay, hour: ch, minute: cm },
  };
}

// 週一～週六 11:00–21:00，週日公休
const weekdays: RegularOpeningHours = {
  periods: [1, 2, 3, 4, 5, 6].map((day) => period(day, "11:00", day, "21:00")),
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

describe("toLocalTime", () => {
  it("用 UTC 偏移換算店家當地時間，不受執行環境時區影響", () => {
    expect(toLocalTime(new Date("2026-10-06T06:30:00Z"), TAIPEI)).toEqual({
      day: 2,
      hour: 14,
      minute: 30,
    });
    // 偏移缺省時以台灣計
    expect(toLocalTime(new Date("2026-10-06T16:30:00Z"), null)).toEqual({
      day: 3,
      hour: 0,
      minute: 30,
    });
  });
});

describe("openingStatus", () => {
  it("營業中：回傳今天的打烊時間", () => {
    expect(openingStatus(weekdays, TAIPEI, taipei("2026-10-06T14:30:00"))).toEqual({
      kind: "open",
      closesAt: { day: 2, hour: 21, minute: 0 },
    });
  });

  it("已打烊：回傳下一次開門（隔天）", () => {
    expect(openingStatus(weekdays, TAIPEI, taipei("2026-10-06T22:00:00"))).toEqual({
      kind: "closed",
      opensAt: { day: 3, hour: 11, minute: 0 },
    });
  });

  it("開門前：下一次開門是今天", () => {
    expect(openingStatus(weekdays, TAIPEI, taipei("2026-10-06T09:00:00"))).toEqual({
      kind: "closed",
      opensAt: { day: 2, hour: 11, minute: 0 },
    });
  });

  it("公休日：下一次開門是隔天", () => {
    // 2026-10-04 是週日
    expect(openingStatus(weekdays, TAIPEI, taipei("2026-10-04T12:00:00"))).toEqual({
      kind: "closed",
      opensAt: { day: 1, hour: 11, minute: 0 },
    });
  });

  it("週六打烊後繞回下週一開門（週日→週一邊界）", () => {
    // 2026-10-10 是週六
    expect(openingStatus(weekdays, TAIPEI, taipei("2026-10-10T23:00:00"))).toEqual({
      kind: "closed",
      opensAt: { day: 1, hour: 11, minute: 0 },
    });
  });

  it("跨午夜：週五 18:00 到週六 02:00，週六凌晨 01:00 仍營業中", () => {
    const lateNight: RegularOpeningHours = {
      periods: [period(5, "18:00", 6, "02:00")],
      weekdayDescriptions: [],
    };
    // 2026-10-10 是週六
    expect(openingStatus(lateNight, TAIPEI, taipei("2026-10-10T01:00:00"))).toEqual({
      kind: "open",
      closesAt: { day: 6, hour: 2, minute: 0 },
    });
    expect(openingStatus(lateNight, TAIPEI, taipei("2026-10-10T02:00:00"))).toEqual({
      kind: "closed",
      opensAt: { day: 5, hour: 18, minute: 0 },
    });
  });

  it("跨週：週六 22:00 到週日 03:00，週日凌晨營業中", () => {
    const wrap: RegularOpeningHours = {
      periods: [period(6, "22:00", 0, "03:00")],
      weekdayDescriptions: [],
    };
    // 2026-10-04 是週日
    expect(openingStatus(wrap, TAIPEI, taipei("2026-10-04T01:00:00"))).toEqual({
      kind: "open",
      closesAt: { day: 0, hour: 3, minute: 0 },
    });
  });

  it("多時段（午休）：休息時間算已打烊，下一次開門是下午", () => {
    const split: RegularOpeningHours = {
      periods: [period(2, "11:00", 2, "14:00"), period(2, "17:00", 2, "21:00")],
      weekdayDescriptions: [],
    };
    expect(openingStatus(split, TAIPEI, taipei("2026-10-06T15:00:00"))).toEqual({
      kind: "closed",
      opensAt: { day: 2, hour: 17, minute: 0 },
    });
    expect(openingStatus(split, TAIPEI, taipei("2026-10-06T12:00:00"))).toEqual({
      kind: "open",
      closesAt: { day: 2, hour: 14, minute: 0 },
    });
  });

  it("24 小時營業", () => {
    const always: RegularOpeningHours = {
      periods: [period(0, "00:00", null)],
      weekdayDescriptions: ["星期一: 24 小時營業"],
    };
    expect(openingStatus(always, TAIPEI, taipei("2026-10-06T03:00:00"))).toEqual({
      kind: "always",
    });
  });

  it("沒有資料時回 unknown", () => {
    expect(openingStatus(null, TAIPEI, taipei("2026-10-06T12:00:00"))).toEqual({
      kind: "unknown",
    });
    expect(
      openingStatus(
        { periods: [], weekdayDescriptions: [] },
        TAIPEI,
        taipei("2026-10-06T12:00:00"),
      ),
    ).toEqual({ kind: "unknown" });
  });

  it("utcOffsetMinutes 缺省時以台灣時間計算", () => {
    // UTC 06:30 = 台灣 14:30 週二 → 營業中
    expect(openingStatus(weekdays, null, new Date("2026-10-06T06:30:00Z"))).toMatchObject({
      kind: "open",
    });
  });
});

describe("formatWeek", () => {
  it("從週一開始的七行，依今天（JS 的 0=週日）標示", () => {
    const rows = formatWeek(weekdays, 2); // 週二
    expect(rows).toHaveLength(7);
    expect(rows[1]).toEqual({ text: "星期二: 11:00 – 21:00", isToday: true });
    expect(rows.filter((row) => row.isToday)).toHaveLength(1);
  });

  it("週日對應最後一行", () => {
    const rows = formatWeek(weekdays, 0);
    expect(rows[6]).toEqual({ text: "星期日: 休息", isToday: true });
  });

  it("沒有資料時回空陣列", () => {
    expect(formatWeek(null, 1)).toEqual([]);
  });
});
