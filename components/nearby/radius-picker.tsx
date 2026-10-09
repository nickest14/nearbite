"use client";

import { SEARCH_RADIUS_OPTIONS, type SearchRadius } from "@/lib/google/config";

type RadiusPickerProps = {
  value: SearchRadius;
  onChange: (radius: SearchRadius) => void;
};

export function radiusLabel(radius: SearchRadius): string {
  return radius < 1000 ? `${radius} m` : `${radius / 1000} km`;
}

// 三個並排的範圍 chip，各至少 44px 高，用 aria-pressed 表示選取狀態
export function RadiusPicker({ value, onChange }: RadiusPickerProps) {
  return (
    <div role="group" aria-label="搜尋範圍" className="flex gap-2">
      {SEARCH_RADIUS_OPTIONS.map((radius) => {
        const selected = radius === value;
        return (
          <button
            key={radius}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(radius)}
            className={`min-h-touch flex-1 rounded-full border px-3 text-sm font-medium whitespace-nowrap ${
              selected
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface-elevated text-text"
            }`}
          >
            {radiusLabel(radius)}
          </button>
        );
      })}
    </div>
  );
}
