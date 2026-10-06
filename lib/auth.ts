import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { canSignIn, parseAllowlist } from "@/lib/allowlist";
import { db } from "@/lib/db";

// Auth.js v5。AUTH_SECRET、AUTH_GOOGLE_ID、AUTH_GOOGLE_SECRET 由 Auth.js 自動從環境變數讀取。

const allowlist = parseAllowlist(process.env["ALLOWED_EMAILS"]);
const isProduction = process.env.NODE_ENV === "production";

if (allowlist.size === 0) {
  console.warn(
    isProduction
      ? "[auth] ALLOWED_EMAILS 未設定：正式環境會拒絕所有登入，請設定白名單。"
      : "[auth] ALLOWED_EMAILS 未設定：開發環境允許任何 Google 帳號登入。",
  );
}

const DAY_IN_SECONDS = 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // Google provider 預設 scope 就是 openid email profile，不額外要求任何權限
  providers: [Google],
  session: {
    // 存在 Postgres 的 Session 表：登出時刪除記錄，舊 cookie 立即失效
    strategy: "database",
    maxAge: 30 * DAY_IN_SECONDS,
    updateAge: DAY_IN_SECONDS,
  },
  pages: {
    signIn: "/login",
    // 登入失敗（含白名單拒絕）導回登入頁，由 ?error= 決定訊息
    error: "/login",
  },
  callbacks: {
    // 回傳 false 時 Auth.js 會在 adapter 建立使用者之前中止，並導向 /login?error=AccessDenied
    signIn({ user }) {
      return canSignIn(user.email, { allowlist, isProduction });
    },
    // database strategy 預設不把 id 放進 session.user，但 requireUser 需要它
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
