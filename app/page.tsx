import type { Metadata } from "next";

import { NearbySearch } from "@/components/nearby/nearby-search";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/session";

// 根 layout 的 title.template 不會套用在同一層的 page，所以這裡寫完整標題
export const metadata: Metadata = {
  title: "探索 | Nearbite",
};

export default async function ExplorePage() {
  await requireUser({ returnTo: "/" });

  return (
    <>
      <PageHeader title="探索" description="看看附近有什麼好吃的。" />
      <NearbySearch />
    </>
  );
}
