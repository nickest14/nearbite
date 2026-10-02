## 1. 工具鏈與專案初始化

- [x] 1.1 啟用 pnpm：`corepack enable && corepack prepare pnpm@latest --activate`，確認 `pnpm -v` 可執行；新增 `.nvmrc`（內容 `22`）
      驗證：`pnpm -v` 輸出版本號
- [x] 1.2 以 `create-next-app` 建立 Next.js 16 專案（TypeScript、Tailwind、ESLint、App Router、`src/` 不啟用、import alias `@/*`），刪除範本的示範內容與圖片
      驗證：`pnpm dev` 啟動、首頁空白無錯誤
- [x] 1.3 在 `package.json` 加入 `packageManager` 欄位；調整 `tsconfig.json` 為 strict 並開啟 `noUncheckedIndexedAccess`
      驗證：`pnpm tsc --noEmit` 通過
- [x] 1.4 更新 `.gitignore`：加入 `.next/`、`coverage/`、`*.tsbuildinfo`、`next-env.d.ts`
      驗證：`git status` 不列出建置產物

## 2. 程式碼品質工具

- [x] 2.1 設定 ESLint flat config：`eslint-config-next` + `typescript-eslint` strict；設定 Prettier + `prettier-plugin-tailwindcss`，加入 `.prettierrc` 與 `.prettierignore`
      驗證：`pnpm eslint .` 與 `pnpm prettier --check .` 在範本程式碼上通過
