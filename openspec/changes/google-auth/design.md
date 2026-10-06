## Context

骨架已完成（見 archive 的 `scaffold-nextjs-app`）：`User` 表只有 `id/email/name/image/createdAt`，殼層（`AppShell` + 兩套導覽）放在根 layout，四個頂層頁面是佔位內容。動機見 proposal.md。

本次查核的事實（2026-10）：

- `next-auth@5.0.0-beta.32` 的 peer deps 明確包含 `next ^16.0.0`；v5 已長期 beta，API 穩定但仍可能有小變動
- `@auth/prisma-adapter@2.11.3` 要求 `@prisma/client >=6`，Prisma 7 符合；adapter 只呼叫 `findUnique/create/update/delete` 等標準 API，與 driver adapter 模式無關
- Next.js 16 已把 `middleware.ts` 改名為 `proxy.ts`，且在 Node.js runtime 執行

約束：行動優先、Server Components 為預設、每個 change 一個 migration、白名單是唯一的存取控制。

## Goals / Non-Goals

**Goals:**

- 登入檢查的寫法簡單到每個新頁面都會自然遵守（一行 `requireUser()`），之後 `nearby-search`、`reviews` 等 change 不用再想這件事
- 登出能真正讓 session 失效（伺服器端可撤銷），不是只清 cookie
- 白名單判定是純函式、可單元測試，Auth.js 只是把它接上
- 未來的公開路由（`/share/[token]`）加入時不需要改動任何既有的驗證程式

**Non-Goals:**

- 不做 proxy 層的全站攔截（原因見 D3）
- 不做 session 列表、裝置管理、強制登出其他裝置
- 不做 Google 以外的 provider 抽象層

## Decisions

### D1. Auth.js v5（next-auth@beta）+ Google provider

依 product-plan 的既定選擇。Google provider、Prisma adapter、App Router 的 `auth()` helper 都是現成的，自己寫 OAuth 流程沒有價值。

**版本鎖定**：`package.json` 寫死 `5.0.0-beta.32`（不加 `^`），避免 beta 之間的 breaking change 在 `pnpm install` 時悄悄升級。

**替代方案**：better-auth（1.7，TypeScript-first、近年成長快，Prisma adapter 與 Google 也齊全）。沒有選它是因為 product-plan 已決定、Auth.js 的 Prisma schema 慣例更廣為人知，而且本專案的需求極簡單，兩者差異不會體現。若 Auth.js v5 在實作時遇到與 Next.js 16 的阻斷性問題，better-auth 是明確的 B 計畫。

### D2. Session 用資料庫策略（database），不用 JWT

Prisma adapter 預設即為 database session。選它的理由：

- 登出時刪除 `Session` 記錄，舊 cookie 立即失效（spec「登出後重用舊的 session」情境）
- 白名單移除某人時，刪掉他的 session 就能立刻踢出，不用等 JWT 過期
- 使用者資料（名稱、頭像）變動時，`auth()` 回傳的是 DB 現值

代價：每次 `auth()` 一次 DB 查詢。本專案流量極小，可接受；每個請求只呼叫一次 `auth()`（見 D3）。

Session 有效期採 Auth.js 預設 30 天、`updateAge` 24 小時（持續使用時滑動延長），符合 spec。

### D3. 登入檢查放在頁面與 Server Action（DAL 模式），不放 layout，也不放 proxy

- **不放 layout**：App Router 的 layout 在同層頁面之間切換時不會重新執行，session 過期後仍可能渲染出頁面。Next.js 官方也明確建議不要在 layout 做驗證。
- **不放 proxy**：database session 無法在 proxy 裡低成本驗證（需要查 DB），且 proxy 對每個請求（含 prefetch、靜態資源）都會執行。v1 不需要這層；若之後想要「未登入連 HTML 都不送出」的最佳化，再加一個只檢查 cookie 是否存在的 proxy 作為樂觀導向。
- **採用**：`lib/session.ts` 提供 `requireUser({ returnTo })`，內部呼叫 `auth()`，沒有 session 就 `redirect('/login?callbackUrl=' + returnTo)`。每個受保護頁面的第一行就是 `const user = await requireUser({ returnTo: "/lists" })`。Server Action 同樣呼叫 `requireUser()`（不帶 `returnTo`，沒有 session 直接丟錯）。

