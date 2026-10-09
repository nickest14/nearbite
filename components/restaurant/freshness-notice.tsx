import type { Freshness } from "@/lib/restaurant-sync";

export const STALE_MESSAGE = "資料可能不是最新";
export const UNAVAILABLE_MESSAGE = "詳細資訊暫時無法取得";

// 超過 30 天且重抓失敗時的提示（design D8）。unavailable 由各區塊自己顯示，這裡不重複
export function FreshnessNotice({ freshness }: { freshness: Freshness }) {
  if (freshness !== "stale") return null;
  return (
    <p role="status" className="text-sm text-text-muted">
      {STALE_MESSAGE}
    </p>
  );
}
