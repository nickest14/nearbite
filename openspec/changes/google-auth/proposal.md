## Why

Nearbite 是自己與朋友用的私人工具，評論與收藏都綁定個人身分，沒有登入就做不了任何後續功能（評論、收藏清單都是路線圖的下一步）。這是路線圖的第 2 個 change，必須在餐廳搜尋之前完成，之後的頁面才能一開始就以「已登入的使用者」為前提設計。

## What Changes

- 加入 Auth.js（NextAuth v5）+ Google OAuth 登入，session 存在 Postgres（Prisma adapter）
- 以 `ALLOWED_EMAILS` 白名單控制誰能登入；不在名單上的 Google 帳號會被拒絕並看到說明
- 新增 `/login` 頁：單一「使用 Google 登入」按鈕，顯示被拒絕或登入失敗的原因
- 四個頂層頁面改為需要登入；未登入時導向 `/login`，登入後回到原本要去的頁面
- `/me` 頁顯示目前使用者的頭像、名稱、email，並提供登出
- 擴充 `User` 資料表並新增 Auth.js 需要的 `Account`、`Session`、`VerificationToken`（一個 migration）
- 登入頁不顯示底部導覽與側欄（未登入時導覽沒有意義）

## Capabilities

### New Capabilities

- `user-auth`：使用者身分驗證。涵蓋 Google 登入流程、白名單判定、session 維持與登出、未登入存取受保護頁面的導向行為、登入頁的呈現，以及 `/me` 顯示目前身分。

### Modified Capabilities

無。`app-shell` 的「四個頂層路由回傳 200」在已登入狀態下仍成立；未登入的導向行為屬於 `user-auth` 的新需求，不改動 `app-shell` 的既有要求。

## Non-goals

- 不做 Email + 密碼、Magic link 或其他 OAuth provider
- 不做角色／權限系統（管理員等），所有白名單內的使用者權限相同
- 不做使用者資料編輯（改名、換頭像），顯示的是 Google 提供的資料
- 不做邀請連結或自助申請加入白名單，名單由環境變數管理
- 不實作 `/share/[token]` 的公開存取（屬於 `favorite-lists` change），但本 change 的路由保護設計必須允許之後加入公開路由

## 對行動裝置體驗與定位／隱私的影響

- **行動體驗**：Google OAuth 在手機瀏覽器會跳轉到 Google 的登入頁再回來，是手機上最少打字的登入方式。登入按鈕放在畫面中央偏下、至少 44px 高。PWA 獨立模式下的 OAuth 跳轉在 iOS 可能會開新視窗，這個問題留到 `pwa` change 驗證。
- **隱私**：只向 Google 要求最基本的 `openid email profile` scope，只儲存 email、名稱、頭像 URL 與 OAuth token（Auth.js adapter 的標準欄位）。不會要求通訊錄、日曆等額外權限。白名單是「哪些 email 可以登入」的設定，不會把名單暴露給使用者；被拒絕的使用者只會看到「不在名單上」而非名單內容。
- **不涉及定位**：本 change 不請求定位權限。

## Impact

- **新增**：`lib/auth.ts`（Auth.js 設定）、`lib/session.ts`（`requireUser` 等 helper）、`lib/allowlist.ts`、`app/login/`、`app/api/auth/[...nextauth]/`、相關測試
- **修改**：`prisma/schema.prisma` 與新 migration、四個頂層頁面加上登入檢查、`app/me/page.tsx` 顯示身分與登出、`components/bottom-nav.tsx` 與 `side-nav.tsx` 在登入頁隱藏、`next.config.ts`（允許 Google 頭像網域）、`.env.example`（白名單為空時的行為說明）
- **新相依**：`next-auth@beta`（5.0.0-beta.32，peer deps 支援 Next.js 16）、`@auth/prisma-adapter`
- **外部設定**：需要在 Google Cloud Console 建立 OAuth 2.0 Client ID，並設定重新導向 URI；這是使用者（你）要做的一次性手動步驟
