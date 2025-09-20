#!/usr/bin/env python3
"""
測試 Supadata 轉錄功能
"""

import requests
import json
from datetime import datetime

def test_supadata_api():
    """測試 Supadata API 調用"""
    # 測試 YouTube URL
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    
    # API 設定
    api_url = f"https://api.supadata.ai/v1/transcript?url={test_url}"
    headers = {
        'x-api-key': 'sd_9aafb77d7110d078e7f233732bb02d69',
        'Content-Type': 'application/json'
    }
    
    print(f"Testing Supadata API with URL: {test_url}")
    print(f"API Endpoint: {api_url}")
    
    try:
        response = requests.get(api_url, headers=headers, timeout=30)
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print("API Response:")
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return True
        else:
            print(f"API Error: {response.status_code}")
            print(f"Response Text: {response.text}")
            return False
            
    except Exception as e:
        print(f"Request failed: {e}")
        return False

def test_manual_trigger():
    """測試手動觸發轉錄"""
    url = "http://localhost:3000/api/youtube/transcript/trigger"
    data = {
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "video_id": "dQw4w9WgXcQ"
    }
    
    print(f"\nTesting manual transcript trigger...")
    print(f"URL: {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    try:
        response = requests.post(url, json=data, timeout=10)
        
        print(f"Response Status: {response.status_code}")
        result = response.json()
        print("Response:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return response.status_code == 200
        
    except Exception as e:
        print(f"Request failed: {e}")
        return False

def test_list_transcript_files():
    """測試列出轉錄檔案"""
    url = "http://localhost:3000/api/youtube/transcript/files"
    
    print(f"\nTesting list transcript files...")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        
        print(f"Response Status: {response.status_code}")
        result = response.json()
        print("Available transcript files:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return response.status_code == 200
        
    except Exception as e:
        print(f"Request failed: {e}")
        return False

def test_get_transcript_from_file():
    """測試從檔案獲取轉錄"""
    video_id = "dQw4w9WgXcQ"
    url = f"http://localhost:3000/api/youtube/transcript/file/{video_id}"
    
    print(f"\nTesting get transcript from file...")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        
        print(f"Response Status: {response.status_code}")
        result = response.json()
        print("Transcript data:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return response.status_code in [200, 404]  # 404 也是正常的，表示檔案不存在
        
    except Exception as e:
        print(f"Request failed: {e}")
        return False

if __name__ == "__main__":
    print("=== Supadata 轉錄功能測試 ===")
    print(f"測試時間: {datetime.now().isoformat()}")
    print()
    
    # 測試 1: 直接調用 Supadata API
    print("1. 測試直接調用 Supadata API")
    print("-" * 40)
    api_success = test_supadata_api()
    
    print("\n" + "="*50 + "\n")
    
    # 測試 2: 測試手動觸發功能（需要後端服務器運行）
    print("2. 測試手動觸發轉錄功能")
    print("-" * 40)
    trigger_success = test_manual_trigger()
    
    print("\n" + "="*50 + "\n")
    
    # 測試 3: 測試列出轉錄檔案
    print("3. 測試列出轉錄檔案")
    print("-" * 40)
    list_success = test_list_transcript_files()
    
    print("\n" + "="*50 + "\n")
    
    # 測試 4: 測試從檔案獲取轉錄
    print("4. 測試從檔案獲取轉錄")
    print("-" * 40)
    file_success = test_get_transcript_from_file()
    
    print("\n" + "="*50)
    print("測試結果摘要:")
    print(f"  Supadata API 直接調用: {'✓ 成功' if api_success else '✗ 失敗'}")
    print(f"  手動觸發功能: {'✓ 成功' if trigger_success else '✗ 失敗'}")
    print(f"  列出轉錄檔案: {'✓ 成功' if list_success else '✗ 失敗'}")
    print(f"  從檔案獲取轉錄: {'✓ 成功' if file_success else '✗ 失敗'}")
    print("="*50)