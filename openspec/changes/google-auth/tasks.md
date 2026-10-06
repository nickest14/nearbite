## 1. 相依與相容性驗證

- [x] 1.1 安裝 `next-auth@5.0.0-beta.32`（寫死版本）與 `@auth/prisma-adapter`；建立最小的 `lib/auth.ts`（Google provider + `PrismaAdapter(db)`，先不加 callbacks）確認 Prisma 7 新版 generator 的 client 能通過 adapter 的型別檢查，需要時用轉型並加註解
      驗證：`pnpm typecheck` 通過
- [x] 1.2 更新 `.env.example`：`ALLOWED_EMAILS` 的說明改為「正式環境必填；為空時正式環境拒絕所有登入、開發環境允許所有帳號」；確認 `AUTH_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET` 的說明仍正確
      驗證：檔案內容與 design D4、D10 一致

## 2. 資料模型

- [x] 2.1 依 design D5 擴充 `prisma/schema.prisma`：`User` 加 `emailVerified` 與關聯，新增 `Account`、`Session`、`VerificationToken`
      驗證：`pnpm prisma validate` 通過
- [x] 2.2 執行 `pnpm prisma migrate dev --name add_auth_tables`
      驗證：`prisma/migrations/` 出現新資料夾；`psql \dt` 看到四張表；`pnpm db:generate` 後 `pnpm typecheck` 通過

## 3. 白名單與 session helper

- [x] 3.1 建立 `lib/allowlist.ts`：`parseAllowlist` 與 `canSignIn`（純函式，不讀 `process.env`）
      驗證：`lib/allowlist.test.ts` 涵蓋大小寫／空白／空字串、名單有無 × production 是否的四種組合，全部通過
- [x] 3.2 建立 `lib/session.ts`：`safeReturnTo(value)` 與 `requireUser({ returnTo? })`（無 session 時 `redirect` 到 `/login?callbackUrl=...`；在 Server Action 情境不帶 `returnTo` 時改為丟出錯誤）
      驗證：`lib/session.test.ts` mock `auth` 與 `next/navigation`，涵蓋有 session 回傳 user、無 session 導向正確 URL、`safeReturnTo` 接受 `/lists` 拒絕 `https://evil.example` 與 `//evil`
- [x] 3.3 完成 `lib/auth.ts`：`session.strategy = "database"`、`pages.signIn` 與 `pages.error` 指向 `/login`、`callbacks.signIn` 接 `canSignIn`（從環境變數讀名單並以 `NODE_ENV` 判斷 production）、名單為空時模組載入階段 `console.warn` 一次；匯出 `handlers`、`auth`、`signIn`、`signOut`
      驗證：`pnpm typecheck` 通過；啟動 dev server 且 `ALLOWED_EMAILS` 為空時 log 出現提醒
- [x] 3.4 建立 `app/api/auth/[...nextauth]/route.ts` 匯出 `handlers` 的 `GET`、`POST`
      驗證：`curl -i localhost:3000/api/auth/providers` 回傳含 `google` 的 JSON

## 4. 登入頁與導覽

- [x] 4.1 `lib/nav-items.ts` 加 `isNavHidden(pathname)`；`BottomNav` 與 `SideNav` 在 hidden 時回傳 `null`
      驗證：`nav-items.test.ts` 新增 `/login` 為 true、`/` 為 false；`bottom-nav.test.tsx` 新增 pathname 為 `/login` 時不渲染任何連結
- [x] 4.2 建立 `app/login/page.tsx`（Server Component）：已登入則 `redirect('/')`；顯示應用名稱、一句說明、「使用 Google 登入」按鈕（`min-h-touch`）；依 `searchParams.error` 顯示訊息（`AccessDenied` → 不在允許名單；其他 → 登入未完成請再試）；`metadata.title` 為「登入」
      驗證：未登入開啟 `/login` 看到按鈕且無導覽列；`/login?error=AccessDenied` 顯示名單訊息；`/login?error=OAuthCallbackError` 顯示一般訊息
- [x] 4.3 建立登入的 Server Action（`app/login/actions.ts`）：接收 `callbackUrl`，經 `safeReturnTo` 後呼叫 `signIn("google", { redirectTo })`
      驗證：點擊按鈕會跳轉到 `accounts.google.com`，且請求的 scope 只有 `openid email profile`

## 5. 受保護頁面與個人頁

- [x] 5.1 四個頂層頁面（`/`、`/search`、`/lists`、`/me`）第一行加入 `await requireUser({ returnTo: "<自己的路徑>" })`
      驗證：未登入時 `curl -i` 四個路由皆為 307 導向 `/login?callbackUrl=<路徑>`；`/api/health` 仍為 200
- [x] 5.2 `next.config.ts` 的 `images.remotePatterns` 加入 `lh3.googleusercontent.com`；建立 `components/avatar.tsx`（有 `image` 用 `next/image`，否則顯示名稱首字的圓形佔位）
      驗證：`components/avatar.test.tsx` 涵蓋有圖／無圖（含中文名首字）兩種渲染
- [x] 5.3 改寫 `app/me/page.tsx`：顯示 `Avatar`、名稱、email，以及 `<form action={signOutAction}>` 的登出按鈕（`min-h-touch`）；`app/me/actions.ts` 的 Server Action 呼叫 `signOut({ redirectTo: "/login" })`
      驗證：登入後 `/me` 顯示 Google 資料；登出後導向 `/login`，再開 `/me` 被導回登入頁，資料庫 `Session` 表對應記錄已刪除

## 6. 文件與手動驗證

- [x] 6.1 README 新增「Google OAuth 設定」段落：在 Google Cloud Console 建立 OAuth 2.0 Client ID（Web application）、授權重新導向 URI `http://localhost:3000/api/auth/callback/google`、同意畫面設為測試中並加入朋友的 email 為測試使用者、把 ID/Secret 填進 `.env`、`ALLOWED_EMAILS` 的格式與正式環境必填的提醒
      驗證：照段落從零設定一次能登入
- [x] 6.2 以真實 Google 帳號手動走過完整流程（需要你先依 6.1 建立 OAuth client 並填入 `.env`）：白名單內帳號登入 → 回到 `callbackUrl` → `/me` 顯示資料 → 登出；白名單外帳號登入 → 看到不在名單訊息且 `User` 表沒有新記錄；在 375px 寬度確認登入頁與 `/me` 的按鈕尺寸與版面
      驗證：上述每一步的結果符合 spec，`pnpm check` 全綠
