import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RestaurantSummary } from "@/app/actions/search";

const { searchNearbyAction, geocodeAction } = vi.hoisted(() => ({
  searchNearbyAction: vi.fn(),
  geocodeAction: vi.fn(),
}));

vi.mock("@/app/actions/search", () => ({ searchNearbyAction, geocodeAction }));

import {
  CURRENT_LOCATION_LABEL,
  initialState,
  MAP_LOCATION_LABEL,
  reducer,
  STORAGE_KEY,
  useNearbySearch,
} from "./use-nearby-search";

const taipei = { lat: 25.0478, lng: 121.517 };

function summary(id: string): RestaurantSummary {
  return {
    id,
    name: id,
    primaryType: "restaurant",
    typeLabel: "餐廳",
    distanceMeters: 100,
    rating: null,
    businessStatus: "OPERATIONAL",
    lat: taipei.lat,
    lng: taipei.lng,
  };
}

function okSearch(results: RestaurantSummary[]) {
  return { ok: true as const, data: { center: taipei, radius: 1000 as const, results } };
}

describe("reducer", () => {
  it("located 設定中心與標籤並關閉地址表單", () => {
    const state = reducer(
      { ...initialState, showAddressForm: true },
      { type: "located", center: taipei },
    );
    expect(state.center).toEqual(taipei);
    expect(state.mapCenter).toEqual(taipei);
    expect(state.centerLabel).toBe(CURRENT_LOCATION_LABEL);
    expect(state.showAddressForm).toBe(false);
  });

  it("locateFailed 顯示地址表單；已有結果時維持 success", () => {
    const fresh = reducer(
      { ...initialState, status: "locating" },
      { type: "locateFailed", reason: "denied" },
    );
    expect(fresh).toMatchObject({ status: "idle", locateFailure: "denied", showAddressForm: true });

    const withResults = reducer(
      { ...initialState, status: "locating", results: [summary("a")] },
      { type: "locateFailed", reason: "timeout" },
    );
    expect(withResults.status).toBe("success");
    expect(withResults.results).toHaveLength(1);
  });

  it("searchFailed 保留之前的結果", () => {
    const state = reducer(
      { ...initialState, status: "searching", results: [summary("a")] },
      { type: "searchFailed", message: "壞了" },
    );
    expect(state).toMatchObject({ status: "error", error: "壞了" });
    expect(state.results).toHaveLength(1);
  });

  it("searchHere 把地圖中心變成搜尋中心；沒有地圖中心時不變", () => {
    const moved = { lat: 25.1, lng: 121.6 };
    const state = reducer(
      { ...initialState, center: taipei, mapCenter: moved },
      { type: "searchHere" },
    );
    expect(state.center).toEqual(moved);
    expect(state.centerLabel).toBe(MAP_LOCATION_LABEL);

    const untouched = { ...initialState, center: taipei };
    expect(reducer(untouched, { type: "searchHere" })).toBe(untouched);
  });

  it("restored 還原快照或只標記已讀取", () => {
    const snapshot = {
      center: taipei,
      centerLabel: "台北車站",
      radius: 2000 as const,
      view: "map" as const,
    };
    expect(reducer(initialState, { type: "restored", snapshot })).toMatchObject({
      restored: true,
      center: taipei,
      centerLabel: "台北車站",
      radius: 2000,
      view: "map",
    });
    expect(reducer(initialState, { type: "restored", snapshot: null })).toMatchObject({
      restored: true,
      center: null,
    });
  });
});

