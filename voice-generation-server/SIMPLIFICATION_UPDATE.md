# 語音生成服務器簡化更新

## 🔄 更新內容

語音生成服務器已經簡化，現在只生成空的 WAV 檔案，不再處理複雜的音頻生成邏輯。

## ✅ 主要變更

### 1. 簡化語音生成函數
- **之前**: 根據情緒和訊息內容生成複雜的音頻波形
- **現在**: 生成 3 秒的靜音 WAV 檔案

### 2. 移除不必要的依賴
- **移除**: `numpy` (不再需要複雜的音頻處理)
- **移除**: `time` 模組 (不再需要 10 秒的等待時間)
- **保留**: `Flask`, `requests` (基本功能需要)

### 3. 提升效能
- **生成時間**: 從至少 10 秒縮短到幾毫秒
- **檔案大小**: 大幅減少 (只有靜音數據)
- **CPU 使用**: 顯著降低
- **記憶體使用**: 顯著降低

## 📁 檔案變更

### `app.py`
```python
# 舊版本 - 複雜的音頻生成
def generate_voice_file(log_data):
    # 複雜的情緒映射
    # 音頻波形計算
    # 至少 10 秒的處理時間
    
# 新版本 - 簡化的空檔生成
def generate_voice_file(log_data):
    # 生成 3 秒靜音
    # 立即完成
```

### `requirements.txt`
```plaintext
# 舊版本
Flask==2.3.3
numpy==1.24.3
requests==2.31.0

# 新版本
Flask==2.3.3
requests==2.31.0
```

## 🚀 使用方式

### 啟動服務器
```bash
cd voice-generation-server
python app.py
```

### API 調用 (不變)
```bash
curl -X POST http://localhost:5001/api/generate_voice \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "30",
    "emotion": "任何值",
    "message": "任何訊息",
    "video_id": "test_video",
    "logs_id": "test_logs"
  }'
```

### 測試功能
```bash
cd voice-generation-server
python test_simplified.py
```

## 📊 效能比較

| 項目 | 舊版本 | 新版本 | 改善 |
|------|--------|--------|------|
| 生成時間 | ≥10 秒 | <1 秒 | 10x+ 更快 |
| CPU 使用 | 高 | 極低 | 大幅降低 |
| 記憶體使用 | 中等 | 極低 | 大幅降低 |
| 檔案大小 | 變動 | 固定小 | 更小 |
| 依賴複雜度 | 高 | 低 | 簡化 |

## 🔧 技術細節

### 生成的 WAV 檔案規格
- **格式**: WAV (PCM)
- **取樣率**: 44.1 kHz
- **位元深度**: 16-bit
- **聲道**: 單聲道
- **時長**: 3 秒
- **內容**: 完全靜音 (全為 0)

### 檔案命名規則 (不變)
```
{video_id}_{logs_id}_{timestamp}_{datetime}.wav
```

## 🎯 適用場景

這個簡化版本適合：
- 需要快速生成語音檔案佔位符
- 測試和開發階段
- 減少系統資源消耗
- 簡化部署和維護

## 🔄 未來擴展

如果需要真實的語音生成，可以：
1. 整合第三方 TTS 服務 (Azure Speech, Google Cloud TTS)
2. 使用本地 TTS 引擎 (eSpeak, Festival)
3. 接入 AI 語音生成服務

## ⚠️ 注意事項

- 生成的檔案是靜音的，不包含任何語音內容
- emotion 和 message 參數仍需提供但會被忽略
- 所有其他 API 端點和回調機制保持不變