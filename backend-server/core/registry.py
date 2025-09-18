#!/usr/bin/env python3
"""
工具註冊管理器
負責管理和註冊 MCP 工具
"""

import logging
from typing import Dict, List, Type, Any, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class MCPTool(ABC):
    """MCP 工具基礎類"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """工具名稱"""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """工具描述"""
        pass
    
    @property
    @abstractmethod
    def input_schema(self) -> Dict:
        """輸入參數 schema"""
        pass
    
    @abstractmethod
    async def execute(self, arguments: Dict) -> Dict:
        """執行工具"""
        pass
    
    def to_mcp_format(self) -> Dict:
        """轉換為 MCP 格式"""
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema
        }


class ToolRegistry:
    """工具註冊管理器"""
    
    def __init__(self):
        self._tools: Dict[str, MCPTool] = {}
        self._tool_classes: Dict[str, Type[MCPTool]] = {}
    
    def register_tool(self, tool_class: Type[MCPTool]):
        """註冊工具類"""
        try:
            # 創建工具實例
            tool_instance = tool_class()
            tool_name = tool_instance.name
            
            if tool_name in self._tools:
                logger.warning(f"Tool {tool_name} already registered, overwriting")
            
            self._tools[tool_name] = tool_instance
            self._tool_classes[tool_name] = tool_class
            logger.info(f"Registered tool: {tool_name}")
            
        except Exception as e:
            logger.error(f"Failed to register tool {tool_class.__name__}: {e}")
    
    def register_tool_instance(self, tool: MCPTool):
        """註冊工具實例"""
        try:
            tool_name = tool.name
            
            if tool_name in self._tools:
                logger.warning(f"Tool {tool_name} already registered, overwriting")
            
            self._tools[tool_name] = tool
            self._tool_classes[tool_name] = type(tool)
            logger.info(f"Registered tool instance: {tool_name}")
            
        except Exception as e:
            logger.error(f"Failed to register tool instance: {e}")
    
    def get_tool(self, name: str) -> Optional[MCPTool]:
        """獲取工具實例"""
        return self._tools.get(name)
    
    def get_all_tools(self) -> Dict[str, MCPTool]:
        """獲取所有工具"""
        return self._tools.copy()
    
    def get_tools_list(self) -> List[Dict]:
        """獲取工具列表（MCP 格式）"""
        return [tool.to_mcp_format() for tool in self._tools.values()]
    
    def is_tool_registered(self, name: str) -> bool:
        """檢查工具是否已註冊"""
        return name in self._tools
    
    async def call_tool(self, name: str, arguments: Dict) -> Dict:
        """調用工具"""
        if name not in self._tools:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"未知工具: {name}"
                    }
                ]
            }
        
        try:
            tool = self._tools[name]
            result = await tool.execute(arguments)
            return result
            
        except Exception as e:
            logger.error(f"Tool execution error for {name}: {e}")
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"工具執行錯誤: {str(e)}"
                    }
                ]
            }
    
    def unregister_tool(self, name: str) -> bool:
        """取消註冊工具"""
        if name in self._tools:
            del self._tools[name]
            if name in self._tool_classes:
                del self._tool_classes[name]
            logger.info(f"Unregistered tool: {name}")
            return True
        return False
    
    def clear_all_tools(self):
        """清除所有工具"""
        self._tools.clear()
        self._tool_classes.clear()
        logger.info("Cleared all registered tools")
    
    def get_tool_count(self) -> int:
        """獲取工具數量"""
        return len(self._tools)


# 全域工具註冊器實例
tool_registry = ToolRegistry()