# user-auth Specification

## Purpose

定義 Nearbite 的使用者身分驗證：以 Google 帳號登入、以 email 白名單決定誰能進入、維持與結束 session，以及未登入時如何被導向登入頁，讓後續所有功能都能以「已知身分的使用者」為前提運作。

## Requirements

### Requirement: 以 Google 帳號登入
系統 SHALL 在 `/login` 提供「使用 Google 登入」的操作。使用者完成 Google 授權且 email 通過白名單檢查後，系統 SHALL 建立登入 session，並將使用者導向原本要前往的站內路徑；若沒有指定路徑或路徑不是站內相對路徑，SHALL 導向 `/`。

#### Scenario: 白名單內的帳號首次登入
- **WHEN** 使用者以白名單內的 Google 帳號完成授權，且系統內尚無此 email 的使用者記錄
- **THEN** 系統建立使用者記錄（email、名稱、頭像）、建立 session，並導向 `/`

#### Scenario: 同一帳號再次登入
- **WHEN** 已存在記錄的使用者再次以同一 Google 帳號登入
- **THEN** 系統沿用既有的使用者記錄，不建立重複的使用者

#### Scenario: 登入後回到原本的頁面
- **WHEN** 使用者因未登入從 `/lists` 被導向登入頁，接著成功登入
- **THEN** 系統導向 `/lists`

#### Scenario: 回跳路徑不是站內路徑
- **WHEN** 登入頁被帶入指向外部網站的回跳路徑（例如 `https://evil.example`）並成功登入
- **THEN** 系統忽略該路徑並導向 `/`

### Requirement: 只要求最基本的 Google 權限
系統向 Google 請求授權時 SHALL 只要求 `openid`、`email`、`profile` 範圍，SHALL NOT 要求通訊錄、日曆或其他額外資料的存取權。

#### Scenario: Google 授權畫面
- **WHEN** 使用者點擊「使用 Google 登入」並進入 Google 的授權畫面
- **THEN** 畫面只列出基本個人資料與 email 的存取，沒有其他權限項目

### Requirement: Email 白名單
系統 SHALL 依 `ALLOWED_EMAILS` 設定（逗號分隔的 email 清單）決定是否允許登入。比對 SHALL 忽略大小寫與前後空白。不在名單上的帳號 SHALL 被拒絕：不建立使用者記錄、不建立 session，並導回 `/login` 顯示不在名單的說明。

#### Scenario: 不在名單上的帳號
- **WHEN** 使用者以不在 `ALLOWED_EMAILS` 內的 Google 帳號完成授權
- **THEN** 系統不建立使用者記錄與 session，導向 `/login` 並顯示「這個 Google 帳號不在允許名單內」的訊息

#### Scenario: 大小寫與空白不同
- **WHEN** `ALLOWED_EMAILS` 含有 ` Friend@Example.com `，使用者以 `friend@example.com` 登入
- **THEN** 系統視為在名單內並允許登入

#### Scenario: 名單為空時的正式環境
- **WHEN** 應用以正式環境執行且 `ALLOWED_EMAILS` 未設定或為空
- **THEN** 所有登入嘗試都被拒絕，伺服器端記錄一則說明名單未設定的警告

#### Scenario: 名單為空時的開發環境
- **WHEN** 應用以開發環境執行且 `ALLOWED_EMAILS` 未設定或為空
- **THEN** 任何 Google 帳號都可以登入，伺服器端記錄一則提醒

### Requirement: 受保護頁面要求登入
除了 `/login`、`/api/health` 與 Google 登入流程本身使用的路徑之外，應用的所有頁面 SHALL 要求登入。未登入的使用者存取受保護頁面時，系統 SHALL 導向 `/login` 並附帶原本的路徑作為回跳目標。已登入的使用者開啟 `/login` 時 SHALL 直接導向 `/`。

#### Scenario: 未登入存取頂層頁面
- **WHEN** 未登入的使用者開啟 `/lists`
- **THEN** 系統導向 `/login`，且回跳目標為 `/lists`

#### Scenario: 未登入存取健康檢查
- **WHEN** 未登入的使用者請求 `/api/health`
- **THEN** 系統正常回應，不要求登入

#### Scenario: 已登入開啟登入頁
- **WHEN** 已登入的使用者開啟 `/login`
- **THEN** 系統導向 `/`

### Requirement: Session 維持與登出
登入後的 session SHALL 在關閉瀏覽器後仍然保留，有效期至少 30 天，期間內持續使用 SHALL 延長有效期。使用者在 `/me` 執行登出後，系統 SHALL 使該 session 失效並導向 `/login`。

#### Scenario: 關閉瀏覽器後再開
- **WHEN** 使用者登入後關閉瀏覽器，隔天再開啟應用
- **THEN** 使用者仍處於登入狀態，不需重新登入

#### Scenario: 登出
- **WHEN** 已登入的使用者在 `/me` 點擊登出
- **THEN** 系統導向 `/login`，再開啟 `/me` 會被導回 `/login`

#### Scenario: 登出後重用舊的 session
- **WHEN** 使用者登出後，以登出前的 session 識別資訊再次請求受保護頁面
- **THEN** 系統視為未登入並導向 `/login`

### Requirement: 登入頁的呈現
`/login` SHALL 以繁體中文呈現，提供單一的「使用 Google 登入」按鈕（可點擊區域高度至少 44px），且 SHALL NOT 顯示應用的主要導覽（底部導覽列與側欄）。登入失敗時 SHALL 依原因顯示對應訊息。

#### Scenario: 一般開啟登入頁
- **WHEN** 未登入的使用者開啟 `/login`
- **THEN** 頁面顯示應用名稱、簡短說明與「使用 Google 登入」按鈕，沒有底部導覽列與側欄

#### Scenario: 使用者在 Google 端取消
- **WHEN** 使用者在 Google 授權畫面取消或授權流程失敗
- **THEN** 系統導回 `/login` 並顯示「登入未完成，請再試一次」類的訊息，使用者可以重新點擊登入

### Requirement: 顯示目前身分
`/me` SHALL 顯示目前登入使用者的頭像、名稱與 email，以及登出按鈕（可點擊區域高度至少 44px）。若使用者沒有頭像，SHALL 以名稱首字作為替代顯示。

#### Scenario: 有頭像的使用者
- **WHEN** 已登入且 Google 帳號有頭像的使用者開啟 `/me`
- **THEN** 頁面顯示該頭像、名稱、email 與登出按鈕

#### Scenario: 沒有頭像的使用者
- **WHEN** 已登入但 Google 帳號沒有頭像的使用者開啟 `/me`
- **THEN** 頁面以名稱首字的圓形佔位圖取代頭像，其餘資訊照常顯示
