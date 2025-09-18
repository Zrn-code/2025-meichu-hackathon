#!/usr/bin/env python3
"""
計算器工具
提供基本的數學運算功能
"""

import logging
from typing import Dict, Any
from .base import MCPTool

logger = logging.getLogger(__name__)


class CalculatorTool(MCPTool):
    """計算器工具 - 提供基本數學運算"""
    
    @property
    def name(self) -> str:
        return "calculator"
    
    @property
    def description(self) -> str:
        return "執行基本數學運算，包括加減乘除和表達式計算"
    
    @property
    def input_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["add", "subtract", "multiply", "divide", "calculate"],
                    "description": "運算類型"
                },
                "a": {
                    "type": "number",
                    "description": "第一個數字（加減乘除時使用）"
                },
                "b": {
                    "type": "number",
                    "description": "第二個數字（加減乘除時使用）"
                },
                "expression": {
                    "type": "string",
                    "description": "數學表達式（calculate 時使用）"
                }
            },
            "required": ["operation"]
        }
    
    async def execute(self, arguments: Dict) -> Dict:
        """執行計算"""
        try:
            operation = arguments.get("operation")
            
            if operation in ["add", "subtract", "multiply", "divide"]:
                return await self._execute_basic_operation(operation, arguments)
            elif operation == "calculate":
                return await self._execute_expression(arguments)
            else:
                return self.create_error_response(f"不支持的運算類型: {operation}")
                
        except Exception as e:
            logger.error(f"Calculator execution error: {e}")
            return self.create_error_response(str(e))
    
    async def _execute_basic_operation(self, operation: str, arguments: Dict) -> Dict:
        """執行基本運算"""
        if not self.validate_arguments(arguments, ["a", "b"]):
            return self.create_error_response("缺少必要參數 a 或 b")
        
        try:
            a = float(arguments["a"])
            b = float(arguments["b"])
            
            if operation == "add":
                result = a + b
                text = f"{a} + {b} = {result}"
            elif operation == "subtract":
                result = a - b
                text = f"{a} - {b} = {result}"
            elif operation == "multiply":
                result = a * b
                text = f"{a} × {b} = {result}"
            elif operation == "divide":
                if b == 0:
                    return self.create_error_response("除數不能為零")
                result = a / b
                text = f"{a} ÷ {b} = {result}"
            else:
                return self.create_error_response(f"未知運算: {operation}")
            
            return self.create_text_response(text)
            
        except (ValueError, TypeError) as e:
            return self.create_error_response(f"參數格式錯誤: {e}")
    
    async def _execute_expression(self, arguments: Dict) -> Dict:
        """執行表達式計算"""
        if not self.validate_arguments(arguments, ["expression"]):
            return self.create_error_response("缺少表達式參數")
        
        try:
            expression = arguments["expression"]
            result = self._safe_eval(expression)
            text = f"{expression} = {result}"
            
            return self.create_text_response(text)
            
        except Exception as e:
            return self.create_error_response(f"表達式計算錯誤: {e}")
    
    def _safe_eval(self, expression: str) -> float:
        """安全的表達式計算"""
        # 清理表達式，只允許數字、運算符和括號
        allowed_chars = set('0123456789+-*/.() ')
        if not all(c in allowed_chars for c in expression):
            raise ValueError("表達式包含不支持的字符")
        
        # 替換常見的中文運算符
        expression = expression.replace('×', '*').replace('÷', '/')
        
        try:
            # 使用 eval 但限制只能使用數學運算
            result = eval(expression, {"__builtins__": {}}, {})
            return float(result)
        except Exception as e:
            raise ValueError(f"無法計算表達式: {str(e)}")


class AddTool(MCPTool):
    """加法工具 - 向後兼容"""
    
    @property
    def name(self) -> str:
        return "add"
    
    @property
    def description(self) -> str:
        return "執行兩個數字的加法運算"
    
    @property
    def input_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "a": {
                    "type": "number",
                    "description": "第一個數字"
                },
                "b": {
                    "type": "number",
                    "description": "第二個數字"
                }
            },
            "required": ["a", "b"]
        }
    
    async def execute(self, arguments: Dict) -> Dict:
        """執行加法"""
        if not self.validate_arguments(arguments, ["a", "b"]):
            return self.create_error_response("缺少必要參數 a 或 b")
        
        try:
            a = float(arguments["a"])
            b = float(arguments["b"])
            result = a + b
            
            return self.create_text_response(f"Result: {a} + {b} = {result}")
            
        except (ValueError, TypeError) as e:
            return self.create_error_response(f"參數格式錯誤: {e}")


