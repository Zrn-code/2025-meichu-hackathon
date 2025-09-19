#!/usr/bin/env python3
"""
主要 Flask 服務器
整合所有處理器和服務
"""

import asyncio
import json
import logging
import sys
import threading
import time
from datetime import datetime
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

# 導入自定義模組
from core.mcp_client import MCPClient
from core.registry import ToolRegistry
from handlers.chat import ChatHandler
from handlers.tools import ToolsHandler
from handlers.youtube import YouTubeHandler
from config.settings import Settings
from tools.calculator import (
    CalculatorTool, AddTool, SubtractTool, 
    MultiplyTool, DivideTool, CalculateTool
)

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
        
        # 初始化核心組件
        self.mcp_client = MCPClient()
        self.tool_registry = ToolRegistry()
        
        # 初始化處理器
        self.tools_handler = ToolsHandler(self.mcp_client, self.tool_registry)
        self.youtube_handler = YouTubeHandler()
        self.chat_handler = ChatHandler(
            self.settings.get_llm_config(),
            self.tools_handler
        )
        
        # 註冊工具
        self._register_tools()
        
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
    
    def _register_tools(self):
        """註冊工具"""
        # 註冊計算器工具（向後兼容）
        tools = [
            CalculatorTool(),
            AddTool(),
            SubtractTool(),
            MultiplyTool(),
            DivideTool(),
            CalculateTool()
        ]
        
        for tool in tools:
            self.tool_registry.register_tool_instance(tool)
        
        self.logger.info(f"Registered {len(tools)} local tools")
    
    def _setup_routes(self):
        """設置 API 路由"""
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            """健康檢查"""
            return jsonify({
                "status": "ok",
                "timestamp": datetime.now().isoformat(),
                "services": {
                    "mcp": self.mcp_client.is_initialized,
                    "llm": bool(self.settings.get("endpointUrl")),
                    "tools": self.tools_handler.get_tool_count()
                },
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
                video_id = request.args.get('video_id')
                limit = request.args.get('limit', 50, type=int)
                
                history = self.youtube_handler.get_subtitle_history(video_id, limit)
                
                return jsonify({
                    "success": True,
                    "data": history,
                    "count": len(history),
                    "video_id": video_id,
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
                video_id = request.args.get('video_id')
                
                transcript = self.youtube_handler.get_subtitle_transcript(video_id)
                
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
                video_id = request.args.get('video_id')
                
                if not query:
                    return jsonify({
                        "success": False,
                        "error": "Query parameter 'q' is required"
                    }), 400
                
                results = self.youtube_handler.search_subtitles(query, video_id)
                
                return jsonify({
                    "success": True,
                    "query": query,
                    "video_id": video_id,
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
    
    async def _start_mcp_server(self):
        """啟動 MCP 服務器"""
        try:
            mcp_config = self.settings.get_mcp_config()
            success = await self.mcp_client.start_server(
                mcp_config["command"], 
                mcp_config["args"]
            )
            
            if success:
                self.logger.info("MCP server started successfully")
            else:
                self.logger.warning("MCP server failed to start")
                
        except Exception as e:
            self.logger.error(f"Failed to start MCP server: {e}")
    
    def _start_mcp_in_thread(self):
        """在背景執行緒中啟動 MCP 服務器"""
        def start_mcp():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self._start_mcp_server())
        
        mcp_thread = threading.Thread(target=start_mcp, daemon=True)
        mcp_thread.start()
        
        # 等待 MCP 服務器啟動
        time.sleep(2)
    
    def run(self, host: str = None, port: int = None, debug: bool = None):
        """運行服務器"""
        # 使用設定中的值或傳入的參數
        server_config = self.settings.get_server_config()
        host = host or server_config["host"]
        port = port or server_config["port"]
        debug = debug if debug is not None else server_config["debug"]
        
        self.logger.info(f"Starting Unified Server v2.0.0 on {host}:{port}")
        self.logger.info(f"Debug mode: {debug}")
        
        # 在後台啟動 MCP 服務器
        self._start_mcp_in_thread()
        
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
        
        if self.mcp_client:
            await self.mcp_client.close()
            
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