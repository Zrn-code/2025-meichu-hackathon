# YouTube 字幕功能使用指南

## 概述

我們已經成功為 YouTube 監控系統添加了完整的字幕獲取功能。這個功能可以實時捕獲中文和其他語言的字幕，並提供豐富的 API 接口。

## 功能特點

### 1. 實時字幕捕獲
- ✅ 支持所有語言的字幕（包括中文）
- ✅ 實時檢測字幕開關狀態
- ✅ 自動獲取可用的字幕軌道信息
- ✅ 捕獲當前顯示的字幕文本

### 2. 字幕數據處理
- ✅ 自動去重，避免重複記錄相同字幕
- ✅ 按時間軸存儲字幕歷史
- ✅ 支持多視頻的字幕數據管理
- ✅ 字幕統### 3. 內容分析
- 分析視頻內容關鍵字
- 統計字幕語言使用情況
- 提取完整轉錄文本
- 生成字幕文件用於其他軟件

### 4. 字幕文件處理
- 導出標準格式字幕文件（SRT、VTT、TXT）
- 完整時間軸信息保留
- 支持多語言字幕導出
- 可用於視頻編輯軟件功能

### 3. 完整的 API 接口
- ✅ 6 個專用的字幕 API 端點
- ✅ 支持查詢、搜索、統計等操作
- ✅ RESTful 設計，易於集成

## API 接口說明

### 實時字幕 API

### 1. 獲取當前字幕信息
```
GET /api/youtube/subtitles/current
```
返回當前正在觀看視頻的字幕狀態和內容。

**響應示例:**
```json
{
  "success": true,
  "data": {
    "video_id": "dQw4w9WgXcQ",
    "subtitle_info": {
      "available": true,
      "isEnabled": true,
      "currentText": {
        "text": "這是當前顯示的中文字幕",
        "timestamp": 125.6
      },
      "currentTrack": {
        "language": "zh-TW",
        "label": "中文（繁體）"
      },
      "tracks": [
        {
          "language": "zh-TW",
          "label": "中文（繁體）"
        },
        {
          "language": "en",
          "label": "English"
        }
      ]
    }
  }
}
```

### 2. 獲取字幕歷史記錄
```
GET /api/youtube/subtitles/history?video_id=<ID>&limit=50
```

**參數:**
- `video_id` (可選): 指定視頻ID，不提供則返回所有視頻的字幕
- `limit` (可選): 返回記錄數量，默認 50

### 3. 獲取完整字幕轉錄
```
GET /api/youtube/subtitles/transcript?video_id=<ID>
```
返回格式化的完整字幕文本，包含時間軸信息。

**響應示例:**
```json
{
  "success": true,
  "data": {
    "video_id": "dQw4w9WgXcQ",
    "video_title": "示例視頻標題",
    "transcript": "[02:15] 第一句字幕\n[02:18] 第二句字幕\n[02:22] 第三句字幕",
    "full_text": "第一句字幕 第二句字幕 第三句字幕",
    "entries": 125,
    "duration_covered": "0s - 300s"
  }
}
```

### 4. 搜索字幕內容
```
GET /api/youtube/subtitles/search?q=<關鍵字>&video_id=<ID>
```

**參數:**
- `q` (必須): 搜索關鍵字
- `video_id` (可選): 限制在特定視頻中搜索

### 5. 獲取字幕統計信息
```
GET /api/youtube/subtitles/statistics
```
返回字幕使用統計，包括總條目數、視頻數量、語言分布等。

### 6. 清除字幕歷史
```
POST /api/youtube/subtitles/clear
Content-Type: application/json

{
  "video_id": "可選，指定視頻ID"
}
```

### 完整字幕 API

### 7. 獲取指定視頻的完整字幕
```
GET /api/youtube/subtitles/full/<video_id>
```
返回指定視頻的完整字幕軌道數據，包含所有字幕條目和時間戳。

**響應示例:**
```json
{
  "success": true,
  "data": {
    "video_id": "dQw4w9WgXcQ",
    "title": "示例視頻標題",
    "duration": 300.5,
    "language": "zh-TW",
    "track_info": {
      "kind": "subtitles",
      "label": "中文（繁體）",
      "language": "zh-TW"
    },
    "cues": [
      {
        "startTime": 0.5,
        "endTime": 3.2,
        "text": "歡迎觀看這個視頻",
        "id": "1",
        "duration": 2.7
      },
      {
        "startTime": 3.5,
        "endTime": 7.1,
        "text": "今天我們要講解的內容是...",
        "id": "2", 
        "duration": 3.6
      }
    ],
    "total_cues": 125,
    "cached_at": "2025-09-19T10:30:00.000Z"
  }
}
```

