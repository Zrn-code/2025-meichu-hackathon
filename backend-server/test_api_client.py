#!/usr/bin/env python3
"""
創建一個簡單的 HTTP 測試客戶端來驗證 check-playback API
"""

import requests
import json
import time
import sys

def test_api():
    """測試 check-playback API"""
    base_url = "http://localhost:3000"
    
    # 測試案例
    test_cases = [
        {
            "name": "匹配的記錄 - 精確時間",
            "params": {"time": "60", "video_id": "video_bb4be737"},
            "expected_should_play": True
        },
        {
            "name": "匹配的記錄 - 容許誤差內",
            "params": {"time": "59.5", "video_id": "video_bb4be737"},
            "expected_should_play": True
        },
        {
            "name": "超出容許誤差",
            "params": {"time": "62", "video_id": "video_bb4be737"},
            "expected_should_play": False
        },
        {
            "name": "錯誤的影片ID",
            "params": {"time": "60", "video_id": "wrong_video"},
            "expected_should_play": False
        },
        {
            "name": "沒有影片ID參數",
            "params": {"time": "60"},
            "expected_should_play": True  # 應該忽略影片ID檢查
        },
        {
            "name": "無效時間參數",
            "params": {"time": "invalid"},
            "expected_error": True
        }
    ]
    
    print("測試 /api/check-playback API...")
    print("=" * 50)
    
    for i, test_case in enumerate(test_cases):
        print(f"\n測試案例 {i+1}: {test_case['name']}")
        print(f"參數: {test_case['params']}")
        
        try:
            response = requests.get(f"{base_url}/api/check-playback", params=test_case['params'], timeout=5)
            
            print(f"HTTP 狀態碼: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"回應: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                if "expected_error" in test_case:
                    print("❌ 預期錯誤但得到成功回應")
                else:
                    should_play = data.get("should_play", False)
                    expected = test_case.get("expected_should_play", False)
                    
                    if should_play == expected:
                        print("✅ 測試通過")
                    else:
                        print(f"❌ 測試失敗 - 預期 should_play={expected}, 實際={should_play}")
            else:
                print(f"回應: {response.text}")
                if "expected_error" in test_case:
                    print("✅ 正確處理錯誤")
                else:
                    print("❌ 意外的錯誤")
                    
        except requests.exceptions.ConnectionError:
            print("❌ 無法連接到服務器")
            return False
        except Exception as e:
            print(f"❌ 測試錯誤: {e}")
    
    return True

def wait_for_server(max_attempts=10):
    """等待服務器啟動"""
    print("等待服務器啟動...")
    
    for attempt in range(max_attempts):
        try:
            response = requests.get("http://localhost:3000/health", timeout=2)
            if response.status_code == 200:
                print("✅ 服務器已準備就緒")
                return True
        except:
            pass
        
        print(f"嘗試 {attempt + 1}/{max_attempts}...")
        time.sleep(2)
    
    print("❌ 服務器未啟動")
    return False

if __name__ == "__main__":
    if wait_for_server():
        test_api()
    else:
        print("\n請先啟動服務器:")
        print("cd c:\\Users\\zxc09\\hackthon\\2025-meichu-hackathon\\backend-server")
        print("python server.py")