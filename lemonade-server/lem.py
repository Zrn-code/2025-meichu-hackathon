#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional
import re

MS_PER_MIN = 60_000
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/api/v1",
    api_key="lemonade"  # 需要帶但不驗證
)

THINK_BLOCK = re.compile(r"<\s*think\b[^>]*>.*?<\s*/\s*think\s*>",
                         flags=re.IGNORECASE | re.DOTALL)

def load_entries(path: Path, encoding: str = "utf-8") -> List[Dict[str, Any]]:
    """Load subtitle entries from a JSON file.
    Supports either a top-level list or an object with a 'content' list.
    Each entry should have: text (str), offset (ms, int), duration (ms, int)."""
    with path.open("r", encoding=encoding) as f:
        data = json.load(f)
    if isinstance(data, list):
        entries = data
    elif isinstance(data, dict):
        if "content" in data and isinstance(data["content"], list):
            entries = data["content"]
        else:
            raise ValueError("JSON object does not contain a 'content' list.")
    else:
        raise ValueError("Unsupported JSON structure: expected list or object.")
    # Normalize and validate
    norm = []
    for i, e in enumerate(entries):
        try:
            text = str(e.get("text", ""))
            offset = int(e.get("offset", 0))
            duration = int(e.get("duration", 0))
        except Exception as exc:
            raise ValueError(f"Entry #{i} has invalid types: {e}") from exc
        if offset < 0:
            offset = 0
        if duration < 0:
            duration = 0
        norm.append({"text": text, "offset": offset, "duration": duration})
    norm.sort(key=lambda x: x["offset"])  # chronological order
    return norm

def compute_total_minutes(entries: List[Dict[str, Any]]) -> int:
    max_end = 0
    for e in entries:
        end_ms = e["offset"] + e["duration"]
        if end_ms > max_end:
            max_end = end_ms
    return int(math.ceil(max_end / MS_PER_MIN)) if max_end > 0 else 1

def overlaps(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return max(a_start, b_start) < min(a_end, b_end)

def group_by_minute(entries: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """Return a list of minute buckets.
    Each bucket is a list of entry dicts that overlap the minute window."""
    total_minutes = compute_total_minutes(entries)
    grouped: List[List[Dict[str, Any]]] = [[] for _ in range(total_minutes)]
    for e in entries:
        start = e["offset"]
        end = start + e["duration"]
        start_idx = start // MS_PER_MIN
        end_idx = max(0, (end - 1) // MS_PER_MIN) if end > 0 else start_idx
        for m in range(start_idx, min(end_idx + 1, total_minutes)):
            win_start = m * MS_PER_MIN
            win_end = win_start + MS_PER_MIN
            if overlaps(start, end, win_start, win_end):
                grouped[m].append(e)
    return grouped

def build_combined_json(grouped: List[List[Dict[str, Any]]],
                        outdir: Path,
                        base: str,
                        join_with: str = "\n") -> Path:
    """Create one JSON file containing, for each minute:
       - minute index
       - start_ms / end_ms (inclusive end shown for readability)
       - last_offset_ms (or null)
       - summary (OpenAI result; empty string if no text)
    """
    outdir.mkdir(parents=True, exist_ok=True)
    minutes_data: List[Dict[str, Any]] = []

    for m, items in enumerate(grouped):
        start_ms = m * MS_PER_MIN
        end_ms = start_ms + MS_PER_MIN - 1
        last_offset = items[-1]["offset"] if items else None
        texts = [it["text"] for it in items]
        texts_str = join_with.join(texts) if texts else ""
        summary = ""
        if texts_str:
            resp = client.chat.completions.create(
                model="user.Roleplay-Llama-3-8B-i1-GGUF",
                # model="DeepSeek-R1-Distill-Llama-8B-Hybrid",
                # messages=[{"role": "user", "content": "你是一位擅長搞笑的大學生，請以簡體中文回覆一句話，長度不超過15字，且句尾必須是「喵」。只輸出這一句，不要任何解釋、不要引號、不要多餘標記、不要換行。請將以下句子用一句話總結\n\n" + texts_str}],
                messages=[{"role": "user", "content": f"""你扮演的角色:
人物背景: 被困在虛擬遊戲世界的VRMMO玩家
語氣口吻: 冷靜寡言，偶露溫柔
人物特色: 黑衣劍士，雙劍高手

依照扮演的角色、針對提供的這段影片片段captions來給予有個人特色的簡短主觀感想
captions：{texts_str}
15個字內簡短回覆："""}],
                stream=False
            )
            content = resp.choices[0].message.content
            summary = THINK_BLOCK.sub("", content).strip()
            print(summary)

        minutes_data.append({
            "minute_index": m,
            "start_ms": start_ms,
            "end_ms": end_ms,
            "last_offset_ms": last_offset,
            "summary": summary
        })

    out_path = outdir / f"{base}_minute_summary_and_last_offsets.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump({"minutes": minutes_data}, f, ensure_ascii=False, indent=2)
    return out_path

def main():
    ap = argparse.ArgumentParser(description="Build a single JSON with OpenAI summary and last offset per minute.")
    ap.add_argument("input", type=Path, help="Path to JSON file (list or {'content': [...]})")
    ap.add_argument("--out", type=Path, default=Path("minute_splits"), help="Output directory (default: ./minute_splits)")
    ap.add_argument("--base", type=str, default="subs", help="Base filename prefix for outputs (default: 'subs')")
    ap.add_argument("--encoding", type=str, default="utf-8", help="Input JSON encoding (default: utf-8)")
    ap.add_argument("--join", type=str, default="\n", help="Joiner between texts within the same minute (default: newline). Use '\n' or ' ' etc.")
    args = ap.parse_args()

    join_with = args.join.encode("utf-8").decode("unicode_escape")

    entries = load_entries(args.input, encoding=args.encoding)
    grouped = group_by_minute(entries)
    out_path = build_combined_json(grouped, args.out, base=args.base, join_with=join_with)
    print(f"Saved combined JSON: {out_path.resolve()}" )

if __name__ == "__main__":
    main()
