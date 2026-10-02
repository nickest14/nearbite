import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "收藏",
};

export default function ListsPage() {
  return (
    <>
      <PageHeader title="收藏" description="把想吃的店存進清單，分享給朋友。" />
      <p className="text-sm text-text-muted">收藏清單即將登場。</p>
    </>
  );
}
