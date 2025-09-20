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
IN_JSON  = "input/test.json"                 # 你的輸入 JSON（照你給的格式）
# SUM_JSON  = "input/test.json"                 # 你的輸入 JSON（照你給的格式）
OUT_JSON = "minutes_with_replies.json"    # 產生的輸出 JSON
CH_JSON = "character/1.json"   

# ========= 3) 讀入 JSON =========
with open(IN_JSON, "r", encoding="utf-8") as f:
    raw_summary = json.load(f)
    
# with open(SUM_JSON, "r", encoding="utf-8") as f:
#     data = json.load(f)
    
with open(CH_JSON, "r", encoding="utf-8") as f:
    ch = json.load(f)


# ========= 4.3) summary Prompt =========
def build_whole(captions: str, character: str) -> str:
    return (
        f"你扮演的角色:{character}\n"
        "依照扮演的角色、對於我提供的這段影片片段有什麼感想嗎\n"
        f"影片片段: {captions}\n"
        "15個字內、中文簡短回覆："
    )

# ========= 5) 逐段產生回覆（無任何後處理）=========
start_time = time.time()

#summarize
time_per_summary = 60000
captions = []
llm_summary = []
stamp = ""

for s in raw_summary.get("content", []):
    _time = s.get("duration", "")
    text = s.get("text", "")
    if stamp == "": stamp = s.get("offset", "")
    time_per_summary -= _time
    # print(text)
    captions.append(text)
    if time_per_summary <= 0:
        time_per_summary = 60000
        prompt  = build_whole(str(captions), str(ch[0]))
        resp = client.chat.completions.create(
            model="user.Roleplay-Llama-3-8B-i1-GGUF",
            messages=[{"role": "user", "content": prompt}],
            stream=False
        )
        content = resp.choices[0].message.content
        reply_text = THINK_BLOCK.sub("", content).strip()
        captions.clear()
        llm_summary.append({
            "time": stamp,
            "Reply": reply_text
        })
        stamp = ""

if len(captions) > 0:
    time_per_summary = 60000
    prompt  = build_whole(str(captions), str(ch[0]))
    resp = client.chat.completions.create(
        model="user.Roleplay-Llama-3-8B-i1-GGUF",
        messages=[{"role": "user", "content": prompt}],
        stream=False
    )
    content = resp.choices[0].message.content
    reply_text = THINK_BLOCK.sub("", content).strip()
    captions.clear()
    llm_summary.append({
        "time": stamp,
        "Reply": reply_text
    })
    stamp = ""

#directly reply
# for m in data.get("minutes", []):
#     summary = m.get("summary", "")
#     prompt  = build_prompt(summary)

#     out = llm(
#         prompt=prompt,
#         max_tokens=32,
#         temperature=0.8,
#         top_p=0.9,
#         repeat_penalty=1.1,
#         stop=["\n", "User:", "Assistant:", "summary：", "回覆："]
#     )
#     m["reply"] = out["choices"][0]["text"]

#reply from summary


elapsed = time.time() - start_time

# ========= 6) 輸出結果 =========
print(f"總處理時間: {elapsed:.2f} 秒")

# with open(OUT_JSON, "w", encoding="utf-8") as f:
#     json.dump({"minutes": data["minutes"]}, f, ensure_ascii=False, indent=2)

with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(llm_summary, f, ensure_ascii=False, indent=2)

print(f"已輸出到：{OUT_JSON}")