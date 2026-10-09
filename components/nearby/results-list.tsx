"use client";

import type { RestaurantSummary } from "@/app/actions/search";

import { RestaurantCard } from "./restaurant-card";
import type { SearchStatus } from "./use-nearby-search";

type ResultsListProps = {
  status: SearchStatus;
  results: RestaurantSummary[];
  error: string | null;
  onRetry: () => void;
};

export const EMPTY_RESULTS_MESSAGE = "這附近沒找到吃的，試試擴大範圍";

// 列表檢視：載入骨架、空結果、錯誤＋重試、卡片列表，底部固定 Google Maps 資料來源標示（design D11）
export function ResultsList({ status, results, error, onRetry }: ResultsListProps) {
  const loading = status === "searching";
  const showSkeleton = loading && results.length === 0;
  const showEmpty = status === "success" && results.length === 0;

  return (
    <section aria-label="搜尋結果" aria-busy={loading} className="space-y-3">
      {status === "error" && error ? (
        <div role="alert" className="flex items-center gap-3 rounded-card border border-border p-3">
          <p className="flex-1 text-sm">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-touch shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground"
          >
            重試
          </button>
        </div>
      ) : null}

      {showSkeleton ? (
        <ul className="space-y-3" aria-label="載入中">
          {[0, 1, 2].map((index) => (
            <li
              key={index}
              className="flex animate-pulse items-center gap-3 rounded-card border border-border bg-surface-elevated p-3"
            >
              <span className="size-11 shrink-0 rounded-full bg-border" />
              <span className="flex-1 space-y-2">
                <span className="block h-4 w-2/3 rounded bg-border" />
                <span className="block h-3 w-1/2 rounded bg-border" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {showEmpty ? (
        <p className="py-6 text-center text-sm text-text-muted">{EMPTY_RESULTS_MESSAGE}</p>
      ) : null}

      {results.length > 0 ? (
        <ol className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
          {results.map((restaurant) => (
            <li key={restaurant.id}>
              <RestaurantCard restaurant={restaurant} />
            </li>
          ))}
        </ol>
      ) : null}

      <AttributionFooter />
    </section>
  );
}

// Places 政策：沒有 Google 地圖的畫面上顯示 Places 資料必須標示 Google Maps；空間不足可用文字
export function AttributionFooter() {
  return <p className="pt-2 text-center text-xs text-text-muted">資料來源：Google Maps</p>;
}
