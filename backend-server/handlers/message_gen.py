import time
import json
import re
from openai import OpenAI

# Initialize lemonade client (referencing lem.py)
client = OpenAI(
    base_url="http://localhost:8000/api/v1",
    api_key="lemonade"  # 需要帶但不驗證
)

# Pattern to remove think blocks (from lem.py)
THINK_BLOCK = re.compile(r"<\s*think\b[^>]*>.*?<\s*/\s*think\s*>",
                         flags=re.IGNORECASE | re.DOTALL)

# ========= 2) 檔案路徑 =========
import os
import glob

# 基礎路徑
BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "windows-app", "src", "data")
VIDEO_SUBTITLES_DIR = os.path.join(BASE_DIR, "video_subtitles")
CHARACTER_DIR = os.path.join(BASE_DIR, "character") 
AVATAR_TALK_DIR = os.path.join(BASE_DIR, "avatar_talk")

# 角色檔案
CH_JSON = os.path.join(CHARACTER_DIR, "1.json")   

# ========= 3) 全域變數和初始化 =========
def _load_character_data():
    """載入角色資料"""
    with open(CH_JSON, "r", encoding="utf-8") as f:
        return json.load(f)

def _ensure_output_dir():
    """確保輸出資料夾存在"""
    os.makedirs(AVATAR_TALK_DIR, exist_ok=True)


# ========= 4) 處理函數 =========
def build_whole(captions: str, character: str) -> str:
    return (
        f"你扮演的角色:{character}\n"
        "依照扮演的角色、對於我提供的這段影片片段有什麼感想嗎\n"
        f"影片片段: {captions}\n"
        "15個字內、中文簡短回覆："
    )

def process_video_subtitles(video_data, character_info, video_id=None):
    """處理單個影片字幕檔案"""
    time_per_summary = 60000
    captions = []
    llm_summary = []
    stamp = ""
    reply_count = 0
    
    transcript_data = video_data.get("transcript_data", {})
    content = transcript_data.get("content", [])
    
    print(f"🎬 開始處理影片字幕，共 {len(content)} 個字幕段落")
    
    for s in content:
        _time = s.get("duration", 0)
        text = s.get("text", "")
        if stamp == "": stamp = s.get("offset", 0)
        time_per_summary -= _time
        
        captions.append(text)
        
        if time_per_summary <= 0:
            time_per_summary = 60000
            reply_count += 1
            print(f"💭 正在生成第 {reply_count} 個回復（時間戳: {stamp}ms）...")
            
            prompt = build_whole(str(captions), str(character_info[0]))
            resp = client.chat.completions.create(
                model="user.Roleplay-Llama-3-8B-i1-GGUF",
                messages=[{"role": "user", "content": prompt}],
                stream=False
            )
            content_reply = resp.choices[0].message.content
            reply_text = THINK_BLOCK.sub("", content_reply).strip()
            
            print(f"✨ 角色回復 #{reply_count}: {reply_text}")
            
            captions.clear()
            llm_summary.append({
                "time": stamp,
                "Reply": reply_text
            })
            stamp = ""
    
    # 處理剩餘的字幕
    if len(captions) > 0:
        reply_count += 1
        print(f"💭 正在生成最後的回復（第 {reply_count} 個，時間戳: {stamp}ms）...")
        
        prompt = build_whole(str(captions), str(character_info[0]))
        resp = client.chat.completions.create(
            model="user.Roleplay-Llama-3-8B-i1-GGUF",
            messages=[{"role": "user", "content": prompt}],
            stream=False
        )
        content_reply = resp.choices[0].message.content
        reply_text = THINK_BLOCK.sub("", content_reply).strip()
        
        print(f"✨ 角色回復 #{reply_count}: {reply_text}")
        
        llm_summary.append({
            "time": stamp,
            "Reply": reply_text
        })
    
    print(f"📝 完成處理，總共生成了 {reply_count} 個角色回復")
    return llm_summary

