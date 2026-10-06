import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { safeReturnTo } from "@/lib/session";

import { signInWithGoogle } from "./actions";

export const metadata: Metadata = {
  title: "登入",
};

// Auth.js 導回 /login?error=<code> 的錯誤碼對應訊息；沒列出的一律顯示一般訊息
const errorMessages: Record<string, string> = {
  AccessDenied: "這個 Google 帳號不在允許名單內。如果你應該可以使用，請朋友把你的 email 加進名單。",
};
const defaultErrorMessage = "登入未完成，請再試一次。";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) redirect("/");

  const params = await searchParams;
  const error = first(params["error"]);
  const callbackUrl = safeReturnTo(first(params["callbackUrl"]));
  const message = error ? (errorMessages[error] ?? defaultErrorMessage) : null;

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 text-center">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-accent">Nearbite</h1>
        <p className="mt-2 text-sm text-text-muted">
          附近吃什麼？和朋友一起找餐廳、留評論、存清單。
        </p>
      </div>

      {message ? (
        <p
          role="alert"
          className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-200"
        >
          {message}
        </p>
      ) : null}

      <form action={signInWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <button
          type="submit"
          className="min-h-touch rounded-lg bg-accent px-6 text-base font-medium text-accent-foreground"
        >
          使用 Google 登入
        </button>
      </form>

      <p className="text-xs text-text-muted">僅限受邀的朋友使用</p>
    </div>
  );
}
