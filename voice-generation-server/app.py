from flask import Flask, request, jsonify
import datetime
import os
import wave
import logging
import requests
import threading
from typing import Dict, Any

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# 確保輸出目錄存在
OUTPUT_DIR = "generated_audio"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 配置
BACKEND_SERVER_CALLBACK_URL = "http://localhost:3000/api/voice_generation_complete"

def generate_voice_file(log_data: Dict[str, Any]) -> str:
    """
    生成空的 WAV 檔案
    """
    try:
        timestamp = log_data['timestamp']
        video_id = log_data['video_id']
        logs_id = log_data['logs_id']
        
        logging.info(f"開始生成語音檔案: {logs_id}")
        
        # 創建檔案名稱：video_id_logs_id_timestamp.wav
        current_time = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{video_id}_{logs_id}_{timestamp}_{current_time}.wav"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        # 生成空的音頻數據 (3秒的靜音)
        sample_rate = 44100
        duration = 3  # 3秒
        
        # 創建靜音音頻數據 (全為0的16位整數)
        num_samples = int(sample_rate * duration)
        audio_data = bytes([0, 0] * num_samples)  # 每個樣本 2 bytes (16-bit)
        
        # 寫入 WAV 檔案
        with wave.open(filepath, 'wb') as wav_file:
            wav_file.setnchannels(1)  # 單聲道
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_data)
        
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
        filepath = generate_voice_file(log_data)
        success = True
    except Exception as e:
        success = False
        error_message = str(e)
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
    app.run(host='0.0.0.0', port=5001, debug=True)
