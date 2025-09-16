#!/usr/bin/env python3
"""
統一的後端服務器
整合 Chrome Extension 數據接收、LLM 服務交互和 MCP 工具功能
"""

import asyncio
import json
import sys
import requests
import logging
import io
from datetime import datetime
from typing import Dict, List, Optional, Any
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor

# 設置 UTF-8 編碼
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 設置日誌
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MCPClient:
    """MCP 客戶端，用於與 MCP 服務器通信"""
    
    def __init__(self):
        self.process = None
        self.tools = []
        self.executor = ThreadPoolExecutor(max_workers=2)
    
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
        
        # 發送請求
        if self.process and self.process.stdin:
            self.process.stdin.write((request_json + "\n").encode('utf-8'))
            await self.process.stdin.drain()
            
            # 讀取響應
            response_line = await self.process.stdout.readline()
            response_json = response_line.decode('utf-8', errors='replace').strip()
            
            return json.loads(response_json)
        else:
            raise Exception("MCP server not available")
    
    async def initialize(self):
        """初始化 MCP 服務器"""
        try:
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
                        "name": "unified-server-client",
                        "version": "1.0.0"
                    }
                }
            )
            
            if "error" in response:
                raise Exception(f"Initialization failed: {response['error']}")
            
            logger.info("MCP server initialized successfully")
            
            # 獲取可用工具
            await self.list_tools()
        except Exception as e:
            logger.error(f"MCP initialization error: {e}")
    
    async def list_tools(self):
        """獲取可用工具列表"""
        try:
            response = await self.send_request("tools/list")
            
            if "error" in response:
                raise Exception(f"Failed to get tools list: {response['error']}")
            
            self.tools = response["result"]["tools"]
            logger.info(f"Found {len(self.tools)} available tools")
        except Exception as e:
            logger.error(f"Error getting tools list: {e}")
            self.tools = []
    
    async def call_tool(self, name: str, arguments: Dict) -> Dict:
        """調用 MCP 工具"""
        try:
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
        except Exception as e:
            logger.error(f"Tool call error: {e}")
            return {"content": [{"type": "text", "text": f"工具調用失敗: {str(e)}"}]}
    
    async def close(self):
        """關閉 MCP 服務器"""
        if self.process:
            self.process.terminate()
            await self.process.wait()
            logger.info("MCP server closed")

