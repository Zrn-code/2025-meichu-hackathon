from flask import Flask, request, jsonify
import datetime
import os
import wave
import logging
import requests
import threading
from typing import Dict, Any
import sys
import random

# Add the indextts module to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'indextts'))

# Import IndexTTS2 
from indextts.infer_v2 import IndexTTS2

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# 確保輸出目錄存在
OUTPUT_DIR = "generated_audio"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 配置
BACKEND_SERVER_CALLBACK_URL = "http://localhost:3000/api/voice_generation_complete"

# IndexTTS2 配置
CONFIG_PATH = "checkpoints/config.yaml"
MODEL_DIR = "checkpoints"
VOICE_SAMPLES_DIR = "examples"

# 全局 IndexTTS2 實例
tts_model = None

def initialize_tts_model():
    """
    初始化 IndexTTS2 模型
    """
    global tts_model
    try:
        if tts_model is None:
            logging.info("正在初始化 IndexTTS2 模型...")
            tts_model = IndexTTS2(
                cfg_path=CONFIG_PATH,
                model_dir=MODEL_DIR,
                use_fp16=False,
                use_cuda_kernel=False
            )
            logging.info("IndexTTS2 模型初始化完成")
        return tts_model
    except Exception as e:
        logging.error(f"初始化 IndexTTS2 模型失敗: {e}")
        raise

def get_voice_sample_by_emotion(emotion: str) -> str:
    """
    根據情緒選擇相應的語音樣本
    """
    emotion_voice_map = {
        'happy': ['voice_01.wav', 'voice_02.wav'],
        'sad': ['emo_sad.wav', 'voice_03.wav'],
        'angry': ['emo_hate.wav', 'voice_04.wav'],
        'neutral': ['voice_05.wav', 'voice_06.wav'],
        'excited': ['voice_07.wav', 'voice_08.wav'],
        'calm': ['voice_09.wav', 'voice_10.wav']
    }
    
    # 如果情緒不在映射中，使用默認語音
    available_voices = emotion_voice_map.get(emotion.lower(), ['voice_01.wav'])
    selected_voice = random.choice(available_voices)
    
    voice_path = os.path.join(VOICE_SAMPLES_DIR, selected_voice)
    
    # 如果指定的語音檔案不存在，使用默認語音
    if not os.path.exists(voice_path):
        voice_path = os.path.join(VOICE_SAMPLES_DIR, 'voice_01.wav')
    
    return voice_path

def generate_voice_file(log_data: Dict[str, Any]) -> str:
    """
    使用 IndexTTS2 生成語音檔案
    """
    try:
        timestamp = log_data['timestamp']
        video_id = log_data['video_id']
        logs_id = log_data['logs_id']
        message = log_data['message']
        emotion = log_data.get('emotion', 'neutral')
        
        logging.info(f"開始生成語音檔案: {logs_id}, 文本: {message[:50]}...")
        
        # 初始化 TTS 模型
        tts = initialize_tts_model()
        
        # 創建檔案名稱：video_id_logs_id_timestamp.wav
        current_time = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{video_id}_{logs_id}_{timestamp}_{current_time}.wav"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        # 根據情緒選擇語音樣本
        spk_audio_prompt = get_voice_sample_by_emotion(emotion)
        logging.info(f"使用語音樣本: {spk_audio_prompt}, 情緒: {emotion}")
        
        # 使用 IndexTTS2 生成語音
        result = tts.infer(
            spk_audio_prompt=spk_audio_prompt,
            text=message,
            output_path=filepath,
            emo_audio_prompt=None,  # 使用說話人音頻作為情緒參考
            emo_alpha=1.0,
            use_emo_text=True,  # 從文本中提取情緒
            emo_text=message,   # 使用消息文本進行情緒分析
            interval_silence=200,
            max_text_tokens_per_segment=120,
            verbose=False
        )
        
        logging.info(f"語音檔案生成完成: {filename}")
        
        return filepath
        
    except Exception as e:
        logging.error(f"生成語音檔案時發生錯誤: {e}")
        raise