class SubtractTool(MCPTool):
    """減法工具 - 向後兼容"""
    
    @property
    def name(self) -> str:
        return "subtract"
    
    @property
    def description(self) -> str:
        return "執行兩個數字的減法運算"
    
    @property
    def input_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "a": {
                    "type": "number",
                    "description": "被減數"
                },
                "b": {
                    "type": "number",
                    "description": "減數"
                }
            },
            "required": ["a", "b"]
        }
    
    async def execute(self, arguments: Dict) -> Dict:
        """執行減法"""
        if not self.validate_arguments(arguments, ["a", "b"]):
            return self.create_error_response("缺少必要參數 a 或 b")
        
        try:
            a = float(arguments["a"])
            b = float(arguments["b"])
            result = a - b
            
            return self.create_text_response(f"Result: {a} - {b} = {result}")
            
        except (ValueError, TypeError) as e:
            return self.create_error_response(f"參數格式錯誤: {e}")


class MultiplyTool(MCPTool):
    """乘法工具 - 向後兼容"""
    
    @property
    def name(self) -> str:
        return "multiply"
    
    @property
    def description(self) -> str:
        return "執行兩個數字的乘法運算"
    
    @property
    def input_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "a": {
                    "type": "number",
                    "description": "第一個數字"
                },
                "b": {
                    "type": "number",
                    "description": "第二個數字"
                }
            },
            "required": ["a", "b"]
        }
    
    async def execute(self, arguments: Dict) -> Dict:
        """執行乘法"""
        if not self.validate_arguments(arguments, ["a", "b"]):
            return self.create_error_response("缺少必要參數 a 或 b")
        
        try:
            a = float(arguments["a"])
            b = float(arguments["b"])
            result = a * b
            
            return self.create_text_response(f"Result: {a} * {b} = {result}")
            
        except (ValueError, TypeError) as e:
            return self.create_error_response(f"參數格式錯誤: {e}")


class DivideTool(MCPTool):
    """除法工具 - 向後兼容"""
    
    @property
    def name(self) -> str:
        return "divide"
    
    @property
    def description(self) -> str:
        return "執行兩個數字的除法運算"
    
    @property
    def input_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "a": {
                    "type": "number",
                    "description": "被除數"
                },
                "b": {
                    "type": "number",
                    "description": "除數（不能為零）"
                }
            },
            "required": ["a", "b"]
        }
    
    async def execute(self, arguments: Dict) -> Dict:
        """執行除法"""
        if not self.validate_arguments(arguments, ["a", "b"]):
            return self.create_error_response("缺少必要參數 a 或 b")
        
        try:
            a = float(arguments["a"])
            b = float(arguments["b"])
            
            if b == 0:
                return self.create_error_response("除數不能為零")
            
            result = a / b
            
            return self.create_text_response(f"Result: {a} / {b} = {result}")
            
        except (ValueError, TypeError) as e:
            return self.create_error_response(f"參數格式錯誤: {e}")


class CalculateTool(MCPTool):
    """表達式計算工具 - 向後兼容"""
    
    @property
    def name(self) -> str:
        return "calculate"
    
    @property
    def description(self) -> str:
        return "計算數學表達式"
    
    @property
    def input_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "要計算的數學表達式"
                }
            },
            "required": ["expression"]
        }
    
    async def execute(self, arguments: Dict) -> Dict:
        """執行表達式計算"""
        if not self.validate_arguments(arguments, ["expression"]):
            return self.create_error_response("缺少表達式參數")
        
        try:
            expression = arguments["expression"]
            calculator = CalculatorTool()
            result_dict = await calculator._execute_expression(arguments)
            
            return result_dict
            
        except Exception as e:
            return self.create_error_response(f"計算錯誤: {e}")