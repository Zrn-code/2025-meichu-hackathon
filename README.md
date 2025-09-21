# 2025 Meichu Hackathon

本專案為 2025 年梅竹黑客松（Meichu Hackathon）開發專案，包含多個子系統，涵蓋後端伺服器、語音生成服務、Chrome 擴充功能與 Windows 桌面應用。

## 專案結構

```
backend-server/           # Python 後端伺服器，處理 API 與核心邏輯
chrome-extension/         # Chrome 擴充功能，提供瀏覽器端互動
lemonade-server/          # 其他服務（用途請補充）
voice-generation-server/  # 語音生成服務，支援語音合成
windows-app/              # Windows 桌面應用，前端 UI 與整合
```

## 子專案簡介

### backend-server
- 使用 Python 開發，負責 API、資料處理與業務邏輯。
- 主要檔案：`main.py`, `server.py`, `requirements.txt`

### chrome-extension
- Chrome 擴充功能，增強瀏覽器端體驗。
- 主要檔案：`background.js`, `content.js`, `manifest.json`, `popup.html`

### voice-generation-server
- 語音生成服務，支援語音合成與音檔產生。
- 主要檔案：`app.py`, `requirements.txt`

### windows-app
- Windows 桌面應用，使用現代前端技術（如 React, Vite）。
- 主要檔案：`src/`, `package.json`, `index.html`

## 快速開始

請依照各子資料夾內的 README.md 進行安裝與啟動。

### 1. 進入子專案資料夾
```sh
cd backend-server  # 或 chrome-extension, voice-generation-server, windows-app
```

### 2. 依照子專案說明安裝依賴與啟動

## 貢獻方式

1. Fork 本專案並建立分支。
2. 提交 Pull Request，並詳述修改內容。
3. 請遵守各子專案的開發規範。

## 聯絡方式

如有問題請聯絡專案負責人或於 Issues 留言。

---

> 本專案由 2025 梅竹黑客松團隊開發維護。
