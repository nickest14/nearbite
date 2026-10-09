import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationPrompt } from "./location-prompt";

type Props = Parameters<typeof LocationPrompt>[0];

function renderPrompt(overrides: Partial<Props> = {}) {
  const props: Props = {
    status: "idle",
    centerLabel: null,
    locateFailure: null,
    showAddressForm: false,
    addressStatus: "idle",
    addressError: null,
    onLocateStart: vi.fn(),
    onLocated: vi.fn(),
    onLocateFailed: vi.fn(),
    onShowAddressForm: vi.fn(),
    onSearchAddress: vi.fn(),
    ...overrides,
  };
  render(<LocationPrompt {...props} />);
  return props;
}

type GeoSuccess = (position: { coords: { latitude: number; longitude: number } }) => void;
type GeoError = (error: { code: number; message: string }) => void;

type GeoOptions = { timeout?: number };

function stubGeolocation(
  impl: (success: GeoSuccess, error: GeoError, options?: GeoOptions) => void,
) {
  const getCurrentPosition = vi.fn(impl);
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  return getCurrentPosition;
}

afterEach(() => {
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
});

describe("LocationPrompt", () => {
  it("初始只顯示「找附近的店」按鈕，不自動請求定位", () => {
    const getCurrentPosition = stubGeolocation(() => undefined);
    renderPrompt();

    expect(screen.getByRole("button", { name: "找附近的店" })).toBeInTheDocument();
    expect(screen.queryByLabelText("地址或地標")).not.toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("按下按鈕才請求定位，成功時回報座標", () => {
    const getCurrentPosition = stubGeolocation((success) => {
      success({ coords: { latitude: 25.0478, longitude: 121.517 } });
    });
    const props = renderPrompt();

    fireEvent.click(screen.getByRole("button", { name: "找附近的店" }));

    expect(props.onLocateStart).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0]?.[2]).toMatchObject({ timeout: 10_000 });
    expect(props.onLocated).toHaveBeenCalledWith({ lat: 25.0478, lng: 121.517 });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ])("定位錯誤碼 %i 對應 %s", (code, reason) => {
    stubGeolocation((_success, error) => {
      error({ code, message: "" });
    });
    const props = renderPrompt();

    fireEvent.click(screen.getByRole("button", { name: "找附近的店" }));

    expect(props.onLocateFailed).toHaveBeenCalledWith(reason);
  });

  it("瀏覽器不支援定位時直接回報 unsupported", () => {
    const props = renderPrompt();

    fireEvent.click(screen.getByRole("button", { name: "找附近的店" }));

    expect(props.onLocateStart).not.toHaveBeenCalled();
    expect(props.onLocateFailed).toHaveBeenCalledWith("unsupported");
  });

  it("拒絕定位後顯示說明與地址表單", () => {
    renderPrompt({ locateFailure: "denied", showAddressForm: true });

    expect(screen.getByRole("alert")).toHaveTextContent("瀏覽器已封鎖定位");
    expect(screen.getByLabelText("地址或地標")).toBeInTheDocument();
  });

  it("定位逾時顯示「定位花太久了」且按鈕可重試", () => {
    const getCurrentPosition = stubGeolocation(() => undefined);
    renderPrompt({ locateFailure: "timeout", showAddressForm: true });

    expect(screen.getByRole("alert")).toHaveTextContent("定位花太久了");
    fireEvent.click(screen.getByRole("button", { name: "找附近的店" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("定位中時按鈕 disabled 並顯示「定位中…」", () => {
    renderPrompt({ status: "locating" });

    expect(screen.getByRole("button", { name: "定位中…" })).toBeDisabled();
  });

  it("空白地址不呼叫 action，顯示需要輸入的提示", () => {
    const props = renderPrompt({ showAddressForm: true });

    fireEvent.change(screen.getByLabelText("地址或地標"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "搜尋" }));

    expect(props.onSearchAddress).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("請輸入地址或地標");
    expect(screen.getByLabelText("地址或地標")).toHaveValue("   ");
  });

  it("送出地址時去除前後空白", () => {
    const props = renderPrompt({ showAddressForm: true });

    fireEvent.change(screen.getByLabelText("地址或地標"), { target: { value: " 台北車站 " } });
    fireEvent.submit(screen.getByLabelText("地址或地標").closest("form") as HTMLFormElement);

    expect(props.onSearchAddress).toHaveBeenCalledWith("台北車站");
  });

  it("送出中時輸入框與按鈕 disabled", () => {
    renderPrompt({ showAddressForm: true, addressStatus: "submitting" });

    expect(screen.getByLabelText("地址或地標")).toBeDisabled();
    expect(screen.getByRole("button", { name: "搜尋中…" })).toBeDisabled();
  });

  it("找不到地點時顯示訊息，輸入框保留原文字", () => {
    renderPrompt({ showAddressForm: true, addressStatus: "not-found" });

    expect(screen.getByRole("alert")).toHaveTextContent("找不到這個地點，換個寫法試試");
    expect(screen.getByLabelText("地址或地標")).not.toBeDisabled();
  });

  it("有搜尋中心時以精簡列顯示標籤與重新定位／改用地址", () => {
    const props = renderPrompt({ centerLabel: "台北市中正區北平西路3號" });

    expect(screen.getByText("台北市中正區北平西路3號")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "找附近的店" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "改用地址" }));
    expect(props.onShowAddressForm).toHaveBeenCalled();
  });
});
