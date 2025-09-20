import time
from llama_cpp import Llama
import json

model_path = "models\Roleplay-Llama-3-8B.i1-Q4_K_M.gguf"  # 改成你的本機路徑

# ========= 1) 載入模型 =========
llm = Llama(
    model_path=model_path,
    n_ctx=4096,          # 依需求調整；越大越吃顯存/記憶體
    n_batch=1024,        # 512~1024 是 8B 常見值；不足可降
    n_threads=8,         # 設為你 CPU 的實體/邏輯核心數
    n_gpu_layers=-1,     # 自動把可容納的層數都放到 GPU（建議）
    seed=42,
    verbose=False,
)

# ========= 2) 檔案路徑 =========
IN_JSON  = "summary/message.json"                 # 你的輸入 JSON（照你給的格式）
SUM_JSON  = "input/test.json"                 # 你的輸入 JSON（照你給的格式）
OUT_JSON = "minutes_with_replies.json"    # 產生的輸出 JSON
CH_JSON = "character/1.json"   

# ========= 3) 讀入 JSON =========
with open(IN_JSON, "r", encoding="utf-8") as f:
    raw_summary = json.load(f)
    
# with open(SUM_JSON, "r", encoding="utf-8") as f:
#     data = json.load(f)
    
with open(CH_JSON, "r", encoding="utf-8") as f:
    ch = json.load(f)

# ========= 4.1) Character Reply Prompt =========
def build_prompt(summary: str) -> str:
    """
    全部條件交由模型遵守：
    - 角色：俏皮、帶點調情；禁止露骨或性行為描述
    - 語言：繁體中文
    - 長度：不超過 15 字
    - 結尾：必須以「喵」收尾
    - 輸出：只輸出這一句，不要任何其它字、引號、前後綴或換行
    """
    return (
        "你是一位擅長吐槽的資訊工程男大學生，請針對summary來給予感想"
        "請以簡體中文回覆一句話，長度不超過15字。"
        "只輸出這一句，不要任何解釋、不要引號、不要多餘標記、不要換行。\n\n"
        f"summary：{summary}\n"
        "回覆："
    )

# ========= 4.2) summary Prompt =========
def build_summary(captions: str) -> str:
    return (
        "請針對提供的影片片段captions來做概要"
        "請以簡體中文回覆一段話，長度不超過30字的完整一段話。"
        "只輸出這一段話，不要引號、不要多餘標記、不要換行。\n\n"
        f"captions：{captions}\n"
        "回覆："
    )

# ========= 4.3) summary Prompt =========
def build_whole(captions: str, character: str) -> str:
    return (
        f"你扮演的角色:{character}\n"
        "依照扮演的角色、針對提供的這段影片片段captions來給予有個人特色的簡短主觀感想\n"
        f"captions：{captions}\n"
        "15個字內不包含括號中文簡短回覆："
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
        out = llm(
            prompt=prompt,
            max_tokens=32,
            temperature=0.8,
            top_p=0.9,
            repeat_penalty=1.1,
            stop=["\n", "User:", "Assistant:", "summary：", "回覆：", "!", "。", "（"]
        )
        captions.clear()
        llm_summary.append({
            "time": stamp,
            "Reply": out["choices"][0]["text"]
        })
        stamp = ""

if len(captions) > 0:
    time_per_summary = 60000
    prompt  = build_whole(str(captions), str(ch[0]))
    out = llm(
        prompt=prompt,
        max_tokens=32,
        temperature=0.8,
        top_p=0.9,
        repeat_penalty=1.1,
            stop=["\n", "User:", "Assistant:", "summary：", "回覆：", "!", "。", "（"]
    )
    captions.clear()
    llm_summary.append({
        "time": stamp,
        "Reply": out["choices"][0]["text"]
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