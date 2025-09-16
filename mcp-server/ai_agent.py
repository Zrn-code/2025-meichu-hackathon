#!/usr/bin/env python3
"""
AI Agent 客戶端
連接到 LLM 服務器並使用 MCP 工具
"""

import asyncio
import json
import sys
import requests
import logging
import io
from typing import Dict, List, Optional

# 設置 UTF-8 編碼
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 設置日誌
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')
logger = logging.getLogger(__name__)

class MCPClient:
    """MCP 客戶端，用於與 MCP 服務器通信"""
    
    def __init__(self):
        self.process = None
        self.tools = []
    
    async def start_server(self, command: str, args: List[str]):
        """啟動 MCP 服務器"""
        try:
            self.process = await asyncio.create_subprocess_exec(
                command, *args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            logger.info(f"MCP server started: {command} {' '.join(args)}")
            
            # 初始化服務器
            await self.initialize()
            
        except Exception as e:
            logger.error(f"Failed to start MCP server: {e}")
            raise
    
    async def send_request(self, method: str, params: Optional[Dict] = None, request_id: str = "1") -> Dict:
        """發送請求到 MCP 服務器"""
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method
        }
        
        if params:
            request["params"] = params
        
        request_json = json.dumps(request, ensure_ascii=True)
        logger.debug(f"Sending request: {request_json}")
        
        # 發送請求
        self.process.stdin.write((request_json + "\n").encode('utf-8'))
        await self.process.stdin.drain()
        
        # 讀取響應
        response_line = await self.process.stdout.readline()
        response_json = response_line.decode('utf-8', errors='replace').strip()
        logger.debug(f"Received response: {response_json}")
        
        return json.loads(response_json)
    
    async def initialize(self):
        """初始化 MCP 服務器"""
        response = await self.send_request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "roots": {
                        "listChanged": True
                    }
                },
                "clientInfo": {
                    "name": "ai-agent-client",
                    "version": "1.0.0"
                }
            }
        )
        
        if "error" in response:
            raise Exception(f"Initialization failed: {response['error']}")
        
        logger.info("MCP server initialized successfully")
        
        # 獲取可用工具
        await self.list_tools()
    
    async def list_tools(self):
        """獲取可用工具列表"""
        response = await self.send_request("tools/list")
        
        if "error" in response:
            raise Exception(f"Failed to get tools list: {response['error']}")
        
        self.tools = response["result"]["tools"]
        logger.info(f"Found {len(self.tools)} available tools:")
        for tool in self.tools:
            logger.info(f"  - {tool['name']}: {tool['description']}")
    
    async def call_tool(self, name: str, arguments: Dict) -> Dict:
        """調用 MCP 工具"""
        response = await self.send_request(
            "tools/call",
            {
                "name": name,
                "arguments": arguments
            }
        )
        
        if "error" in response:
            raise Exception(f"Tool call failed: {response['error']}")
        
        return response["result"]
    
    async def close(self):
        """關閉 MCP 服務器"""
        if self.process:
            self.process.terminate()
            await self.process.wait()
            logger.info("MCP server closed")

