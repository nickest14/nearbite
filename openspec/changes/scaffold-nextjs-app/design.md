## Context

目前 repo 只有 `docker-compose.yml`（Postgres 16）、`.env.example`、OpenSpec 設定與 `docs/product-plan.md`，沒有任何程式碼。動機見 proposal.md。

本機環境的既定條件（2026-10 查核）：

- Node.js 20.19.4（Next.js 16 要求 ≥ 20.9，符合）
- pnpm 未安裝，但 corepack 0.32 可用
- npm 上的版本：Next.js 16.3、Tailwind CSS 4.3、Vitest 5.0、`@prisma/client` 7.10（`prisma` 套件的 `latest` 標籤目前指向 8.0.0-rc，**不可直接用 `@latest` 安裝**）

後續 change 的需求會反過來約束這裡的選擇：Auth.js 需要 Prisma adapter 與 `User` 表；Google Maps 需要 Client Component 邊界清楚；PWA 需要 `viewport-fit=cover` 與 safe-area 從一開始就處理好。

## Goals / Non-Goals

**Goals:**

- 一個 `pnpm dev` 就能跑、`prisma migrate dev` 就能建表的專案，新開發者照 README 十分鐘內完成設定
- 行動版版面的基礎決策（底部導覽、safe-area、觸控尺寸、設計 token）一次做對，後面不用回頭補
- Server / Client Component 邊界的慣例在骨架階段就示範清楚
- 測試基礎設施就位，後續 change 可以直接寫測試而不用先搭環境

**Non-Goals:**

- 不追求 Lighthouse 分數或 bundle 最佳化，等有真實頁面再說
- 不建立完整的 UI 元件庫，只做殼層需要的元件（導覽列、頁面容器、頁首）
- 不設定 Docker 化的 Next.js 服務；App 直接跑在本機

## Decisions

### D1. 套件管理：pnpm，透過 corepack 啟用

`corepack enable && corepack prepare pnpm@latest --activate`，並在 `package.json` 加 `packageManager` 欄位鎖定版本，確保不同電腦用同一版。

**替代方案**：npm（不用額外步驟，但 `node_modules` 大、安裝慢）；bun（快但與部分工具相容性仍不穩）。pnpm 是 Next.js 生態最常見的選擇，與 Vercel 相容無虞。

### D2. Prisma 鎖定 7.x，使用 driver adapter

`prisma` 與 `@prisma/client` 都明確安裝 `^7.10.0`，不用 `latest`。Prisma 7 預設不再附帶 Rust 查詢引擎，連線透過 `@prisma/adapter-pg` + `pg` 進行；資料庫 URL 放在 `prisma.config.ts` 讀取 `DATABASE_URL`。

Prisma Client 以單例模式輸出（`lib/db.ts`），開發模式下掛在 `globalThis` 避免熱更新時連線數爆炸。

**替代方案**：Drizzle（更輕、SQL-first，但 Auth.js 的 Prisma adapter 更成熟、product-plan 已選定 Prisma）；Prisma 8 RC（新功能但 RC 不適合作為基礎）。

### D3. 第一個 migration 只建 `User` 表的基礎欄位

Schema 先只有 `User { id, email, name, image, createdAt }`。Auth.js 的 `Account`、`Session` 等表留給 `google-auth` change，其他實體留給各自的 change。這樣每個 change 的 migration 都對應它自己的功能，review 時容易對照。

**替代方案**：一次把 product-plan 的完整 schema 建好。否決，因為會讓這個 change 承擔它不實作的功能的資料模型決策，違反「每個 change 只處理一項功能」。

### D4. Tailwind CSS 4，CSS-first 設定，設計 token 用 `@theme`

Tailwind 4 不再用 `tailwind.config.js`，主題直接在 `app/globals.css` 用 `@theme { --color-brand-500: ...; }` 定義。設計 token 分三層：

- **原始值**：`--color-brand-*`（品牌色階）、`--color-neutral-*`、`--spacing-*`、`--radius-*`、`--font-size-*`
- **語意值**：`--color-surface`、`--color-text`、`--color-text-muted`、`--color-border`、`--color-accent`，支援 `prefers-color-scheme: dark` 切換
- **元件層**：由各元件自行用 Tailwind utility 組合，不另外抽象

品牌色先用一個暖橘色系作為佔位（食物主題），之後要換只需改 `@theme` 一處。

**替代方案**：CSS Modules + 自訂變數（更自由但失去 utility 的開發速度）；shadcn/ui（好用但會帶入 Radix 等相依，殼層階段不需要）。

### D5. 版面結構：root layout 放導覽，頁面只負責內容

