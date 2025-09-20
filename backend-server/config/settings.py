#!/usr/bin/env python3
"""
設定管理器
統一管理應用程式設定
"""

import json
import logging
import os
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class Settings:
    """設定管理器"""
    
    def __init__(self, config_file: str = "agent.json"):
        self.config_file = config_file
        self._config = {}
        self._default_config = {
            "model": "Llama-3.2-1B-Instruct-CPU",
            "endpointUrl": "http://localhost:8000/api/v1",
            "server": {
                "host": "localhost",
                "port": 3000,
                "debug": False
            },
            "chat": {
                "max_tokens": 100,
                "temperature": 0.7,
                "max_history": 10
            },
            "logging": {
                "level": "INFO",
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            }
        }
        self.load_config()
    
    def load_config(self) -> bool:
        """載入設定檔"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, "r", encoding="utf-8") as f:
                    self._config = json.load(f)
                logger.info(f"Loaded config from {self.config_file}")
            else:
                logger.info(f"Config file {self.config_file} not found, using defaults")
                self._config = {}
            
            # 合併預設設定
            self._merge_defaults()
            return True
            
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            self._config = self._default_config.copy()
            return False
    
    def save_config(self) -> bool:
        """儲存設定檔"""
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(self._config, f, ensure_ascii=False, indent=2)
            logger.info(f"Config saved to {self.config_file}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
            return False
    
    def _merge_defaults(self):
        """合併預設設定"""
        def merge_dict(default: Dict, config: Dict) -> Dict:
            merged = default.copy()
            for key, value in config.items():
                if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                    merged[key] = merge_dict(merged[key], value)
                else:
                    merged[key] = value
            return merged
        
        self._config = merge_dict(self._default_config, self._config)
    
    def get(self, key: str, default: Any = None) -> Any:
        """獲取設定值"""
        keys = key.split(".")
        value = self._config
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, key: str, value: Any) -> bool:
        """設定值"""
        try:
            keys = key.split(".")
            config = self._config
            
            # 導航到父級
            for k in keys[:-1]:
                if k not in config:
                    config[k] = {}
                config = config[k]
            
            # 設定值
            config[keys[-1]] = value
            return True
            
        except Exception as e:
            logger.error(f"Failed to set config {key}: {e}")
            return False
    
    def get_llm_config(self) -> Dict:
        """獲取 LLM 設定"""
        return {
            "model": self.get("model"),
            "endpointUrl": self.get("endpointUrl"),
            "max_tokens": self.get("chat.max_tokens"),
            "temperature": self.get("chat.temperature")
        }
    
    def get_server_config(self) -> Dict:
        """獲取伺服器設定"""
        return {
            "host": self.get("server.host"),
            "port": self.get("server.port"),
            "debug": self.get("server.debug")
        }
    
    def get_mcp_config(self) -> Dict:
        """獲取 MCP 設定"""
        return {
            "command": self.get("mcp.command"),
            "args": self.get("mcp.args"),
            "timeout": self.get("mcp.timeout")
        }
    
    def get_chat_config(self) -> Dict:
        """獲取聊天設定"""
        return {
            "max_tokens": self.get("chat.max_tokens"),
            "temperature": self.get("chat.temperature"),
            "max_history": self.get("chat.max_history")
        }
    
    def update_config(self, config_dict: Dict) -> bool:
        """批量更新設定"""
        try:
            for key, value in config_dict.items():
                self.set(key, value)
            return True
        except Exception as e:
            logger.error(f"Failed to update config: {e}")
            return False
    
    def reset_to_defaults(self) -> bool:
        """重設為預設值"""
        try:
            self._config = self._default_config.copy()
            return self.save_config()
        except Exception as e:
            logger.error(f"Failed to reset config: {e}")
            return False
    
    def get_all_config(self) -> Dict:
        """獲取所有設定"""
        return self._config.copy()
    
    def validate_config(self) -> bool:
        """驗證設定"""
        try:
            # 檢查必要的設定
            required_keys = ["model", "endpointUrl"]
            for key in required_keys:
                if not self.get(key):
                    logger.error(f"Missing required config: {key}")
                    return False
            
            # 檢查伺服器設定
            port = self.get("server.port")
            if not isinstance(port, int) or port <= 0 or port > 65535:
                logger.error(f"Invalid server port: {port}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Config validation error: {e}")
            return False
    
    def __getitem__(self, key: str) -> Any:
        """支援字典式存取"""
        return self.get(key)
    
    def __setitem__(self, key: str, value: Any):
        """支援字典式設定"""
        self.set(key, value)
    
    def __contains__(self, key: str) -> bool:
        """支援 in 操作符"""
        return self.get(key) is not None