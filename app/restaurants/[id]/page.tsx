import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

// 店家頁的最小佔位（design D13）：只求從搜尋結果點進來的導航鏈完整，
// 完整詳情（營業時間、價位、照片、評論）由店家詳情的 change 改寫。

// generateMetadata 比 page 先執行，所以這裡也要先驗證登入：未登入的人不該觸發任何 DB 查詢
export async function generateMetadata({
  params,
}: PageProps<"/restaurants/[id]">): Promise<Metadata> {
  const { id } = await params;
  await requireUser({ returnTo: `/restaurants/${id}` });
  const restaurant = await db.restaurant.findUnique({ where: { id }, select: { name: true } });
  return { title: restaurant?.name ?? "找不到店家" };
}

export default async function RestaurantPage({ params }: PageProps<"/restaurants/[id]">) {
  const { id } = await params;
  await requireUser({ returnTo: `/restaurants/${id}` });

  const restaurant = await db.restaurant.findUnique({
    where: { id },
    select: { name: true, address: true },
  });
  if (!restaurant) notFound();

  return (
    <>
      <PageHeader title={restaurant.name} description={restaurant.address ?? undefined} />
      <p className="text-sm text-text-muted">店家詳情即將登場。</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-touch items-center rounded-lg border border-border px-4 text-sm font-medium"
      >
        回到搜尋
      </Link>
    </>
  );
}
