#!/usr/bin/env python3
"""
對話記錄工具
提供表單式的對話記錄功能，允許 LLM 輸入時間、對話語句和情緒敘述
"""

import logging
import json
import os
import uuid
import requests
import threading
from typing import Dict, Any
from .base import MCPTool

logger = logging.getLogger(__name__)


class ConversationLogTool(MCPTool):
    """對話記錄工具 - 提供表單式的對話記錄功能"""
    
    def __init__(self):
        # 設定資料存儲文件路徑
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
        self.data_file = os.path.join(self.data_dir, "conversation_logs.json")
        
        # 語音生成服務器配置
        self.voice_server_url = "http://localhost:5001/api/generate_voice"
        
        # 確保資料目錄存在
        os.makedirs(self.data_dir, exist_ok=True)
        
        # 確保資料文件存在
        if not os.path.exists(self.data_file):
            self._initialize_data_file()
    
    @property
    def name(self) -> str:
        return "conversation_log"
    
    @property
    def description(self) -> str:
        return "記錄對話日誌，包含時間、對話語句和情緒敘述。用於安排在特定時間以特定語氣說特定的話。"
    
    @property
    def input_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "timestamp": {
                    "type": "string",
                    "description": "希望說話的時間（是第幾秒，例如：'30'、'150'）"
                },
                "emotion": {
                    "type": "string",
                    "description": "情緒或語氣描述（如：溫和的、興奮的、嚴肅的、幽默的等）"
                },
                "message": {
                    "type": "string",
                    "description": "要說的對話語句內容"
                },
                "video_id": {
                    "type": "string",
                    "description": "影片ID（可選，如果未提供將自動生成）"
                }
            },
            "required": ["timestamp", "emotion", "message"]
        }
    
    def _initialize_data_file(self):
        """初始化資料文件"""
        initial_data = {"logs": []}
        
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(initial_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Initialized conversation log data file: {self.data_file}")
    
    def _load_data(self) -> Dict:
        """載入資料"""
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load data: {e}")
            # 如果載入失敗，重新初始化
            self._initialize_data_file()
            return self._load_data()
    
    def _save_data(self, data: Dict):
        """儲存資料"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save data: {e}")
            raise
    
    def _send_voice_generation_request(self, record: Dict):
        """向語音生成服務器發送請求"""
        try:
            # 準備語音生成所需的數據
            voice_data = {
                "timestamp": record["timestamp"],
                "emotion": record["emotion"],
                "message": record["message"],
                "video_id": record["video_id"],
                "logs_id": record["logs_id"]
            }
            
            logger.info(f"向語音服務器發送請求: {record['logs_id']}")
            
            # 發送請求到語音生成服務器
            response = requests.post(
                self.voice_server_url,
                json=voice_data,
                timeout=10
            )
            
            if response.status_code == 202:  # 202 Accepted
                logger.info(f"語音生成請求已被接受: {record['logs_id']}")
            else:
                logger.warning(f"語音服務器回應異常: {response.status_code} - {response.text}")
                
        except requests.exceptions.ConnectionError:
            logger.error(f"無法連接到語音服務器 (localhost:5001): {record['logs_id']}")
        except requests.exceptions.Timeout:
            logger.error(f"語音服務器請求超時: {record['logs_id']}")
        except Exception as e:
            logger.error(f"發送語音生成請求時發生錯誤: {e}")
    
    def _send_voice_request_async(self, record: Dict):
        """異步發送語音生成請求"""
        thread = threading.Thread(
            target=self._send_voice_generation_request,
            args=(record,),
            daemon=True
        )
        thread.start()
    
    async def execute(self, arguments: Dict) -> Dict:
        """執行對話記錄工具"""
        try:
            timestamp = arguments.get("timestamp")
            message = arguments.get("message")
            emotion = arguments.get("emotion")
            video_id = arguments.get("video_id")
            
            # 驗證必要欄位
            if not timestamp:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": "錯誤：timestamp 欄位是必填的"
                        }
                    ]
                }
            
            if not message:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": "錯誤：message 欄位是必填的"
                        }
                    ]
                }
            
            if not emotion:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": "錯誤：emotion 欄位是必填的"
                        }
                    ]
                }
            
            # 生成唯一 ID
            logs_id = str(uuid.uuid4())
            if not video_id:
                video_id = f"video_{str(uuid.uuid4())[:8]}"
            
            # 載入現有資料
            data = self._load_data()
            
            # 創建新記錄
            record = {
                "logs_id": logs_id,
                "video_id": video_id,
                "timestamp": timestamp,
                "emotion": emotion,
                "message": message
            }
            
            # 新增記錄
            data["logs"].append(record)
            
            # 儲存資料
            self._save_data(data)
            
            # 異步發送語音生成請求
            self._send_voice_request_async(record)
            
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"✅ 對話記錄已成功新增！\n📋 記錄ID: {logs_id}\n🎬 影片ID: {video_id}\n🎵 語音生成請求已發送到 localhost:5001"
                    }
                ]
            }
                
        except Exception as e:
            logger.error(f"Error executing conversation log tool: {e}")
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"執行對話記錄工具時發生錯誤: {str(e)}"
                    }
                ]
            }
    