def generate_avatar_response_for_video(video_id, character_index=0):
    """為指定影片 ID 生成角色回應
    
    Args:
        video_id (str): 影片 ID
        character_index (int): 角色索引，預設為 0 (第一位角色)
    
    Returns:
        bool: 是否成功生成
    """
    try:
        import logging
        logger = logging.getLogger(__name__)
        
        print(f"\n🎯 開始處理影片: {video_id}")
        print(f"📁 字幕檔案來源: video_subtitles/{video_id}.json")
        print("="*50)
        
        # 確保輸出資料夾存在
        _ensure_output_dir()
        
        # 載入角色資料
        character_info = _load_character_data()
        character_name = character_info[0] if character_info else "預設角色"
        print(f"👤 使用角色: {character_name}")
        
        # 構建輸入檔案路徑
        subtitle_file = os.path.join(VIDEO_SUBTITLES_DIR, f"{video_id}.json")
        
        if not os.path.exists(subtitle_file):
            print(f"❌ 字幕檔案不存在: {subtitle_file}")
            logger.warning(f"字幕檔案不存在: {subtitle_file}")
            return False
        
        logger.info(f"開始為影片 {video_id} 生成角色回應...")
        
        # 讀取影片字幕資料
        with open(subtitle_file, "r", encoding="utf-8") as f:
            video_data = json.load(f)
        
        print(f"📖 成功載入字幕檔案")
        
        # 處理字幕生成回應
        llm_summary = process_video_subtitles(video_data, character_info, video_id)
        
        # 輸出檔案路徑
        output_file = os.path.join(AVATAR_TALK_DIR, f"{video_id}.json")
        
        # 儲存結果
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(llm_summary, f, ensure_ascii=False, indent=2)
        
        print(f"💾 結果已儲存到: avatar_talk/{video_id}.json")
        print("="*50)
        print(f"✅ 影片 {video_id} 處理完成！\n")
        
        logger.info(f"角色回應已生成並儲存到: {output_file}")
        return True
        
    except Exception as e:
        print(f"❌ 處理影片 {video_id} 時發生錯誤: {e}")
        logger.error(f"生成角色回應時發生錯誤: {e}")
        return False

def generate_avatar_responses_batch():
    """批次處理所有影片字幕檔案生成角色回應"""
    import logging
    logger = logging.getLogger(__name__)
    
    start_time = time.time()
    
    print("\n🔄 開始批次處理所有影片字幕檔案")
    print("="*60)
    
    # 確保輸出資料夾存在
    _ensure_output_dir()
    
    # 載入角色資料
    character_info = _load_character_data()
    
    # 取得所有影片字幕檔案
    subtitle_files = glob.glob(os.path.join(VIDEO_SUBTITLES_DIR, "*.json"))
    
    print(f"📂 找到 {len(subtitle_files)} 個影片字幕檔案")
    logger.info(f"找到 {len(subtitle_files)} 個影片字幕檔案")
    
    success_count = 0
    
    for subtitle_file in subtitle_files:
        try:
            logger.info(f"處理檔案: {subtitle_file}")
            
            # 取得檔案名稱（不包含副檔名）作為 video ID
            video_id = os.path.splitext(os.path.basename(subtitle_file))[0]
            
            # 讀取影片字幕資料
            with open(subtitle_file, "r", encoding="utf-8") as f:
                video_data = json.load(f)
            
            # 處理這個影片的字幕
            print(f"\n🎯 處理影片: {video_id}")
            llm_summary = process_video_subtitles(video_data, character_info, video_id)
            
            # 輸出檔案路徑
            output_file = os.path.join(AVATAR_TALK_DIR, f"{video_id}.json")
            
            # 儲存結果
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(llm_summary, f, ensure_ascii=False, indent=2)
            
            print(f"💾 已儲存到: avatar_talk/{video_id}.json")
            logger.info(f"已儲存到: {output_file}")
            success_count += 1
            
        except Exception as e:
            print(f"❌ 處理檔案 {subtitle_file} 時發生錯誤: {e}")
            logger.error(f"處理檔案 {subtitle_file} 時發生錯誤: {e}")
    
    elapsed = time.time() - start_time
    print("="*60)
    print(f"🏁 批次處理完成！")
    print(f"✅ 成功處理: {success_count}/{len(subtitle_files)} 個檔案")
    print(f"⏱️  總時間: {elapsed:.2f} 秒")
    print("="*60)
    
    logger.info(f"批次處理完成！成功處理 {success_count}/{len(subtitle_files)} 個檔案，總時間: {elapsed:.2f} 秒")
    
    return success_count == len(subtitle_files)

# ========= 5) 主程式部分 =========
if __name__ == "__main__":
    # 當作為獨立腳本執行時
    import sys
    
    if len(sys.argv) > 1:
        # 如果提供了 video ID 參數，只處理該影片
        video_id = sys.argv[1]
        print(f"處理指定影片: {video_id}")
        success = generate_avatar_response_for_video(video_id)
        if success:
            print(f"影片 {video_id} 的角色回應生成完成")
        else:
            print(f"影片 {video_id} 的角色回應生成失敗")
    else:
        # 否則批次處理所有影片
        print("開始批次處理所有影片...")
        success = generate_avatar_responses_batch()
        if success:
            print("所有影片處理完成")
        else:
            print("部分影片處理失敗，請檢查日誌")