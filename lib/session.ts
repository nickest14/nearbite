import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

export class UnauthorizedError extends Error {
  constructor() {
    super("需要登入");
    this.name = "UnauthorizedError";
  }
}

// 只接受站內相對路徑：單一 "/" 開頭、不是 "//" 或 "/\"（會被瀏覽器解讀成外部網址）。
// 其他一律回首頁。
export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (/[\r\n]/.test(value)) return "/";
  return value;
}

export function loginPath(returnTo?: string): string {
  const target = safeReturnTo(returnTo);
  return target === "/" ? "/login" : `/login?callbackUrl=${encodeURIComponent(target)}`;
}

type RequireUserOptions = {
  // 受保護頁面傳入自己的路徑：沒有 session 時導向登入頁，登入後回到這裡。
  // Server Action 不傳：沒有 session 時直接丟錯，由呼叫端決定如何回應。
  returnTo?: string;
};

export async function requireUser(options: RequireUserOptions = {}): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;

  if (user?.id && user.email) {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
    };
  }

  if (options.returnTo !== undefined) {
    redirect(loginPath(options.returnTo));
  }
  throw new UnauthorizedError();
}
