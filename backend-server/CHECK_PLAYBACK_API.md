# Check Playback API 使用文檔

## 概述

新增的 `/api/check-playback` API 端點允許前端根據當前 YouTube 播放時間來查詢是否有對應的語音內容需要播放。

## API 端點

### GET /api/check-playback

檢查當前時間點是否有需要播放的語音內容。

#### 請求參數

| 參數名 | 類型 | 必需 | 說明 |
|--------|------|------|------|
| `time` | string/number | 是 | 當前 YouTube 播放時間（秒） |
| `video_id` | string | 否 | YouTube 影片 ID，如果不提供則忽略影片匹配 |

#### 回應格式

**成功回應 (HTTP 200):**

```json
{
  "success": true,
  "should_play": true,  // 是否應該播放
  "content": {          // 當 should_play 為 true 時提供
    "logs_id": "4020454b-b20a-4fa9-b646-68b9ac67f005",
    "message": "這首歌真是經典！",
    "emotion": "興奮的",
    "timestamp": "60",
    "video_id": "video_bb4be737",
    "voice_file_path": "generated_audio/video_bb4be737_4020454b-b20a-4fa9-b646-68b9ac67f005_60_20250920_120000.wav"
  }
}
```

**無匹配內容時 (HTTP 200):**

```json
{
  "success": true,
  "should_play": false,
  "content": null
}
```

**錯誤回應 (HTTP 400):**

```json
{
  "success": false,
  "error": "Invalid time parameter"
}
```

## 匹配邏輯

API 會根據以下條件尋找匹配的語音內容：

1. **時間匹配**: 當前時間與記錄中的 `timestamp` 差異在 ±1 秒內
2. **影片匹配**: 如果提供了 `video_id` 參數，則必須與記錄中的 `video_id` 完全相符
3. **語音已生成**: 記錄中的 `is_generated` 為 `true`

## 使用範例

### 1. 基本查詢

```bash
curl "http://localhost:3000/api/check-playback?time=60&video_id=video_bb4be737"
```

### 2. 忽略影片 ID

```bash
curl "http://localhost:3000/api/check-playback?time=60"
```

### 3. JavaScript 前端整合

```javascript
// 前端每秒查詢一次
setInterval(async () => {
  const currentTime = getCurrentYouTubeTime(); // 獲取當前播放時間
  const videoId = getCurrentVideoId();         // 獲取當前影片ID
  
  try {
    const response = await fetch(
      `http://localhost:3000/api/check-playback?time=${currentTime}&video_id=${videoId}`
    );
    const data = await response.json();
    
    if (data.success && data.should_play) {
      // 播放對應的語音檔案
      playAudioFile(data.content.voice_file_path);
      
      // 顯示訊息和情緒
      showMessage(data.content.message, data.content.emotion);
    }
  } catch (error) {
    console.error('查詢播放狀態失敗:', error);
  }
}, 1000); // 每秒查詢一次
```

## 容錯設計

- **時間容忍度**: ±1 秒的誤差範圍，適應網路延遲和播放器精度問題
- **參數驗證**: 自動處理無效的時間參數
- **優雅降級**: 即使沒有匹配內容也返回正常回應

## 性能考量

- 查詢操作為 O(n) 複雜度，其中 n 是對話記錄數量
- 建議前端實施適當的查詢頻率控制
- 考慮在大量記錄時添加索引優化

## 測試

使用提供的測試客戶端：

```bash
cd c:\Users\zxc09\hackthon\2025-meichu-hackathon\backend-server
python test_api_client.py
```

## 注意事項

1. 確保 conversation_logs.json 中的記錄有正確的 `is_generated` 標記
2. `voice_file_path` 應該是相對於語音生成服務器的正確路徑
3. 前端需要實施適當的音檔快取機制以避免重複播放
