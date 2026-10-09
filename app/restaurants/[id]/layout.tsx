import { requireUser } from "@/lib/session";

// 登入檢查放在 layout：loading.tsx 的 Suspense 邊界只包住 page，
// 在這裡 redirect 會在串流開始前發生，未登入的請求才會得到真正的 307，而不是 200 + 串流內轉址。
// page 與 generateMetadata 仍各自呼叫 requireUser 作為防線。
export default async function RestaurantLayout({
  children,
  params,
}: LayoutProps<"/restaurants/[id]">) {
  const { id } = await params;
  await requireUser({ returnTo: `/restaurants/${id}` });
  return children;
}
