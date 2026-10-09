import { Globe, Navigation, Phone } from "lucide-react";

import type { Freshness } from "@/lib/restaurant-sync";

import { UNAVAILABLE_MESSAGE } from "./freshness-notice";

type ActionLinksProps = {
  lat: number;
  lng: number;
  googlePlaceId: string;
  phone: string | null;
  website: string | null;
  freshness: Freshness;
};

// Google Maps URLs：免費、不需金鑰，手機上會開 Google 地圖 app。只帶店家座標與 place_id，不帶使用者位置
export function mapsUrl(lat: number, lng: number, googlePlaceId: string): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${lat},${lng}`);
  url.searchParams.set("query_place_id", googlePlaceId);
  return url.toString();
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[\s-]/g, "")}`;
}

export function websiteLabel(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
}

const linkClass =
  "flex min-h-touch items-center gap-3 rounded-lg border border-border bg-surface-elevated px-3 text-sm";

export function NavigateButton({
  lat,
  lng,
  googlePlaceId,
}: Pick<ActionLinksProps, "lat" | "lng" | "googlePlaceId">) {
  return (
    <a
      href={mapsUrl(lat, lng, googlePlaceId)}
      target="_blank"
      rel="noopener"
      className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-base font-semibold text-accent-foreground"
    >
      <Navigation className="size-5" aria-hidden="true" />在 Google 地圖開啟
    </a>
  );
}

// 電話與網站；缺的不渲染。詳情從未取得時顯示提示
export function ContactLinks({
  phone,
  website,
  freshness,
}: Pick<ActionLinksProps, "phone" | "website" | "freshness">) {
  if (freshness === "unavailable") {
    return (
      <section aria-label="聯絡方式" className="text-sm text-text-muted">
        {UNAVAILABLE_MESSAGE}
      </section>
    );
  }
  if (!phone && !website) return null;

  return (
    <section aria-label="聯絡方式" className="space-y-2">
      {phone ? (
        <a href={telHref(phone)} className={linkClass}>
          <Phone className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          <span>{phone}</span>
        </a>
      ) : null}
      {website ? (
        <a href={website} target="_blank" rel="noopener" className={linkClass}>
          <Globe className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          <span className="truncate">{websiteLabel(website)}</span>
        </a>
      ) : null}
    </section>
  );
}