class AIAgent:
    """AI Agent 主類"""
    
    def __init__(self, llm_endpoint: str, model: str):
        self.llm_endpoint = llm_endpoint
        self.model = model
        self.mcp_client = MCPClient()
        self.conversation_history = []
    
    async def start(self):
        """啟動 AI Agent"""
        logger.info("Starting AI Agent...")
        
        # 啟動 MCP 服務器
        await self.mcp_client.start_server("python", ["mcp_server.py"])
        
        logger.info("AI Agent ready!")
    
    def call_llm(self, messages: List[Dict]) -> str:
        """調用 LLM API"""
        try:
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": 1000,
                "temperature": 0.7
            }
            
            response = requests.post(
                f"{self.llm_endpoint}/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            response.raise_for_status()
            result = response.json()
            
            return result["choices"][0]["message"]["content"]
            
        except Exception as e:
            logger.error(f"LLM API 調用失敗: {e}")
            return f"抱歉，我遇到了一個錯誤: {str(e)}"
    
    def extract_tool_calls(self, llm_response: str) -> List[Dict]:
        """從 LLM 響應中提取工具調用"""
        tool_calls = []
        
        # 簡單的工具調用檢測邏輯
        # 在實際應用中，您可能需要更複雜的解析邏輯
        if "add(" in llm_response or "加法" in llm_response:
            # 這裡可以添加更複雜的解析邏輯來提取參數
            # 為了演示，我們使用簡單的示例
            pass
        
        return tool_calls
    
    async def process_user_input(self, user_input: str) -> str:
        """處理用戶輸入"""
        # 添加到對話歷史
        self.conversation_history.append({
            "role": "user", 
            "content": user_input
        })
        
        # 準備系統提示，告訴 LLM 可用的工具
        system_message = {
            "role": "system",
            "content": f"""你是一個有用的AI助手，可以使用以下數學計算工具：

可用工具：
{json.dumps([{'name': tool['name'], 'description': tool['description']} for tool in self.mcp_client.tools], ensure_ascii=False, indent=2)}

當用戶需要進行數學計算時，你可以告訴用戶你將使用這些工具來幫助計算。

用戶輸入: {user_input}
"""
        }
        
        # 調用 LLM
        messages = [system_message] + self.conversation_history
        llm_response = self.call_llm(messages)
        
        # 檢查是否需要使用工具
        # 這裡是一個簡化的示例，實際應用中可能需要更複雜的邏輯
        tool_result = ""
        if any(keyword in user_input.lower() for keyword in ["計算", "加法", "+", "加", "求和"]):
            try:
                # 嘗試提取數字進行加法運算
                numbers = []
                import re
                number_matches = re.findall(r'\d+(?:\.\d+)?', user_input)
                if len(number_matches) >= 2:
                    a = float(number_matches[0])
                    b = float(number_matches[1])
                    
                    result = await self.mcp_client.call_tool("add", {"a": a, "b": b})
                    tool_result = f"\n\n工具調用結果: {result['content'][0]['text']}"
                    
            except Exception as e:
                tool_result = f"\n\n工具調用錯誤: {str(e)}"
        
        # 組合最終響應
        final_response = llm_response + tool_result
        
        # 添加到對話歷史
        self.conversation_history.append({
            "role": "assistant",
            "content": final_response
        })
        
        return final_response
    
    async def run_interactive(self):
        """運行互動模式"""
        print("=== AI Agent 互動模式 ===")
        print("輸入 'quit' 或 'exit' 退出")
        print("可以嘗試問: '計算 15 加 25' 或 '幫我算 10 + 20'")
        print()
        
        while True:
            try:
                user_input = input("你: ").strip()
                
                if user_input.lower() in ['quit', 'exit', '退出']:
                    break
                
                if not user_input:
                    continue
                
                response = await self.process_user_input(user_input)
                print(f"AI: {response}")
                print()
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"錯誤: {e}")
                print()
    
    async def close(self):
        """關閉 AI Agent"""
        await self.mcp_client.close()

async def main():
    """主函數"""
    # 從 agent.json 讀取配置
    try:
        with open("agent.json", "r", encoding="utf-8") as f:
            config = json.load(f)
        
        model = config["model"]
        endpoint = config["endpointUrl"]
        
    except Exception as e:
        logger.error(f"讀取配置文件失敗: {e}")
        return
    
    # 創建並啟動 AI Agent
    agent = AIAgent(endpoint, model)
    
    try:
        await agent.start()
        await agent.run_interactive()
    except KeyboardInterrupt:
        logger.info("收到中斷信號")
    except Exception as e:
        logger.error(f"AI Agent 錯誤: {e}")
    finally:
        await agent.close()
        logger.info("AI Agent 已關閉")

if __name__ == "__main__":
    asyncio.run(main())