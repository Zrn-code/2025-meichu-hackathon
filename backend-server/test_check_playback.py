#!/usr/bin/env python3
"""
測試 check-playback API 的邏輯
"""

import json
import os
from tools.conversation_log import ConversationLogTool

def test_check_playback_logic():
    """測試播放檢查邏輯"""
    print("測試 check-playback API 邏輯...")
    
    # 創建 ConversationLogTool 實例
    conversation_tool = ConversationLogTool()
    
    try:
        # 載入對話記錄資料
        data = conversation_tool._load_data()
        print(f"載入的對話記錄: {json.dumps(data, indent=2, ensure_ascii=False)}")
        
        # 測試參數
        test_cases = [
            {"current_time": 60.0, "video_id": "video_bb4be737", "expected": True},
            {"current_time": 59.0, "video_id": "video_bb4be737", "expected": True},  # 容許誤差
            {"current_time": 61.0, "video_id": "video_bb4be737", "expected": True},  # 容許誤差
            {"current_time": 62.5, "video_id": "video_bb4be737", "expected": False}, # 超出誤差範圍
            {"current_time": 60.0, "video_id": "wrong_video", "expected": False},    # 錯誤的影片ID
            {"current_time": 30.0, "video_id": "video_bb4be737", "expected": False}, # 沒有對應時間
        ]
        
        for i, test_case in enumerate(test_cases):
            current_time = test_case["current_time"]
            video_id = test_case["video_id"]
            expected = test_case["expected"]
            
            print(f"\n測試案例 {i+1}: time={current_time}, video_id={video_id}")
            
            # 實作檢查邏輯
            matching_log = None
            tolerance = 1.0  # 容許誤差範圍（秒）
            
            for log in data.get("logs", []):
                try:
                    log_timestamp = float(log.get("timestamp", "0"))
                    log_video_id = log.get("video_id", "")
                    
                    # 檢查時間和影片ID是否匹配
                    time_matches = abs(log_timestamp - current_time) <= tolerance
                    video_matches = (not video_id) or (log_video_id == video_id)
                    is_generated = log.get("is_generated", False)
                    
                    print(f"  檢查記錄: timestamp={log_timestamp}, video_id={log_video_id}, is_generated={is_generated}")
                    print(f"  時間匹配: {time_matches}, 影片匹配: {video_matches}")
                    
                    if time_matches and video_matches and is_generated:
                        matching_log = log
                        break
                        
                except (ValueError, TypeError) as e:
                    print(f"  解析錯誤: {e}")
                    continue
            
            result = matching_log is not None
            print(f"  結果: {result} (預期: {expected})")
            print(f"  匹配記錄: {matching_log}")
            
            if result == expected:
                print("  ✅ 測試通過")
            else:
                print("  ❌ 測試失敗")
        
    except Exception as e:
        print(f"測試錯誤: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_check_playback_logic()