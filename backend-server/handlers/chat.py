#!/usr/bin/env python3
"""
聊天處理器
處理與 LLM 相關的請求
"""

import asyncio
import logging
import requests
import re
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class ChatHandler:
    """聊天處理器"""
    
    def __init__(self, llm_config: Dict, tools_handler=None):
        self.llm_model = llm_config.get("model", "Llama-3.2-1B-Instruct-CPU")
        self.llm_endpoint = llm_config.get("endpointUrl", "http://localhost:8000/api/v1")
        self.tools_handler = tools_handler
        self.conversation_history = []
        self.max_history = 10
    
    async def process_message(self, user_message: str) -> str:
        """處理聊天消息"""
        try:
            # 添加到對話歷史
            self.conversation_history.append({
                "role": "user",
                "content": user_message
            })
            
            # 保持對話歷史在限制內
            if len(self.conversation_history) > self.max_history * 2:
                self.conversation_history = self.conversation_history[-self.max_history * 2:]
            
            # 準備系統消息
            system_message = self._build_system_message(user_message)
            
            # 調用 LLM
            messages = [system_message] + self.conversation_history[-self.max_history:]
            llm_response = await self._call_llm(messages)
            
            # 檢查是否需要使用工具
            tool_result = await self._check_and_use_tools(user_message)
            
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
    
    def _build_system_message(self, user_message: str) -> Dict:
        """構建系統消息"""
        context = ""
        
        # 添加可用工具信息
        if self.tools_handler:
            tools_context = self.tools_handler.get_context_info()
            if tools_context:
                context += tools_context + "\n\n"
        
        return {
            "role": "system",
            "content": f"""你是一個友善的桌面助手，可以幫助用戶管理瀏覽器標籤頁和進行計算。
請用繁體中文簡潔回答，不超過30個字。

當前上下文信息:
{context}

用戶輸入: {user_message}"""
        }
    
    async def _call_llm(self, messages: List[Dict]) -> str:
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
            # 添加到對話歷史
            self.conversation_history.append({
                "role": "user",
                "content": user_message
            })
            
            # 保持對話歷史在限制內
            if len(self.conversation_history) > self.max_history * 2:
                self.conversation_history = self.conversation_history[-self.max_history * 2:]
            
            # 準備系統消息
            system_message = self._build_system_message(user_message)
            
            # 調用 LLM
            messages = [system_message] + self.conversation_history[-self.max_history:]
            response = asyncio.run(self._call_llm(messages))
            
            # 檢查是否需要使用工具
            tool_result = asyncio.run(self._check_and_use_tools(user_message))
            
            # 組合最終響應
            final_response = response
            if tool_result:
                final_response += f"\n\n{tool_result}"
            
            # 添加助手回應到歷史
            self.conversation_history.append({
                "role": "assistant",
                "content": final_response
            })
            
            # 模擬流式返回
            words = final_response.split()
            if not words:
                yield {"content": "抱歉，我現在無法回應 😅", "fullResponse": "抱歉，我現在無法回應 😅"}
                return
                
            for i, word in enumerate(words):
                yield {
                    "content": word + (" " if i < len(words) - 1 else ""),
                    "fullResponse": " ".join(words[:i+1])
                }
                
        except Exception as e:
            logger.error(f"Stream LLM call failed: {e}")
            yield {"error": f"抱歉，處理您的消息時發生錯誤: {str(e)}"}
    
    async def _check_and_use_tools(self, user_message: str) -> str:
        """檢查是否需要使用工具並執行"""
        if not self.tools_handler:
            return ""
        
        try:
            # 檢查是否包含數學運算關鍵字
            math_keywords = ["計算", "加法", "減法", "乘法", "除法", "+", "-", "*", "/", "加", "減", "乘", "除"]
            
            if any(keyword in user_message for keyword in math_keywords):
                # 嘗試提取數字
                numbers = re.findall(r'\d+(?:\.\d+)?', user_message)
                
                if len(numbers) >= 2:
                    a = float(numbers[0])
                    b = float(numbers[1])
                    
                    # 根據關鍵字決定運算類型
                    if "加" in user_message or "+" in user_message:
                        return await self.tools_handler.call_tool("add", {"a": a, "b": b})
                    elif "減" in user_message or "-" in user_message:
                        return await self.tools_handler.call_tool("subtract", {"a": a, "b": b})
                    elif "乘" in user_message or "*" in user_message:
                        return await self.tools_handler.call_tool("multiply", {"a": a, "b": b})
                    elif "除" in user_message or "/" in user_message:
                        return await self.tools_handler.call_tool("divide", {"a": a, "b": b})
                    else:
                        return await self.tools_handler.call_tool("add", {"a": a, "b": b})
            
            return ""
            
        except Exception as e:
            logger.error(f"Tool usage error: {e}")
            return f"工具調用錯誤: {str(e)}"
    
    def clear_history(self):
        """清除對話歷史"""
        self.conversation_history.clear()
        logger.info("Conversation history cleared")
    
    def get_history(self) -> List[Dict]:
        """獲取對話歷史"""
        return self.conversation_history.copy()