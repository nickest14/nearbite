"use client";

import { LocateFixed, MapPin } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import type { LatLng } from "@/lib/geo";

import type { AddressStatus, LocateFailure, SearchStatus } from "./use-nearby-search";

type LocationPromptProps = {
  status: SearchStatus;
  centerLabel: string | null;
  locateFailure: LocateFailure | null;
  showAddressForm: boolean;
  addressStatus: AddressStatus;
  addressError: string | null;
  onLocateStart: () => void;
  onLocated: (position: LatLng) => void;
  onLocateFailed: (reason: LocateFailure) => void;
  onShowAddressForm: () => void;
  onSearchAddress: (query: string) => void;
};

// GeolocationPositionError 的錯誤碼。用數字而不是 error.PERMISSION_DENIED，測試的假物件不一定有常數
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

const FAILURE_MESSAGES: Record<LocateFailure, string> = {
  denied: "無法取得位置：瀏覽器已封鎖定位。可以在網址列的設定重新允許，或改用下方的地址搜尋。",
  timeout: "定位花太久了，再試一次或改用地址搜尋。",
  unavailable: "無法取得位置，改用地址搜尋吧。",
  unsupported: "這個瀏覽器不支援定位，改用地址搜尋吧。",
};

const EMPTY_ADDRESS_HINT = "請輸入地址或地標";
const NOT_FOUND_MESSAGE = "找不到這個地點，換個寫法試試";

// 「找附近的店」按鈕、定位錯誤訊息與地址表單（design D8）。
// 定位只在使用者按下按鈕時請求，頁面載入不會跳出權限對話框。
export function LocationPrompt({
  status,
  centerLabel,
  locateFailure,
  showAddressForm,
  addressStatus,
  addressError,
  onLocateStart,
  onLocated,
  onLocateFailed,
  onShowAddressForm,
  onSearchAddress,
}: LocationPromptProps) {
  const locating = status === "locating";

  function handleLocate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      onLocateFailed("unsupported");
      return;
    }
    onLocateStart();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocated({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (error) => {
        if (error.code === PERMISSION_DENIED) onLocateFailed("denied");
        else if (error.code === TIMEOUT) onLocateFailed("timeout");
        else onLocateFailed("unavailable");
      },
      // maximumAge 讓一分鐘內的重試不用重新定位
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const hasCenter = centerLabel !== null;

  return (
    <section aria-label="搜尋位置" className="space-y-3">
      {hasCenter ? (
        <div className="flex min-h-touch items-center gap-2 text-sm">
          <MapPin className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate" title={centerLabel}>
            {centerLabel}
          </span>
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className="min-h-touch shrink-0 px-2 font-medium text-accent disabled:opacity-50"
          >
            {locating ? "定位中…" : "重新定位"}
          </button>
          {!showAddressForm ? (
            <button
              type="button"
              onClick={onShowAddressForm}
              className="min-h-touch shrink-0 px-2 font-medium text-accent"
            >
              改用地址
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-base font-semibold text-accent-foreground disabled:opacity-60"
          >
            <LocateFixed className="size-5" aria-hidden="true" />
            {locating ? "定位中…" : "找附近的店"}
          </button>
          <p className="text-sm text-text-muted">
            按下後會請求定位，位置只用於這次搜尋，不會儲存。
          </p>
          {!showAddressForm && !locateFailure ? (
            <button
              type="button"
              onClick={onShowAddressForm}
              className="min-h-touch text-sm font-medium text-accent"
            >
              或改用地址、地標搜尋
            </button>
          ) : null}
        </div>
      )}

      {locateFailure ? (
        <p role="alert" className="text-sm text-text-muted">
          {FAILURE_MESSAGES[locateFailure]}
        </p>
      ) : null}

      {showAddressForm ? (
        <AddressForm
          addressStatus={addressStatus}
          addressError={addressError}
          onSubmit={onSearchAddress}
        />
      ) : null}
    </section>
  );
}

type AddressFormProps = {
  addressStatus: AddressStatus;
  addressError: string | null;
  onSubmit: (query: string) => void;
};

function AddressForm({ addressStatus, addressError, onSubmit }: AddressFormProps) {
  const inputId = useId();
  const hintId = useId();
  const [query, setQuery] = useState("");
  const [emptyHint, setEmptyHint] = useState(false);
  const submitting = addressStatus === "submitting";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      // 空白輸入不發請求，輸入框保留原文字
      setEmptyHint(true);
      return;
    }
    setEmptyHint(false);
    onSubmit(trimmed);
  }

  const message = emptyHint
    ? EMPTY_ADDRESS_HINT
    : addressStatus === "not-found"
      ? NOT_FOUND_MESSAGE
      : addressStatus === "error"
        ? addressError
        : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">
        地址或地標
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          inputMode="search"
          autoComplete="street-address"
          enterKeyHint="search"
          placeholder="例如：台北車站"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setEmptyHint(false);
          }}
          disabled={submitting}
          aria-invalid={message !== null}
          aria-describedby={message ? hintId : undefined}
          className="min-h-touch min-w-0 flex-1 rounded-lg border border-border bg-surface-elevated px-3 text-base disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-touch shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {submitting ? "搜尋中…" : "搜尋"}
        </button>
      </div>
      {message ? (
        <p id={hintId} role="alert" className="text-sm text-text-muted">
          {message}
        </p>
      ) : null}
    </form>
  );
}
