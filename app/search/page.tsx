import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "搜尋",
};

export default async function SearchPage() {
  await requireUser({ returnTo: "/search" });

  return (
    <>
      <PageHeader title="搜尋" description="用關鍵字找餐廳，例如「拉麵」或「咖啡」。" />
      <p className="text-sm text-text-muted">關鍵字搜尋即將登場。</p>
    </>
  );
}