- [x] 2.2 安裝 Vitest 5 + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom`，建立 `vitest.config.ts`（jsdom 環境、`@/` alias、setup 檔）與一個最小的 smoke test
      驗證：`pnpm vitest run` 執行並通過 1 個測試
- [x] 2.3 在 `package.json` 加入 scripts：`check`（串接 `tsc --noEmit`、`eslint .`、`prettier --check .`、`vitest run`）、`test`、`lint`、`format`、`db:migrate`、`db:studio`
      驗證：`pnpm check` 一次跑完全部並通過

## 3. 資料庫與 Prisma

- [x] 3.1 安裝 `prisma@^7.10.0`、`@prisma/client@^7.10.0`、`@prisma/adapter-pg`、`pg`（明確指定版本，不用 `latest`）；建立 `prisma.config.ts` 讀取 `DATABASE_URL`
      驗證：`pnpm prisma --version` 顯示 7.x
- [x] 3.2 撰寫 `prisma/schema.prisma`：datasource postgresql、generator client，以及 `User` model（`id`、`email` unique、`name?`、`image?`、`createdAt`）
      驗證：`pnpm prisma validate` 通過
- [x] 3.3 啟動 `docker compose up -d`，執行 `pnpm prisma migrate dev --name init` 建立第一個 migration
      驗證：`prisma/migrations/` 出現 init 資料夾；`pnpm prisma studio` 看得到 `User` 表
- [x] 3.4 建立 `lib/db.ts`：以 `@prisma/adapter-pg` 建立 Prisma Client 單例，開發模式掛在 `globalThis`，附註解說明 Prisma 7 driver adapter 模式
      驗證：在 Node REPL 或臨時腳本 `import { db } from '@/lib/db'` 後執行 `db.user.count()` 回傳 0

## 4. 設計 token 與全域樣式

- [x] 4.1 在 `app/globals.css` 用 Tailwind 4 `@theme` 定義原始 token：品牌色階（暖橘佔位，50–900）、中性色階、間距、圓角、字級
      驗證：在任一頁面使用 `bg-brand-500` 可正確渲染顏色
- [x] 4.2 定義語意 token（`--color-surface`、`--color-text`、`--color-text-muted`、`--color-border`、`--color-accent`）並在 `@media (prefers-color-scheme: dark)` 下覆寫；設定 `body` 的背景與文字色、系統字型堆疊（含 Noto Sans TC fallback）
      驗證：切換系統深色模式，頁面背景與文字色跟著變

## 5. 應用殼層

- [x] 5.1 建立 `lib/nav-items.ts`：匯出四個導覽項目（`href`、`label`、`icon`），安裝 `lucide-react` 並選定圖示（探索 Compass、搜尋 Search、收藏 Bookmark、我 User）
      驗證：單元測試確認 4 個項目、`href` 唯一、`label` 非空
- [x] 5.2 建立 `components/bottom-nav.tsx`（Client Component）：用 `usePathname` 判斷當前項目、高亮樣式、`aria-current="page"`、每個項目最小 44×44px、`pb-[env(safe-area-inset-bottom)]`、`lg:hidden`
      驗證：單元測試 mock `usePathname` 為 `/lists`，確認「收藏」帶 `aria-current`
- [x] 5.3 建立 `components/side-nav.tsx`（桌面版，`hidden lg:flex`）共用 `nav-items`，以及 `components/page-header.tsx` 頁面標題列
      驗證：1280px 寬度下側欄顯示、底部導覽隱藏
- [x] 5.4 建立 `components/app-shell.tsx`（Server Component）：組合 `SideNav`、內容區（行動版底部預留導覽高度 + safe-area、桌面版 `max-w-5xl mx-auto`）、`BottomNav`
      驗證：在 375px 寬度下放入超長內容，捲到底部最後一行不被導覽列遮住
- [x] 5.5 更新 `app/layout.tsx`：`<html lang="zh-Hant-TW">`、`metadata`（title template `%s | Nearbite`）、`viewport`（`width=device-width, initial-scale=1, viewport-fit=cover`）、套用 `AppShell`
      驗證：檢視原始碼確認 `lang`、`<title>` 含 Nearbite、viewport 含 `viewport-fit=cover`

## 6. 頁面

- [x] 6.1 建立四個佔位頁面 `app/page.tsx`、`app/search/page.tsx`、`app/lists/page.tsx`、`app/me/page.tsx`：各自設定 `metadata.title`，使用 `PageHeader` 顯示標題與一句說明文字
      驗證：四個路由皆 HTTP 200，標題正確，導覽高亮對應
- [x] 6.2 建立 `app/not-found.tsx`：繁體中文 404 訊息 + 回首頁連結，仍在 `AppShell` 內
      驗證：開啟 `/foo` 顯示 404 頁面且底部導覽可見

## 7. 健康檢查端點

- [x] 7.1 建立 `app/api/health/route.ts`：`GET` 執行 `SELECT 1` 包 3 秒逾時，成功回 200 `{ status: 'ok', database: 'ok', timestamp }`，失敗回 503 `{ status: 'degraded', database: 'error', timestamp }`；`dynamic = 'force-dynamic'`、`Cache-Control: no-store`；錯誤只 `console.error`
      驗證：`curl -i localhost:3000/api/health` 回 200 與 `no-store` 標頭；`docker compose stop db` 後再 curl 回 503 且 body 無連線字串
- [x] 7.2 撰寫 `/api/health` 的 Vitest 測試：mock `@/lib/db`，涵蓋成功、查詢拋錯、查詢逾時三個情境，並斷言回應不含 `DATABASE_URL` 的內容
      驗證：`pnpm vitest run` 通過

## 8. 文件與收尾

- [x] 8.1 撰寫 `README.md`：專案一句話說明、需求（Node 20+／pnpm／Docker）、本機啟動步驟（複製 env → compose up → install → migrate → dev）、常用指令、Prisma 7 與版本鎖定的注意事項、連結到 `docs/product-plan.md`
      驗證：照 README 從零走一遍能跑起來
- [x] 8.2 檢查 `.env.example` 是否需補充（例如 `NODE_ENV` 不需要；確認 `DATABASE_URL` 格式與 `prisma.config.ts` 一致）
      驗證：`cp .env.example .env` 後不改其他值即可 `prisma migrate dev`
- [x] 8.3 在 375px 寬度下手動走過四個頁面與 404，確認觸控尺寸與 safe-area；在 1280px 下確認桌面版面；最後執行 `pnpm check` 全綠
      驗證：`pnpm check` 退出碼 0，手動檢查無版面問題