```
app/
  layout.tsx          ← <html lang="zh-Hant-TW">、字型、<AppShell>
  globals.css         ← Tailwind + @theme
  page.tsx            ← 探索（佔位）
  search/page.tsx
  lists/page.tsx
  me/page.tsx
  not-found.tsx       ← 404，仍在 AppShell 內
  api/health/route.ts
components/
  app-shell.tsx       ← Server Component：版面容器 + <BottomNav /> + <SideNav />
  bottom-nav.tsx      ← Client Component：用 usePathname 決定高亮
  page-header.tsx     ← 頁面標題列
lib/
  db.ts               ← Prisma 單例
  nav-items.ts        ← 四個導覽項目的單一來源（路徑、標籤、圖示）
```

`AppShell` 是 Server Component，只有 `BottomNav` 因為需要 `usePathname()` 才是 Client Component，示範「只在需要時下沉到 client」的慣例。導覽項目定義在 `lib/nav-items.ts`，底部導覽與桌面側欄共用，避免兩處不同步。

### D6. 行動版與桌面版切換用 CSS，不用 JS 偵測

底部導覽 `lg:hidden`、側邊導覽 `hidden lg:flex`，同時渲染兩者由 CSS 決定顯示。內容區在行動版加 `pb-[calc(theme(spacing.16)+env(safe-area-inset-bottom))]` 預留導覽列高度與安全區域；導覽列本身 `pb-[env(safe-area-inset-bottom)]`。

**替代方案**：用 `matchMedia` 在 client 判斷只渲染一個。否決，因為會造成 hydration 不一致與首屏閃爍。

### D7. 圖示用 `lucide-react`

輕量、tree-shakeable、風格一致，後續餐廳卡片與篩選列也會用到同一套。

### D8. `/api/health` 用 Route Handler，查詢加 3 秒逾時

`SELECT 1` 包在 `Promise.race` 與 3 秒 timer 裡，失敗或逾時都回 503 + 固定 JSON，錯誤只 `console.error` 到伺服器端。設定 `export const dynamic = 'force-dynamic'` 並回傳 `Cache-Control: no-store`。

### D9. 測試：Vitest + Testing Library，jsdom 環境

- 單元測試：`nav-items` 的資料完整性、`BottomNav` 的高亮邏輯（mock `usePathname`）
- Route Handler 測試：`/api/health` 的正常與失敗路徑（mock Prisma）
- 不在這個 change 導入 Playwright，等有真實互動流程再加

### D10. 程式碼品質工具

- ESLint 用 Next.js 16 的 flat config（`eslint-config-next`）+ `typescript-eslint` strict
- Prettier 搭配 `prettier-plugin-tailwindcss` 自動排序 class
- `pnpm check` 腳本串接 `tsc --noEmit`、`eslint`、`prettier --check`、`vitest run`，作為 commit 前的單一驗證指令

## Risks / Trade-offs

- [Next.js 16 與 Tailwind 4 都是較新的大版本，部分套件或範例還停在舊版] → 以官方文件為準，遇到不相容的第三方套件時優先找替代而非降版；design 中記錄的版本在 tasks 執行時再次核對
- [Prisma 7 的 driver adapter 模式與多數網路教學（Prisma 5/6）不同] → README 與 `lib/db.ts` 加註解說明；若 Auth.js Prisma adapter 與 Prisma 7 有相容問題，在 `google-auth` change 處理，不影響本 change
- [`prisma` 套件 `latest` 指向 RC，有人手動 `pnpm add prisma` 會裝到 8.x] → `package.json` 明確鎖 `^7.10.0`，README 提醒
- [桌面版同時渲染兩套導覽，略增 HTML 體積] → 導覽只有四個項目，成本可忽略；換來無 hydration 問題
- [設計 token 的佔位色之後可能全換] → token 集中在一處，換色只改 `@theme`
- [Node 20 將於 2026-04 結束 LTS 維護，本機仍是 20.19] → 這個 change 不強制升級，但 `.nvmrc` 寫 `22` 並在 README 建議升級；Next.js 16 兩個版本都支援

## Migration Plan

全新專案，無既有資料或使用者，不需遷移。

部署面：本 change 不部署。但所有決策維持 Vercel 相容（無檔案系統寫入、無長駐程序），確保 `deployment` change 不用回頭改。

回滾：若骨架有根本問題，直接 `git revert` 整個 change 的 commit，沒有外部狀態需要清理（本機 Postgres 可 `docker compose down -v` 重置）。

## Open Questions

- 字型：先用系統字型堆疊（`system-ui, -apple-system, "Noto Sans TC", ...`），之後是否要載入 Noto Sans TC web font 可在 UI 真正成形時再決定，不影響本 change 的任務拆分
- 深色模式：token 已預留 `prefers-color-scheme` 切換，但是否提供手動切換開關可延後到 `me` 頁有設定區時決定
