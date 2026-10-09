import { Star } from "lucide-react";
import { createElement } from "react";

import { typeIcon, typeLabel } from "@/lib/place-types";

type DetailHeaderProps = {
  name: string;
  primaryType: string | null;
  types: string[];
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  businessStatus: string | null;
};

export function statusBadge(businessStatus: string | null): string | null {
  if (businessStatus === "CLOSED_PERMANENTLY") return "已歇業";
  if (businessStatus === "CLOSED_TEMPORARILY") return "暫停營業";
  return null;
}

// 價位用 $ 符號（design 的 open question：之後做篩選時再統一）；0 或 null 不顯示
export function priceLabel(priceLevel: number | null): string | null {
  if (!priceLevel || priceLevel < 1) return null;
  return "$".repeat(Math.min(priceLevel, 4));
}

// 店名、類型、評分、價位、歇業標示。沒有照片：用類型圖示（proposal 的決定）
export function DetailHeader({
  name,
  primaryType,
  types,
  rating,
  ratingCount,
  priceLevel,
  businessStatus,
}: DetailHeaderProps) {
  const badge = statusBadge(businessStatus);
  const price = priceLabel(priceLevel);

  return (
    <header className="flex items-start gap-3">
      <span
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
        aria-hidden="true"
      >
        {createElement(typeIcon(primaryType, types), { className: "size-7" })}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        {badge ? (
          <p className="mt-1 inline-block rounded-full bg-border px-2 py-0.5 text-xs font-medium text-text-muted">
            {badge}
          </p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
          <span>{typeLabel(primaryType, types)}</span>
          <span aria-hidden="true">·</span>
          {rating !== null ? (
            <span className="flex items-center gap-0.5">
              <Star className="size-3.5 fill-current text-accent" aria-hidden="true" />
              <span aria-label={`Google 評分 ${rating.toFixed(1)}，${ratingCount ?? 0} 則`}>
                {rating.toFixed(1)}
                {ratingCount !== null ? `（${ratingCount}）` : ""}
              </span>
            </span>
          ) : (
            <span>尚無評分</span>
          )}
          {price ? (
            <>
              <span aria-hidden="true">·</span>
              <span aria-label={`價位 ${price.length} 級`}>{price}</span>
            </>
          ) : null}
        </p>
      </div>
    </header>
  );
}