`returnTo` 由頁面自己傳入而非從請求推斷，因為 Server Component 拿不到目前 URL；每個頁面知道自己的路徑，動態路由在實作時用參數組出來。

**公開路由的慣例**：不呼叫 `requireUser()` 的頁面就是公開的。沒有白名單式的「公開路由清單」要維護，未來 `/share/[token]` 只要不呼叫就好。`/api/health` 與 `/api/auth/*` 本來就不經過這個 helper。

### D4. 白名單是純函式，接在 Auth.js 的 `signIn` callback

`lib/allowlist.ts`：

- `parseAllowlist(raw: string | undefined): Set<string>`：以逗號切分、trim、小寫、過濾空字串
- `canSignIn(email: string | null | undefined, { allowlist, isProduction }): boolean`：
  - email 缺失 → false
  - 名單非空 → 以小寫比對
  - 名單為空且 production → false（fail-closed）；名單為空且非 production → true
- 兩者都不碰 `process.env`，由 `lib/auth.ts` 讀環境變數後注入，方便測試

`lib/auth.ts` 的 `callbacks.signIn` 回傳 `canSignIn(...)`；回傳 `false` 時 Auth.js 會在 adapter 建立使用者**之前**中止，並導向 `pages.error`（設為 `/login`）附帶 `error=AccessDenied`。名單為空時用 `console.warn` 記錄一次（模組載入時），符合 spec 的「伺服器端記錄警告」。

**為什麼名單為空在正式環境要拒絕**：這是私人工具，「忘了設白名單結果全世界都能登入」比「忘了設結果誰都進不來」嚴重得多。開發環境放行是為了本機不用先設定名單就能測。`.env.example` 的說明要跟著改。

### D5. 資料模型：擴充 `User`，新增 Auth.js 三張表

依 `@auth/prisma-adapter` 的標準 schema：

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?           // adapter 需要，Google 登入時會填入
  name          String?
  image         String?
  createdAt     DateTime  @default(now())

  accounts Account[]
  sessions Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

`Account` 的 snake_case 欄位名是 adapter 的約定，不改名以免要寫 mapping。`VerificationToken` 目前（只有 OAuth）用不到，但 adapter 型別要求它存在，建了之後 Email provider 也能直接用。Migration 名稱 `add_auth_tables`，純新增，沒有資料搬移。

### D6. Prisma 7 與 adapter 的接法

`PrismaAdapter(db)`，`db` 是 `lib/db.ts` 的單例（Prisma 7 新版 generator 產生的 client）。adapter 的型別參數接受任何具備對應 model delegate 的物件，預期不需要轉型；若 TypeScript 因為新版 generator 的型別形狀報錯，用 `PrismaAdapter(db as never)` 加註解處理，執行期不受影響。這是本 change 最可能踩到的相容性問題，排在任務最前面先驗證。

### D7. 登入頁留在殼層內，導覽依路徑隱藏

`/login` 仍在根 layout 的 `AppShell` 裡，不用 route group 拆成兩套 layout。原因：根層 `not-found.tsx` 必須留在殼層內（`app-shell` spec 要求 404 頁有導覽列），而未匹配的 URL 只會由根層 `not-found.tsx` 處理；若把殼層搬進 `(app)` group，404 就會掉出殼層。

做法：`lib/nav-items.ts` 加 `isNavHidden(pathname)`（目前只有 `/login` 回傳 true），`BottomNav` 與 `SideNav` 在 hidden 時回傳 `null`；`AppShell` 的內容區在登入頁不需要預留導覽高度，但多預留也無害，不特別處理。

登入頁本身是 Server Component：讀 `searchParams.error` 與 `callbackUrl`，若 `auth()` 已有 session 就 `redirect('/')`；按鈕是 `<form action={signInAction}>`，Server Action 呼叫 `signIn("google", { redirectTo })`。

### D8. 回跳路徑的安全性

