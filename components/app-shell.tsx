import type { ReactNode } from "react";

import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";

// 應用殼層（Server Component）。行動版與桌面版的導覽同時渲染，由 CSS 斷點決定顯示哪一個，
// 避免用 JS 偵測螢幕寬度造成 hydration 不一致。
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:pl-56">
      <SideNav />
      <main className="mx-auto w-full max-w-content px-4 pt-4 pb-nav-safe lg:px-8 lg:pt-8 lg:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
