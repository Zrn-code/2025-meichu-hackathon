#!/usr/bin/env python3
"""
工具處理器
處理 MCP 工具相關的請求
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class ToolsHandler:
    """工具處理器"""
    
    def __init__(self, mcp_client=None, tool_registry=None):
        self.mcp_client = mcp_client
        self.tool_registry = tool_registry
    
    def get_available_tools(self) -> List[Dict]:
        """獲取可用工具列表"""
        tools = []
        
        # 從 MCP 客戶端獲取工具
        if self.mcp_client and self.mcp_client.is_initialized:
            tools.extend(self.mcp_client.get_available_tools())
        
        # 從本地註冊器獲取工具
        if self.tool_registry:
            tools.extend(self.tool_registry.get_tools_list())
        
        return tools
    
    async def call_tool(self, name: str, arguments: Dict) -> str:
        """調用工具"""
        try:
            # 首先嘗試本地註冊的工具
            if self.tool_registry and self.tool_registry.is_tool_registered(name):
                result = await self.tool_registry.call_tool(name, arguments)
                return self._extract_text_from_result(result)
            
            # 然後嘗試 MCP 客戶端工具
            if self.mcp_client and self.mcp_client.is_tool_available(name):
                result = await self.mcp_client.call_tool(name, arguments)
                return self._extract_text_from_result(result)
            
            return f"工具 {name} 不可用"
            
        except Exception as e:
            logger.error(f"Tool call error for {name}: {e}")
            return f"工具調用錯誤: {str(e)}"
    
    def _extract_text_from_result(self, result: Dict) -> str:
        """從結果中提取文字內容"""
        try:
            if "content" in result and isinstance(result["content"], list):
                for content_item in result["content"]:
                    if content_item.get("type") == "text":
                        return content_item.get("text", "")
            
            # 如果沒有找到 content，嘗試直接返回結果
            return str(result)
            
        except Exception as e:
            logger.error(f"Error extracting text from result: {e}")
            return f"結果解析錯誤: {str(e)}"
    
    def is_tool_available(self, name: str) -> bool:
        """檢查工具是否可用"""
        # 檢查本地註冊的工具
        if self.tool_registry and self.tool_registry.is_tool_registered(name):
            return True
        
        # 檢查 MCP 客戶端工具
        if self.mcp_client and self.mcp_client.is_tool_available(name):
            return True
        
        return False
    
    def get_tool_count(self) -> int:
        """獲取工具數量"""
        count = 0
        
        if self.tool_registry:
            count += self.tool_registry.get_tool_count()
        
        if self.mcp_client:
            count += len(self.mcp_client.get_available_tools())
        
        return count
    
    def get_context_info(self) -> str:
        """獲取上下文信息用於 LLM"""
        tools = self.get_available_tools()
        
        if not tools:
            return ""
        
        tools_info = []
        for tool in tools:
            tools_info.append(f"- {tool['name']}: {tool['description']}")
        
        return f"可用工具:\n" + "\n".join(tools_info)
    
    def get_tool_by_name(self, name: str) -> Optional[Dict]:
        """根據名稱獲取工具信息"""
        tools = self.get_available_tools()
        
        for tool in tools:
            if tool.get("name") == name:
                return tool
        
        return None
    
    def search_tools(self, query: str) -> List[Dict]:
        """搜索工具"""
        query_lower = query.lower()
        matching_tools = []
        
        for tool in self.get_available_tools():
            name = tool.get("name", "").lower()
            description = tool.get("description", "").lower()
            
            if query_lower in name or query_lower in description:
                matching_tools.append(tool)
        
        return matching_tools
    
    async def batch_call_tools(self, tool_calls: List[Dict]) -> List[Dict]:
        """批量調用工具"""
        results = []
        
        for tool_call in tool_calls:
            name = tool_call.get("name")
            arguments = tool_call.get("arguments", {})
            
            if not name:
                results.append({
                    "error": "工具名稱不能為空",
                    "success": False
                })
                continue
            
            try:
                result_text = await self.call_tool(name, arguments)
                results.append({
                    "name": name,
                    "result": result_text,
                    "success": True
                })
            except Exception as e:
                results.append({
                    "name": name,
                    "error": str(e),
                    "success": False
                })
        
        return results
    
    def get_tools_summary(self) -> Dict:
        """獲取工具摘要"""
        tools = self.get_available_tools()
        
        return {
            "total_tools": len(tools),
            "local_tools": self.tool_registry.get_tool_count() if self.tool_registry else 0,
            "mcp_tools": len(self.mcp_client.get_available_tools()) if self.mcp_client else 0,
            "tools": [{"name": tool["name"], "description": tool["description"]} for tool in tools]
        }