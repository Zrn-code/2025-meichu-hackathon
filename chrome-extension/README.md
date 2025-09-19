# YouTube Tab Monitor Chrome Extension

一個用於監控 YouTube 頁面狀態並與本地 Python 服務器進行實時通信的 Chrome 擴展。

## 功能特點

- **實時監控**: 每秒更新 YouTube 播放狀態
- **詳細信息**: 捕獲視頻標題、頻道、播放進度、觀看次數等
- **本地通信**: 與 Python backend-server 實時數據同步
- **用戶友好**: 簡潔的彈窗界面顯示當前狀態
- **自動檢測**: 自動識別 YouTube 標籤頁並開始監控

## 監控數據

擴展會收集以下 YouTube 數據：
- 視頻 URL 和 ID
- 視頻標題和頻道名稱
- 播放狀態（播放/暫停）
- 當前播放時間和總時長
- 播放進度百分比
- 觀看次數
- 播放列表信息
- 視頻品質設置
- 全屏狀態

## 安裝步驟

### 1. 安裝擴展

1. 打開 Chrome 瀏覽器
2. 進入 `chrome://extensions/`
3. 開啟「開發者模式」
4. 點擊「載入未封裝擴充功能」
5. 選擇 `chrome-extension` 文件夾

### 2. 配置圖標（可選）

如需自定義圖標，請在 `icons/` 文件夾中添加：
- `icon16.png` (16x16)
- `icon48.png` (48x48)  
- `icon128.png` (128x128)

### 3. 啟動 Python 服務器

確保 backend-server 正在運行：

```bash
cd backend-server
python server.py
```

服務器默認運行在 `http://localhost:5000`

## 使用方法

### 基本使用

1. 打開 YouTube 頁面
2. 點擊擴展圖標打開彈窗
3. 點擊「開始監控」按鈕
4. 擴展會自動監控當前 YouTube 標籤頁

### 監控界面

彈窗界面顯示：
- **狀態指示器**: 綠點表示正在監控，紅點表示未監控
- **服務器連接**: 顯示與 Python 服務器的連接狀態
- **視頻信息**: 當前播放的視頻詳情
- **播放進度**: 實時更新的進度條
- **控制按鈕**: 開始/停止監控、刷新狀態

### 自動功能

- **自動檢測**: 切換到 YouTube 標籤頁時自動開始監控
- **實時更新**: 每秒向服務器發送最新數據
- **智能過濾**: 只在數據發生變化時發送，減少網絡請求

## API 端點

Python 服務器提供以下 API：

### 接收數據
```
POST /api/youtube
```
接收來自 Chrome 擴展的 YouTube 數據

### 獲取當前數據
```
GET /api/youtube/current
```
獲取最新的 YouTube 播放數據

### 獲取歷史數據
```
GET /api/youtube/history?limit=50
```
獲取歷史播放記錄

### 獲取統計信息
```
GET /api/youtube/statistics
```
獲取觀看統計數據

### 停止監控
```
POST /api/youtube/stop
```
停止 YouTube 監控

## 數據格式

發送到服務器的數據格式：

```json
{
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "videoId": "VIDEO_ID",
    "title": "視頻標題",
    "channelName": "頻道名稱",
    "isPlaying": true,
    "currentTime": 120,
    "duration": 300,
    "viewCount": "1,234,567",
    "isPlaylist": false,
    "playlistId": null,
    "isFullscreen": false,
    "timestamp": 1640995200000,
    "tabId": 123456789
}
```

## 疑難排解

### 擴展無法載入
- 確認所有文件都在 chrome-extension 文件夾中
- 檢查 manifest.json 語法是否正確
- 重新載入擴展

### 無法連接服務器
- 確認 Python 服務器正在運行
- 檢查服務器地址是否為 localhost:5000
- 查看瀏覽器控制台是否有 CORS 錯誤

### 監控不工作
- 確認在 YouTube 頁面上
- 檢查擴展權限是否已授予
- 重新載入 YouTube 頁面

### 數據不更新
- 檢查網絡連接
- 查看 Chrome 開發者工具的控制台錯誤
- 重新開始監控

## 開發說明

### 文件結構
```
chrome-extension/
├── manifest.json       # 擴展清單文件
├── background.js      # 後台服務工作者
├── content.js         # 內容腳本
├── popup.html         # 彈窗界面
├── popup.js          # 彈窗邏輯
├── icons/            # 圖標文件夾
└── README.md         # 說明文件
```

### 關鍵組件

1. **Background Script**: 管理標籤頁監控和服務器通信
2. **Content Script**: 在 YouTube 頁面中提取視頻數據  
3. **Popup**: 用戶界面和控制面板

### 事件流程

1. 用戶打開 YouTube 標籤頁
2. Background script 檢測到 URL 變化
3. 注入 Content script 到頁面
4. Content script 監控視頻元素事件
5. 數據變化時發送到 Background script
6. Background script 轉發到 Python 服務器

## 授權

本項目為開源項目，歡迎貢獻和改進。