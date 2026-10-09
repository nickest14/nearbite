"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import { geocodeAction, searchNearbyAction, type RestaurantSummary } from "@/app/actions/search";
import { haversineMeters, type LatLng } from "@/lib/geo";
import {
  DEFAULT_SEARCH_RADIUS,
  SEARCH_RADIUS_OPTIONS,
  type SearchRadius,
} from "@/lib/google/config";

// 附近搜尋的狀態中樞（design D1）：所有元件只讀 state、呼叫這裡提供的函式，不各自打 Server Action。
// 座標只放在 client state 與 sessionStorage（分頁關閉即清除），不進網址。

export type View = "list" | "map";
export type SearchStatus = "idle" | "locating" | "searching" | "success" | "error";
export type LocateFailure = "denied" | "timeout" | "unavailable" | "unsupported";
export type AddressStatus = "idle" | "submitting" | "not-found" | "error";

export type NearbySearchState = {
  center: LatLng | null;
  centerLabel: string | null;
  radius: SearchRadius;
  view: View;
  status: SearchStatus;
  results: RestaurantSummary[];
  error: string | null;
  locateFailure: LocateFailure | null;
  showAddressForm: boolean;
  addressStatus: AddressStatus;
  addressError: string | null;
  // 地圖目前的中心；與 center 偏離超過門檻時顯示「在此區域搜尋」
  mapCenter: LatLng | null;
  // sessionStorage 已讀取（避免在還原之前就把初始狀態寫回去蓋掉）
  restored: boolean;
};

export type NearbySearchAction =
  | { type: "locate" }
  | { type: "located"; center: LatLng }
  | { type: "locateFailed"; reason: LocateFailure }
  | { type: "showAddressForm" }
  | { type: "geocodeStarted" }
  | { type: "geocodeNotFound" }
  | { type: "geocodeFailed"; message: string }
  | { type: "geocoded"; center: LatLng; label: string }
  | { type: "setRadius"; radius: SearchRadius }
  | { type: "setView"; view: View }
  | { type: "searchStarted" }
  | { type: "searchSucceeded"; results: RestaurantSummary[] }
  | { type: "searchFailed"; message: string }
  | { type: "mapMoved"; center: LatLng }
  | { type: "searchHere" }
  | { type: "restored"; snapshot: Snapshot | null };

// 寫進 sessionStorage 的部分：只有搜尋條件，結果每次重新整理都重搜一次
type Snapshot = {
  center: LatLng;
  centerLabel: string;
  radius: SearchRadius;
  view: View;
};

export const STORAGE_KEY = "nearbite.nearby-search.v1";
export const CURRENT_LOCATION_LABEL = "目前位置";
export const MAP_LOCATION_LABEL = "地圖上的位置";
// 地圖中心偏離搜尋中心超過這個距離才顯示「在此區域搜尋」
export const SEARCH_HERE_THRESHOLD_METERS = 100;
const NETWORK_FAILED_MESSAGE = "搜尋暫時無法使用，請稍後再試";

export const initialState: NearbySearchState = {
  center: null,
  centerLabel: null,
  radius: DEFAULT_SEARCH_RADIUS,
  view: "list",
  status: "idle",
  results: [],
  error: null,
  locateFailure: null,
  showAddressForm: false,
  addressStatus: "idle",
  addressError: null,
  mapCenter: null,
  restored: false,
};

export function reducer(state: NearbySearchState, action: NearbySearchAction): NearbySearchState {
  switch (action.type) {
    case "locate":
      return { ...state, status: "locating", locateFailure: null, error: null };
    case "located":
      return {
        ...state,
        center: action.center,
        centerLabel: CURRENT_LOCATION_LABEL,
        mapCenter: action.center,
        locateFailure: null,
        showAddressForm: false,
      };
    case "locateFailed":
      return {
        ...state,
        // 已經有結果的話維持顯示，不要因為重新定位失敗就把列表清掉
        status: state.results.length > 0 ? "success" : "idle",
        locateFailure: action.reason,
        showAddressForm: true,
      };
    case "showAddressForm":
      return { ...state, showAddressForm: true };
    case "geocodeStarted":
      return { ...state, addressStatus: "submitting", addressError: null };
    case "geocodeNotFound":
      return { ...state, addressStatus: "not-found" };
    case "geocodeFailed":
      return { ...state, addressStatus: "error", addressError: action.message };
    case "geocoded":
      return {
        ...state,
        center: action.center,
        centerLabel: action.label,
        mapCenter: action.center,
        addressStatus: "idle",
        addressError: null,
        locateFailure: null,
        showAddressForm: false,
      };
    case "setRadius":
      return { ...state, radius: action.radius };
    case "setView":
      return { ...state, view: action.view };
    case "searchStarted":
      return { ...state, status: "searching", error: null };
    case "searchSucceeded":
      return { ...state, status: "success", results: action.results, error: null };
    case "searchFailed":
      // 之前的結果（若有）維持顯示
      return { ...state, status: "error", error: action.message };
    case "mapMoved":
      return { ...state, mapCenter: action.center };
    case "searchHere":
      if (!state.mapCenter) return state;
      return { ...state, center: state.mapCenter, centerLabel: MAP_LOCATION_LABEL };
    case "restored":
      if (!action.snapshot) return { ...state, restored: true };
      return {
        ...state,
        restored: true,
        center: action.snapshot.center,
        centerLabel: action.snapshot.centerLabel,
        mapCenter: action.snapshot.center,
        radius: action.snapshot.radius,
        view: action.snapshot.view,
      };
  }
}

