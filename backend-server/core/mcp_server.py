#!/usr/bin/env python3
"""
MCP 服務器基礎類
提供標準的 MCP 服務器實現
"""

import asyncio
import json
import sys
import logging
from typing import Dict, Any, Optional

from .registry import ToolRegistry, tool_registry

# UTF-8 編碼由環境變數處理

logger = logging.getLogger(__name__)


class MCPServer:
    """MCP 服務器實現"""
    
    def __init__(self, registry: Optional[ToolRegistry] = None):
        self.registry = registry or tool_registry
        self.server_info = {
            "name": "modular-mcp-server",
            "version": "2.0.0"
        }
    
    def create_response(self, request_id: Optional[str], result: Any = None, error: Optional[Dict] = None) -> Dict:
        """創建標準的 JSON-RPC 響應"""
        response = {
            "jsonrpc": "2.0",
            "id": request_id
        }
        
        if error:
            response["error"] = error
        else:
            response["result"] = result
            
        return response
    
    def create_error(self, code: int, message: str, data: Any = None) -> Dict:
        """創建標準的錯誤響應"""
        error = {
            "code": code,
            "message": message
        }
        if data is not None:
            error["data"] = data
        return error
    
    async def handle_initialize(self, request: Dict) -> Dict:
        """處理初始化請求"""
        return self.create_response(
            request.get("id"),
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": self.server_info
            }
        )
    
    async def handle_tools_list(self, request: Dict) -> Dict:
        """處理工具列表請求"""
        try:
            tools = self.registry.get_tools_list()
            return self.create_response(
                request.get("id"),
                {
                    "tools": tools
                }
            )
        except Exception as e:
            logger.error(f"Error handling tools/list: {e}")
            return self.create_response(
                request.get("id"),
                error=self.create_error(-32603, f"內部錯誤: {str(e)}")
            )
    
    async def handle_tools_call(self, request: Dict) -> Dict:
        """處理工具調用請求"""
        try:
            params = request.get("params", {})
            name = params.get("name")
            arguments = params.get("arguments", {})
            
            if not name:
                return self.create_response(
                    request.get("id"),
                    error=self.create_error(-32602, "工具名稱是必需的")
                )
            
            if not self.registry.is_tool_registered(name):
                return self.create_response(
                    request.get("id"),
                    error=self.create_error(-32602, f"未知工具: {name}")
                )
            
            # 調用工具
            result = await self.registry.call_tool(name, arguments)
            
            return self.create_response(
                request.get("id"),
                result
            )
            
        except Exception as e:
            logger.error(f"Tool call error: {e}")
            return self.create_response(
                request.get("id"),
                error=self.create_error(-32603, f"內部錯誤: {str(e)}")
            )
    
    async def handle_request(self, request: Dict) -> Dict:
        """處理請求"""
        method = request.get("method")
        
        try:
            if method == "initialize":
                return await self.handle_initialize(request)
            elif method == "tools/list":
                return await self.handle_tools_list(request)
            elif method == "tools/call":
                return await self.handle_tools_call(request)
            else:
                return self.create_response(
                    request.get("id"),
                    error=self.create_error(-32601, f"未知方法: {method}")
                )
        except Exception as e:
            logger.error(f"Request handling error: {e}")
            return self.create_response(
                request.get("id"),
                error=self.create_error(-32603, f"內部錯誤: {str(e)}")
            )
    
    async def run(self):
        """運行服務器"""
        logger.info(f"Starting MCP Server: {self.server_info['name']} v{self.server_info['version']}")
        logger.info(f"Registered tools: {self.registry.get_tool_count()}")
        
        while True:
            try:
                # 讀取標準輸入
                line = await asyncio.get_event_loop().run_in_executor(
                    None, sys.stdin.readline
                )
                
                if not line:
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                try:
                    request = json.loads(line)
                    response = await self.handle_request(request)
                    # 使用 ASCII 輸出，避免編碼問題
                    print(json.dumps(response, ensure_ascii=True))
                    sys.stdout.flush()
                    
                except json.JSONDecodeError as e:
                    error_response = self.create_response(
                        None,
                        error=self.create_error(-32700, "Parse error")
                    )
                    print(json.dumps(error_response, ensure_ascii=True))
                    sys.stdout.flush()
                    
            except KeyboardInterrupt:
                logger.info("Received interrupt signal")
                break
            except Exception as e:
                logger.error(f"Server error: {e}")
                continue


async def main():
    """主函數"""
    server = MCPServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())