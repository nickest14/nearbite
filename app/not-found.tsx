import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "找不到頁面",
};

// 根層級的 not-found 會在 RootLayout 內渲染，所以底部導覽列仍然可見。
export default function NotFound() {
  return (
    <>
      <PageHeader title="找不到頁面" description="這個網址不存在，或是內容已經被移除了。" />
      <Link
        href="/"
        className="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground"
      >
        回到首頁
      </Link>
    </>
  );
}