function isLatLng(value: unknown): value is LatLng {
  if (typeof value !== "object" || value === null) return false;
  const { lat, lng } = value as Record<string, unknown>;
  return typeof lat === "number" && typeof lng === "number";
}

function isSearchRadius(value: unknown): value is SearchRadius {
  return (SEARCH_RADIUS_OPTIONS as readonly number[]).includes(value as number);
}

// sessionStorage 在無痕模式或被停用時會丟例外，讀寫都包起來，失敗就當作沒有記憶
function readSnapshot(): Snapshot | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { center, centerLabel, radius, view } = parsed as Record<string, unknown>;
    if (!isLatLng(center) || typeof centerLabel !== "string" || !isSearchRadius(radius)) {
      return null;
    }
    return { center, centerLabel, radius, view: view === "map" ? "map" : "list" };
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: Snapshot | null): void {
  try {
    if (snapshot) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // 無法寫入就不記憶，功能照常
  }
}

export function useNearbySearch() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // callback 需要讀到最新的 state（例如 setRadius 時的 center），用 ref 鏡射避免閉包過期。
  // 在 effect 裡更新而不是 render 中：事件處理都在 commit 之後才會跑，讀到的一定是最新值
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 每次搜尋遞增；回應回來時若編號已過期就丟掉，避免快速切換範圍時舊結果蓋掉新結果
  const requestSeq = useRef(0);

  const runSearch = useCallback(async (center: LatLng, radius: SearchRadius) => {
    const seq = ++requestSeq.current;
    dispatch({ type: "searchStarted" });

    let result: Awaited<ReturnType<typeof searchNearbyAction>>;
    try {
      result = await searchNearbyAction({ lat: center.lat, lng: center.lng, radius });
    } catch {
      // Server Action 本身失敗（網路、未登入被丟錯）
      if (seq === requestSeq.current) {
        dispatch({ type: "searchFailed", message: NETWORK_FAILED_MESSAGE });
      }
      return;
    }
    if (seq !== requestSeq.current) return;

    if (result.ok) {
      dispatch({ type: "searchSucceeded", results: result.data.results });
    } else {
      dispatch({ type: "searchFailed", message: result.message });
    }
  }, []);

  // 重新整理時從 sessionStorage 還原並自動重搜一次（design D1）。
  // ref 守衛讓 React StrictMode 的雙重執行不會搜兩次。
  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    const snapshot = readSnapshot();
    dispatch({ type: "restored", snapshot });
    if (snapshot) {
      void runSearch(snapshot.center, snapshot.radius);
    }
  }, [runSearch]);

  const { center, centerLabel, radius, view, restored } = state;
  useEffect(() => {
    if (!restored) return;
    writeSnapshot(center && centerLabel ? { center, centerLabel, radius, view } : null);
  }, [center, centerLabel, radius, view, restored]);

  const locateStart = useCallback(() => {
    dispatch({ type: "locate" });
  }, []);

  const located = useCallback(
    (position: LatLng) => {
      dispatch({ type: "located", center: position });
      void runSearch(position, stateRef.current.radius);
    },
    [runSearch],
  );

  const locateFailed = useCallback((reason: LocateFailure) => {
    dispatch({ type: "locateFailed", reason });
  }, []);

  const showAddressForm = useCallback(() => {
    dispatch({ type: "showAddressForm" });
  }, []);

  const searchAddress = useCallback(
    async (query: string) => {
      dispatch({ type: "geocodeStarted" });
      let result: Awaited<ReturnType<typeof geocodeAction>>;
      try {
        result = await geocodeAction({ query });
      } catch {
        dispatch({ type: "geocodeFailed", message: NETWORK_FAILED_MESSAGE });
        return;
      }
      if (!result.ok) {
        dispatch({ type: "geocodeFailed", message: result.message });
        return;
      }
      if (!result.data) {
        dispatch({ type: "geocodeNotFound" });
        return;
      }
      const position = { lat: result.data.lat, lng: result.data.lng };
      dispatch({ type: "geocoded", center: position, label: result.data.formattedAddress });
      void runSearch(position, stateRef.current.radius);
    },
    [runSearch],
  );

  const setRadius = useCallback(
    (next: SearchRadius) => {
      dispatch({ type: "setRadius", radius: next });
      // 還沒有搜尋中心時只改選項，不發請求
      const current = stateRef.current.center;
      if (current) void runSearch(current, next);
    },
    [runSearch],
  );

  const setView = useCallback((next: View) => {
    dispatch({ type: "setView", view: next });
  }, []);

  const mapMoved = useCallback((position: LatLng) => {
    dispatch({ type: "mapMoved", center: position });
  }, []);

  const searchHere = useCallback(() => {
    const target = stateRef.current.mapCenter;
    if (!target) return;
    dispatch({ type: "searchHere" });
    void runSearch(target, stateRef.current.radius);
  }, [runSearch]);

  const retry = useCallback(() => {
    const current = stateRef.current.center;
    if (current) void runSearch(current, stateRef.current.radius);
  }, [runSearch]);

  const showSearchHere =
    state.center !== null &&
    state.mapCenter !== null &&
    haversineMeters(state.center, state.mapCenter) > SEARCH_HERE_THRESHOLD_METERS;

  return {
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
  };
}
