#!/usr/bin/env python3
"""
Google 搜索工具
提供 Google 自定義搜索功能，並將結果保存到以 video_id 命名的 JSON 檔案中
"""

import logging
import json
import os
import re
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup
from .base import MCPTool

logger = logging.getLogger(__name__)


class GoogleSearchTool(MCPTool):
    """Google 搜索工具 - 搜索關鍵字並將結果保存到對應的 JSON 檔案"""
    
    GOOGLE_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1"
    
    def __init__(self, youtube_handler=None):
        # YouTube Handler 實例用於獲取當前影片 ID
        self.youtube_handler = youtube_handler
        
        # 設置資料存儲目錄
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "video_keyword")
        os.makedirs(self.data_dir, exist_ok=True)
        
        # 載入環境變數
        self._load_env_vars()
    
    @property
    def name(self) -> str:
        return "google_search"
    
    @property
    def description(self) -> str:
        return "使用 Google 自定義搜索 API 搜索關鍵字，並將結果保存到以當前 YouTube 影片 ID 命名的 JSON 檔案中。"
    
    @property
    def input_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "keyword": {
                    "type": "string",
                    "description": "要搜索的關鍵字或查詢語句"
                },
                "num_results": {
                    "type": "integer",
                    "description": "搜索結果數量（1-10，預設為3）",
                    "minimum": 1,
                    "maximum": 10,
                    "default": 3
                }
            },
            "required": ["keyword"]
        }
    
    def _load_env_vars(self):
        """載入環境變數"""
        # 嘗試從 .env 檔案載入
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            self._parse_env_file(env_path)
        
        # 檢查必要的環境變數
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        self.google_cse_id = os.getenv("GOOGLE_CSE_ID")
        
        if not self.google_api_key or not self.google_cse_id:
            logger.warning("Google API 憑證未設置，請在 .env 檔案或環境變數中設置 GOOGLE_API_KEY 和 GOOGLE_CSE_ID")
    
    def _parse_env_file(self, env_path: Path):
        """解析 .env 檔案"""
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key not in os.environ:
                    os.environ[key] = value
        except Exception as e:
            logger.error(f"解析 .env 檔案失敗: {e}")
    
    def _get_current_video_id(self) -> Optional[str]:
        """獲取當前 YouTube 影片 ID"""
        if not self.youtube_handler:
            logger.warning("YouTube Handler 未設置，無法獲取當前影片 ID")
            return None
        
        return self.youtube_handler.get_current_video_id()
    
    def _google_search(self, query: str, num: int = 3) -> Dict:
        """執行 Google 搜索"""
        if not self.google_api_key or not self.google_cse_id:
            raise Exception("Google API 憑證未設置")
        
        params = {
            "key": self.google_api_key,
            "cx": self.google_cse_id,
            "q": query,
            "num": max(1, min(int(num), 10)),
            "hl": "zh-TW",
            "lr": "lang_zh-TW",
            "safe": "active",
            "gl": "tw",
        }
        
        try:
            response = requests.get(self.GOOGLE_SEARCH_ENDPOINT, params=params, timeout=20)
            response.raise_for_status()
            return response.json()
        except requests.HTTPError as e:
            try:
                detail = response.json()
            except:
                detail = response.text
            raise Exception(f"Google Search API 失敗: {e}\n{detail}")
    
    def _extract_search_results(self, search_data: Dict, keyword: str) -> Dict:
        """提取搜索結果"""
        items = search_data.get("items", [])
        
        results = []
        for item in items:
            result = {
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "timestamp": datetime.now().isoformat()
            }
            results.append(result)
        
        return {
            "keyword": keyword,
            "search_timestamp": datetime.now().isoformat(),
            "total_results": len(results),
            "results": results
        }
    
    def _save_to_json(self, data: Dict, video_id: str) -> str:
        """將搜索結果保存到 JSON 檔案"""
        filename = f"{video_id}.json"
        filepath = os.path.join(self.data_dir, filename)
        
        # 如果檔案已存在，載入現有資料並添加新的搜索結果
        existing_data = {"searches": []}
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                # 確保 searches 鍵存在
                if "searches" not in existing_data:
                    existing_data["searches"] = []
            except Exception as e:
                logger.error(f"載入現有檔案失敗: {e}")
        
        # 添加新的搜索結果
        existing_data["searches"].append(data)
        existing_data["last_updated"] = datetime.now().isoformat()
        
        # 保存到檔案
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(existing_data, f, ensure_ascii=False, indent=2)
            return filepath
        except Exception as e:
            logger.error(f"保存檔案失敗: {e}")
            raise
    
    async def execute(self, arguments: Dict) -> Dict:
        """執行 Google 搜索"""
        try:
            # 驗證參數
            if not self.validate_arguments(arguments, ["keyword"]):
                return self.create_error_response("缺少必要參數: keyword")
            
            keyword = arguments.get("keyword")
            num_results = arguments.get("num_results", 3)
            
            # 檢查 API 憑證
            if not self.google_api_key or not self.google_cse_id:
                return self.create_error_response(
                    "Google API 憑證未設置，請設置 GOOGLE_API_KEY 和 GOOGLE_CSE_ID 環境變數"
                )
            
            # 獲取當前影片 ID
            video_id = self._get_current_video_id()
            if not video_id:
                return self.create_error_response(
                    "無法獲取當前 YouTube 影片 ID，請確保正在觀看 YouTube 影片"
                )
            
            # 執行搜索
            search_data = self._google_search(keyword, num_results)
            search_results = self._extract_search_results(search_data, keyword)
            
            # 保存結果
            filepath = self._save_to_json(search_results, video_id)
            
            # 準備回應訊息
            results_summary = []
            for i, result in enumerate(search_results["results"], 1):
                results_summary.append(f"{i}. {result['title']}\n   連結: {result['link']}")
            
            response_text = (
                f"✅ Google 搜索完成\n\n"
                f"🔍 關鍵字: {keyword}\n"
                f"📹 影片 ID: {video_id}\n"
                f"📁 保存位置: {filepath}\n"
                f"📊 找到 {len(search_results['results'])} 個結果\n\n"
                f"搜索結果:\n" + "\n\n".join(results_summary)
            )
            
            return self.create_text_response(response_text)
            
        except Exception as e:
            logger.error(f"Google 搜索執行失敗: {e}")
            return self.create_error_response(f"搜索失敗: {str(e)}")