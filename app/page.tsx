import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

// 根 layout 的 title.template 不會套用在同一層的 page，所以這裡寫完整標題
export const metadata: Metadata = {
  title: "探索 | Nearbite",
};

export default function ExplorePage() {
  return (
    <>
      <PageHeader title="探索" description="看看附近有什麼好吃的。" />
      <p className="text-sm text-text-muted">附近餐廳搜尋即將登場。</p>
    </>
  );
}
