# 語音生成服務器 (Backend Server 2)

## 功能說明

這是一個專門處理語音生成的 Flask 服務器，接收來自 backend server 的 log 數據，生成對應的語音檔案，並在完成後回報給 backend server。

## 特性

- 接收 log 數據進行語音生成
- 根據情感調整音頻特性
- 至少運行 10 秒的生成過程
- 異步處理避免阻塞
- 完成後自動回報給 backend server
- 根據 video_id, logs_id, timestamp 命名檔案

## 安裝依賴

```bash
pip install -r requirements.txt
```

## 運行服務

```bash
python app.py
```

服務會在 `http://localhost:5001` 上運行。

## API 端點

### POST /api/generate_voice
接收 log 數據並開始語音生成

請求體:
```json
{
  "timestamp": "120",
  "emotion": "專業的",
  "message": "現在開始我們的主題",
  "video_id": "abc123",
  "logs_id": "log002"
}
```

回應 (202 Accepted):
```json
{
  "message": "語音生成已開始",
  "logs_id": "log002",
  "estimated_duration": "至少 10 秒"
}
```

### GET /api/health
健康檢查

### GET /api/files
列出已生成的語音檔案

## 回調機制

生成完成後會向 `http://localhost:3000/api/voice_generation_complete` 發送回調:

```json
{
  "logs_id": "log002",
  "video_id": "abc123",
  "success": true,
  "filepath": "generated_audio/abc123_log002_120_20241215_143022.wav",
  "filename": "abc123_log002_120_20241215_143022.wav",
  "error_message": null,
  "timestamp": "2024-12-15T14:30:22.123456"
}
```

## 檔案命名規則

生成的 WAV 檔案命名格式：
`{video_id}_{logs_id}_{timestamp}_{生成時間}.wav`

例如：`abc123_log002_120_20241215_143022.wav`

## 情感音頻映射

- **友善的**: 頻率 440Hz, 振幅 0.3, 調製 5Hz
- **專業的**: 頻率 350Hz, 振幅 0.25, 調製 2Hz  
- **興奮的**: 頻率 500Hz, 振幅 0.4, 調製 8Hz
- **平靜的**: 頻率 300Hz, 振幅 0.2, 調製 1Hz

## 與 Backend Server 的整合

Backend Server 需要實現 `/api/voice_generation_complete` 端點來接收完成回調。

## 輸出目錄

生成的語音檔案保存在 `generated_audio/` 目錄中。
