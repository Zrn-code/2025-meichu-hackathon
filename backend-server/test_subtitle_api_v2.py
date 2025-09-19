#!/usr/bin/env python3
"""
字幕API測試腳本 (更新版 - 無需video_id)
測試localhost:3000上的字幕相關API端點
新版本API自動獲取當前觀看的YouTube視頻字幕
"""

import requests
import json
import sys
from datetime import datetime

class SubtitleAPITester:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        
    def test_health(self):
        """測試健康檢查端點"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 健康檢查成功: {data['status']}")
                print(f"   服務版本: {data.get('version', 'Unknown')}")
                print(f"   時間戳: {data.get('timestamp', 'Unknown')}")
                return True
            else:
                print(f"❌ 健康檢查失敗: HTTP {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 連接失敗: {e}")
            return False
    
    def test_current_youtube_data(self):
        """測試獲取當前YouTube數據"""
        try:
            response = self.session.get(f"{self.base_url}/api/youtube/current")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 獲取YouTube數據成功")
                if data.get('data'):
                    current = data['data']
                    print(f"   視頻ID: {current.get('videoId', 'N/A')}")
                    print(f"   標題: {current.get('title', 'N/A')[:50]}...")
                    print(f"   頻道: {current.get('channelName', 'N/A')}")
                    print(f"   播放狀態: {'播放中' if current.get('isPlaying') else '暫停'}")
                    return True
                else:
                    print("   ⚠️ 沒有當前YouTube數據")
                    return False
            else:
                print(f"❌ 獲取YouTube數據失敗: HTTP {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 請求失敗: {e}")
            return False
    
    def test_current_subtitles(self):
        """測試獲取當前字幕"""
        try:
            response = self.session.get(f"{self.base_url}/api/youtube/subtitles/current")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 獲取當前字幕成功")
                if data.get('data'):
                    subtitle = data['data']
                    print(f"   視頻ID: {subtitle.get('video_id', 'N/A')}")
                    print(f"   視頻時間: {subtitle.get('video_time', 0)}秒")
                    
                    subtitle_info = subtitle.get('subtitle_info', {})
                    if subtitle_info:
                        current_text = subtitle_info.get('currentText', {})
                        if current_text:
                            print(f"   當前字幕: {current_text.get('text', 'N/A')}")
                        
                        track = subtitle_info.get('currentTrack', {})
                        if track:
                            print(f"   語言: {track.get('language', 'N/A')}")
                    return True
                else:
                    print("   ⚠️ 沒有當前字幕數據")
                    return False
            else:
                print(f"❌ 獲取當前字幕失敗: HTTP {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 請求失敗: {e}")
            return False
    
    def test_subtitle_history(self, limit=10):
        """測試獲取字幕歷史"""
        try:
            params = {"limit": limit}
                
            response = self.session.get(f"{self.base_url}/api/youtube/subtitles/history", params=params)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 獲取字幕歷史成功")
                history = data.get('data', [])
                current_video_id = data.get('current_video_id')
                print(f"   當前視頻ID: {current_video_id}")
                print(f"   歷史記錄數量: {len(history)}")
                
                if history:
                    print("   最近的字幕:")
                    for i, entry in enumerate(history[-3:], 1):  # 顯示最後3條
                        text = entry.get('text', 'N/A')[:50]
                        video_time = entry.get('video_time', 0)
                        print(f"     {i}. [{video_time}s] {text}...")
                return len(history)
            else:
                print(f"❌ 獲取字幕歷史失敗: HTTP {response.status_code}")
                return 0
        except Exception as e:
            print(f"❌ 請求失敗: {e}")
            return 0
    
    def test_subtitle_transcript(self):
        """測試獲取完整字幕轉錄"""
        try:
            response = self.session.get(f"{self.base_url}/api/youtube/subtitles/transcript")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 獲取字幕轉錄成功")
                transcript_data = data.get('data', {})
                
                print(f"   視頻ID: {transcript_data.get('video_id', 'N/A')}")
                print(f"   視頻標題: {transcript_data.get('video_title', 'N/A')[:50]}...")
                print(f"   條目數量: {transcript_data.get('entries', 0)}")
                print(f"   時間範圍: {transcript_data.get('duration_covered', 'N/A')}")
                
                full_text = transcript_data.get('full_text', '')
                if full_text:
                    print(f"   完整文本長度: {len(full_text)} 字符")
                    print(f"   文本預覽: {full_text[:100]}...")
                
                transcript = transcript_data.get('transcript', '')
                if transcript:
                    print(f"   轉錄長度: {len(transcript)} 字符")
                    # 顯示前幾行
                    lines = transcript.split('\n')[:5]
                    print("   轉錄預覽:")
                    for line in lines:
                        if line.strip():
                            print(f"     {line}")
                
                return transcript_data
            else:
                print(f"❌ 獲取字幕轉錄失敗: HTTP {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ 請求失敗: {e}")
            return None
    
    def test_current_full_subtitles(self):
        """測試獲取當前視頻的完整字幕數據"""
        try:
            response = self.session.get(f"{self.base_url}/api/youtube/subtitles/full/current")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 獲取完整字幕成功")
                subtitle_data = data.get('data', {})
                
                print(f"   視頻ID: {subtitle_data.get('video_id', 'N/A')}")
                print(f"   標題: {subtitle_data.get('title', 'N/A')[:50]}...")
                print(f"   語言: {subtitle_data.get('language', 'N/A')}")
                print(f"   總cue數量: {subtitle_data.get('total_cues', 0)}")
                print(f"   時長: {subtitle_data.get('duration', 0)}秒")
                print(f"   緩存時間: {subtitle_data.get('cached_at', 'N/A')}")
                
                cues = subtitle_data.get('cues', [])
                if cues:
                    print("   前3個cue:")
                    for i, cue in enumerate(cues[:3], 1):
                        start_time = cue.get('startTime', 0)
                        end_time = cue.get('endTime', 0)
                        text = cue.get('text', 'N/A')[:50]
                        print(f"     {i}. [{start_time:.1f}s-{end_time:.1f}s] {text}...")
                
                return subtitle_data
            elif response.status_code == 404:
                print(f"⚠️ 沒有找到當前視頻的完整字幕數據")
                return None
            else:
                print(f"❌ 獲取完整字幕失敗: HTTP {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ 請求失敗: {e}")
            return None
    
    def test_all_cached_subtitles(self):
        """測試獲取所有緩存的字幕"""
        try:
            response = self.session.get(f"{self.base_url}/api/youtube/subtitles/full")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 獲取所有緩存字幕成功")
                cached_data = data.get('data', {})
                
                print(f"   緩存的視頻數量: {len(cached_data)}")
                
                if cached_data:
                    print("   緩存的視頻:")
                    for video_id, subtitle_data in cached_data.items():
                        title = subtitle_data.get('title', 'Unknown')[:40]
                        total_cues = subtitle_data.get('total_cues', 0)
                        language = subtitle_data.get('language', 'Unknown')
                        print(f"     • {video_id}: {title}... ({total_cues} cues, {language})")
                
                return list(cached_data.keys())
            else:
                print(f"❌ 獲取緩存字幕失敗: HTTP {response.status_code}")
                return []
        except Exception as e:
            print(f"❌ 請求失敗: {e}")
            return []
    
    def test_subtitle_search(self, query):
        """測試字幕搜索"""
        try:
            params = {"q": query}
                
            response = self.session.get(f"{self.base_url}/api/youtube/subtitles/search", params=params)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 字幕搜索成功")
                results = data.get('results', [])
                current_video_id = data.get('current_video_id')
                
                print(f"   搜索關鍵字: '{query}'")
                print(f"   當前視頻ID: {current_video_id}")
                print(f"   找到結果: {len(results)}")
                
                if results:
                    print("   搜索結果:")
                    for i, result in enumerate(results[:5], 1):  # 顯示前5個結果
                        text = result.get('text', 'N/A')[:60]
                        video_time = result.get('video_time', 0)
                        print(f"     {i}. [{video_time}s] {text}...")
                
                return results
            else:
                print(f"❌ 字幕搜索失敗: HTTP {response.status_code}")
                return []
        except Exception as e:
            print(f"❌ 請求失敗: {e}")
            return []
    
    def test_subtitle_statistics(self):
        """測試獲取字幕統計"""
        try:
            response = self.session.get(f"{self.base_url}/api/youtube/subtitles/statistics")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 獲取字幕統計成功")
                stats = data.get('data', {})
                
                print(f"   總條目數: {stats.get('total_entries', 0)}")
                print(f"   唯一視頻數: {stats.get('unique_videos', 0)}")
                print(f"   總字符數: {stats.get('total_characters', 0)}")
                print(f"   語言: {', '.join(stats.get('languages', []))}")
                print(f"   當前字幕可用: {'是' if stats.get('current_subtitle_available') else '否'}")
                
                return stats
            else:
                print(f"❌ 獲取字幕統計失敗: HTTP {response.status_code}")
                return {}
        except Exception as e:
            print(f"❌ 請求失敗: {e}")
            return {}
    
    def test_export_subtitles(self, format_type='srt'):
        """測試導出字幕文件"""
        try:
            params = {"format": format_type}
            response = self.session.get(f"{self.base_url}/api/youtube/subtitles/export", params=params)
            
            if response.status_code == 200:
                print(f"✅ 導出{format_type.upper()}字幕成功")
                content_length = len(response.content)
                print(f"   文件大小: {content_length} 字節")
                
                # 顯示前幾行內容
                content_preview = response.text[:200]
                print(f"   內容預覽:\n{content_preview}...")
                
                return response.content
            elif response.status_code == 404:
                error_data = response.json()
                print(f"⚠️ 導出失敗: {error_data.get('error', 'Unknown error')}")
                return None
            else:
                print(f"❌ 導出字幕失敗: HTTP {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ 請求失敗: {e}")
            return None
    
    def run_all_tests(self):
        """運行所有測試"""
        print("🚀 開始測試localhost:3000上的字幕API (更新版 - 無需video_id)")
        print("=" * 70)
        
        # 1. 健康檢查
        print("\n1️⃣ 測試健康檢查")
        if not self.test_health():
            print("❌ 服務器未運行，請先啟動後端服務器")
            return False
        
        # 2. 獲取當前YouTube數據
        print("\n2️⃣ 測試當前YouTube數據")
        has_current_video = self.test_current_youtube_data()
        
        if not has_current_video:
            print("\n⚠️ 沒有檢測到當前YouTube視頻")
            print("   請確保:")
            print("   - Chrome擴展已安裝並啟用")
            print("   - 正在YouTube頁面播放視頻")
            print("   - 擴展已連接到後端服務器")
            print("\n⏸️ 跳過需要當前視頻的測試...")
            
            # 只運行不需要當前視頻的測試
            print("\n6️⃣ 測試所有緩存字幕")
            self.test_all_cached_subtitles()
            
            print("\n9️⃣ 測試字幕統計")
            self.test_subtitle_statistics()
            
            print("\n" + "=" * 70)
            print("⚠️ 部分測試完成！請先播放YouTube視頻來測試完整功能")
            return False
        
        # 3. 獲取當前字幕
        print("\n3️⃣ 測試當前字幕")
        self.test_current_subtitles()
        
        # 4. 獲取字幕歷史
        print("\n4️⃣ 測試字幕歷史")
        history_count = self.test_subtitle_history()
        
        # 5. 獲取字幕轉錄
        print("\n5️⃣ 測試字幕轉錄")
        transcript_data = self.test_subtitle_transcript()
        
        # 6. 獲取所有緩存字幕
        print("\n6️⃣ 測試所有緩存字幕")
        cached_video_ids = self.test_all_cached_subtitles()
        
        # 7. 測試當前視頻完整字幕數據
        print("\n7️⃣ 測試當前視頻完整字幕數據")
        self.test_current_full_subtitles()
        
        # 8. 測試字幕搜索（如果有歷史記錄）
        print("\n8️⃣ 測試字幕搜索")
        if history_count > 0:
            self.test_subtitle_search("the")
        else:
            print("⚠️ 沒有字幕歷史記錄，跳過搜索測試")
        
        # 9. 獲取字幕統計
        print("\n9️⃣ 測試字幕統計")
        self.test_subtitle_statistics()
        
        # 10. 測試導出功能
        print("\n🔟 測試導出字幕文件")
        self.test_export_subtitles('srt')
        
        print("\n" + "=" * 70)
        print("✅ 所有測試完成！")
        
        # 提供使用說明
        print("\n📋 新版API使用說明 (無需video_id):")
        print("1. 獲取當前YouTube數據: GET /api/youtube/current")
        print("2. 獲取當前字幕: GET /api/youtube/subtitles/current")
        print("3. 獲取字幕歷史: GET /api/youtube/subtitles/history?limit=50")
        print("4. 獲取字幕轉錄: GET /api/youtube/subtitles/transcript")
        print("5. 獲取當前完整字幕: GET /api/youtube/subtitles/full/current")
        print("6. 獲取所有緩存字幕: GET /api/youtube/subtitles/full")
        print("7. 搜索字幕: GET /api/youtube/subtitles/search?q=關鍵字")
        print("8. 獲取字幕統計: GET /api/youtube/subtitles/statistics")
        print("9. 導出字幕文件: GET /api/youtube/subtitles/export?format=srt")
        
        print(f"\n💡 所有API都會自動使用當前正在觀看的YouTube視頻")
        print(f"   無需手動指定video_id，使用更簡單！")
        
        return True


def main():
    """主函數"""
    tester = SubtitleAPITester()
    
    print("🎬 YouTube字幕API測試工具 (更新版)")
    print("🆕 新版本特點：無需video_id，自動獲取當前視頻字幕")
    print(f"⏰ 測試時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        tester.run_all_tests()
    except KeyboardInterrupt:
        print("\n\n⚠️ 測試被用戶中斷")
    except Exception as e:
        print(f"\n❌ 測試過程中發生錯誤: {e}")


if __name__ == "__main__":
    main()