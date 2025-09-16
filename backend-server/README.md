# 計算器 MCP 服務器

這是一個簡單的 MCP (Model Context Protocol) 服務器，為 LLM 提供基本的數學計算功能。

## 功能特點

- ✅ 基本四則運算：加法、減法、乘法、除法
- ✅ 數學表達式計算
- ✅ 錯誤處理（例如：除零錯誤）
- ✅ 中文介面和回應

## 可用工具

### 1. `add` - 加法運算
執行兩個數字的加法運算。

**參數：**
- `a` (number): 第一個數字
- `b` (number): 第二個數字

**範例：**
```json
{
  "name": "add",
  "arguments": {
    "a": 15,
    "b": 25
  }
}
```

### 2. `subtract` - 減法運算
執行兩個數字的減法運算。

**參數：**
- `a` (number): 被減數
- `b` (number): 減數

**範例：**
```json
{
  "name": "subtract",
  "arguments": {
    "a": 100,
    "b": 30
  }
}
```

### 3. `multiply` - 乘法運算
執行兩個數字的乘法運算。

**參數：**
- `a` (number): 第一個數字
- `b` (number): 第二個數字

**範例：**
```json
{
  "name": "multiply",
  "arguments": {
    "a": 7,
    "b": 8
  }
}
```

### 4. `divide` - 除法運算
執行兩個數字的除法運算。

**參數：**
- `a` (number): 被除數
- `b` (number): 除數（不能為零）

**範例：**
```json
{
  "name": "divide",
  "arguments": {
    "a": 84,
    "b": 12
  }
}
```

### 5. `calculate` - 表達式計算
計算數學表達式，支持基本運算符和括號。

**參數：**
- `expression` (string): 要計算的數學表達式

**範例：**
```json
{
  "name": "calculate",
  "arguments": {
    "expression": "2 + 3 * 4"
  }
}
```

支持的表達式範例：
- `"2 + 3"` → 5
- `"10 * 5"` → 50  
- `"15 / 3"` → 5
- `"20 - 8"` → 12
- `"2 + 3 * 4"` → 14
- `"(10 + 5) / 3"` → 5
- `"2.5 * 4 + 1.5"` → 11.5

## 使用方法

### 1. 直接運行 MCP 服務器
```bash
python mcp_server.py
```

### 2. 使用測試腳本
```bash
python test_calculator.py
```

### 3. 配置 agent.json
確保你的 `agent.json` 文件配置正確：

```json
{
  "model": "Qwen3-8B-GGUF",
  "endpointUrl": "http://localhost:8000/api/",
  "servers": [
    {
      "type": "stdio",
      "command": "python",
      "args": [
        "mcp_server.py"
      ]
    }
  ]
}
```

## 錯誤處理

服務器會處理以下錯誤情況：
- 除零錯誤
- 無效的數學表達式
- 缺少必要參數
- 不支持的運算符

所有錯誤都會返回友好的中文錯誤訊息。

## 技術細節

- 基於 MCP 2024-11-05 協議版本
- 使用 JSON-RPC 2.0 進行通信
- 支持 stdio 傳輸方式
- 使用 Python 3.7+ 的 asyncio 異步處理

## 安全性

- 表達式計算使用受限的 `eval()`，只允許基本數學運算符
- 不允許執行任意 Python 代碼
- 輸入驗證和錯誤處理

## 擴展功能

如需添加更多數學功能，可以在 `Calculator` 類中添加新方法，並在 `MCPServer` 的 `tools` 字典中註冊相應的工具定義。