import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RestaurantDetail } from "@/components/restaurant/restaurant-detail";
import { db } from "@/lib/db";
import { getRestaurantDetail } from "@/lib/restaurant-sync";
import { requireUser } from "@/lib/session";

// 店家詳情頁（design D6）：Server Component，快取與重抓的判斷都在 getRestaurantDetail。

// generateMetadata 比 page 先執行，所以這裡也要先驗證登入：未登入的人不該觸發任何 DB 查詢。
// 只讀店名，不觸發重抓。
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

  const now = new Date();
  const restaurant = await getRestaurantDetail(id, { now });
  if (!restaurant) notFound();

  return <RestaurantDetail restaurant={restaurant} now={now} />;
}
