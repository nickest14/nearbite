import { MapPin } from "lucide-react";
import Link from "next/link";

import { parseOpeningHours } from "@/lib/opening-hours";
import type { RestaurantDetailView } from "@/lib/restaurant-sync";

import { ContactLinks, NavigateButton } from "./action-links";
import { DetailHeader } from "./detail-header";
import { FreshnessNotice } from "./freshness-notice";
import { OpeningHours } from "./opening-hours";

type RestaurantDetailProps = {
  restaurant: RestaurantDetailView;
  now: Date;
};

// 詳情頁版面（design D6）：由上到下 header → 營業狀態 → 導航 → 地址 → 聯絡 → 整週營業時間 → 回到搜尋。
// 評論與收藏之後插在導航按鈕下方，先預留位置。
export function RestaurantDetail({ restaurant, now }: RestaurantDetailProps) {
  return (
    <article className="space-y-5">
      <DetailHeader
        name={restaurant.name}
        primaryType={restaurant.primaryType}
        types={restaurant.types}
        rating={restaurant.googleRating}
        ratingCount={restaurant.googleRatingCount}
        priceLevel={restaurant.priceLevel}
        businessStatus={restaurant.businessStatus}
      />

      <FreshnessNotice freshness={restaurant.freshness} />

      <OpeningHours
        hours={parseOpeningHours(restaurant.openingHours)}
        utcOffsetMinutes={restaurant.utcOffsetMinutes}
        businessStatus={restaurant.businessStatus}
        freshness={restaurant.freshness}
        now={now}
      />

      <NavigateButton
        lat={restaurant.lat}
        lng={restaurant.lng}
        googlePlaceId={restaurant.googlePlaceId}
      />

      {/* 評論與收藏（第 5、6 個 change）會放在這裡 */}
      <section aria-hidden="true" className="hidden" data-slot="reviews-and-lists" />

      {restaurant.address ? (
        <p className="flex items-start gap-2 text-sm text-text-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{restaurant.address}</span>
        </p>
      ) : null}

      <ContactLinks
        phone={restaurant.phone}
        website={restaurant.website}
        freshness={restaurant.freshness}
      />

      <Link
        href="/"
        className="inline-flex min-h-touch items-center rounded-lg border border-border px-4 text-sm font-medium"
      >
        回到搜尋
      </Link>
    </article>
  );
}
