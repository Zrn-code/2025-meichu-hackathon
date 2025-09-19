# YouTube Tab Monitor 部署和使用指南

這是一個完整的 YouTube 頁面監控解決方案，包含 Chrome 擴展和 Python 後端服務器。

## 🎯 項目概述

- **Chrome 擴展**: 監控 YouTube 頁面狀態，提取播放信息
- **Python 服務器**: 接收和處理來自擴展的數據，提供 API 接口
- **實時同步**: 每秒更新數據，支持實時分析

## 📁 項目結構

```
2025-meichu-hackathon/
├── backend-server/          # Python 後端服務器
│   ├── server.py           # 主服務器文件
│   ├── handlers/
│   │   ├── youtube.py      # YouTube 數據處理器
│   │   └── chat.py         # 聊天處理器
│   ├── test_youtube.py     # 測試腳本
│   └── requirements.txt    # Python 依賴
├── chrome-extension/        # Chrome 擴展
│   ├── manifest.json       # 擴展清單
│   ├── background.js       # 後台腳本
│   ├── content.js         # 內容腳本
│   ├── popup.html         # 彈窗界面
│   ├── popup.js           # 彈窗邏輯
│   └── icons/             # 圖標文件夾
└── windows-app/            # 桌面應用（現有）
```

## 🚀 快速開始

### 步驟 1: 啟動 Python 服務器

```powershell
# 進入後端目錄
cd C:\Users\WuKai\meichu\2025-meichu-hackathon\backend-server

# 安裝依賴（如果尚未安裝）
pip install flask flask-cors requests

# 啟動服務器
python server.py
```

服務器將在 http://localhost:5000 運行

### 步驟 2: 安裝 Chrome 擴展

1. 打開 Chrome 瀏覽器
2. 進入 `chrome://extensions/`
3. 開啟右上角的「開發者模式」
4. 點擊「載入未封裝擴充功能」
5. 選擇 `C:\Users\WuKai\meichu\2025-meichu-hackathon\chrome-extension` 文件夾
6. 確認擴展已載入並啟用

### 步驟 3: 測試功能

```powershell
# 運行測試腳本
cd C:\Users\WuKai\meichu\2025-meichu-hackathon\backend-server
python test_youtube.py
```

### 步驟 4: 開始監控

1. 打開 YouTube 頁面（例如: https://www.youtube.com/watch?v=dQw4w9WgXcQ）
2. 點擊 Chrome 工具欄中的擴展圖標
3. 在彈窗中點擊「開始監控」
4. 觀察彈窗中的實時數據更新

## 📊 API 端點

### 健康檢查
```
GET http://localhost:5000/health
```

### YouTube 數據接口
```
# 接收擴展數據
POST http://localhost:5000/api/youtube

# 獲取當前狀態
GET http://localhost:5000/api/youtube/current

# 獲取歷史數據
GET http://localhost:5000/api/youtube/history?limit=50

# 獲取統計信息
GET http://localhost:5000/api/youtube/statistics

# 停止監控
POST http://localhost:5000/api/youtube/stop
```

## 🔧 配置選項

### Python 服務器配置

編輯 `backend-server/agent.json`:

```json
{
  "server": {
    "host": "localhost",
    "port": 5000,
    "debug": true
  },
  "logging": {
    "level": "INFO"
  }
}
```

### Chrome 擴展配置

編輯 `chrome-extension/background.js` 中的 `serverUrl`:

```javascript
this.serverUrl = 'http://localhost:5000';  // 修改為您的服務器地址
```

## 📈 監控數據

### 收集的數據類型

- **基本信息**: URL、視頻 ID、標題、頻道名稱
- **播放狀態**: 播放/暫停、當前時間、總時長
- **用戶行為**: 音量、播放速率、全屏狀態
- **額外信息**: 觀看次數、播放列表、視頻畫質

### 數據格式示例

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "channelName": "Rick Astley", 
  "isPlaying": true,
  "currentTime": 120,
  "duration": 212,
  "progress_percent": 56.60,
  "viewCount": "1,234,567,890",
  "timestamp": 1640995200000
}
```

## 🎮 實際使用場景

### 1. 學習分析
- 監控學習視頻的觀看進度
- 分析學習習慣和專注度
- 統計學習時間和完成率

### 2. 內容研究
- 追蹤熱門視頻的觀看數據
- 分析用戶觀看行為模式
- 收集內容偏好數據

### 3. 生產力追蹤
- 監控工作相關視頻消費
- 分析娛樂 vs 教育內容比例
- 設置觀看時間限制

### 4. 自動化工作流
- 根據視頻類型觸發不同行為
- 自動記錄學習筆記
- 集成其他生產力工具

## 🔍 疑難排解

### 常見問題

#### 1. 擴展無法載入
**錯誤**: Extensions 頁面顯示錯誤

**解決方案**:
- 檢查 `manifest.json` 語法
- 確認所有文件都存在
- 重新載入擴展

#### 2. 服務器連接失敗
**錯誤**: 彈窗顯示「未連接」

**解決方案**:
```powershell
# 檢查服務器是否運行
curl http://localhost:5000/health

# 重新啟動服務器
cd backend-server
python server.py
```

#### 3. 數據不更新
**錯誤**: 彈窗中的視頻信息不變

**解決方案**:
- 刷新 YouTube 頁面
- 重新啟動監控
- 檢查瀏覽器控制台錯誤

#### 4. CORS 錯誤
**錯誤**: Console 中出現跨域錯誤

**解決方案**:
- 確認服務器已啟用 CORS
- 檢查請求 URL 是否正確
- 重新啟動服務器

### 調試模式

#### 啟用 Chrome 擴展調試
1. 進入 `chrome://extensions/`
2. 找到 YouTube Tab Monitor
3. 點擊「詳細資料」
4. 點擊「檢查檢視」> 「服務工作者」

#### 啟用服務器調試
```python
# 在 server.py 中設置
self.app.run(host=host, port=port, debug=True)
```

## 📝 開發說明

### 擴展架構

1. **Manifest V3**: 使用最新的擴展標準
2. **Service Worker**: 後台持久運行
3. **Content Scripts**: 頁面內容提取
4. **Popup Interface**: 用戶控制界面

### 後端架構

1. **Flask 框架**: RESTful API 服務
2. **模塊化設計**: 處理器分離
3. **數據持久化**: 內存存儲 + 歷史記錄
4. **CORS 支持**: 跨域請求處理

### 通信流程

```
YouTube 頁面 → Content Script → Background Script → Python 服務器
     ↑                                                      ↓
用戶界面 ← Popup Interface ← Chrome Extension API ← HTTP API
```

## 🔮 未來擴展

### 功能增強
- [ ] 數據庫持久化存儲
- [ ] WebSocket 實時通信
- [ ] 多用戶支持
- [ ] 數據可視化界面
- [ ] 機器學習分析

### 平台支持
- [ ] Firefox 擴展版本
- [ ] Safari 擴展支持
- [ ] 移動端應用
- [ ] 網頁版監控面板

## 📄 授權信息

本項目基於 MIT 授權協議開源。

## 🆘 技術支持

如果遇到問題，請：

1. 查看本指南的疑難排解部分
2. 檢查瀏覽器和服務器的控制台日誌  
3. 運行測試腳本進行診斷
4. 重新啟動服務器和重新載入擴展

---

**祝您使用愉快！** 🎉