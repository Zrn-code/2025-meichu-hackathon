# 使用指南

## 如何添加新的 MCP 工具

### 方法一：繼承 MCPTool 基礎類

```python
# tools/weather_tool.py
from .base import MCPTool
import requests

class WeatherTool(MCPTool):
    @property
    def name(self) -> str:
        return "weather"
    
    @property 
    def description(self) -> str:
        return "獲取天氣信息"
    
    @property
    def input_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "城市名稱"
                }
            },
            "required": ["city"]
        }
    
    async def execute(self, arguments: Dict) -> Dict:
        try:
            city = arguments.get("city")
            # 實現天氣查詢邏輯
            weather_data = f"今天{city}的天氣晴朗"
            
            return self.create_text_response(weather_data)
        except Exception as e:
            return self.create_error_response(str(e))
```

### 方法二：批量註冊工具

```python
# server.py 中的 _register_tools 方法
def _register_tools(self):
    from tools.weather_tool import WeatherTool
    from tools.file_tool import FileTool
    
    tools = [
        # 現有工具
        CalculatorTool(),
        AddTool(),
        # 新工具
        WeatherTool(),
        FileTool(),
    ]
    
    for tool in tools:
        self.tool_registry.register_tool_instance(tool)
```

## 測試新工具

```bash
# 測試工具是否註冊成功
curl http://localhost:3000/api/tools

# 測試工具調用
curl -X POST http://localhost:3000/api/tools/weather \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"city": "台北"}}'
```

## 設定檔案範例

```json
{
  "model": "gpt-3.5-turbo",
  "endpointUrl": "https://api.openai.com/v1",
  "server": {
    "host": "0.0.0.0",
    "port": 8080,
    "debug": true
  },
  "chat": {
    "max_tokens": 200,
    "temperature": 0.9
  }
}
```