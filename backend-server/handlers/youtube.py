#!/usr/bin/env python3
"""
YouTube 數據處理器
處理來自 Chrome 擴展的 YouTube 監控數據
"""

import logging
import json
import os
import threading
import time
import requests
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
        
        # 字幕相關數據存儲
        self.subtitle_history = []  # 字幕歷史記錄
        self.max_subtitle_history = 200  # 最大字幕歷史記錄數量
        self.current_subtitles = None  # 當前字幕信息
        
        # Supadata API 相關設定
        self.supadata_api_key = "sd_9aafb77d7110d078e7f233732bb02d69"
        self.supadata_base_url = "https://api.supadata.ai/v1/transcript"
        self.processed_fullscreen_videos = set()  # 避免重複處理同一個視頻
        self.last_mode_state = {}  # 記錄上次的模式狀態
        
        # 設定字幕檔案存儲路徑
        self.subtitles_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'video_subtitles')
        self._ensure_subtitles_dir_exists()
        
        # 啟動監控線程
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_tabs, daemon=True)
        self.monitor_thread.start()
        
        logger.info("YouTube Handler initialized with tab monitoring and subtitle support")
    
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
            
            # 檢測全螢幕或影劇模式並處理轉錄
            self._check_and_handle_special_modes(data)
            
            # 處理字幕數據
            self._process_subtitle_data(data)
            
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
    
    def get_current_video_id(self) -> Optional[str]:
        """獲取當前活動視頻的ID"""
        if not self.current_data:
            logger.debug("No current_data available")
            return None
            
        video_id = self.current_data.get('videoId')
        if not video_id:
            logger.debug(f"No videoId in current_data. Available keys: {list(self.current_data.keys()) if self.current_data else 'None'}")
            return None
            
        return video_id
    
    def _process_subtitle_data(self, data: Dict[str, Any]):
        """處理字幕數據"""
        try:
            subtitles = data.get('subtitles')
            if not subtitles:
                return
            
            # 更新當前字幕信息
            self.current_subtitles = {
                'video_id': data.get('videoId'),
                'timestamp': data.get('timestamp'),
                'subtitle_info': subtitles,
                'video_time': data.get('currentTime', 0)
            }
            
            # 如果有字幕文本，添加到歷史記錄
            current_text = subtitles.get('currentText')
            if current_text and isinstance(current_text, dict):
                subtitle_entry = {
                    'video_id': data.get('videoId'),
                    'video_title': data.get('title'),
                    'timestamp': data.get('timestamp'),
                    'video_time': data.get('currentTime', 0),
                    'text': current_text.get('text'),
                    'lines': current_text.get('lines', []),
                    'track': subtitles.get('currentTrack'),
                    'start_time': current_text.get('startTime'),
                    'end_time': current_text.get('endTime')
                }
                
                # 避免重複添加相同的字幕
                if not self._is_duplicate_subtitle(subtitle_entry):
                    self.subtitle_history.append(subtitle_entry)
                    
                    # 限制歷史記錄數量
                    if len(self.subtitle_history) > self.max_subtitle_history:
                        self.subtitle_history.pop(0)
                    
                    logger.debug(f"New subtitle: {current_text.get('text', '')[:50]}...")
            
        except Exception as e:
            logger.error(f"Error processing subtitle data: {e}")
    
    def _is_duplicate_subtitle(self, new_entry: Dict[str, Any]) -> bool:
        """檢查是否為重複的字幕條目"""
        if not self.subtitle_history:
            return False
        
        last_entry = self.subtitle_history[-1]
        
        # 如果是同一個視頻且文本相同，則認為是重複
        return (
            last_entry.get('video_id') == new_entry.get('video_id') and
            last_entry.get('text') == new_entry.get('text') and
            abs(last_entry.get('video_time', 0) - new_entry.get('video_time', 0)) < 2
        )
    
    def get_current_subtitles(self) -> Optional[Dict[str, Any]]:
        """獲取當前字幕信息"""
        return self.current_subtitles
    
    def get_subtitle_history(self, video_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """獲取字幕歷史記錄"""
        # 如果沒有指定video_id，使用當前視頻ID
        if video_id is None:
            video_id = self.get_current_video_id()
        
        history = self.subtitle_history
        
        # 如果有視頻ID，則篩選
        if video_id:
            history = [entry for entry in history if entry.get('video_id') == video_id]
        
        return history[-limit:]
    
    def get_subtitle_transcript(self, video_id: Optional[str] = None) -> Dict[str, Any]:
        """獲取完整的字幕轉錄文本"""
        # 如果沒有指定video_id，使用當前視頻ID
        if video_id is None:
            video_id = self.get_current_video_id()
        
        history = self.get_subtitle_history(video_id)
        
        if not history:
            return {
                "video_id": video_id,
                "transcript": "",
                "entries": 0,
                "error": "No subtitle data available"
            }
        
        # 組合字幕文本
        transcript_lines = []
        for entry in history:
            text = entry.get('text', '').strip()
            video_time = entry.get('video_time', 0)
            if text:
                # 格式化時間戳
                minutes = int(video_time // 60)
                seconds = int(video_time % 60)
                time_str = f"[{minutes:02d}:{seconds:02d}]"
                transcript_lines.append(f"{time_str} {text}")
        
        return {
            "video_id": video_id or (history[0].get('video_id') if history else None),
            "video_title": history[0].get('video_title') if history else None,
            "transcript": "\n".join(transcript_lines),
            "full_text": " ".join([entry.get('text', '') for entry in history if entry.get('text')]),
            "entries": len(history),
            "duration_covered": f"{int(history[0].get('video_time', 0))}s - {int(history[-1].get('video_time', 0))}s" if history else "0s"
        }
    
    def search_subtitles(self, query: str, video_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """在字幕中搜索關鍵字"""
        # 如果沒有指定video_id，使用當前視頻ID
        if video_id is None:
            video_id = self.get_current_video_id()
            
        results = []
        history = self.get_subtitle_history(video_id, limit=self.max_subtitle_history)
        
        query_lower = query.lower()
        
        for entry in history:
            text = entry.get('text', '')
            if query_lower in text.lower():
                results.append({
                    'video_id': entry.get('video_id'),
                    'video_title': entry.get('video_title'),
                    'text': text,
                    'video_time': entry.get('video_time'),
                    'timestamp': entry.get('timestamp'),
                    'track': entry.get('track')
                })
        
        return results
    
    def clear_subtitle_history(self, video_id: Optional[str] = None):
        """清除字幕歷史記錄"""
        if video_id:
            # 清除指定視頻的字幕記錄
            self.subtitle_history = [
                entry for entry in self.subtitle_history 
                if entry.get('video_id') != video_id
            ]
            logger.info(f"Cleared subtitle history for video: {video_id}")
        else:
            # 清除所有字幕記錄
            self.subtitle_history.clear()
            self.current_subtitles = None
            logger.info("Cleared all subtitle history")
    
    def get_subtitle_statistics(self) -> Dict[str, Any]:
        """獲取字幕統計信息"""
        if not self.subtitle_history:
            return {
                "total_entries": 0,
                "unique_videos": 0,
                "languages": [],
                "total_characters": 0
            }
        
        unique_videos = set()
        languages = set()
        total_chars = 0
        
        for entry in self.subtitle_history:
            if entry.get('video_id'):
                unique_videos.add(entry.get('video_id'))
            
            track = entry.get('track')
            if track and track.get('language'):
                languages.add(track.get('language'))
            
            text = entry.get('text', '')
            total_chars += len(text)
        
        return {
            "total_entries": len(self.subtitle_history),
            "unique_videos": len(unique_videos),
            "languages": list(languages),
            "total_characters": total_chars,
            "current_subtitle_available": self.current_subtitles is not None
        }
    
    def get_current_video_subtitle_count(self) -> Dict[str, Any]:
        """獲取當前視頻的字幕數量統計"""
        try:
            current_video_id = self.get_current_video_id()
            
            if not current_video_id:
                return {
                    "success": False,
                    "error": "No current video available",
                    "video_id": None,
                    "counts": {
                        "history_entries": 0,
                        "total_count": 0
                    }
                }
            
            # 統計歷史字幕條目數量
            history_count = len([
                entry for entry in self.subtitle_history 
                if entry.get('video_id') == current_video_id
            ])
            
            # 獲取當前視頻信息
            video_title = None
            video_duration = None
            if self.current_data and self.current_data.get('videoId') == current_video_id:
                video_title = self.current_data.get('title')
                video_duration = self.current_data.get('duration', 0)
            
            return {
                "success": True,
                "video_id": current_video_id,
                "video_title": video_title,
                "video_duration": video_duration,
                "counts": {
                    "history_entries": history_count,
                    "total_count": history_count
                },
                "subtitle_sources": {
                    "has_history": history_count > 0
                },
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting current video subtitle count: {e}")
            return {
                "success": False,
                "error": str(e),
                "video_id": self.get_current_video_id(),
                "counts": {
                    "history_entries": 0,
                    "total_count": 0
                }
            }
    
    def _check_and_handle_special_modes(self, data: Dict[str, Any]):
        """檢測全螢幕或影劇模式並觸發轉錄處理"""
        try:
            video_id = data.get('videoId')
            video_url = data.get('url')
            is_fullscreen = data.get('isFullscreen', False)
            is_theater_mode = data.get('isTheaterMode', False)
            
            if not video_id or not video_url:
                return
            
            # 檢查是否進入了全螢幕或影劇模式
            current_special_mode = is_fullscreen or is_theater_mode
            previous_special_mode = self.last_mode_state.get(video_id, False)
            
            # 更新狀態記錄
            self.last_mode_state[video_id] = current_special_mode
            
            # 如果從非特殊模式切換到特殊模式，且該視頻未被處理過
            if current_special_mode and not previous_special_mode and video_id not in self.processed_fullscreen_videos:
                logger.info(f"Detected special mode for video {video_id}: fullscreen={is_fullscreen}, theater={is_theater_mode}")
                
                # 檢查字幕檔案是否已存在
                subtitle_file_path = self._get_subtitle_file_path(video_id)
                if os.path.exists(subtitle_file_path):
                    logger.info(f"Subtitle file already exists for video {video_id}, skipping API call")
                    self.processed_fullscreen_videos.add(video_id)
                    return
                
                # 標記為已處理，避免重複
                self.processed_fullscreen_videos.add(video_id)
                
                # 在後台線程中處理轉錄，避免阻塞主線程
                threading.Thread(
                    target=self._process_video_transcript,
                    args=(video_url, video_id),
                    daemon=True
                ).start()
                
        except Exception as e:
            logger.error(f"Error in _check_and_handle_special_modes: {e}")
    
    def _process_video_transcript(self, video_url: str, video_id: str):
        """處理視頻轉錄（在後台線程中運行）"""
        try:
            logger.info(f"Starting transcript processing for video: {video_id}")
            
            # 調用 Supadata API
            transcript_result = self._call_supadata_api(video_url)
            
            if transcript_result.get('success'):
                logger.info(f"Successfully retrieved transcript for video: {video_id}")
                
                # 將轉錄結果存儲到字幕歷史中
                self._store_transcript_result(video_id, video_url, transcript_result)
                
                # 通知訂閱者有新的轉錄數據
                self._notify_transcript_update(video_id, transcript_result)
                
            else:
                logger.warning(f"Failed to retrieve transcript for video {video_id}: {transcript_result.get('error')}")
                
        except Exception as e:
            logger.error(f"Error processing video transcript for {video_id}: {e}")
    
    def _call_supadata_api(self, video_url: str) -> Dict[str, Any]:
        """調用 Supadata API 獲取轉錄"""
        try:
            # 準備 API 請求
            api_url = f"{self.supadata_base_url}?url={video_url}"
            headers = {
                'x-api-key': self.supadata_api_key,
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Calling Supadata API: {api_url}")
            
            # 發送 GET 請求
            response = requests.get(api_url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'data': result,
                    'timestamp': datetime.now().isoformat()
                }
            else:
                logger.error(f"Supadata API error: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': f"API returned status {response.status_code}",
                    'response_text': response.text
                }
                
        except requests.exceptions.Timeout:
            logger.error("Supadata API request timeout")
            return {
                'success': False,
                'error': 'Request timeout'
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Supadata API request error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"Unexpected error calling Supadata API: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _store_transcript_result(self, video_id: str, video_url: str, transcript_result: Dict[str, Any]):
        """將轉錄結果存儲到字幕歷史和檔案中"""
        try:
            transcript_data = transcript_result.get('data', {})
            
            # 創建轉錄條目
            transcript_entry = {
                'video_id': video_id,
                'video_url': video_url,
                'video_title': self.current_data.get('title', 'Unknown') if self.current_data else 'Unknown',
                'transcript_type': 'supadata_api',
                'transcript_data': transcript_data,
                'timestamp': transcript_result.get('timestamp'),
                'created_at': datetime.now().isoformat(),
                'mode_trigger': 'fullscreen_or_theater'
            }
            
            # 儲存到檔案系統
            self._save_transcript_to_file(video_id, transcript_entry)
            
            # 添加到字幕歷史
            self.subtitle_history.append(transcript_entry)
            
            # 限制歷史記錄數量
            if len(self.subtitle_history) > self.max_subtitle_history:
                self.subtitle_history.pop(0)
            
            logger.info(f"Stored transcript result for video: {video_id} (both in memory and file)")
            
        except Exception as e:
            logger.error(f"Error storing transcript result: {e}")
    
    def _notify_transcript_update(self, video_id: str, transcript_result: Dict[str, Any]):
        """通知訂閱者有新的轉錄更新"""
        try:
            notification_data = {
                'type': 'transcript_update',
                'video_id': video_id,
                'transcript_available': transcript_result.get('success', False),
                'timestamp': datetime.now().isoformat()
            }
            
            # 通知所有訂閱者
            self._notify_subscribers(notification_data)
            
        except Exception as e:
            logger.error(f"Error notifying transcript update: {e}")
    
    def get_video_transcripts(self, video_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """獲取視頻的轉錄數據"""
        if video_id is None:
            video_id = self.get_current_video_id()
        
        if not video_id:
            return []
        
        # 篩選出該視頻的轉錄數據
        transcripts = [
            entry for entry in self.subtitle_history
            if entry.get('video_id') == video_id and entry.get('transcript_type') == 'supadata_api'
        ]
        
        return transcripts
    
    def get_latest_transcript(self, video_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """獲取最新的轉錄數據"""
        transcripts = self.get_video_transcripts(video_id)
        return transcripts[-1] if transcripts else None
    
    def _ensure_subtitles_dir_exists(self):
        """確保字幕目錄存在"""
        try:
            if not os.path.exists(self.subtitles_dir):
                os.makedirs(self.subtitles_dir, exist_ok=True)
                logger.info(f"Created subtitles directory: {self.subtitles_dir}")
        except Exception as e:
            logger.error(f"Error creating subtitles directory: {e}")
    
    def _get_subtitle_file_path(self, video_id: str) -> str:
        """獲取字幕檔案的完整路徑"""
        return os.path.join(self.subtitles_dir, f"{video_id}.json")
    
    def _save_transcript_to_file(self, video_id: str, transcript_entry: Dict[str, Any]):
        """將轉錄結果保存到檔案"""
        try:
            file_path = self._get_subtitle_file_path(video_id)
            
            # 確保目錄存在
            self._ensure_subtitles_dir_exists()
            
            # 將轉錄條目保存為 JSON 檔案
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(transcript_entry, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Successfully saved transcript to file: {file_path}")
            
        except Exception as e:
            logger.error(f"Error saving transcript to file for video {video_id}: {e}")
    
    def _load_transcript_from_file(self, video_id: str) -> Optional[Dict[str, Any]]:
        """從檔案載入轉錄結果"""
        try:
            file_path = self._get_subtitle_file_path(video_id)
            
            if not os.path.exists(file_path):
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                transcript_data = json.load(f)
            
            logger.info(f"Successfully loaded transcript from file: {file_path}")
            return transcript_data
            
        except Exception as e:
            logger.error(f"Error loading transcript from file for video {video_id}: {e}")
            return None
    
    def get_transcript_from_file_or_memory(self, video_id: str) -> Optional[Dict[str, Any]]:
        """優先從檔案載入轉錄，如果沒有則從記憶體中獲取"""
        # 首先嘗試從檔案載入
        transcript = self._load_transcript_from_file(video_id)
        
        if transcript:
            return transcript
        
        # 如果檔案中沒有，則從記憶體中獲取
        return self.get_latest_transcript(video_id)
    
    def list_available_transcripts(self) -> List[str]:
        """列出所有可用的轉錄檔案"""
        try:
            if not os.path.exists(self.subtitles_dir):
                return []
            
            transcript_files = []
            for filename in os.listdir(self.subtitles_dir):
                if filename.endswith('.json'):
                    video_id = filename[:-5]  # 移除 .json 副檔名
                    transcript_files.append(video_id)
            
            return sorted(transcript_files)
            
        except Exception as e:
            logger.error(f"Error listing transcript files: {e}")
            return []
    

    
