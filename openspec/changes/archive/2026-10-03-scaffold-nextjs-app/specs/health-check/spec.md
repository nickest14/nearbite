## Purpose

提供一個不需登入的健康檢查端點，讓開發者與部署平台能確認應用程式正在運作、且能連上資料庫。

## ADDED Requirements

### Requirement: 健康檢查端點
應用 SHALL 提供 `GET /api/health` 端點，回傳 JSON 格式的狀態，包含 `status`（`ok` 或 `degraded`）、`database`（`ok` 或 `error`）與 `timestamp`（ISO 8601）。端點 SHALL 不需要任何驗證。

#### Scenario: 應用與資料庫皆正常
- **WHEN** 資料庫可連線且能執行簡單查詢
- **THEN** 回傳 HTTP 200，`status` 為 `ok`，`database` 為 `ok`

#### Scenario: 資料庫無法連線
- **WHEN** 資料庫連線失敗或查詢逾時（超過 3 秒）
- **THEN** 回傳 HTTP 503，`status` 為 `degraded`，`database` 為 `error`，應用程式本身不當機

### Requirement: 不洩漏敏感資訊
健康檢查的回應 SHALL NOT 包含資料庫連線字串、主機名稱、帳號、密碼、堆疊追蹤或任何環境變數的值。

#### Scenario: 資料庫錯誤時的回應內容
- **WHEN** 資料庫連線失敗並回傳 503
- **THEN** 回應 body 不含錯誤堆疊、連線字串或主機資訊，只有固定格式的狀態欄位

### Requirement: 不被快取
健康檢查回應 SHALL 帶有 `Cache-Control: no-store` 標頭，確保每次請求都反映即時狀態。

#### Scenario: 連續請求
- **WHEN** 連續兩次請求 `/api/health`，中間資料庫由正常變為不可用
- **THEN** 第二次回應反映 `degraded` 狀態，而非回傳第一次的快取結果
