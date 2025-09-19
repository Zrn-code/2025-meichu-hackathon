#!/usr/bin/env python3
"""
測試 YouTube 監控功能
"""

import requests
import json
import time
from datetime import datetime


def test_server_health():
    """測試服務器健康狀況"""
    try:
        response = requests.get('http://localhost:5000/health', timeout=5)
        if response.status_code == 200:
            print("✅ 服務器運行正常")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            return True
        else:
            print(f"❌ 服務器響應異常: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 無法連接服務器: {e}")
        return False


def test_youtube_api():
    """測試 YouTube API 端點"""
    # 模擬 Chrome 擴展發送的數據
    test_data = {
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "videoId": "dQw4w9WgXcQ",
        "title": "Rick Astley - Never Gonna Give You Up (Official Video)",
        "channelName": "Rick Astley",
        "isPlaying": True,
        "currentTime": 60,
        "duration": 212,
        "viewCount": "1,234,567,890",
        "isPlaylist": False,
        "playlistId": None,
        "isFullscreen": False,
        "timestamp": int(time.time() * 1000),
        "tabId": 123456789,
        "type": "youtube_data"
    }
    
    try:
        # 測試發送數據
        print("\n📤 測試發送 YouTube 數據...")
        response = requests.post(
            'http://localhost:5000/api/youtube',
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        
        if response.status_code == 200:
            print("✅ YouTube 數據發送成功")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        else:
            print(f"❌ YouTube 數據發送失敗: {response.status_code}")
            print(response.text)
            return False
        
        # 測試獲取當前數據
        print("\n📥 測試獲取當前數據...")
        response = requests.get('http://localhost:5000/api/youtube/current', timeout=5)
        
        if response.status_code == 200:
            print("✅ 獲取當前數據成功")
            data = response.json()
            if data.get('data'):
                print(f"視頻標題: {data['data'].get('title', 'N/A')}")
                print(f"頻道名稱: {data['data'].get('channelName', 'N/A')}")
                print(f"播放狀態: {'播放中' if data['data'].get('isPlaying') else '已暫停'}")
            print(json.dumps(data['summary'], indent=2, ensure_ascii=False))
        else:
            print(f"❌ 獲取當前數據失敗: {response.status_code}")
            return False
        
        # 測試獲取統計信息
        print("\n📊 測試獲取統計信息...")
        response = requests.get('http://localhost:5000/api/youtube/statistics', timeout=5)
        
        if response.status_code == 200:
            print("✅ 獲取統計信息成功")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        else:
            print(f"❌ 獲取統計信息失敗: {response.status_code}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ YouTube API 測試失敗: {e}")
        return False


def simulate_video_playback():
    """模擬視頻播放過程"""
    print("\n🎬 模擬視頻播放過程...")
    
    base_data = {
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "videoId": "dQw4w9WgXcQ", 
        "title": "Rick Astley - Never Gonna Give You Up",
        "channelName": "Rick Astley",
        "duration": 212,
        "viewCount": "1,234,567,890",
        "isPlaylist": False,
        "tabId": 123456789,
        "type": "youtube_data"
    }
    
    # 模擬播放進度
    for i in range(5):
        current_time = i * 30
        is_playing = i % 2 == 0  # 交替播放/暫停
        
        data = {
            **base_data,
            "currentTime": current_time,
            "isPlaying": is_playing,
            "timestamp": int(time.time() * 1000)
        }
        
        try:
            response = requests.post(
                'http://localhost:5000/api/youtube',
                json=data,
                timeout=5
            )
            
            if response.status_code == 200:
                status = "播放中" if is_playing else "已暫停"
                progress = (current_time / 212) * 100
                print(f"  📹 {current_time}s/{212}s ({progress:.1f}%) - {status}")
            else:
                print(f"  ❌ 更新失敗: {response.status_code}")
                
        except Exception as e:
            print(f"  ❌ 發送失敗: {e}")
        
        time.sleep(1)


def main():
    """主函數"""
    print("🔍 YouTube 監控功能測試")
    print("=" * 50)
    
    # 測試服務器健康狀況
    if not test_server_health():
        print("\n請確保 Python 服務器正在運行:")
        print("  cd backend-server")
        print("  python server.py")
        return
    
    # 測試 YouTube API
    if not test_youtube_api():
        return
    
    # 模擬視頻播放
    simulate_video_playback()
    
    print("\n✅ 所有測試完成!")
    print("\n現在您可以:")
    print("  1. 在 Chrome 中載入擴展")
    print("  2. 打開 YouTube 頁面") 
    print("  3. 點擊擴展圖標開始監控")


if __name__ == "__main__":
    main()