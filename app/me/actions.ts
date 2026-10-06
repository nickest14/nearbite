"use server";

import { signOut } from "@/lib/auth";

// database strategy：signOut 會刪除 Session 表的記錄，舊 cookie 立即失效
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