describe("useNearbySearch", () => {
  beforeEach(() => {
    searchNearbyAction.mockReset();
    geocodeAction.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("初始狀態：不呼叫任何 Server Action，sessionStorage 沒有東西", async () => {
    const { result } = renderHook(() => useNearbySearch());

    await waitFor(() => expect(result.current.state.restored).toBe(true));
    expect(result.current.state.status).toBe("idle");
    expect(searchNearbyAction).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("還沒有中心時切換範圍只改選項，不發請求", async () => {
    const { result } = renderHook(() => useNearbySearch());
    await waitFor(() => expect(result.current.state.restored).toBe(true));

    act(() => result.current.setRadius(2000));

    expect(result.current.state.radius).toBe(2000);
    expect(searchNearbyAction).not.toHaveBeenCalled();
  });

  it("定位成功後以目前範圍搜尋，並把條件寫進 sessionStorage", async () => {
    searchNearbyAction.mockResolvedValue(okSearch([summary("a"), summary("b")]));
    const { result } = renderHook(() => useNearbySearch());
    await waitFor(() => expect(result.current.state.restored).toBe(true));

    act(() => result.current.setRadius(500));
    act(() => result.current.locateStart());
    expect(result.current.state.status).toBe("locating");

    await act(async () => result.current.located(taipei));

    expect(searchNearbyAction).toHaveBeenCalledWith({ ...taipei, radius: 500 });
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(result.current.state.results.map((r) => r.id)).toEqual(["a", "b"]);
    expect(result.current.state.centerLabel).toBe(CURRENT_LOCATION_LABEL);

    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null");
    expect(stored).toEqual({
      center: taipei,
      centerLabel: CURRENT_LOCATION_LABEL,
      radius: 500,
      view: "list",
    });
  });

  it("有中心時切換範圍立即以新範圍重搜", async () => {
    searchNearbyAction.mockResolvedValue(okSearch([]));
    const { result } = renderHook(() => useNearbySearch());
    await waitFor(() => expect(result.current.state.restored).toBe(true));
    await act(async () => result.current.located(taipei));

    await act(async () => result.current.setRadius(2000));

    expect(searchNearbyAction).toHaveBeenLastCalledWith({ ...taipei, radius: 2000 });
  });

  it("搜尋失敗時回固定訊息並保留之前的結果，retry 會再搜一次", async () => {
    searchNearbyAction
      .mockResolvedValueOnce(okSearch([summary("a")]))
      .mockResolvedValueOnce({ ok: false, message: "搜尋暫時無法使用，請稍後再試" })
      .mockResolvedValueOnce(okSearch([summary("b")]));
    const { result } = renderHook(() => useNearbySearch());
    await waitFor(() => expect(result.current.state.restored).toBe(true));

    await act(async () => result.current.located(taipei));
    await act(async () => result.current.setRadius(2000));

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toBe("搜尋暫時無法使用，請稍後再試");
    expect(result.current.state.results.map((r) => r.id)).toEqual(["a"]);

    await act(async () => result.current.retry());

    expect(result.current.state.status).toBe("success");
    expect(result.current.state.results.map((r) => r.id)).toEqual(["b"]);
  });

  it("Server Action 本身丟錯時也視為搜尋失敗", async () => {
    searchNearbyAction.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useNearbySearch());
    await waitFor(() => expect(result.current.state.restored).toBe(true));

    await act(async () => result.current.located(taipei));

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toBe("搜尋暫時無法使用，請稍後再試");
  });

  it("地址搜尋：解析成功後以該座標搜尋並顯示解析後的地址", async () => {
    geocodeAction.mockResolvedValue({
      ok: true,
      data: { lat: 25.0478, lng: 121.517, formattedAddress: "台北市中正區北平西路3號" },
    });
    searchNearbyAction.mockResolvedValue(okSearch([]));
    const { result } = renderHook(() => useNearbySearch());
    await waitFor(() => expect(result.current.state.restored).toBe(true));

    await act(async () => result.current.searchAddress("台北車站"));

    expect(geocodeAction).toHaveBeenCalledWith({ query: "台北車站" });
    expect(result.current.state.centerLabel).toBe("台北市中正區北平西路3號");
    expect(searchNearbyAction).toHaveBeenCalledWith({ ...taipei, radius: 1000 });
    expect(result.current.state.addressStatus).toBe("idle");
  });

  it("地址搜尋：找不到時標記 not-found 且不搜尋", async () => {
    geocodeAction.mockResolvedValue({ ok: true, data: null });
    const { result } = renderHook(() => useNearbySearch());
    await waitFor(() => expect(result.current.state.restored).toBe(true));

    await act(async () => result.current.searchAddress("asdfgh"));

    expect(result.current.state.addressStatus).toBe("not-found");
    expect(searchNearbyAction).not.toHaveBeenCalled();
  });

  it("地圖移動超過 100 公尺才顯示「在此區域搜尋」，按下後以地圖中心重搜", async () => {
    searchNearbyAction.mockResolvedValue(okSearch([]));
    const { result } = renderHook(() => useNearbySearch());
    await waitFor(() => expect(result.current.state.restored).toBe(true));
    await act(async () => result.current.located(taipei));

    act(() => result.current.mapMoved({ lat: taipei.lat + 0.0005, lng: taipei.lng }));
    expect(result.current.showSearchHere).toBe(false);

    const farAway = { lat: taipei.lat + 0.01, lng: taipei.lng };
    act(() => result.current.mapMoved(farAway));
    expect(result.current.showSearchHere).toBe(true);

    await act(async () => result.current.searchHere());

    expect(searchNearbyAction).toHaveBeenLastCalledWith({ ...farAway, radius: 1000 });
    expect(result.current.state.center).toEqual(farAway);
    expect(result.current.state.centerLabel).toBe(MAP_LOCATION_LABEL);
    expect(result.current.showSearchHere).toBe(false);
  });

  it("重新整理：從 sessionStorage 還原條件並自動重搜一次", async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ center: taipei, centerLabel: "台北車站", radius: 2000, view: "map" }),
    );
    searchNearbyAction.mockResolvedValue(okSearch([summary("a")]));

    const { result } = renderHook(() => useNearbySearch());

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(searchNearbyAction).toHaveBeenCalledTimes(1);
    expect(searchNearbyAction).toHaveBeenCalledWith({ ...taipei, radius: 2000 });
    expect(result.current.state).toMatchObject({
      centerLabel: "台北車站",
      radius: 2000,
      view: "map",
    });
  });

  it("sessionStorage 內容壞掉時當作沒有記憶", async () => {
    window.sessionStorage.setItem(STORAGE_KEY, '{"center":"nope","radius":123}');
    const { result } = renderHook(() => useNearbySearch());

    await waitFor(() => expect(result.current.state.restored).toBe(true));
    expect(result.current.state.center).toBeNull();
    expect(searchNearbyAction).not.toHaveBeenCalled();
  });

  it("sessionStorage 讀寫丟例外時不中斷功能", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    searchNearbyAction.mockResolvedValue(okSearch([summary("a")]));

    const { result } = renderHook(() => useNearbySearch());
    await waitFor(() => expect(result.current.state.restored).toBe(true));
    await act(async () => result.current.located(taipei));

    expect(result.current.state.status).toBe("success");
    expect(result.current.state.results).toHaveLength(1);
  });
});
