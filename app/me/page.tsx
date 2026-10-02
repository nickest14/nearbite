import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "我",
};

export default function MePage() {
  return (
    <>
      <PageHeader title="我" description="你的評論、清單與設定。" />
      <p className="text-sm text-text-muted">登入功能即將登場。</p>
    </>
  );
}
