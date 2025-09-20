#!/usr/bin/env python3
"""
主要 Flask 服務器
整合所有處理器和服務
"""

import asyncio
import json
import logging
import os
import sys
import threading
import time
from datetime import datetime
from flask import Flask, request, jsonify, Response, send_file, abort
from flask_cors import CORS

# 導入自定義模組
from handlers.chat import ChatHandler
from handlers.youtube import YouTubeHandler
from config.settings import Settings

# 設置 UTF-8 編碼（簡化版）
import os
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'


class UnifiedServer:
    """統一的後端服務器"""
    
    def __init__(self, config_file: str = "agent.json"):
        # 初始化設定
        self.settings = Settings(config_file)
        
        # 設置日誌
        self._setup_logging()
        self.logger = logging.getLogger(__name__)
        
        # 初始化 Flask 應用
        self.app = Flask(__name__)
        CORS(self.app, origins="*")
        
        # 初始化處理器
        self._setup_handlers()
        
        # 設置路由
        self._setup_routes()
        
        self.logger.info("Unified Server initialized")
    
    def _setup_logging(self):
        """設置日誌"""
        log_level = getattr(logging, self.settings.get("logging.level", "INFO"))
        log_format = self.settings.get("logging.format")
        
        logging.basicConfig(
            level=log_level,
            format=log_format,
            handlers=[
                logging.StreamHandler(sys.stdout)
            ]
        )
    
    def _setup_handlers(self):
        """初始化各種處理器"""
        # 初始化 YouTube 處理器 (不需要參數)
        self.youtube_handler = YouTubeHandler()
        
        # 初始化聊天處理器 (需要 LLM 配置)
        llm_config = self.settings.get_llm_config()
        self.chat_handler = ChatHandler(llm_config, tools_handler=None)
        
        # 暫時設置一個空的 tools_handler 以避免錯誤
        self.tools_handler = None
        
        self.logger.info("Handlers initialized successfully")
    
    def _setup_routes(self):
        """設置 API 路由"""
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            """健康檢查端點"""
            return jsonify({
                "status": "healthy",
                "message": "Server is running",
                "timestamp": datetime.now().isoformat(),
                "version": "2.0.0"
            })

        @self.app.route('/api/chat', methods=['POST'])
        def chat_with_llm():
            """與 LLM 對話"""
            try:
                data = request.get_json()
                user_message = data.get('message', '')
                
                if not user_message:
                    return jsonify({
                        "success": False,
                        "error": "Message is required"
                    }), 400
                
                # 處理用戶消息
                response = asyncio.run(self.chat_handler.process_message(user_message))
                
                return jsonify({
                    "success": True,
                    "response": response,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Chat error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/chat/stream', methods=['POST'])
        def chat_stream():
            """流式對話 API"""
            try:
                data = request.get_json()
                user_message = data.get('message', '')
                
                if not user_message:
                    return jsonify({
                        "success": False,
                        "error": "Message is required"
                    }), 400
                
                def generate_stream():
                    """生成流式響應"""
                    try:
                        # 調用 LLM 並逐步返回結果
                        for chunk in self.chat_handler.call_llm_stream(user_message):
                            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                    except Exception as e:
                        self.logger.error(f"Stream generation error: {e}")
                        yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
                    finally:
                        yield "data: [DONE]\n\n"
                
                return Response(
                    generate_stream(),
                    mimetype='text/event-stream',
                    headers={
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    }
                )
                
            except Exception as e:
                self.logger.error(f"Stream chat error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/tools', methods=['GET'])
        def get_available_tools():
            """獲取可用工具列表"""
            if self.tools_handler is None:
                return jsonify({
                    "success": True,
                    "tools": [],
                    "summary": "Tools handler not initialized",
                    "timestamp": datetime.now().isoformat()
                })
            
            return jsonify({
                "success": True,
                "tools": self.tools_handler.get_available_tools(),
                "summary": self.tools_handler.get_tools_summary(),
                "timestamp": datetime.now().isoformat()
            })
        
        @self.app.route('/api/tools/<tool_name>', methods=['POST'])
        def call_tool(tool_name):
            """調用特定工具"""
            try:
                if self.tools_handler is None:
                    return jsonify({
                        "success": False,
                        "error": "Tools handler not initialized"
                    }), 503
                
                data = request.get_json()
                arguments = data.get('arguments', {})
                
                result = asyncio.run(self.tools_handler.call_tool(tool_name, arguments))
                
                return jsonify({
                    "success": True,
                    "tool": tool_name,
                    "result": result,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Tool call error for {tool_name}: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/config', methods=['GET'])
        def get_config():
            """獲取設定"""
            # 只返回公開的設定
            public_config = {
                "server": self.settings.get_server_config(),
                "chat": self.settings.get_chat_config(),
                "version": "2.0.0"
            }
            return jsonify({
                "success": True,
                "config": public_config
            })
        
        @self.app.route('/api/config', methods=['POST'])
        def update_config():
            """更新設定"""
            try:
                data = request.get_json()
                
                # 只允許更新特定的設定
                allowed_keys = ["chat.max_tokens", "chat.temperature", "chat.max_history"]
                
                updates = {}
                for key in allowed_keys:
                    if key in data:
                        updates[key] = data[key]
                
                if updates:
                    success = self.settings.update_config(updates)
                    if success:
                        self.settings.save_config()
                    
                    return jsonify({
                        "success": success,
                        "updated": list(updates.keys())
                    })
                else:
                    return jsonify({
                        "success": False,
                        "error": "No valid config keys provided"
                    }), 400
                    
            except Exception as e:
                self.logger.error(f"Config update error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        # YouTube 監控相關路由
        @self.app.route('/api/youtube', methods=['POST'])
        def receive_youtube_data():
            """接收來自 Chrome 擴展的 YouTube 數據"""
            try:
                data = request.get_json()
                
                if not data:
                    return jsonify({
                        "success": False,
                        "error": "No data provided"
                    }), 400
                
                # 處理數據
                result = self.youtube_handler.update_youtube_data(data)
                
                return jsonify(result)
                
            except Exception as e:
                self.logger.error(f"YouTube data error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500

        @self.app.route('/api/youtube/video-id', methods=['GET'])
        def get_current_video_id():
            """獲取當前 YouTube 影片 ID"""
            try:
                # 調試信息
                current_data = self.youtube_handler.get_current_data()
                self.logger.debug(f"Current data exists: {current_data is not None}")
                if current_data:
                    self.logger.debug(f"Current data keys: {list(current_data.keys())}")
                
                video_id = self.youtube_handler.get_current_video_id()
                
                if video_id:
                    return jsonify({
                        "success": True,
                        "video_id": video_id,
                        "timestamp": datetime.now().isoformat()
                    })
                else:
                    # 返回更詳細的調試信息
                    debug_info = {
                        "has_current_data": current_data is not None,
                        "current_data_keys": list(current_data.keys()) if current_data else None,
                        "videoId_value": current_data.get('videoId') if current_data else None
                    }
                    
                    return jsonify({
                        "success": False,
                        "error": "No active YouTube video",
                        "video_id": None,
                        "debug": debug_info
                    }), 404
                
            except Exception as e:
                self.logger.error(f"Get video ID error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e),
                    "video_id": None
                }), 500
        
        @self.app.route('/api/youtube/current', methods=['GET'])
        def get_current_youtube_data():
            """獲取當前 YouTube 數據"""
            try:
                current_data = self.youtube_handler.get_current_data()
                
                return jsonify({
                    "success": True,
                    "data": current_data,
                    "summary": self.youtube_handler.get_video_summary(),
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Get YouTube data error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/history', methods=['GET'])
        def get_youtube_history():
            """獲取 YouTube 數據歷史"""
            try:
                limit = request.args.get('limit', 50, type=int)
                history = self.youtube_handler.get_data_history(limit)
                
                return jsonify({
                    "success": True,
                    "history": history,
                    "count": len(history),
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Get YouTube history error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/statistics', methods=['GET'])
        def get_youtube_statistics():
            """獲取 YouTube 觀看統計"""
            try:
                stats = self.youtube_handler.get_watching_statistics()
                
                return jsonify({
                    "success": True,
                    "statistics": stats,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Get YouTube statistics error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/stop', methods=['POST'])
        def stop_youtube_monitoring():
            """停止 YouTube 監控"""
            try:
                result = self.youtube_handler.stop_monitoring()
                
                return jsonify(result)
                
            except Exception as e:
                self.logger.error(f"Stop YouTube monitoring error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        # ===== 字幕相關 API =====
        
        @self.app.route('/api/youtube/subtitles/current', methods=['GET'])
        def get_current_subtitles():
            """獲取當前字幕信息"""
            try:
                subtitles = self.youtube_handler.get_current_subtitles()
                
                return jsonify({
                    "success": True,
                    "data": subtitles,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Get current subtitles error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/subtitles/history', methods=['GET'])
        def get_subtitle_history():
            """獲取字幕歷史記錄"""
            try:
                limit = request.args.get('limit', 50, type=int)
                
                # 自動使用當前視頻的字幕歷史
                history = self.youtube_handler.get_subtitle_history(None, limit)
                current_video_id = self.youtube_handler.get_current_video_id()
                
                return jsonify({
                    "success": True,
                    "data": history,
                    "count": len(history),
                    "current_video_id": current_video_id,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Get subtitle history error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/subtitles/transcript', methods=['GET'])
        def get_subtitle_transcript():
            """獲取完整字幕轉錄"""
            try:
                # 自動使用當前視頻的字幕轉錄
                transcript = self.youtube_handler.get_subtitle_transcript(None)
                
                return jsonify({
                    "success": True,
                    "data": transcript,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Get subtitle transcript error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/subtitles/search', methods=['GET'])
        def search_subtitles():
            """搜索字幕內容"""
            try:
                query = request.args.get('q', '').strip()
                
                if not query:
                    return jsonify({
                        "success": False,
                        "error": "Query parameter 'q' is required"
                    }), 400
                
                # 自動使用當前視頻的字幕搜索
                results = self.youtube_handler.search_subtitles(query, None)
                current_video_id = self.youtube_handler.get_current_video_id()
                
                return jsonify({
                    "success": True,
                    "query": query,
                    "current_video_id": current_video_id,
                    "results": results,
                    "count": len(results),
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Search subtitles error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/subtitles/statistics', methods=['GET'])
        def get_subtitle_statistics():
            """獲取字幕統計信息"""
            try:
                stats = self.youtube_handler.get_subtitle_statistics()
                
                return jsonify({
                    "success": True,
                    "data": stats,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Get subtitle statistics error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/subtitles/count', methods=['GET'])
        def get_current_video_subtitle_count():
            """獲取當前視頻的字幕數量統計"""
            try:
                result = self.youtube_handler.get_current_video_subtitle_count()
                
                if result.get('success'):
                    return jsonify(result)
                else:
                    return jsonify(result), 404 if 'No current video' in result.get('error', '') else 500
                
            except Exception as e:
                self.logger.error(f"Get current video subtitle count error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e),
                    "video_id": None,
                    "counts": {
                        "history_entries": 0,
                        "total_count": 0
                    }
                }), 500
        
        @self.app.route('/api/youtube/subtitles/clear', methods=['POST'])
        def clear_subtitle_history():
            """清除字幕歷史記錄"""
            try:
                data = request.get_json() or {}
                video_id = data.get('video_id')
                
                self.youtube_handler.clear_subtitle_history(video_id)
                
                return jsonify({
                    "success": True,
                    "message": f"Subtitle history cleared" + (f" for video {video_id}" if video_id else ""),
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Clear subtitle history error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        # ===== 轉錄相關 API (Supadata) =====
        
        @self.app.route('/api/youtube/transcript/<video_id>', methods=['GET'])
        def get_video_transcript(video_id):
            """獲取指定視頻的轉錄數據"""
            try:
                transcripts = self.youtube_handler.get_video_transcripts(video_id)
                
                return jsonify({
                    "success": True,
                    "video_id": video_id,
                    "transcripts": transcripts,
                    "count": len(transcripts),
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Get video transcript error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/transcript/latest', methods=['GET'])
        def get_latest_transcript():
            """獲取最新的轉錄數據"""
            try:
                video_id = request.args.get('video_id')
                transcript = self.youtube_handler.get_latest_transcript(video_id)
                
                if transcript:
                    return jsonify({
                        "success": True,
                        "transcript": transcript,
                        "timestamp": datetime.now().isoformat()
                    })
                else:
                    return jsonify({
                        "success": False,
                        "message": "No transcript available",
                        "video_id": video_id
                    }), 404
                    
            except Exception as e:
                self.logger.error(f"Get latest transcript error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/transcript/trigger', methods=['POST'])
        def trigger_manual_transcript():
            """手動觸發轉錄處理"""
            try:
                data = request.get_json()
                video_url = data.get('video_url')
                video_id = data.get('video_id')
                
                if not video_url:
                    return jsonify({
                        "success": False,
                        "error": "video_url is required"
                    }), 400
                
                if not video_id:
                    # 嘗試從URL提取video_id
                    import re
                    match = re.search(r'[?&]v=([^&]+)', video_url)
                    if match:
                        video_id = match.group(1)
                    else:
                        return jsonify({
                            "success": False,
                            "error": "Could not extract video_id from URL"
                        }), 400
                
                # 在後台線程中處理轉錄
                import threading
                thread = threading.Thread(
                    target=self.youtube_handler._process_video_transcript,
                    args=(video_url, video_id),
                    daemon=True
                )
                thread.start()
                
                return jsonify({
                    "success": True,
                    "message": "Transcript processing started",
                    "video_id": video_id,
                    "video_url": video_url,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"Trigger manual transcript error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/transcript/files', methods=['GET'])
        def list_transcript_files():
            """列出所有可用的轉錄檔案"""
            try:
                transcript_files = self.youtube_handler.list_available_transcripts()
                
                return jsonify({
                    "success": True,
                    "transcript_files": transcript_files,
                    "count": len(transcript_files),
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                self.logger.error(f"List transcript files error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/api/youtube/transcript/file/<video_id>', methods=['GET'])
        def get_transcript_from_file(video_id):
            """從檔案或記憶體獲取轉錄數據"""
            try:
                transcript = self.youtube_handler.get_transcript_from_file_or_memory(video_id)
                
                if transcript:
                    return jsonify({
                        "success": True,
                        "video_id": video_id,
                        "transcript": transcript,
                        "timestamp": datetime.now().isoformat()
                    })
                else:
                    return jsonify({
                        "success": False,
                        "message": f"No transcript found for video {video_id}",
                        "video_id": video_id
                    }), 404
                    
            except Exception as e:
                self.logger.error(f"Get transcript from file error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500

        
        @self.app.route('/api/tabs', methods=['GET', 'POST'])
        def handle_tab_info():
            """處理標籤頁信息 - GET: 獲取信息, POST: 接收更新"""
            if request.method == 'GET':
                # 返回當前標籤頁統計信息
                try:
                    tab_stats = {
                        "active_tabs": len(self.youtube_handler.active_tabs),
                        "youtube_tabs": len(self.youtube_handler.youtube_tabs),
                        "tab_details": list(self.youtube_handler.active_tabs.values()),
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    return jsonify({
                        "success": True,
                        "data": tab_stats
                    })
                    
                except Exception as e:
                    self.logger.error(f"Get tab info error: {e}")
                    return jsonify({
                        "success": False,
                        "error": str(e)
                    }), 500
            
            elif request.method == 'POST':
                # 接收標籤頁統計信息
                try:
                    data = request.get_json()
                    
                    if not data:
                        return jsonify({
                            "success": False,
                            "error": "No data provided"
                        }), 400
                    
                    # 更新標籤頁統計
                    if hasattr(self.youtube_handler, 'update_tab_stats'):
                        self.youtube_handler.update_tab_stats(data)
                    
                    return jsonify({
                        "success": True,
                        "message": "Tab info received",
                        "timestamp": datetime.now().isoformat()
                    })
                    
                except Exception as e:
                    self.logger.error(f"Tab info error: {e}")
                    return jsonify({
                        "success": False,
                        "error": str(e)
                    }), 500

        @self.app.route('/api/voice_generation_complete', methods=['POST'])
        def handle_voice_generation_complete():
            """處理語音生成完成的回調"""
            try:
                data = request.get_json()
                
                if not data:
                    return jsonify({
                        "success": False,
                        "error": "No data provided"
                    }), 400
                
                logs_id = data.get('logs_id')
                success = data.get('success', False)
                filepath = data.get('filepath')
                error_message = data.get('error_message')
                
                if not logs_id:
                    return jsonify({
                        "success": False,
                        "error": "Missing logs_id"
                    }), 400
                
                # 找到 ConversationLogTool 實例並更新狀態
                conversation_tool = None
                for tool in self.tool_registry.tools.values():
                    if tool.name == "conversation_log":
                        conversation_tool = tool
                        break
                
                if conversation_tool:
                    updated = conversation_tool.update_voice_generation_status(
                        logs_id, success, filepath, error_message
                    )
                    
                    if updated:
                        self.logger.info(f"Voice generation status updated for {logs_id}: {success}")
                        return jsonify({
                            "success": True,
                            "message": "Voice generation status updated"
                        })
                    else:
                        return jsonify({
                            "success": False,
                            "error": "Failed to update status"
                        }), 404
                else:
                    return jsonify({
                        "success": False,
                        "error": "ConversationLogTool not found"
                    }), 500
                    
            except Exception as e:
                self.logger.error(f"Voice generation complete error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500

        @self.app.route('/api/check-playback', methods=['GET'])
        def check_playback():
            """檢查當前是否需要播放語音內容（基於 YouTube 當前資料和 avatar_talk 檔案）"""
            try:
                # 獲取 YouTube 當前播放資料
                current_youtube_data = self.youtube_handler.get_current_data()
                
                if not current_youtube_data:
                    return jsonify({
                        "success": False,
                        "error": "No YouTube data available",
                        "message": "請確保 Chrome 擴展正在監控 YouTube 播放"
                    }), 400
                
                # 從 YouTube 資料獲取當前播放信息
                current_time = current_youtube_data.get('currentTime', 0)  # 秒
                current_time_ms = current_time * 1000  # 轉換為毫秒用於匹配
                video_id = current_youtube_data.get('videoId', '')
                is_playing = current_youtube_data.get('isPlaying', False)
                video_title = current_youtube_data.get('title', '')
                
                self.logger.info(f"[CHECK PLAYBACK] 當前播放: {video_title[:30]}... | 時間: {current_time}s ({current_time_ms}ms) | 播放中: {is_playing} | 影片ID: {video_id}")
                
                # 構建 avatar_talk JSON 檔案路徑
                backend_dir = os.path.dirname(os.path.abspath(__file__))
                parent_dir = os.path.dirname(backend_dir)
                avatar_talk_dir = os.path.join(parent_dir, "windows-app", "src", "data", "avatar_talk")
                avatar_file_path = os.path.join(avatar_talk_dir, f"{video_id}.json")
                
                self.logger.debug(f"[AVATAR TALK] 查找檔案: {avatar_file_path}")
                
                # 檢查 avatar_talk 檔案是否存在
                if not os.path.exists(avatar_file_path):
                    self.logger.info(f"[NO AVATAR FILE] 沒有找到 avatar talk 檔案: {video_id}.json")
                    return jsonify({
                        "success": True,
                        "should_play": False,
                        "content": None
                    })
                
                # 讀取 avatar_talk JSON 檔案
                try:
                    with open(avatar_file_path, 'r', encoding='utf-8') as f:
                        avatar_data = json.load(f)
                except (json.JSONDecodeError, IOError) as e:
                    self.logger.error(f"[AVATAR FILE ERROR] 讀取檔案失敗: {e}")
                    return jsonify({
                        "success": False,
                        "error": f"Failed to read avatar talk file: {str(e)}"
                    }), 500
                
                # 尋找符合條件的語音內容
                matching_entry = None
                tolerance_ms = 2000  # 容許誤差範圍（毫秒）
                
                for entry in avatar_data:
                    try:
                        entry_time = entry.get("time", 0)  # avatar_talk 使用毫秒
                        is_generated = entry.get("is_generated", False)
                        reply = entry.get("Reply", "")
                        file_path = entry.get("file_path", "")
                        
                        # 檢查時間是否匹配（都轉換為毫秒比較）
                        time_matches = abs(entry_time - current_time_ms) <= tolerance_ms
                        
                        self.logger.debug(f"[CHECK ENTRY] 回應: {reply[:20]}... | 時間: {entry_time}ms | 當前: {current_time_ms}ms | 差異: {abs(entry_time - current_time_ms)}ms | 已生成: {is_generated} | 匹配: {time_matches}")
                        
                        if time_matches and is_generated and file_path:
                            matching_entry = entry
                            self.logger.info(f"[FOUND MATCH] 找到匹配內容: {reply} (時間: {entry_time}ms)")
                            break
                            
                    except (ValueError, TypeError) as e:
                        self.logger.warning(f"[ENTRY ERROR] 處理記錄時發生錯誤: {e}")
                        continue
                
                # 回應結果
                if matching_entry:
                    filename = matching_entry.get("file_path", "")
                    
                    self.logger.info(f"[RESPONSE] 回傳播放內容: {matching_entry.get('Reply', '')} | 音檔: {filename}")
                    
                    return jsonify({
                        "success": True,
                        "should_play": True,
                        "content": {
                            "message": matching_entry.get("Reply"),
                            "is_generated": matching_entry.get("is_generated"),
                            "file_path": matching_entry.get("file_path")
                        }
                    })
                else:
                    self.logger.info(f"[NO MATCH] 沒有找到匹配的語音內容 (時間: {current_time}s, 影片: {video_id})")
                    
                    return jsonify({
                        "success": True,
                        "should_play": False,
                        "content": None
                    })
                    
            except Exception as e:
                self.logger.error(f"Check playback error: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e),
                    "message": "檢查播放時發生錯誤"
                }), 500

        @self.app.route('/api/audio/<filename>', methods=['GET'])
        def serve_audio_file(filename):
            """提供語音檔案的 HTTP 訪問"""
            try:
                # 驗證檔案名稱安全性
                if not filename.endswith('.wav'):
                    return abort(400, "Only WAV files are supported")
                
                if '..' in filename or '/' in filename or '\\' in filename:
                    return abort(400, "Invalid filename")
                
                # 語音檔案的完整路徑
                # 假設語音檔案存放在 ../voice-generation-server/generated_audio/
                backend_dir = os.path.dirname(os.path.abspath(__file__))
                parent_dir = os.path.dirname(backend_dir)
                audio_dir = os.path.join(parent_dir, "voice-generation-server", "generated_audio")
                file_path = os.path.join(audio_dir, filename)
                
                # 檢查檔案是否存在
                if not os.path.exists(file_path):
                    self.logger.warning(f"Audio file not found: {file_path}")
                    return abort(404, "Audio file not found")
                
                # 檢查檔案是否在允許的目錄內（安全檢查）
                real_audio_dir = os.path.realpath(audio_dir)
                real_file_path = os.path.realpath(file_path)
                if not real_file_path.startswith(real_audio_dir):
                    self.logger.warning(f"Attempted access outside audio directory: {file_path}")
                    return abort(403, "Access denied")
                
                self.logger.info(f"Serving audio file: {filename}")
                
                # 返回檔案並設置正確的 MIME 類型
                return send_file(
                    file_path,
                    mimetype='audio/wav',
                    as_attachment=False,
                    download_name=filename
                )
                
            except Exception as e:
                self.logger.error(f"Error serving audio file {filename}: {e}")
                return abort(500, "Internal server error")
    
    
    def run(self, host: str = None, port: int = None, debug: bool = None):
        """運行服務器"""
        # 使用設定中的值或傳入的參數
        server_config = self.settings.get_server_config()
        host = host or server_config["host"]
        port = port or server_config["port"]
        debug = debug if debug is not None else server_config["debug"]
        
        self.logger.info(f"Starting Unified Server v2.0.0 on {host}:{port}")
        self.logger.info(f"Debug mode: {debug}")
        
        try:
            # 啟動 Flask 服務器
            self.app.run(host=host, port=port, debug=debug, threaded=True)
        except Exception as e:
            self.logger.error(f"Server error: {e}")
        finally:
            asyncio.run(self.close())
    
    async def close(self):
        """關閉服務器"""
        self.logger.info("Shutting down server...")
        
        # 關閉 YouTube 處理器
        if self.youtube_handler:
            self.youtube_handler.shutdown()
        
        self.logger.info("Server shutdown complete")


def create_app(config_file: str = "agent.json") -> Flask:
    """工廠函數創建 Flask 應用"""
    server = UnifiedServer(config_file)
    return server.app


if __name__ == "__main__":
    import json
    
    server = UnifiedServer()
    
    try:
        server.run()
    except KeyboardInterrupt:
        print("\nReceived interrupt signal")
        asyncio.run(server.close())
    except Exception as e:
        print(f"Server error: {e}")
        asyncio.run(server.close())