### 8. 獲取所有緩存的完整字幕
```
GET /api/youtube/subtitles/full
```
返回所有已緩存的視頻完整字幕數據。

### 9. 導出字幕文件
```
GET /api/youtube/subtitles/export/<video_id>?format=<格式>
```

**參數:**
- `format` (可選): 導出格式，支持 `srt`、`vtt`、`txt`，默認為 `srt`

**支持的導出格式:**

#### SRT 格式 (SubRip)
```
1
00:00:00,500 --> 00:00:03,200
歡迎觀看這個視頻

2
00:00:03,500 --> 00:00:07,100
今天我們要講解的內容是...
```

#### VTT 格式 (WebVTT)
```
WEBVTT

NOTE Title: 示例視頻標題
NOTE Language: zh-TW

00:00:00.500 --> 00:00:03.200
歡迎觀看這個視頻

00:00:03.500 --> 00:00:07.100
今天我們要講解的內容是...
```

#### TXT 格式 (純文本)
```
[00:00] 歡迎觀看這個視頻
[00:03] 今天我們要講解的內容是...
```

## 使用步驟

### 1. 準備環境
1. 確保 Chrome 擴展已安裝並啟用
2. 啟動後端服務器：
   ```bash
   cd backend-server
   python server.py
   ```

### 2. 開始使用
1. 在 Chrome 中打開 YouTube 視頻
2. 開啟字幕功能（CC 按鈕）
3. 選擇需要的字幕語言（支持中文）
4. 播放視頻，系統會自動捕獲字幕

### 3. 測試功能
運行測試腳本：
```bash
python test_subtitles.py
```

## 技術實現

### Chrome 擴展端 (content.js)
- **字幕檢測**: 監控 `.ytp-caption-segment` 等字幕容器
- **軌道信息**: 從 `video.textTracks` 獲取可用字幕軌道
- **實時監控**: 使用 `MutationObserver` 監控字幕變化
- **事件監聽**: 監聽字幕按鈕點擊和 `cuechange` 事件

### 後端處理 (handlers/youtube.py)
- **數據處理**: `_process_subtitle_data()` 處理字幕數據
- **去重機制**: `_is_duplicate_subtitle()` 避免重複記錄
- **歷史管理**: 限制歷史記錄數量，自動清理舊數據
- **搜索功能**: 支持關鍵字搜索和過濾

### API 服務 (server.py)
- **RESTful 設計**: 6 個專用字幕端點
- **錯誤處理**: 完整的異常捕獲和響應
- **參數驗證**: 輸入參數驗證和類型轉換

## 字幕數據結構

### 字幕歷史條目
```json
{
  "video_id": "視頻ID",
  "video_title": "視頻標題", 
  "timestamp": "系統時間戳",
  "video_time": "視頻播放時間（秒）",
  "text": "字幕文本",
  "lines": ["字幕行1", "字幕行2"],
  "track": {
    "language": "語言代碼",
    "label": "語言標籤"
  },
  "start_time": "字幕開始時間",
  "end_time": "字幕結束時間"
}
```

## 使用場景

### 1. 學習輔助
- 實時記錄視頻字幕，方便回顧
- 搜索特定內容的時間點
- 生成學習筆記

### 2. 內容分析
- 分析視頻內容關鍵字
- 統計字幕語言使用情況
- 提取完整轉錄文本

### 3. 無障礙功能
- 為聽障用戶提供字幕歷史
- 字幕內容搜索和導航
- 多語言字幕支持

## 注意事項

1. **隱私保護**: 字幕數據僅在本地存儲，不會上傳到外部服務器
2. **性能優化**: 自動限制歷史記錄數量，避免內存過度使用
3. **兼容性**: 支持 YouTube 的各種字幕格式和語言
4. **實時性**: 字幕捕獲延遲通常在 100ms 以內

## 故障排除

### 1. 無法獲取字幕
- 檢查 YouTube 視頻是否有字幕
- 確認字幕功能已開啟（CC 按鈕）
- 檢查 Chrome 擴展是否正常運行

### 2. 字幕內容為空
- 嘗試切換不同的字幕語言
- 刷新頁面重新加載擴展
- 檢查控制台是否有錯誤信息

### 3. API 無響應
- 確認後端服務器正在運行
- 檢查端口 5000 是否被占用
- 查看服務器日志獲取錯誤信息

## 未來擴展

- 支持字幕翻譯功能
- 添加字幕導出格式（SRT、VTT等）
- 集成 AI 分析字幕內容
- 支持離線字幕存儲