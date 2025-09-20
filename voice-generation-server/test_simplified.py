#!/usr/bin/env python3
"""
測試簡化版語音生成服務器
"""

import requests
import json
import time

def test_simplified_voice_generation():
    """測試簡化後的語音生成功能"""
    print("🚀 測試簡化版語音生成服務器...")
    
    # 測試數據
    test_data = {
        "timestamp": "30",
        "emotion": "友善的",  # 現在這個參數會被忽略
        "message": "這是一個測試訊息",  # 現在這個參數會被忽略
        "video_id": "test_video_123",
        "logs_id": "test_logs_456"
    }
    
    try:
        print("📡 向語音服務器發送請求...")
        response = requests.post(
            "http://localhost:5001/api/generate_voice",
            json=test_data,
            timeout=15
        )
        
        if response.status_code == 202:
            print("✅ 語音生成請求已被接受")
            result = response.json()
            print(f"📋 回應: {result}")
            
            # 等待語音生成完成
            print("⏳ 等待語音檔案生成...")
            time.sleep(5)
            
            # 檢查生成的檔案
            files_response = requests.get("http://localhost:5001/api/files")
            if files_response.status_code == 200:
                files_data = files_response.json()
                print(f"📁 生成的檔案數量: {files_data['count']}")
                if files_data['files']:
                    latest_file = files_data['files'][-1]
                    print(f"📄 最新檔案: {latest_file['filename']}")
                    print(f"📊 檔案大小: {latest_file['size']} bytes")
                    print("✅ 語音檔案生成成功！")
                else:
                    print("⚠️  尚未找到生成的檔案")
            
            return True
            
        else:
            print(f"❌ 語音生成請求失敗: {response.status_code}")
            print(f"回應: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到語音服務器 (localhost:5001)")
        print("請先啟動語音服務器：cd voice-generation-server && python app.py")
        return False
    except Exception as e:
        print(f"❌ 測試時發生錯誤: {e}")
        return False

def test_health_check():
    """測試健康檢查"""
    try:
        print("🔍 檢查語音服務器健康狀況...")
        response = requests.get("http://localhost:5001/api/health", timeout=5)
        
        if response.status_code == 200:
            print("✅ 語音服務器健康狀況良好")
            print(f"回應: {response.json()}")
            return True
        else:
            print(f"❌ 健康檢查失敗: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 健康檢查時發生錯誤: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("簡化版語音生成服務器測試")
    print("=" * 50)
    
    # 測試健康檢查
    health_ok = test_health_check()
    
    if health_ok:
        print("\n" + "=" * 50)
        # 測試語音生成
        generation_ok = test_simplified_voice_generation()
        
        print("\n" + "=" * 50)
        if generation_ok:
            print("🎉 所有測試通過！")
            print("📝 功能說明:")
            print("   - 語音生成現在只創建 3 秒的空白 WAV 檔案")
            print("   - 不再處理情緒或訊息內容")
            print("   - 檔案大小大幅減少")
            print("   - 生成速度更快")
        else:
            print("⚠️  語音生成測試失敗")
    else:
        print("\n⚠️  語音服務器不可用")
        print("請使用以下命令啟動服務器:")
        print("cd voice-generation-server")
        print("python app.py")