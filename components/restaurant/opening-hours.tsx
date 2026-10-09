import { ChevronDown, Clock } from "lucide-react";

import {
  DAY_LABELS,
  formatClock,
  formatWeek,
  openingStatus,
  toLocalTime,
  type OpeningStatus,
  type RegularOpeningHours,
} from "@/lib/opening-hours";
import type { Freshness } from "@/lib/restaurant-sync";

import { UNAVAILABLE_MESSAGE } from "./freshness-notice";

type OpeningHoursProps = {
  hours: RegularOpeningHours | null;
  utcOffsetMinutes: number | null;
  businessStatus: string | null;
  freshness: Freshness;
  now: Date;
};

export const NO_HOURS_MESSAGE = "營業時間未提供";

// 狀態列的文案（design D8）
export function statusText(status: OpeningStatus, today: number): string {
  switch (status.kind) {
    case "always":
      return "24 小時營業";
    case "open":
      return `營業中 · ${formatClock(status.closesAt)} 打烊`;
    case "closed": {
      const dayPrefix = status.opensAt.day === today ? "" : `${DAY_LABELS[status.opensAt.day]} `;
      return `已打烊 · ${dayPrefix}${formatClock(status.opensAt)} 開門`;
    }
    case "unknown":
      return NO_HOURS_MESSAGE;
  }
}

// 狀態列 + 原生 <details> 展開整週；全部 Server Component，不需要 JS
export function OpeningHours({
  hours,
  utcOffsetMinutes,
  businessStatus,
  freshness,
  now,
}: OpeningHoursProps) {
  if (freshness === "unavailable") {
    return (
      <section aria-label="營業時間" className="text-sm text-text-muted">
        <Clock className="mr-2 inline size-4 align-text-bottom" aria-hidden="true" />
        {UNAVAILABLE_MESSAGE}
      </section>
    );
  }

  const today = toLocalTime(now, utcOffsetMinutes).day;
  const status = openingStatus(hours, utcOffsetMinutes, now);
  const closedForGood =
    businessStatus === "CLOSED_PERMANENTLY" || businessStatus === "CLOSED_TEMPORARILY";
  const week = formatWeek(hours, today);

  // 歇業的店不顯示「營業中」（header 已有標示），只保留整週表讓人參考
  const headline = closedForGood ? null : statusText(status, today);
  const isOpen = !closedForGood && (status.kind === "open" || status.kind === "always");

  if (week.length === 0) {
    return (
      <section aria-label="營業時間" className="text-sm text-text-muted">
        <Clock className="mr-2 inline size-4 align-text-bottom" aria-hidden="true" />
        {headline ?? NO_HOURS_MESSAGE}
      </section>
    );
  }

  return (
    <details className="group rounded-card border border-border bg-surface-elevated">
      <summary className="flex min-h-touch cursor-pointer list-none items-center gap-2 px-3 text-sm [&::-webkit-details-marker]:hidden">
        <Clock
          className={`size-4 shrink-0 ${isOpen ? "text-green-600" : "text-text-muted"}`}
          aria-hidden="true"
        />
        <span
          className={`flex-1 ${isOpen ? "font-medium text-green-700 dark:text-green-400" : ""}`}
        >
          {headline ?? "營業時間"}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="space-y-1 border-t border-border px-3 py-2 text-sm">
        {week.map((row) => (
          <li
            key={row.text}
            aria-current={row.isToday ? "date" : undefined}
            className={row.isToday ? "font-semibold" : "text-text-muted"}
          >
            {row.text}
          </li>
        ))}
      </ul>
    </details>
  );
}
