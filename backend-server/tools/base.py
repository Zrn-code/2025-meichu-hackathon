#!/usr/bin/env python3
"""
MCP 工具基礎類
所有 MCP 工具都應該繼承此類
"""

from abc import ABC, abstractmethod
from typing import Dict, Any
import logging

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
        """執行工具
        
        Args:
            arguments: 工具參數
            
        Returns:
            Dict: MCP 格式的回應，包含 content 陣列
        """
        pass
    
    def to_mcp_format(self) -> Dict:
        """轉換為 MCP 格式"""
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema
        }
    
    def create_text_response(self, text: str) -> Dict:
        """創建文字回應"""
        return {
            "content": [
                {
                    "type": "text",
                    "text": text
                }
            ]
        }
    
    def create_error_response(self, error_message: str) -> Dict:
        """創建錯誤回應"""
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"錯誤: {error_message}"
                }
            ]
        }
    
    def validate_arguments(self, arguments: Dict, required_fields: list) -> bool:
        """驗證參數"""
        for field in required_fields:
            if field not in arguments:
                return False
        return True