`requireUser` 組出的 `callbackUrl` 一律是站內相對路徑。登入頁把 `callbackUrl` 交給 `signIn` 前先用 `lib/session.ts` 的 `safeReturnTo(value)` 過濾：只接受以單一 `/` 開頭、不以 `//` 開頭、不含協定的字串，否則回 `/`。Auth.js 的 `redirect` callback 本身也只允許同源，這裡是雙重保險並讓行為可單元測試。

### D9. 頭像

Google 頭像來自 `lh3.googleusercontent.com`，`next.config.ts` 的 `images.remotePatterns` 加入該網域，用 `next/image` 顯示。`components/avatar.tsx` 接受 `name` 與 `image`，沒有 `image` 時顯示名稱首字（取第一個 Unicode 字元，中文名也正確）。

### D10. 環境變數

Auth.js v5 自動讀取 `AUTH_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`，不用在程式碼裡傳；`.env.example` 已有這三個。本地開發不需要 `AUTH_URL`。`AUTH_TRUST_HOST=true` 只在非 Vercel 的部署需要，留給 `deployment` change。`ALLOWED_EMAILS` 的說明改為「正式環境必填；為空時拒絕所有登入」。

### D11. 測試

- `lib/allowlist.test.ts`：parse 的大小寫／空白／空字串處理，`canSignIn` 的四種組合（名單有／無 × production 是／否）
- `lib/session.test.ts`：`safeReturnTo` 的接受與拒絕案例；`requireUser` 在無 session 時呼叫 `redirect` 並帶正確 `callbackUrl`（mock `auth` 與 `next/navigation`）
- `components/avatar.test.tsx`：有圖／無圖兩種渲染
- 真實的 Google 登入流程無法自動化（需要真實 OAuth client 與帳號），列為手動驗證任務，需要你先在 Google Cloud Console 建好 OAuth client

## Risks / Trade-offs

- [Auth.js v5 仍是 beta，可能有未文件化的行為差異] → 版本寫死；遇到阻斷性問題時以 better-auth 替換，因為白名單、session helper、頁面都不依賴 Auth.js 的 API，替換範圍只有 `lib/auth.ts` 與 route handler
- [`@auth/prisma-adapter` 對 Prisma 7 新版 generator 的型別相容性未經驗證] → 排在第一個任務驗證；型別問題用轉型繞過，執行期 API 相同
- [Google OAuth 同意畫面若維持「測試中」狀態，只能加 100 位測試使用者且 refresh token 7 天過期] → 本專案只用 Google 做登入、不保存需要長期有效的 token，7 天過期不影響；朋友的 email 加入測試使用者即可。這是 Google Cloud Console 的設定，記在 README
- [iOS 以 PWA 獨立模式開啟時，OAuth 跳轉可能開到 Safari 而回不到 PWA] → 本 change 不處理，`pwa` change 驗證並決定是否需要 `display: standalone` 以外的設定
- [database session 每個請求多一次查詢] → 流量極小；`requireUser` 保證每個頁面只查一次
- [名單為空在正式環境拒絕所有人，部署時忘了設會「鎖在門外」] → `/login` 的錯誤訊息區分 AccessDenied，加上伺服器 warn log，容易診斷；比反向的風險小得多

## Migration Plan

1. 套用 migration `add_auth_tables`（純新增欄位與資料表，`User.emailVerified` 可為 null，既有資料不受影響；目前資料庫沒有任何使用者）
2. 設定環境變數（`AUTH_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`、`ALLOWED_EMAILS`）
3. 部署程式碼

回滾：`git revert` 本 change 的 commit，並以 `prisma migrate` 建立反向 migration 移除三張表與 `emailVerified` 欄位；或直接 `docker compose down -v` 重置本機資料庫。

## Open Questions

- Google OAuth 同意畫面要維持「測試中」（最多 100 位測試使用者，夠用）還是走「發布」流程（需要隱私權政策頁面）：不影響程式碼與任務拆分，部署前決定即可
- `/me` 之後要放的設定項目（例如深色模式切換、預設收藏清單）由各自的 change 決定，本 change 只放身分與登出
