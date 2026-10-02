# app-shell Specification

## Purpose

定義 Nearbite 應用的外殼：根版面、底部導覽列與四個頂層頁面的存在與行為，讓後續每個功能頁面都能在一致的行動優先框架中呈現。

## Requirements

### Requirement: 四個頂層路由存在且可到達
應用 SHALL 提供四個頂層路由：`/`（探索）、`/search`（搜尋）、`/lists`（收藏）、`/me`（我）。每個路由 SHALL 回傳 HTTP 200 並顯示該頁面的標題。

#### Scenario: 直接開啟任一頂層路由
- **WHEN** 使用者在瀏覽器直接輸入 `/`、`/search`、`/lists` 或 `/me`
- **THEN** 頁面成功載入（HTTP 200）並顯示對應的頁面標題（探索／搜尋／收藏／我）

#### Scenario: 開啟不存在的路由
- **WHEN** 使用者開啟未定義的路徑（例如 `/foo`）
- **THEN** 顯示繁體中文的 404 頁面，並提供回到首頁的連結，底部導覽列仍然可見

### Requirement: 底部導覽列
所有頂層頁面 SHALL 在畫面底部顯示固定的導覽列，包含四個項目（探索、搜尋、收藏、我），每個項目有圖示與文字標籤。導覽列 SHALL 在內容捲動時維持固定位置。

#### Scenario: 當前頁面高亮
- **WHEN** 使用者位於 `/lists`
- **THEN** 導覽列的「收藏」項目以高亮樣式顯示，其他三個項目為一般樣式，且高亮項目帶有 `aria-current="page"` 屬性

#### Scenario: 點擊切換頁面
- **WHEN** 使用者在 `/` 點擊導覽列的「我」
- **THEN** 導航至 `/me`，不整頁重新載入，導覽列的高亮切換為「我」

#### Scenario: 長內容捲動
- **WHEN** 頁面內容高度超過視窗，使用者向下捲動
- **THEN** 底部導覽列維持在畫面底部可見，且頁面最底部的內容不被導覽列遮住

### Requirement: 觸控目標尺寸
底部導覽列的每個項目 SHALL 具有至少 44×44 CSS 像素的可點擊區域。

#### Scenario: 在 375px 寬度下量測
- **WHEN** 視窗寬度為 375px
- **THEN** 每個導覽項目的可點擊區域寬度與高度皆不小於 44px

### Requirement: 安全區域適配
應用 SHALL 尊重裝置的安全區域（safe area）：底部導覽列 SHALL 在有 Home indicator 的裝置上額外加上底部內距，使導覽項目不被系統 UI 遮擋。

#### Scenario: iOS Safari 全螢幕模式
- **WHEN** 應用在具有底部安全區域的裝置上以獨立模式（standalone）開啟
- **THEN** 導覽列的底部內距等於或大於系統回報的安全區域底部值，導覽項目完整可見

### Requirement: 桌面版漸進增強
在視窗寬度大於等於 1024px 時，應用 SHALL 將導覽改為側邊欄或頂部列，並將內容區限制在合理的最大寬度內置中；行動版的功能與路由不變。

#### Scenario: 在桌面寬度開啟
- **WHEN** 視窗寬度為 1280px
- **THEN** 底部導覽列不顯示，改以側邊或頂部導覽呈現相同的四個項目，內容區水平置中且最大寬度不超過 1024px

### Requirement: 語言與基本中繼資料
所有頁面的 `<html lang>` SHALL 為 `zh-Hant-TW`，`<title>` SHALL 包含「Nearbite」，viewport SHALL 設定為 `width=device-width, initial-scale=1, viewport-fit=cover`。

#### Scenario: 檢視頁面原始碼
- **WHEN** 開啟任一頁面並檢視 HTML
- **THEN** `<html>` 的 `lang` 屬性為 `zh-Hant-TW`，`<title>` 含有 Nearbite，viewport meta 含有 `viewport-fit=cover`
