#!/usr/bin/env python3
"""
獨立的 MCP 服務器
可以作為獨立進程運行的 MCP 服務器
"""

import asyncio
import json
import sys
import logging
import os
from typing import Dict, Any, Optional

# 添加當前目錄到 Python 路徑，以便導入模組
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.registry import ToolRegistry, tool_registry

# 導入並註冊工具
from tools.calculator import (
    CalculatorTool, AddTool, SubtractTool, 
    MultiplyTool, DivideTool, CalculateTool
)

# 註冊所有工具
def register_all_tools():
    """註冊所有可用工具"""
    import logging
    logger = logging.getLogger(__name__)
    
    tools = [
        CalculatorTool(),
        AddTool(),
        SubtractTool(),
        MultiplyTool(),
        DivideTool(),
        CalculateTool()
    ]
    
    for tool in tools:
        tool_registry.register_tool_instance(tool)
        logger.info(f"Registered tool: {tool.name}")

# 立即註冊工具
register_all_tools()

# UTF-8 編碼由環境變數處理

logger = logging.getLogger(__name__)


class StandaloneMCPServer:
    """獨立的 MCP 服務器"""
    
    def __init__(self):
        self.registry = tool_registry
        self.server_info = {
            "name": "modular-mcp-server",
            "version": "2.0.0",
            "protocol_version": "2024-11-05"
        }
        
        # 設定日誌
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    async def handle_initialize(self, params: Dict) -> Dict:
        """處理初始化請求"""
        return {
            "protocolVersion": self.server_info["protocol_version"],
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": self.server_info["name"],
                "version": self.server_info["version"]
            }
        }
    
    async def handle_tools_list(self, params: Dict) -> Dict:
        """列出可用工具"""
        tools = []
        for tool_name, tool_instance in self.registry.get_all_tools().items():
            tools.append({
                "name": tool_name,
                "description": tool_instance.description,
                "inputSchema": tool_instance.input_schema
            })
        
        return {"tools": tools}
    
    async def handle_tools_call(self, params: Dict) -> Dict:
        """執行工具調用"""
        try:
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            if not tool_name:
                return {
                    "isError": True,
                    "content": [{"type": "text", "text": "Missing tool name"}]
                }
            
            # 執行工具
            result = await self.registry.execute_tool(tool_name, arguments)
            
            return {
                "content": [{"type": "text", "text": str(result)}]
            }
            
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Error: {str(e)}"}]
            }
    
    async def handle_request(self, request: Dict) -> Dict:
        """處理 JSON-RPC 請求"""
        try:
            method = request.get("method")
            params = request.get("params", {})
            request_id = request.get("id")
            
            if method == "initialize":
                result = await self.handle_initialize(params)
            elif method == "tools/list":
                result = await self.handle_tools_list(params)
            elif method == "tools/call":
                result = await self.handle_tools_call(params)
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}"
                    }
                }
            
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Request handling error: {e}")
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                }
            }
    
    async def run(self):
        """運行 MCP 服務器"""
        logger.info(f"Starting MCP Server: {self.server_info['name']} v{self.server_info['version']}")
        logger.info(f"Available tools: {list(self.registry.get_all_tools().keys())}")
        
        try:
            while True:
                # 讀取 JSON-RPC 請求
                line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
                if not line:
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                try:
                    request = json.loads(line)
                    response = await self.handle_request(request)
                    
                    # 發送響應
                    response_json = json.dumps(response, ensure_ascii=True)
                    print(response_json, flush=True)
                    
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON: {e}")
                    continue
                    
        except KeyboardInterrupt:
            logger.info("MCP Server stopped by user")
        except Exception as e:
            logger.error(f"MCP Server error: {e}")


async def main():
    """主函數"""
    server = StandaloneMCPServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())