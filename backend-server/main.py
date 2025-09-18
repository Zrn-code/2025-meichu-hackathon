#!/usr/bin/env python3
"""
應用程式入口點
啟動重構後的統一後端服務器
"""

import sys
import argparse
import logging
from server import UnifiedServer

def main():
    """主函數"""
    parser = argparse.ArgumentParser(description="統一後端服務器 v2.0.0")
    parser.add_argument("--host", default="localhost", help="服務器主機 (預設: localhost)")
    parser.add_argument("--port", type=int, default=3000, help="服務器埠號 (預設: 3000)")
    parser.add_argument("--debug", action="store_true", help="啟用除錯模式")
    parser.add_argument("--config", default="agent.json", help="設定檔路徑 (預設: agent.json)")
    parser.add_argument("--log-level", choices=["DEBUG", "INFO", "WARNING", "ERROR"], 
                       default="INFO", help="日誌級別 (預設: INFO)")
    
    args = parser.parse_args()
    
    # 設置根日誌級別
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    # 創建服務器實例
    server = UnifiedServer(args.config)
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║                  統一後端服務器 v2.0.0                        ║
║                                                              ║
║  🚀 服務器地址: http://{args.host}:{args.port}                     ║
║  📁 設定檔案: {args.config}                                   ║
║  🔧 除錯模式: {'開啟' if args.debug else '關閉'}                   ║
║  📝 日誌級別: {args.log_level}                                 ║
║                                                              ║
║  💡 重構特色:                                                ║
║     • 模組化架構，易於擴展                                     ║
║     • 統一的工具註冊系統                                       ║
║     • 分離的處理器模組                                         ║
║     • 設定管理系統                                             ║
║                                                              ║
║  🛠️  可用 API:                                               ║
║     • GET  /health        - 健康檢查                         ║
║     • POST /api/chat      - LLM 對話                         ║
║     • GET  /api/tools     - 獲取可用工具                      ║
║     • GET  /api/config    - 獲取設定                          ║
║                                                              ║
║  按 Ctrl+C 停止服務器                                         ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    try:
        server.run(host=args.host, port=args.port, debug=args.debug)
    except KeyboardInterrupt:
        print("\n\n✋ 收到中斷信號，正在關閉服務器...")
    except Exception as e:
        print(f"\n❌ 服務器錯誤: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()