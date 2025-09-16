#!/usr/bin/env python3
"""
簡單的 MCP (Model Context Protocol) 服務器
提供基本的加法運算工具
"""

import asyncio
import json
import sys
import logging
import io
from typing import Any, Dict, List, Optional, Union

# 設置 UTF-8 編碼
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 設置日誌，使用 ASCII 編碼避免編碼問題
logging.basicConfig(
    level=logging.ERROR,  # 降低日誌級別，避免編碼問題
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)

class Calculator:
    """計算器類，提供基本的數學運算功能"""
    
    def add(self, a: float, b: float) -> float:
        """執行加法運算"""
        return a + b
    
    def subtract(self, a: float, b: float) -> float:
        """執行減法運算"""
        return a - b
    
    def multiply(self, a: float, b: float) -> float:
        """執行乘法運算"""
        return a * b
    
    def divide(self, a: float, b: float) -> float:
        """執行除法運算"""
        if b == 0:
            raise ValueError("Division by zero")
        return a / b
    
    def calculate(self, expression: str) -> float:
        """計算數學表達式"""
        # 安全的表達式計算，只允許基本運算符
        allowed_chars = set('0123456789+-*/.() ')
        if not all(c in allowed_chars for c in expression):
            raise ValueError("Expression contains unsupported characters")
        
        try:
            # 使用 eval 但限制只能使用數學運算
            result = eval(expression, {"__builtins__": {}}, {})
            return float(result)
        except Exception as e:
            raise ValueError(f"Cannot calculate expression: {str(e)}")

class MCPServer:
    """MCP 服務器實現"""
    
    def __init__(self):
        self.calculator = Calculator()
        self.tools = {
            "add": {
                "name": "add",
                "description": "執行兩個數字的加法運算",
                "inputSchema": {
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
            },
            "subtract": {
                "name": "subtract",
                "description": "執行兩個數字的減法運算",
                "inputSchema": {
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
            },
            "multiply": {
                "name": "multiply", 
                "description": "執行兩個數字的乘法運算",
                "inputSchema": {
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
            },
            "divide": {
                "name": "divide",
                "description": "執行兩個數字的除法運算",
                "inputSchema": {
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
            },
            "calculate": {
                "name": "calculate",
                "description": "計算數學表達式",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "要計算的數學表達式"
                        }
                    },
                    "required": ["expression"]
                }
            }
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
                "serverInfo": {
                    "name": "calculator-mcp-server",
                    "version": "1.0.0"
                }
            }
        )
    
    async def handle_tools_list(self, request: Dict) -> Dict:
        """處理工具列表請求"""
        return self.create_response(
            request.get("id"),
            {
                "tools": list(self.tools.values())
            }
        )
    
    async def handle_tools_call(self, request: Dict) -> Dict:
        """處理工具調用請求"""
        try:
            params = request.get("params", {})
            name = params.get("name")
            arguments = params.get("arguments", {})
            
            if name not in self.tools:
                return self.create_response(
                    request.get("id"),
                    error=self.create_error(-32602, f"未知工具: {name}")
                )
            
            # 調用對應的計算器方法
            if name == "add":
                result = self.calculator.add(arguments["a"], arguments["b"])
                content = f"Result: {arguments['a']} + {arguments['b']} = {result}"
            elif name == "subtract":
                result = self.calculator.subtract(arguments["a"], arguments["b"])
                content = f"Result: {arguments['a']} - {arguments['b']} = {result}"
            elif name == "multiply":
                result = self.calculator.multiply(arguments["a"], arguments["b"])
                content = f"Result: {arguments['a']} * {arguments['b']} = {result}"
            elif name == "divide":
                result = self.calculator.divide(arguments["a"], arguments["b"])
                content = f"Result: {arguments['a']} / {arguments['b']} = {result}"
            elif name == "calculate":
                result = self.calculator.calculate(arguments["expression"])
                content = f"Result: {arguments['expression']} = {result}"
            else:
                return self.create_response(
                    request.get("id"),
                    error=self.create_error(-32602, f"不支持的工具: {name}")
                )
            
            return self.create_response(
                request.get("id"),
                {
                    "content": [
                        {
                            "type": "text",
                            "text": content
                        }
                    ]
                }
            )
            
        except ValueError as e:
            return self.create_response(
                request.get("id"),
                error=self.create_error(-32602, str(e))
            )
        except Exception as e:
            logger.error(f"工具調用錯誤: {e}")
            return self.create_response(
                request.get("id"),
                error=self.create_error(-32603, f"內部錯誤: {str(e)}")
            )
    
    async def handle_request(self, request: Dict) -> Dict:
        """處理請求"""
        method = request.get("method")
        
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
    
    async def run(self):
        """運行服務器"""
        # 簡化日誌，避免編碼問題
        
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
                break
            except Exception as e:
                # 簡化錯誤處理，避免編碼問題
                pass

async def main():
    """主函數"""
    server = MCPServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())
