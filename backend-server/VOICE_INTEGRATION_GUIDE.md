# 對話記錄工具語音集成功能

## 概述

`ConversationLogTool` 現在已經集成了語音生成功能。當你添加一個對話記錄時，工具會自動：

1. 保存對話記錄到 JSON 文件
2. 生成唯一的 `logs_id` 和 `video_id`
3. 異步發送語音生成請求到 `localhost:5001`

## 新增功能

### 自動語音生成
- 每當創建新的對話記錄時，會自動觸發語音生成請求
- 使用異步處理，不會阻塞主要流程
- 包含完整的錯誤處理和日誌記錄

### 唯一標識符
- `logs_id`: 每個對話記錄的唯一標識符 (UUID)
- `video_id`: 影片標識符（可選輸入，否則自動生成）

### 新的輸入參數
- `video_id` (可選): 影片ID，如果未提供會自動生成

## 使用方法

### 基本使用
```json
{
  "timestamp": "30",
  "emotion": "友善的",
  "message": "歡迎來到我們的頻道！"
}
```

### 指定影片ID
```json
{
  "timestamp": "60",
  "emotion": "興奮的", 
  "message": "今天要介紹一個很棒的功能！",
  "video_id": "my_custom_video_123"
}
```

## 啟動語音服務器

在使用語音生成功能前，需要先啟動語音服務器：

```bash
cd voice-generation-server
python app.py
```

語音服務器會在 `localhost:5001` 運行。

## 測試集成功能

運行測試腳本來驗證集成：

```bash
cd backend-server
python test_voice_integration.py
```

## 錯誤處理

工具包含以下錯誤處理機制：

1. **連接錯誤**: 如果語音服務器未運行，會記錄錯誤但不影響對話記錄保存
2. **超時錯誤**: 10秒超時保護
3. **其他異常**: 完整的異常捕獲和日誌記錄

## 生成的文件結構

對話記錄現在包含以下字段：

```json
{
  "logs_id": "550e8400-e29b-41d4-a716-446655440000",
  "video_id": "video_12345678",
  "timestamp": "30",
  "emotion": "友善的",
  "message": "歡迎來到我們的頻道！"
}
```

## API 端點

語音服務器提供以下端點：

- `POST /api/generate_voice`: 生成語音
- `GET /api/health`: 健康檢查
- `GET /api/files`: 列出生成的語音文件

## 注意事項

1. 語音生成是異步處理，不會立即完成
2. 生成的語音文件存儲在 `voice-generation-server/generated_audio/` 目錄
3. 文件命名格式：`{video_id}_{logs_id}_{timestamp}_{datetime}.wav`
4. 語音生成至少需要10秒完成（模擬真實語音生成時間）

## 故障排除

### 語音服務器無法連接
- 確認語音服務器已啟動在 port 5001
- 檢查防火牆設置
- 查看語音服務器日誌

### 語音生成失敗
- 檢查輸入數據格式
- 查看語音服務器日誌
- 確認 `generated_audio` 目錄權限