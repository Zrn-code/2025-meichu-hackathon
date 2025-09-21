#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, sys, json, argparse, requests
from pathlib import Path

video_id = "FwOTs4UxQS4"  # 測試用影片 ID，可改成其他
GOOGLE_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1"
BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "windows-app", "src", "data")
VIDEO_KEYWORD_DIR = os.path.join(BASE_DIR, "video_keyword")
AVATAR_NOTE_DIR = os.path.join(BASE_DIR, "note")

# ---------- 讀取 .env（若已設環境變數則不覆蓋） ----------
def _parse_env_file(env_path: Path) -> dict:
    env = {}
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def load_dotenv_sidecar():
    env_path = Path(__file__).resolve().with_name(".env")
    if not env_path.exists():
        return env_path
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=env_path, override=False)
    except Exception:
        for k, v in _parse_env_file(env_path).items():
            if k not in os.environ:
                os.environ[k] = v
    return env_path

# ---------- Google 搜尋 ----------
_session = requests.Session()

def google_search_best_url(query, hl="zh-TW", lr="lang_zh-TW", gl="tw", safe="active"):
    env_path = load_dotenv_sidecar()
    key = os.getenv("GOOGLE_API_KEY")
    cx  = os.getenv("GOOGLE_CSE_ID")
    if not key or not cx:
        where = f"（嘗試讀取 {env_path}）" if env_path else ""
        raise RuntimeError(
            f"缺少 GOOGLE_API_KEY 或 GOOGLE_CSE_ID {where}\n"
            "請在同層 .env 或環境變數中提供。"
        )

    params = {
        "key": key,
        "cx": cx,
        "q": query,
        "num": 1,
        "hl": hl,
        "lr": lr,
        "gl": gl,
        "safe": safe,
    }
    r = _session.get(GOOGLE_SEARCH_ENDPOINT, params=params, timeout=20)
    r.raise_for_status()
    data = r.json()
    items = data.get("items") or []
    if not items:
        return None
    return items[0].get("link")

# ---------- 批次處理 ----------
def process_file(input_path: Path, output_path: Path):
    raw = json.loads(input_path.read_text(encoding="utf-8"))

    if not isinstance(raw, list):
        raise ValueError("輸入 JSON 需為陣列（list）。")

    cache = {}  # 關鍵字 -> url
    out = []
    for item in raw:
        if not isinstance(item, dict):
            out.append(item)  # 非 dict 原樣放回
            continue

        # 取 keywords
        kw = str(item.get("Keyword") or "").strip()
        if not kw:
            new_item = dict(item)
            new_item["url"] = None
            out.append(new_item)
            continue

        if kw in cache:
            url = cache[kw]
        else:
            try:
                url = google_search_best_url(kw)
            except Exception as e:
                print(str(e))
                # API 失敗時給 None；如需偵錯可改為 new_item["error"] = str(e)
                url = None
            cache[kw] = url

        new_item = dict(item)
        new_item["url"] = url
        out.append(new_item)

    dumped = json.dumps(out, ensure_ascii=False, indent=2)
    if output_path:
        output_path.write_text(dumped, encoding="utf-8")
    else:
        print(dumped)

# ---------- CLI ----------
def main():
    # parser = argparse.ArgumentParser(description="以 Google 搜尋為輸入 JSON 每筆加入 url")
    # parser.add_argument("input", help="輸入 JSON 檔案路徑")
    # parser.add_argument("-o", "--output", help="輸出 JSON 檔案路徑（預設印到 stdout）")
    # parser.add_argument("--hl", default="zh-TW", help="UI 語言提示（預設 zh-TW）")
    # parser.add_argument("--lr", default="lang_zh-TW", help="限制語言（預設 lang_zh-TW；空字串為不限制）")
    # parser.add_argument("--gl", default="tw", help="地區偏好（預設 tw）")
    # parser.add_argument("--safe", default="active", choices=["off", "active"], help="安全搜尋（預設 active）")
    # args = parser.parse_args()

    input_path = Path(os.path.join(VIDEO_KEYWORD_DIR, f"{video_id}.json"))
    output_path = Path(os.path.join(AVATAR_NOTE_DIR, f"{video_id}.json"))

    process_file(input_path, output_path,)

if __name__ == "__main__":
    main()
