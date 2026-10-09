"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { createElement } from "react";

import type { RestaurantSummary } from "@/app/actions/search";
import { formatDistance } from "@/lib/geo";
import { typeIcon } from "@/lib/place-types";

type RestaurantCardProps = {
  restaurant: RestaurantSummary;
  selected?: boolean;
};

function statusBadge(businessStatus: string | null): string | null {
  if (businessStatus === "CLOSED_PERMANENTLY") return "已歇業";
  if (businessStatus === "CLOSED_TEMPORARILY") return "暫停營業";
  return null;
}

// 單張結果卡片。用類型圖示取代照片（照片是 Enterprise 計費，見 design D10）。
export function RestaurantCard({ restaurant, selected = false }: RestaurantCardProps) {
  const badge = statusBadge(restaurant.businessStatus);

  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      aria-current={selected ? "true" : undefined}
      className={`flex min-h-touch items-center gap-3 rounded-card border bg-surface-elevated p-3 ${
        selected ? "border-accent ring-2 ring-accent/40" : "border-border"
      }`}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
        aria-hidden="true"
      >
        {/* 圖示依資料動態選擇，用 createElement 而不是 <Icon />：eslint 的 static-components 規則會把後者當成在 render 中建立元件 */}
        {createElement(typeIcon(restaurant.primaryType), { className: "size-5" })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{restaurant.name}</span>
          {badge ? (
            <span className="shrink-0 rounded-full bg-border px-2 py-0.5 text-xs text-text-muted">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-sm text-text-muted">
          <span>{restaurant.typeLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDistance(restaurant.distanceMeters)}</span>
          <span aria-hidden="true">·</span>
          {restaurant.rating !== null ? (
            <span className="flex items-center gap-0.5">
              <Star className="size-3.5 fill-current text-accent" aria-hidden="true" />
              <span aria-label={`Google 評分 ${restaurant.rating}`}>
                {restaurant.rating.toFixed(1)}
              </span>
            </span>
          ) : (
            <span>尚無評分</span>
          )}
        </span>
      </span>
    </Link>
  );
}
