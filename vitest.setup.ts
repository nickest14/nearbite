// 讓 expect 可以使用 toBeInTheDocument、toHaveAttribute 等 DOM matcher
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 沒開 vitest 的 globals，Testing Library 不會自動在每個測試後清理 DOM，這裡手動補上
afterEach(() => {
  cleanup();
});
