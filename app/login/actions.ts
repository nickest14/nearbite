"use server";

import { signIn } from "@/lib/auth";
import { safeReturnTo } from "@/lib/session";

export async function signInWithGoogle(formData: FormData) {
  const callbackUrl = formData.get("callbackUrl");
  const redirectTo = safeReturnTo(typeof callbackUrl === "string" ? callbackUrl : undefined);

  // signIn 會丟出 redirect 把使用者帶去 Google 授權頁
  await signIn("google", { redirectTo });
}
