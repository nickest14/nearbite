// Email 白名單的純函式。不讀 process.env，由呼叫端（lib/auth.ts）注入，方便測試。

export function parseAllowlist(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

export type CanSignInOptions = {
  allowlist: ReadonlySet<string>;
  isProduction: boolean;
};

// 名單非空：只放行名單內的 email。
// 名單為空：正式環境拒絕所有人（fail-closed，避免忘了設定就對全世界開放）；開發環境放行所有人。
export function canSignIn(
  email: string | null | undefined,
  { allowlist, isProduction }: CanSignInOptions,
): boolean {
  if (!email) return false;
  if (allowlist.size > 0) return allowlist.has(email.trim().toLowerCase());
  return !isProduction;
}
