#!/usr/bin/env python3
"""
測試 YouTube 字幕功能
"""

import requests
import json
import time
from datetime import datetime

class SubtitleTester:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        
    def test_subtitle_apis(self):
        """測試字幕相關的 API"""
        print("=== YouTube 字幕功能測試 ===\n")
        
        # 測試當前字幕信息
        print("1. 測試獲取當前字幕信息...")
        self.test_current_subtitles()
        
        # 測試字幕歷史記錄
        print("\n2. 測試獲取字幕歷史記錄...")
        self.test_subtitle_history()
        
        # 測試字幕轉錄
        print("\n3. 測試獲取字幕轉錄...")
        self.test_subtitle_transcript()
        
        # 測試字幕搜索
        print("\n4. 測試字幕搜索...")
        self.test_subtitle_search()
        
        # 測試字幕統計
        print("\n5. 測試字幕統計信息...")
        self.test_subtitle_statistics()
        
        print("\n=== 測試完成 ===")
    
    def test_current_subtitles(self):
        """測試當前字幕 API"""
        try:
            response = requests.get(f"{self.base_url}/api/youtube/subtitles/current")
            result = response.json()
            
            print(f"狀態碼: {response.status_code}")
            print(f"響應: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
            if result.get("success"):
                data = result.get("data")
                if data:
                    subtitle_info = data.get("subtitle_info", {})
                    print(f"字幕可用: {subtitle_info.get('available', False)}")
                    print(f"字幕啟用: {subtitle_info.get('isEnabled', False)}")
                    current_text = subtitle_info.get('currentText')
                    if current_text:
                        print(f"當前字幕: {current_text.get('text', 'N/A')}")
                else:
                    print("當前沒有字幕數據")
            
        except Exception as e:
            print(f"錯誤: {e}")
    
    def test_subtitle_history(self):
        """測試字幕歷史 API"""
        try:
            # 測試獲取所有歷史記錄
            response = requests.get(f"{self.base_url}/api/youtube/subtitles/history?limit=10")
            result = response.json()
            
            print(f"狀態碼: {response.status_code}")
            print(f"記錄數量: {result.get('count', 0)}")
            
            if result.get("success") and result.get("data"):
                history = result["data"]
                print(f"最近的字幕記錄:")
                for i, entry in enumerate(history[:3]):  # 只顯示前3條
                    video_time = entry.get("video_time", 0)
                    text = entry.get("text", "")[:50] + "..." if len(entry.get("text", "")) > 50 else entry.get("text", "")
                    print(f"  {i+1}. [{int(video_time//60):02d}:{int(video_time%60):02d}] {text}")
            else:
                print("沒有字幕歷史記錄")
            
        except Exception as e:
            print(f"錯誤: {e}")
    
    def test_subtitle_transcript(self):
        """測試字幕轉錄 API"""
        try:
            response = requests.get(f"{self.base_url}/api/youtube/subtitles/transcript")
            result = response.json()
            
            print(f"狀態碼: {response.status_code}")
            
            if result.get("success"):
                data = result.get("data", {})
                entries = data.get("entries", 0)
                duration = data.get("duration_covered", "0s")
                
                print(f"字幕條目數: {entries}")
                print(f"時間覆蓋範圍: {duration}")
                
                if entries > 0:
                    full_text = data.get("full_text", "")
                    preview = full_text[:100] + "..." if len(full_text) > 100 else full_text
                    print(f"字幕內容預覽: {preview}")
                else:
                    print("沒有可用的字幕轉錄")
            
        except Exception as e:
            print(f"錯誤: {e}")
    
    def test_subtitle_search(self):
        """測試字幕搜索 API"""
        try:
            # 測試搜索功能
            search_query = "測試"  # 可以改為其他關鍵字
            response = requests.get(f"{self.base_url}/api/youtube/subtitles/search?q={search_query}")
            result = response.json()
            
            print(f"狀態碼: {response.status_code}")
            print(f"搜索關鍵字: {search_query}")
            print(f"搜索結果數量: {result.get('count', 0)}")
            
            if result.get("success") and result.get("results"):
                results = result["results"]
                print("搜索結果:")
                for i, item in enumerate(results[:3]):  # 只顯示前3個結果
                    text = item.get("text", "")
                    video_time = item.get("video_time", 0)
                    print(f"  {i+1}. [{int(video_time//60):02d}:{int(video_time%60):02d}] {text}")
            else:
                print("沒有找到匹配的字幕")
            
        except Exception as e:
            print(f"錯誤: {e}")
    
    def test_subtitle_statistics(self):
        """測試字幕統計 API"""
        try:
            response = requests.get(f"{self.base_url}/api/youtube/subtitles/statistics")
            result = response.json()
            
            print(f"狀態碼: {response.status_code}")
            
            if result.get("success"):
                data = result.get("data", {})
                print(f"字幕統計信息:")
                print(f"  總條目數: {data.get('total_entries', 0)}")
                print(f"  視頻數量: {data.get('unique_videos', 0)}")
                print(f"  字幕語言: {', '.join(data.get('languages', []))}")
                print(f"  總字符數: {data.get('total_characters', 0)}")
                print(f"  當前有字幕: {data.get('current_subtitle_available', False)}")
            
        except Exception as e:
            print(f"錯誤: {e}")
    
    def test_server_connection(self):
        """測試服務器連接"""
        try:
            response = requests.get(f"{self.base_url}/api/status", timeout=5)
            if response.status_code == 200:
                print("✅ 服務器連接正常")
                return True
            else:
                print(f"❌ 服務器響應異常: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 無法連接到服務器: {e}")
            print("請確保後端服務器正在運行 (python server.py)")
            return False

def main():
    """主測試函數"""
    print("YouTube 字幕功能測試工具")
    print("=" * 40)
    
    tester = SubtitleTester()
    
    # 首先測試服務器連接
    if not tester.test_server_connection():
        return
    
    print("\n開始測試字幕功能...")
    print("注意: 這些測試需要 Chrome 擴展正在運行並且有 YouTube 頁面打開")
    print("=" * 40)
    
    # 運行測試
    tester.test_subtitle_apis()
    
    print("\n提示:")
    print("1. 如果沒有數據，請確保:")
    print("   - Chrome 擴展已安裝並啟用")
    print("   - 正在觀看有字幕的 YouTube 視頻")
    print("   - 字幕功能已開啟")
    print("2. 可以嘗試切換不同的字幕語言測試")
    print("3. 字幕數據會隨著視頻播放實時更新")

if __name__ == "__main__":
    main()