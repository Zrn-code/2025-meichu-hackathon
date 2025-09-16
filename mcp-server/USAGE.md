# 快速使用指南

## ✅ 修復完成！

UTF-8编码问题已解决，MCP服务器现在可以正常工作了！

## 📋 测试结果

刚刚的测试显示所有工具都工作正常：

```
1. 加法工具: 15 + 25 = 40 ✅
2. 减法工具: 100 - 30 = 70 ✅  
3. 乘法工具: 7 * 8 = 56 ✅
4. 除法工具: 84 / 12 = 7.0 ✅
5. 表达式计算: 2 + 3 * 4 = 14.0 ✅
```

## 🚀 如何使用

### 1. 测试MCP服务器
```powershell
python test_calculator.py
```

### 2. 运行AI Agent (需要LLM服务器)
```powershell
python ai_agent.py
```

### 3. 直接测试单个MCP工具
创建一个测试文件来手动调用工具：

```python
import asyncio
from ai_agent import MCPClient

async def test_single_tool():
    client = MCPClient()
    await client.start_server("python", ["mcp_server.py"])
    
    # 测试加法
    result = await client.call_tool("add", {"a": 10, "b": 20})
    print(result['content'][0]['text'])
    
    await client.close()

asyncio.run(test_single_tool())
```

## 🔧 MCP工具说明

您的MCP服务器现在提供以下工具：

| 工具名称 | 功能 | 示例 |
|---------|------|------|
| `add` | 加法运算 | `{"a": 15, "b": 25}` → `40` |
| `subtract` | 减法运算 | `{"a": 100, "b": 30}` → `70` |
| `multiply` | 乘法运算 | `{"a": 7, "b": 8}` → `56` |
| `divide` | 除法运算 | `{"a": 84, "b": 12}` → `7.0` |
| `calculate` | 表达式计算 | `{"expression": "2 + 3 * 4"}` → `14.0` |

## 📡 与您的LLM服务器集成

您的 `agent.json` 已配置好：
```json
{
  "model": "Qwen-2.5-1.5B-Instruct-NPU",
  "endpointUrl": "http://localhost:8000/api/",
  "servers": [
    {
      "type": "stdio", 
      "command": "python",
      "args": ["mcp_server.py"]
    }
  ]
}
```

当您的LLM服务器 (http://localhost:8000/api/) 运行时，它就可以通过MCP协议调用这些数学工具了！

## 🛠️ 故障排除

- **编码问题**: 已修复，现在使用ASCII输出避免Windows编码问题
- **Python路径**: 确保在正确的环境中运行 `python`
- **端口冲突**: 如果需要，可以修改LLM服务器端口

## 📝 下一步

现在您可以：
1. 启动您的LLM服务器在 `http://localhost:8000/api/`
2. 运行 `python ai_agent.py` 开始与支持MCP工具的AI Agent交互
3. 尝试问AI关于数学计算的问题，它会自动使用MCP工具！