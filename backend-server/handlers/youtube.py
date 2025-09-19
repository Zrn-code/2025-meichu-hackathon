#!/usr/bin/env python3
"""
YouTube 數據處理器
處理來自 Chrome 擴展的 YouTube 監控數據
"""

import logging
import json
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


class YouTubeHandler:
    """YouTube 數據處理器"""
    
    def __init__(self):
        self.current_data = None
        self.data_history = []
        self.max_history = 100
        self.subscribers = []  # 訂閱者列表，用於實時通知
        self.active_tabs = {}  # 存儲活動標籤頁信息 {tab_id: tab_info}
        self.youtube_tabs = set()  # 存儲 YouTube 標籤頁 ID
        
        # 啟動監控線程
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_tabs, daemon=True)
        self.monitor_thread.start()
        
        logger.info("YouTube Handler initialized with tab monitoring")
    
    def update_youtube_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """更新 YouTube 數據"""
        try:
            # 添加處理時間戳
            data['processed_at'] = datetime.now().isoformat()
            
            # 驗證數據完整性
            if not self._validate_data(data):
                logger.warning("Invalid YouTube data received")
                return {
                    "success": False,
                    "error": "Invalid data format"
                }
            
            # 更新標籤頁信息
            tab_id = data.get('tabId')
            if tab_id:
                self.active_tabs[tab_id] = {
                    'url': data.get('url'),
                    'title': data.get('title'),
                    'last_update': datetime.now(),
                    'is_youtube': True
                }
                self.youtube_tabs.add(tab_id)
            
            # 更新當前數據
            self.current_data = data
            
            # 添加到歷史記錄
            self.data_history.append(data)
            if len(self.data_history) > self.max_history:
                self.data_history.pop(0)
            
            # 記錄關鍵信息
            self._log_video_info(data)
            
            # 通知訂閱者
            self._notify_subscribers(data)
            
            return {
                "success": True,
                "message": "Data updated successfully",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error updating YouTube data: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_current_data(self) -> Optional[Dict[str, Any]]:
        """獲取當前 YouTube 數據"""
        return self.current_data
    
    def get_data_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """獲取數據歷史記錄"""
        return self.data_history[-limit:]
    
    def get_video_summary(self) -> Dict[str, Any]:
        """獲取視頻摘要信息"""
        if not self.current_data:
            return {
                "status": "no_data",
                "message": "No video data available"
            }
        
        data = self.current_data
        
        summary = {
            "status": "active",
            "video_id": data.get("videoId"),
            "title": data.get("title"),
            "channel": data.get("channelName"),
            "is_playing": data.get("isPlaying", False),
            "current_time": data.get("currentTime", 0),
            "duration": data.get("duration", 0),
            "progress_percent": self._calculate_progress_percent(data),
            "view_count": data.get("viewCount"),
            "url": data.get("url"),
            "is_playlist": data.get("isPlaylist", False),
            "last_update": data.get("timestamp"),
            "processed_at": data.get("processed_at")
        }
        
        return summary
    
    def get_watching_statistics(self) -> Dict[str, Any]:
        """獲取觀看統計信息"""
        if not self.data_history:
            return {
                "total_videos": 0,
                "total_watch_time": 0,
                "sessions": 0
            }
        
        # 分析歷史數據
        videos = set()
        total_time = 0
        sessions = 0
        current_session_start = None
        
        for entry in self.data_history:
            video_id = entry.get("videoId")
            if video_id:
                videos.add(video_id)
            
            # 簡單的會話計算
            if entry.get("isPlaying") and current_session_start is None:
                current_session_start = entry.get("timestamp")
                sessions += 1
            elif not entry.get("isPlaying") and current_session_start:
                current_session_start = None
        
        return {
            "total_videos": len(videos),
            "total_watch_time": total_time,
            "sessions": sessions,
            "history_entries": len(self.data_history)
        }
    
    def subscribe_to_updates(self, callback):
        """訂閱數據更新通知"""
        if callback not in self.subscribers:
            self.subscribers.append(callback)
            logger.info("New subscriber added for YouTube updates")
    
    def unsubscribe_from_updates(self, callback):
        """取消訂閱數據更新通知"""
        if callback in self.subscribers:
            self.subscribers.remove(callback)
            logger.info("Subscriber removed from YouTube updates")
    
    def stop_monitoring(self) -> Dict[str, Any]:
        """停止監控"""
        # 處理來自擴展的停止監控請求
        if self.current_data and self.current_data.get('tabId'):
            tab_id = self.current_data.get('tabId')
            if tab_id in self.active_tabs:
                del self.active_tabs[tab_id]
            self.youtube_tabs.discard(tab_id)
        
        self.current_data = None
        logger.info("YouTube monitoring stopped")
        
        return {
            "success": True,
            "message": "Monitoring stopped",
            "timestamp": datetime.now().isoformat()
        }
    
    def shutdown(self):
        """關閉監控器"""
        self.monitoring = False
        if self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=2)
        logger.info("YouTube Handler shutdown completed")
    
    def _validate_data(self, data: Dict[str, Any]) -> bool:
        """驗證數據格式"""
        required_fields = ["url", "timestamp"]
        
        for field in required_fields:
            if field not in data:
                logger.warning(f"Missing required field: {field}")
                return False
        
        # 檢查 URL 是否為 YouTube
        url = data.get("url", "")
        if "youtube.com" not in url:
            logger.warning(f"Invalid URL: {url}")
            return False
        
        return True
    
    def _calculate_progress_percent(self, data: Dict[str, Any]) -> float:
        """計算播放進度百分比"""
        current_time = data.get("currentTime", 0)
        duration = data.get("duration", 0)
        
        if duration > 0:
            return round((current_time / duration) * 100, 2)
        return 0.0
    
    def _log_video_info(self, data: Dict[str, Any]):
        """記錄視頻信息"""
        if data.get("type") == "stop_monitoring":
            logger.info("YouTube monitoring stopped by extension")
            return
        
        video_id = data.get("videoId")
        title = data.get("title", "Unknown")
        is_playing = data.get("isPlaying", False)
        current_time = data.get("currentTime", 0)
        duration = data.get("duration", 0)
        
        if video_id:
            status = "播放中" if is_playing else "已暫停"
            progress = self._calculate_progress_percent(data)
            
            logger.info(
                f"YouTube: {title[:30]}... | {status} | "
                f"{current_time}s/{duration}s ({progress}%)"
            )
    
    def _notify_subscribers(self, data: Dict[str, Any]):
        """通知所有訂閱者"""
        for callback in self.subscribers[:]:  # 使用副本避免迭代時修改
            try:
                callback(data)
            except Exception as e:
                logger.error(f"Error notifying subscriber: {e}")
                # 移除有問題的訂閱者
                self.subscribers.remove(callback)
    
    def clear_history(self):
        """清除歷史數據"""
        self.data_history.clear()
        logger.info("YouTube data history cleared")
    
    def export_data(self) -> Dict[str, Any]:
        """導出所有數據"""
        return {
            "current_data": self.current_data,
            "history": self.data_history,
            "statistics": self.get_watching_statistics(),
            "export_time": datetime.now().isoformat()
        }
    
    def _monitor_tabs(self):
        """監控標籤頁數量的後台線程"""
        while self.monitoring:
            try:
                # 清理過期的標籤頁（超過5秒沒有更新的）
                current_time = datetime.now()
                expired_tabs = []
                
                for tab_id, tab_info in list(self.active_tabs.items()):
                    if (current_time - tab_info['last_update']).total_seconds() > 5:
                        expired_tabs.append(tab_id)
                
                for tab_id in expired_tabs:
                    del self.active_tabs[tab_id]
                    self.youtube_tabs.discard(tab_id)
                
                # 統計標籤頁數量
                total_tabs = len(self.active_tabs)
                youtube_tabs = len(self.youtube_tabs)
                
                # 輸出標籤頁統計
                if total_tabs > 0:
                    if youtube_tabs > 0:
                        print(f"🔍 [TAB MONITOR] 總標籤頁: {total_tabs} | 🎬 YouTube 標籤頁: {youtube_tabs}")
                        
                        # 詳細顯示 YouTube 標籤頁信息
                        for tab_id in self.youtube_tabs:
                            if tab_id in self.active_tabs:
                                tab_info = self.active_tabs[tab_id]
                                title = tab_info.get('title', 'Unknown Title')[:50]
                                print(f"  📺 Tab {tab_id}: {title}...")
                    else:
                        print(f"🔍 [TAB MONITOR] 總標籤頁: {total_tabs} | YouTube 標籤頁: 0")
                else:
                    print("🔍 [TAB MONITOR] 沒有活動的標籤頁")
                
                time.sleep(1)  # 每秒檢查一次
                
            except Exception as e:
                logger.error(f"Tab monitoring error: {e}")
                time.sleep(1)
    
    def update_tab_stats(self, tab_data: Dict[str, Any]):
        """更新來自 Chrome 擴展的標籤頁統計"""
        try:
            total_tabs = tab_data.get('totalTabs', 0)
            youtube_tabs = tab_data.get('youtubeTabs', 0)
            
            # 更新活動標籤頁信息
            if 'tabs' in tab_data:
                current_time = datetime.now()
                for tab in tab_data['tabs']:
                    tab_id = tab.get('id')
                    if tab_id and tab.get('isYoutube'):
                        self.active_tabs[tab_id] = {
                            'url': tab.get('url'),
                            'title': tab.get('title'),
                            'last_update': current_time,
                            'is_youtube': True,
                            'active': tab.get('active', False)
                        }
                        self.youtube_tabs.add(tab_id)
            
        except Exception as e:
            logger.error(f"Error updating tab stats: {e}")