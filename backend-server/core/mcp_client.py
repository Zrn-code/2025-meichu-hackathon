#!/usr/bin/env python3
"""
統一的 MCP 客戶端
負責與 MCP 服務器通信，提供統一的介面
"""

import asyncio
import json
import sys
import logging
from typing import Dict, List, Optional, Any

# UTF-8 編碼由環境變數處理

logger = logging.getLogger(__name__)


class MCPClient:
    """MCP 客戶端，用於與 MCP 服務器通信"""
    
    def __init__(self):
        self.process = None
        self.tools = []
        self.is_initialized = False
    
    async def start_server(self, command: str, args: List[str]) -> bool:
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
            self.is_initialized = True
            return True
            
        except Exception as e:
            logger.error(f"Failed to start MCP server: {e}")
            self.is_initialized = False
            return False
    
    async def send_request(self, method: str, params: Optional[Dict] = None, request_id: str = "1") -> Dict:
        """發送請求到 MCP 服務器"""
        if not self.process or not self.process.stdin:
            raise Exception("MCP server not available")
        
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method
        }
        
        if params:
            request["params"] = params
        
        request_json = json.dumps(request, ensure_ascii=True)
        
        try:
            # 發送請求
            self.process.stdin.write((request_json + "\n").encode('utf-8'))
            await self.process.stdin.drain()
            
            # 讀取響應
            response_line = await self.process.stdout.readline()
            if not response_line:
                raise Exception("No response from MCP server")
            
            response_json = response_line.decode('utf-8', errors='replace').strip()
            return json.loads(response_json)
            
        except Exception as e:
            logger.error(f"MCP communication error: {e}")
            raise
    
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
            raise
    
    async def list_tools(self):
        """獲取可用工具列表"""
        try:
            response = await self.send_request("tools/list")
            
            if "error" in response:
                raise Exception(f"Failed to get tools list: {response['error']}")
            
            self.tools = response.get("result", {}).get("tools", [])
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
            
            return response.get("result", {})
            
        except Exception as e:
            logger.error(f"Tool call error for {name}: {e}")
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"工具調用失敗: {str(e)}"
                    }
                ]
            }
    
    def get_available_tools(self) -> List[Dict]:
        """獲取可用工具列表"""
        return self.tools.copy()
    
    def is_tool_available(self, tool_name: str) -> bool:
        """檢查工具是否可用"""
        return any(tool.get("name") == tool_name for tool in self.tools)
    
    async def close(self):
        """關閉 MCP 服務器"""
        if self.process:
            try:
                self.process.terminate()
                await self.process.wait()
                logger.info("MCP server closed")
            except Exception as e:
                logger.error(f"Error closing MCP server: {e}")
            finally:
                self.process = None
                self.is_initialized = False
    
    def __del__(self):
        """析構函數"""
        if self.process:
            try:
                if hasattr(asyncio, '_get_running_loop'):
                    loop = asyncio._get_running_loop()
                    if loop is not None:
                        loop.create_task(self.close())
            except:
                pass