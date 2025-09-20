import time
import json
import re
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/api/v1",
    api_key="lemonade"  # 需要帶但不驗證
)

resp = client.chat.completions.create(
    model="user.Roleplay-Llama-3-8B-i1-GGUF",
    messages=[{"role": "user", "content": "什麼是不鏽鋼? 使用中文回答，不超過15字"}],
    stream=False
)

print(resp.choices[0].message.content)