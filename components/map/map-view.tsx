"use client";

import {
  AdvancedMarker,
  APIProvider,
  Map,
  Pin,
  useMap,
  type MapCameraChangedEvent,
} from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useRef, useState } from "react";

import type { RestaurantSummary } from "@/app/actions/search";
import { RestaurantCard } from "@/components/nearby/restaurant-card";
import type { LatLng } from "@/lib/geo";
import { browserApiKey, mapId } from "@/lib/google/config";

type MapViewProps = {
  center: LatLng;
  radius: number;
  results: RestaurantSummary[];
  searching: boolean;
  showSearchHere: boolean;
  visible: boolean;
  onCameraChanged: (center: LatLng) => void;
  onSearchHere: () => void;
};

// 拖曳後多久才回報中心：避免每個 frame 都計算距離
const CAMERA_DEBOUNCE_MS = 300;

// 地圖檢視（design D9）。掛載一次就不卸載（每次掛載算一次 Dynamic Maps 載入），
// 列表檢視時由父層用 CSS 隱藏；visible 轉為 true 時觸發 resize 讓地圖重新量尺寸。
export function MapView({
  center,
  radius,
  results,
  searching,
  showSearchHere,
  visible,
  onCameraChanged,
  onSearchHere,
}: MapViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cardRefs = useRef(new globalThis.Map<string, HTMLLIElement>());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCameraChanged = useCallback(
    (event: MapCameraChangedEvent) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      const next = event.detail.center;
      debounceTimer.current = setTimeout(() => {
        onCameraChanged({ lat: next.lat, lng: next.lng });
      }, CAMERA_DEBOUNCE_MS);
    },
    [onCameraChanged],
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // 點標記：把對應卡片捲到中間並高亮
  function selectRestaurant(id: string) {
    setSelectedId(id);
    cardRefs.current
      .get(id)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  if (!browserApiKey) {
    return (
      <p role="alert" className="rounded-card border border-border p-4 text-sm text-text-muted">
        尚未設定 NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY，無法顯示地圖。設定方式見 README。
      </p>
    );
  }

  return (
    <APIProvider apiKey={browserApiKey} language="zh-TW" region="TW">
      <div className="relative -mx-4 overflow-hidden lg:mx-0 lg:rounded-card">
        <Map
          mapId={mapId}
          defaultCenter={center}
          defaultZoom={15}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          onCameraChanged={handleCameraChanged}
          className="h-[55dvh] min-h-80 w-full"
        >
          <FitToSearchArea center={center} radius={radius} visible={visible} />
          <AdvancedMarker position={center} title="搜尋中心" zIndex={1}>
            <Pin background="#1c1917" borderColor="#1c1917" glyphColor="#fafaf9" scale={0.9} />
          </AdvancedMarker>
          {results.map((restaurant) => (
            <AdvancedMarker
              key={restaurant.id}
              position={{ lat: restaurant.lat, lng: restaurant.lng }}
              title={restaurant.name}
              zIndex={selectedId === restaurant.id ? 2 : 0}
              onClick={() => selectRestaurant(restaurant.id)}
            >
              <Pin
                background={selectedId === restaurant.id ? "#c2410c" : "#f97316"}
                borderColor="#9a3412"
                glyphColor="#ffffff"
                scale={selectedId === restaurant.id ? 1.3 : 1}
              />
            </AdvancedMarker>
          ))}
        </Map>

        {showSearchHere ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <button
              type="button"
              onClick={onSearchHere}
              disabled={searching}
              className="pointer-events-auto min-h-touch rounded-full bg-surface-elevated px-4 text-sm font-medium shadow-md disabled:opacity-60"
            >
              {searching ? "搜尋中…" : "在此區域搜尋"}
            </button>
          </div>
        ) : null}
      </div>

      {results.length > 0 ? (
        <ul
          aria-label="地圖上的結果"
          className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0"
        >
          {results.map((restaurant) => (
            <li
              key={restaurant.id}
              ref={(node) => {
                if (node) cardRefs.current.set(restaurant.id, node);
                else cardRefs.current.delete(restaurant.id);
              }}
              className="w-[80vw] max-w-xs shrink-0 snap-center"
            >
              <RestaurantCard restaurant={restaurant} selected={selectedId === restaurant.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-sm text-text-muted">
          {searching ? "搜尋中…" : "這附近沒找到吃的，試試擴大範圍"}
        </p>
      )}
    </APIProvider>
  );
}

type FitToSearchAreaProps = {
  center: LatLng;
  radius: number;
  visible: boolean;
};

// 初始視野涵蓋整個搜尋範圍；中心或範圍改變、或從隱藏變為顯示時重新套用
function FitToSearchArea({ center, radius, visible }: FitToSearchAreaProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !visible) return;
    // 隱藏期間容器是 0×0，顯示後要先讓地圖重新量尺寸
    google.maps.event.trigger(map, "resize");
    map.fitBounds(boundsAround(center, radius), 24);
  }, [map, center, radius, visible]);

  return null;
}

// 以中心與半徑算出外接矩形：1 度緯度 ≈ 111 km，經度再除以 cos(lat)
function boundsAround(center: LatLng, radiusMeters: number): google.maps.LatLngBoundsLiteral {
  const dLat = radiusMeters / 111_320;
  const dLng = radiusMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  return {
    north: center.lat + dLat,
    south: center.lat - dLat,
    east: center.lng + dLng,
    west: center.lng - dLng,
  };
}