def notify_backend_server(log_data: Dict[str, Any], filepath: str, success: bool, error_message: str = None):
    """
    向 backend server 回報生成完成狀態
    """
    try:
        callback_data = {
            "logs_id": log_data.get('logs_id'),
            "video_id": log_data.get('video_id'),
            "success": success,
            "filepath": filepath if success else None,
            "filename": os.path.basename(filepath) if success and filepath else None,
            "error_message": error_message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
        response = requests.post(
            BACKEND_SERVER_CALLBACK_URL,
            json=callback_data,
            timeout=10
        )
        
        if response.status_code == 200:
            logging.info(f"成功回報給 backend server: {log_data.get('logs_id')}")
        else:
            logging.warning(f"回報 backend server 失敗: {response.status_code}")
            
    except Exception as e:
        logging.error(f"回報 backend server 時發生錯誤: {e}")

def process_voice_generation_async(log_data: Dict[str, Any]):
    """
    異步處理語音生成
    """
    filepath = None
    success = False
    error_message = None
    
    try:
        # 檢查文本是否為空
        message = log_data.get('message', '').strip()
        if not message:
            raise ValueError("消息文本不能為空")
        
        # 檢查必要檔案是否存在
        if not os.path.exists(CONFIG_PATH):
            raise FileNotFoundError(f"配置檔案不存在: {CONFIG_PATH}")
        
        if not os.path.exists(MODEL_DIR):
            raise FileNotFoundError(f"模型目錄不存在: {MODEL_DIR}")
        
        if not os.path.exists(VOICE_SAMPLES_DIR):
            raise FileNotFoundError(f"語音樣本目錄不存在: {VOICE_SAMPLES_DIR}")
        
        filepath = generate_voice_file(log_data)
        success = True
        
    except FileNotFoundError as e:
        success = False
        error_message = f"檔案或目錄不存在: {str(e)}"
        logging.error(f"檔案錯誤: {e}")
        
    except ValueError as e:
        success = False
        error_message = f"輸入驗證錯誤: {str(e)}"
        logging.error(f"輸入錯誤: {e}")
        
    except Exception as e:
        success = False
        error_message = f"語音生成失敗: {str(e)}"
        logging.error(f"語音生成失敗: {e}")
        
    finally:
        # 回報給 backend server
        notify_backend_server(log_data, filepath, success, error_message)

@app.route('/api/generate_voice', methods=['POST'])
def generate_voice():
    """
    接收 log 數據並開始語音生成
    """
    try:
        log_data = request.get_json()
        
        # 驗證必要欄位
        required_fields = ['timestamp', 'emotion', 'message', 'video_id', 'logs_id']
        for field in required_fields:
            if field not in log_data:
                return jsonify({'error': f'缺少必要欄位: {field}'}), 400
        
        logging.info(f"收到語音生成請求: {log_data['logs_id']}")
        
        # 啟動異步處理
        thread = threading.Thread(
            target=process_voice_generation_async,
            args=(log_data,),
            daemon=True
        )
        thread.start()
        
        return jsonify({
            'message': '語音生成已開始',
            'logs_id': log_data['logs_id'],
            'estimated_duration': '至少 10 秒'
        }), 202  # 202 Accepted
        
    except Exception as e:
        logging.error(f"處理語音生成請求時發生錯誤: {e}")
        return jsonify({'error': '內部服務器錯誤'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    健康檢查端點
    """
    return jsonify({
        'status': 'healthy',
        'service': 'voice-generation-server',
        'output_directory': OUTPUT_DIR
    }), 200

@app.route('/api/files', methods=['GET'])
def list_generated_files():
    """
    列出已生成的語音檔案
    """
    try:
        files = []
        if os.path.exists(OUTPUT_DIR):
            for filename in os.listdir(OUTPUT_DIR):
                if filename.endswith('.wav'):
                    filepath = os.path.join(OUTPUT_DIR, filename)
                    stat = os.stat(filepath)
                    files.append({
                        'filename': filename,
                        'size': stat.st_size,
                        'created': datetime.datetime.fromtimestamp(stat.st_ctime).isoformat()
                    })
        
        return jsonify({
            'files': files,
            'count': len(files)
        }), 200
        
    except Exception as e:
        logging.error(f"列出檔案時發生錯誤: {e}")
        return jsonify({'error': '無法列出檔案'}), 500

if __name__ == '__main__':
    logging.info("啟動語音生成服務器...")
    
    # 預先初始化 IndexTTS2 模型
    try:
        logging.info("預先加載 IndexTTS2 模型...")
        initialize_tts_model()
        logging.info("模型預加載完成")
    except Exception as e:
        logging.warning(f"模型預加載失敗，將在首次使用時加載: {e}")
    
    app.run(host='0.0.0.0', port=5001, debug=True)
