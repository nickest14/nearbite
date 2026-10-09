// 營業狀態的純函式（design D5）。輸入 Google regularOpeningHours 原樣結構與店家的 UTC 偏移，
// 用注入的「現在」計算，測試不依賴系統時間。

export type OpeningPoint = {
  day: number; // 0 = 週日 … 6 = 週六（Google 的定義，與 JS getDay 相同）
  hour: number;
  minute: number;
};

export type OpeningPeriod = {
  open: OpeningPoint;
  close?: OpeningPoint | null; // 24 小時營業時沒有 close
};

export type RegularOpeningHours = {
  periods: OpeningPeriod[];
  weekdayDescriptions: string[]; // 從週一開始的七行在地化文字
};

export type LocalTime = OpeningPoint;

export type OpeningStatus =
  | { kind: "unknown" }
  | { kind: "always" }
  | { kind: "open"; closesAt: LocalTime }
  | { kind: "closed"; opensAt: LocalTime };

// 台灣沒有日光節約時間，偏移固定；Google 沒給 utcOffsetMinutes 時以台灣為預設（proposal：使用者與店家都在台灣）
export const DEFAULT_UTC_OFFSET_MINUTES = 480;

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

function toWeekMinutes(point: OpeningPoint): number {
  return point.day * MINUTES_PER_DAY + point.hour * 60 + point.minute;
}

function fromWeekMinutes(weekMinutes: number): LocalTime {
  const normalized = ((weekMinutes % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
  const day = Math.floor(normalized / MINUTES_PER_DAY);
  const rest = normalized - day * MINUTES_PER_DAY;
  return { day, hour: Math.floor(rest / 60), minute: rest % 60 };
}

// 店家當地時間：UTC 加上偏移後，用 UTC 的 getter 讀出星期與時分（避免受執行環境的時區影響）
export function toLocalTime(now: Date, utcOffsetMinutes: number | null): LocalTime {
  const offset = utcOffsetMinutes ?? DEFAULT_UTC_OFFSET_MINUTES;
  const shifted = new Date(now.getTime() + offset * 60_000);
  return { day: shifted.getUTCDay(), hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

// 把每個 period 轉成一週內的分鐘區間 [start, end)；close 早於 open 代表跨午夜（或跨週日→週一）
function toIntervals(periods: OpeningPeriod[]): Array<{ start: number; end: number }> {
  const intervals: Array<{ start: number; end: number }> = [];
  for (const period of periods) {
    if (!period.close) continue;
    const start = toWeekMinutes(period.open);
    let end = toWeekMinutes(period.close);
    if (end <= start) end += MINUTES_PER_WEEK;
    intervals.push({ start, end });
  }
  return intervals.sort((a, b) => a.start - b.start);
}

function isAlwaysOpen(periods: OpeningPeriod[]): boolean {
  const [only] = periods;
  return (
    periods.length === 1 &&
    only !== undefined &&
    !only.close &&
    only.open.day === 0 &&
    only.open.hour === 0 &&
    only.open.minute === 0
  );
}

export function openingStatus(
  hours: RegularOpeningHours | null | undefined,
  utcOffsetMinutes: number | null,
  now: Date,
): OpeningStatus {
  if (!hours || hours.periods.length === 0) return { kind: "unknown" };
  if (isAlwaysOpen(hours.periods)) return { kind: "always" };

  const intervals = toIntervals(hours.periods);
  if (intervals.length === 0) return { kind: "unknown" };

  const t = toWeekMinutes(toLocalTime(now, utcOffsetMinutes));

  // 現在落在某個區間內？跨週的區間（end > 一週）也要用 t + 一週 比對
  for (const { start, end } of intervals) {
    if ((start <= t && t < end) || (start <= t + MINUTES_PER_WEEK && t + MINUTES_PER_WEEK < end)) {
      return { kind: "open", closesAt: fromWeekMinutes(end) };
    }
  }

  // 找下一次開門：本週剩下的第一個，沒有就繞回下週第一個
  const next = intervals.find(({ start }) => start > t) ?? intervals[0];
  if (!next) return { kind: "unknown" };
  return { kind: "closed", opensAt: fromWeekMinutes(next.start) };
}

// 資料庫的 Json 欄位讀回來是 unknown，顯示前先確認形狀；不符就當作沒有資料
export function parseOpeningHours(value: unknown): RegularOpeningHours | null {
  if (typeof value !== "object" || value === null) return null;
  const { periods, weekdayDescriptions } = value as Record<string, unknown>;
  if (!Array.isArray(periods) || !Array.isArray(weekdayDescriptions)) return null;
  const isPoint = (p: unknown): p is OpeningPoint =>
    typeof p === "object" &&
    p !== null &&
    typeof (p as OpeningPoint).day === "number" &&
    typeof (p as OpeningPoint).hour === "number" &&
    typeof (p as OpeningPoint).minute === "number";
  const parsedPeriods: OpeningPeriod[] = [];
  for (const period of periods) {
    if (typeof period !== "object" || period === null) return null;
    const { open, close } = period as Record<string, unknown>;
    if (!isPoint(open)) return null;
    if (close !== undefined && close !== null && !isPoint(close)) return null;
    parsedPeriods.push({ open, close: close ?? null });
  }
  if (!weekdayDescriptions.every((row) => typeof row === "string")) return null;
  return { periods: parsedPeriods, weekdayDescriptions };
}

export const DAY_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"] as const;

export function formatClock(time: LocalTime): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

export type WeekRow = {
  text: string;
  isToday: boolean;
};

// 整週列表直接用 Google 已在地化的 weekdayDescriptions（從週一開始），只負責標示今天
export function formatWeek(
  hours: RegularOpeningHours | null | undefined,
  todayIndex: number, // 0 = 週日 … 6 = 週六
): WeekRow[] {
  if (!hours || hours.weekdayDescriptions.length === 0) return [];
  const mondayBasedToday = (todayIndex + 6) % 7;
  return hours.weekdayDescriptions.map((text, index) => ({
    text,
    isToday: index === mondayBasedToday,
  }));
}
