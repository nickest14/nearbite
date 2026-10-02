## Why

Nearbite 目前只有規劃文件與 Postgres 的 Docker Compose，還沒有任何程式碼。後續所有功能（登入、附近搜尋、評論、收藏）都需要一個可以跑起來、連得上資料庫、有一致行動版版面的應用骨架作為基礎。這是路線圖的第 1 個 change，必須先完成。

## What Changes

- 建立 Next.js（App Router）專案：TypeScript strict、Tailwind CSS、ESLint、Prettier、Vitest
- 加入 Prisma，連接 Docker Compose 的 Postgres，建立第一個 migration（先只含 Auth.js 會用到的 `User` 基礎欄位，其餘實體留給各自的 change）
- 建立行動優先的應用殼層：根版面、底部導覽列（探索／搜尋／收藏／我）、四個對應的佔位頁面
- 建立設計 token（顏色、間距、字級、圓角）作為 Tailwind 主題，之後所有 UI 共用
- 新增 `/api/health` 端點，回報應用與資料庫連線狀態，作為開發環境的驗證點
- 更新 README：本機啟動步驟

## Capabilities

### New Capabilities

- `app-shell`：應用殼層與導覽。定義根版面、底部導覽列的行為（當前 tab 高亮、觸控目標尺寸）、四個頂層路由的存在與桌面版的漸進增強版面。
- `health-check`：`/api/health` 端點的回應格式與資料庫連線失敗時的行為。

### Modified Capabilities

無（目前沒有既有的 spec）。

## Non-goals

- 不實作登入、搜尋、評論、收藏任何業務功能，四個頁面只是佔位
- 不建立 `Restaurant`、`Review`、`FavoriteList` 等資料表，由後續 change 各自新增
- 不做 PWA manifest 與 Service Worker（路線圖第 8 項）
- 不設定 CI／部署（路線圖第 9 項）
- 不整合 Google Maps 或 Places API

## 對行動裝置體驗與定位／隱私的影響

- **行動體驗**：這個 change 決定了之後所有頁面的基礎版面。底部導覽固定在畫面底部、觸控目標至少 44×44px、內容區預留 safe-area（iPhone 瀏海與 Home indicator）。這些若現在沒做好，後面每個 change 都要補。
- **定位／隱私**：本 change 不請求任何權限、不收集任何使用者資料，`/api/health` 不回傳敏感資訊（不含連線字串、不含版本號以外的環境細節）。

## Impact

- **新增**：整個 Next.js 專案結構（`app/`、`components/`、`lib/`、`prisma/`）、`package.json` 與鎖定檔、Tailwind／ESLint／Prettier／Vitest／TypeScript 設定檔、`README.md`
- **修改**：`.gitignore`（加入 `.next/`、`coverage/` 等）、`.env.example`（若需補充變數）
- **相依**：Node.js 20+、pnpm、Docker（Postgres）
- **不影響**：`docker-compose.yml`、`openspec/config.yaml`、`docs/product-plan.md`
