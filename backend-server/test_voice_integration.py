#!/usr/bin/env python3
"""
測試語音生成服務器是否正在運行
"""

import requests
import json

def test_voice_server():
    """測試語音服務器的健康狀況"""
    try:
        print("🔍 正在檢查語音服務器狀態...")
        response = requests.get("http://localhost:5001/api/health", timeout=5)
        
        if response.status_code == 200:
            print("✅ 語音服務器正在運行")
            print(f"回應: {response.json()}")
            return True
        else:
            print(f"❌ 語音服務器回應異常: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到語音服務器 (localhost:5001)")
        print("請確認語音服務器已啟動")
        return False
    except Exception as e:
        print(f"❌ 檢查語音服務器時發生錯誤: {e}")
        return False

def test_voice_generation_request():
    """測試語音生成請求"""
    try:
        print("\n🎵 測試語音生成請求...")
        
        test_data = {
            "timestamp": "30",
            "emotion": "友善的",
            "message": "這是一個測試訊息",
            "video_id": "test_video_123",
            "logs_id": "test_logs_456"
        }
        
        response = requests.post(
            "http://localhost:5001/api/generate_voice",
            json=test_data,
            timeout=10
        )
        
        if response.status_code == 202:
            print("✅ 語音生成請求已被接受")
            print(f"回應: {response.json()}")
            return True
        else:
            print(f"❌ 語音生成請求失敗: {response.status_code}")
            print(f"回應: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到語音服務器進行語音生成測試")
        return False
    except Exception as e:
        print(f"❌ 測試語音生成時發生錯誤: {e}")
        return False

if __name__ == "__main__":
    print("🚀 開始測試語音服務器集成...")
    
    # 測試健康狀況
    health_ok = test_voice_server()
    
    if health_ok:
        # 測試語音生成
        generation_ok = test_voice_generation_request()
        
        if generation_ok:
            print("\n🎉 所有測試通過！語音服務器集成成功")
        else:
            print("\n⚠️  語音生成測試失敗")
    else:
        print("\n⚠️  語音服務器不可用，請先啟動語音服務器")
        print("啟動命令：cd voice-generation-server && python app.py")