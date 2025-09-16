#!/usr/bin/env python3
"""
測試 MCP 服務器和 AI Agent 的腳本
"""

import asyncio
import json
import logging
from ai_agent import AIAgent, MCPClient

# 設置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_mcp_server():
    """測試 MCP 服務器"""
    print("=== 測試 MCP 服務器 ===")
    
    client = MCPClient()
    
    try:
        # 啟動服務器
        await client.start_server("python", ["mcp_server.py"])
        
        # 測試加法工具
        print("\n1. 測試加法工具:")
        result = await client.call_tool("add", {"a": 15, "b": 25})
        print(f"   結果: {result['content'][0]['text']}")
        
        # 測試減法工具
        print("\n2. 測試減法工具:")
        result = await client.call_tool("subtract", {"a": 100, "b": 30})
        print(f"   結果: {result['content'][0]['text']}")
        
        # 測試乘法工具
        print("\n3. 測試乘法工具:")
        result = await client.call_tool("multiply", {"a": 7, "b": 8})
        print(f"   結果: {result['content'][0]['text']}")
        
        # 測試除法工具
        print("\n4. 測試除法工具:")
        result = await client.call_tool("divide", {"a": 84, "b": 12})
        print(f"   結果: {result['content'][0]['text']}")
        
        # 測試表達式計算
        print("\n5. 測試表達式計算:")
        result = await client.call_tool("calculate", {"expression": "2 + 3 * 4"})
        print(f"   結果: {result['content'][0]['text']}")
        
        print("\n✅ MCP 服務器測試通過!")
        
    except Exception as e:
        print(f"❌ MCP 服務器測試失敗: {e}")
    finally:
        await client.close()

async def test_ai_agent():
    """測試 AI Agent（需要 LLM 服務器運行）"""
    print("\n=== 測試 AI Agent ===")
    
    # 從配置文件讀取設置
    try:
        with open("agent.json", "r", encoding="utf-8") as f:
            config = json.load(f)
        
        model = config["model"]
        endpoint = config["endpointUrl"]
        
    except Exception as e:
        print(f"❌ 讀取配置文件失敗: {e}")
        return
    
    agent = AIAgent(endpoint, model)
    
    try:
        # 啟動 AI Agent
        await agent.start()
        
        # 測試一些輸入
        test_inputs = [
            "計算 15 加 25",
            "幫我算 100 減 30", 
            "10 乘以 8 等於多少",
            "84 除以 12"
        ]
        
        for i, test_input in enumerate(test_inputs, 1):
            print(f"\n{i}. 測試輸入: '{test_input}'")
            try:
                response = await agent.process_user_input(test_input)
                print(f"   AI 回應: {response}")
            except Exception as e:
                print(f"   ❌ 處理失敗: {e}")
        
        print("\n✅ AI Agent 測試完成!")
        
    except Exception as e:
        print(f"❌ AI Agent 測試失敗: {e}")
    finally:
        await agent.close()

async def main():
    """主測試函數"""
    print("開始測試 MCP 系統...")
    
    # 測試 MCP 服務器
    await test_mcp_server()
    
    # 測試 AI Agent（僅在 LLM 服務器可用時）
    import requests
    try:
        with open("agent.json", "r", encoding="utf-8") as f:
            config = json.load(f)
        endpoint = config["endpointUrl"]
        
        # 檢查 LLM 服務器是否可用
        response = requests.get(f"{endpoint}/models", timeout=5)
        if response.status_code == 200:
            await test_ai_agent()
        else:
            print(f"\n⚠️  LLM 服務器不可用 ({endpoint})，跳過 AI Agent 測試")
            
    except Exception as e:
        print(f"\n⚠️  無法連接到 LLM 服務器: {e}")
        print("   請確保您的 LLM 服務器正在運行在 http://localhost:8000/api/")
    
    print("\n測試完成!")

if __name__ == "__main__":
    asyncio.run(main())