class UnifiedServer:
    """統一的後端服務器"""
    
    def __init__(self):
        self.app = Flask(__name__)
        CORS(self.app, origins="*")
        self.mcp_client = MCPClient()
        self.tabs_data = None
        self.conversation_history = []
        
        # 從配置文件讀取 LLM 配置
        self.load_config()
        
        # 設置路由
        self.setup_routes()
    
    def load_config(self):
        """加載配置"""
        try:
            with open("agent.json", "r", encoding="utf-8") as f:
                config = json.load(f)
            
            self.llm_model = config["model"]
            self.llm_endpoint = config["endpointUrl"]
            logger.info(f"Loaded LLM config: {self.llm_model} @ {self.llm_endpoint}")
            
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            # 默認配置
            self.llm_model = "Llama-3.2-1B-Instruct-CPU"
            self.llm_endpoint = "http://localhost:8000/api/v1"
    
    def setup_routes(self):
        """設置 API 路由"""
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            """健康檢查"""
            return jsonify({
                "status": "ok",
                "timestamp": datetime.now().isoformat(),
                "services": {
                    "mcp": len(self.mcp_client.tools) > 0,
                    "llm": self.llm_endpoint is not None
                }
            })
        
        @self.app.route('/api/tabs', methods=['POST'])
        def receive_tabs_data():
            """接收 Chrome Extension 的標籤頁數據"""
            try:
                tabs_data = request.get_json()
                
                if not tabs_data or not isinstance(tabs_data.get('tabs'), list):
                    return jsonify({
                        "success": False,
                        "error": "Invalid tabs data format"
                    }), 400
                
                # 保存標籤頁數據
                self.tabs_data = {
                    **tabs_data,
                    "receivedAt": datetime.now().isoformat()
                }
                
                logger.info(f"Received tabs data: {tabs_data.get('totalTabs', 0)} tabs")
                
                return jsonify({
                    "success": True,
                    "message": "Tabs data received",
                    "receivedTabs": tabs_data.get('totalTabs', 0),
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                logger.error(f"Error processing tabs data: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/tabs', methods=['GET'])
        def get_tabs_data():
            """獲取最新的標籤頁數據"""
            return jsonify({
                "success": True,
                "data": self.tabs_data,
                "timestamp": datetime.now().isoformat()
            })
        
        @self.app.route('/api/chat', methods=['POST'])
        def chat_with_llm():
            """與 LLM 對話"""
            try:
                data = request.get_json()
                user_message = data.get('message', '')
                
                if not user_message:
                    return jsonify({
                        "success": False,
                        "error": "Message is required"
                    }), 400
                
                # 處理用戶消息
                response = asyncio.run(self.process_chat_message(user_message))
                
                return jsonify({
                    "success": True,
                    "response": response,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                logger.error(f"Chat error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/chat/stream', methods=['POST'])
        def chat_stream():
            """流式對話 API"""
            try:
                data = request.get_json()
                user_message = data.get('message', '')
                
                if not user_message:
                    return jsonify({
                        "success": False,
                        "error": "Message is required"
                    }), 400
                
                def generate_stream():
                    """生成流式響應"""
                    try:
                        # 調用 LLM 並逐步返回結果
                        for chunk in self.call_llm_stream(user_message):
                            yield f"data: {json.dumps(chunk)}\n\n"
                    except Exception as e:
                        yield f"data: {json.dumps({'error': str(e)})}\n\n"
                    finally:
                        yield "data: [DONE]\n\n"
                
                return Response(
                    generate_stream(),
                    mimetype='text/plain',
                    headers={
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    }
                )
                
            except Exception as e:
                logger.error(f"Stream chat error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/tools', methods=['GET'])
        def get_available_tools():
            """獲取可用工具列表"""
            return jsonify({
                "success": True,
                "tools": self.mcp_client.tools,
                "timestamp": datetime.now().isoformat()
            })
    
    async def process_chat_message(self, user_message: str) -> str:
        """處理聊天消息"""
        try:
            # 添加到對話歷史
            self.conversation_history.append({
                "role": "user",
                "content": user_message
            })
            
            # 準備系統消息
            system_message = self.build_system_message(user_message)
            
            # 調用 LLM
            messages = [system_message] + self.conversation_history[-10:]  # 保持最近10條對話
            llm_response = self.call_llm(messages)
            
            # 檢查是否需要使用工具
            tool_result = await self.check_and_use_tools(user_message)
            
            # 組合最終響應
            final_response = llm_response
            if tool_result:
                final_response += f"\n\n{tool_result}"
            
            # 添加助手回應到歷史
            self.conversation_history.append({
                "role": "assistant",
                "content": final_response
            })
            
            return final_response
            
        except Exception as e:
            logger.error(f"Error processing chat message: {e}")
            return f"抱歉，處理您的消息時發生錯誤: {str(e)}"
    
    def build_system_message(self, user_message: str) -> Dict:
        """構建系統消息"""
        context = ""
        
        # 添加標籤頁信息
        if self.tabs_data and self.tabs_data.get('tabs'):
            active_tab = next((tab for tab in self.tabs_data['tabs'] if tab.get('isActive')), None)
            if active_tab:
                context += f"當前活動標籤頁: {active_tab.get('title', 'Unknown')}\n"
                context += f"URL: {active_tab.get('url', 'Unknown')}\n"
            context += f"總共有 {len(self.tabs_data['tabs'])} 個標籤頁\n\n"
        
        # 添加可用工具信息
        if self.mcp_client.tools:
            tools_info = []
            for tool in self.mcp_client.tools:
                tools_info.append(f"- {tool['name']}: {tool['description']}")
            context += f"可用工具:\n" + "\n".join(tools_info) + "\n\n"
        
        return {
            "role": "system",
            "content": f"""你是一個友善的桌面助手，可以幫助用戶管理瀏覽器標籤頁和進行計算。
請用繁體中文簡潔回答，不超過30個字。

當前上下文信息:
{context}

用戶輸入: {user_message}"""
        }
    
    def call_llm(self, messages: List[Dict]) -> str:
        """調用 LLM API"""
        try:
            payload = {
                "model": self.llm_model,
                "messages": messages,
                "max_tokens": 100,
                "temperature": 0.7
            }
            
            response = requests.post(
                f"{self.llm_endpoint}/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            return result["choices"][0]["message"]["content"].strip()
            
        except Exception as e:
            logger.error(f"LLM API call failed: {e}")
            return "抱歉，LLM 服務暫時無法使用 😅"
    
    def call_llm_stream(self, user_message: str):
        """流式調用 LLM（簡化版本）"""
        try:
            # 簡化的流式實現
            response = self.call_llm([{
                "role": "user",
                "content": user_message
            }])
            
            # 模擬流式返回
            words = response.split()
            for i, word in enumerate(words):
                yield {
                    "content": word + (" " if i < len(words) - 1 else ""),
                    "fullResponse": " ".join(words[:i+1])
                }
                
        except Exception as e:
            yield {"error": str(e)}
    
    async def check_and_use_tools(self, user_message: str) -> str:
        """檢查是否需要使用工具並執行"""
        try:
            # 檢查是否包含數學運算關鍵字
            math_keywords = ["計算", "加法", "減法", "乘法", "除法", "+", "-", "*", "/", "加", "減", "乘", "除"]
            
            if any(keyword in user_message for keyword in math_keywords):
                # 嘗試提取數字
                import re
                numbers = re.findall(r'\d+(?:\.\d+)?', user_message)
                
                if len(numbers) >= 2:
                    a = float(numbers[0])
                    b = float(numbers[1])
                    
                    # 根據關鍵字決定運算類型
                    if "加" in user_message or "+" in user_message:
                        result = await self.mcp_client.call_tool("add", {"a": a, "b": b})
                    elif "減" in user_message or "-" in user_message:
                        result = await self.mcp_client.call_tool("subtract", {"a": a, "b": b})
                    elif "乘" in user_message or "*" in user_message:
                        result = await self.mcp_client.call_tool("multiply", {"a": a, "b": b})
                    elif "除" in user_message or "/" in user_message:
                        result = await self.mcp_client.call_tool("divide", {"a": a, "b": b})
                    else:
                        result = await self.mcp_client.call_tool("add", {"a": a, "b": b})
                    
                    if result and "content" in result:
                        return result["content"][0]["text"]
            
            return ""
            
        except Exception as e:
            logger.error(f"Tool usage error: {e}")
            return f"工具調用錯誤: {str(e)}"
    
    async def start_mcp_server(self):
        """啟動 MCP 服務器"""
        try:
            await self.mcp_client.start_server("python", ["mcp_server.py"])
            logger.info("MCP server started successfully")
        except Exception as e:
            logger.error(f"Failed to start MCP server: {e}")
    
    def run(self, host="localhost", port=3000, debug=False):
        """運行服務器"""
        logger.info(f"Starting Unified Server on {host}:{port}")
        
        # 在後台啟動 MCP 服務器
        def start_mcp():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.start_mcp_server())
        
        mcp_thread = threading.Thread(target=start_mcp, daemon=True)
        mcp_thread.start()
        
        # 等待 MCP 服務器啟動
        time.sleep(2)
        
        # 啟動 Flask 服務器
        self.app.run(host=host, port=port, debug=debug, threaded=True)
    
    async def close(self):
        """關閉服務器"""
        await self.mcp_client.close()

def main():
    """主函數"""
    server = UnifiedServer()
    
    try:
        server.run(host="localhost", port=3000, debug=False)
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
        asyncio.run(server.close())
    except Exception as e:
        logger.error(f"Server error: {e}")
        asyncio.run(server.close())

if __name__ == "__main__":
    main()