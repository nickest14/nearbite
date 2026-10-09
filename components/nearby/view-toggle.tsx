"use client";

import { List, Map as MapIcon } from "lucide-react";

import type { View } from "./use-nearby-search";

type ViewToggleProps = {
  value: View;
  onChange: (view: View) => void;
};

const OPTIONS: ReadonlyArray<{ value: View; label: string; icon: typeof List }> = [
  { value: "list", label: "列表", icon: List },
  { value: "map", label: "地圖", icon: MapIcon },
];

// 列表／地圖切換，aria-pressed 表示目前檢視
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div role="group" aria-label="檢視方式" className="flex rounded-lg border border-border">
      {OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={`flex min-h-touch min-w-touch items-center justify-center gap-1 px-3 text-sm font-medium first:rounded-l-lg last:rounded-r-lg ${
              selected ? "bg-text text-surface" : "text-text-muted"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
