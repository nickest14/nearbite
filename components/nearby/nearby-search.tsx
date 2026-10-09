"use client";

import { useState } from "react";

import { MapView } from "@/components/map/map-view";

import { LocationPrompt } from "./location-prompt";
import { RadiusPicker } from "./radius-picker";
import { ResultsList } from "./results-list";
import { useNearbySearch } from "./use-nearby-search";
import { ViewToggle } from "./view-toggle";

// 首頁的搜尋區塊：依 useNearbySearch 的 state 組合各元件（design D8）
export function NearbySearch() {
  const {
    state,
    showSearchHere,
    locateStart,
    located,
    locateFailed,
    showAddressForm,
    searchAddress,
    setRadius,
    setView,
    mapMoved,
    searchHere,
    retry,
  } = useNearbySearch();

  const hasSearched =
    state.status === "searching" || state.status === "success" || state.status === "error";
  const showMap = state.view === "map" && state.center !== null;

  // 地圖在第一次切到地圖檢視時才掛載（純用列表的人不載入 Maps JS），之後不再卸載
  // 「從 props 衍生 state」的寫法：在 render 中直接 setState，React 會立刻重跑這次 render，不需要 effect
  const [mapMounted, setMapMounted] = useState(false);
  if (showMap && !mapMounted) setMapMounted(true);

  return (
    <div className="space-y-4">
      <LocationPrompt
        status={state.status}
        centerLabel={state.centerLabel}
        locateFailure={state.locateFailure}
        showAddressForm={state.showAddressForm}
        addressStatus={state.addressStatus}
        addressError={state.addressError}
        onLocateStart={locateStart}
        onLocated={located}
        onLocateFailed={locateFailed}
        onShowAddressForm={showAddressForm}
        onSearchAddress={searchAddress}
      />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <RadiusPicker value={state.radius} onChange={setRadius} />
        </div>
        {hasSearched ? <ViewToggle value={state.view} onChange={setView} /> : null}
      </div>

      {hasSearched && !showMap ? (
        <ResultsList
          status={state.status}
          results={state.results}
          error={state.error}
          onRetry={retry}
        />
      ) : null}

      {mapMounted && state.center ? (
        <div className={showMap ? "" : "hidden"}>
          {state.status === "error" && state.error ? (
            <div
              role="alert"
              className="mb-3 flex items-center gap-3 rounded-card border border-border p-3"
            >
              <p className="flex-1 text-sm">{state.error}</p>
              <button
                type="button"
                onClick={retry}
                className="min-h-touch shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground"
              >
                重試
              </button>
            </div>
          ) : null}
          <MapView
            center={state.center}
            radius={state.radius}
            results={state.results}
            searching={state.status === "searching"}
            showSearchHere={showSearchHere}
            visible={showMap}
            onCameraChanged={mapMoved}
            onSearchHere={searchHere}
          />
        </div>
      ) : null}
    </div>
  );
}
