import React, { useEffect, useState, useRef } from 'react';
import './index.css';
import llmService from './services/llmService';
import { getAuthHeader } from './services/apikey'
import noteData from "./data/note/FwOTs4UxQS4.json";
import audioPlaybackService from "./services/audioPlaybackService";

const MODEL = import.meta.env.VITE_STT_MODEL || 'whisper-1'
const LANGUAGE = import.meta.env.VITE_LANGUAGE || 'zh'
const TRANSCRIBE_URL = import.meta.env.VITE_TRANSCRIBE_URL

function pickSupportedMime() {
  const prefer = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4'
  ]
  for (const t of prefer) {
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t
  }
  return ''
}

const MessageBox = ({ isNormalMode = true, onClose, onStart, youtube_id }) => {
  const [message, setMessage] = useState("你好！我是你的桌面小助手🐱");
  const [running, setRunning] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 錄音相關狀態
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [latencyMs, setLatencyMs] = useState(null)
  const [error, setError] = useState('')
  // 音訊 chain refs
  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const inputRef = useRef(null);
  const messagesRef = useRef(null);
  // 直接綁定 API Key
  const userKey = ""; // REMOVED: Do not hardcode secrets. Use environment variables or secure storage.

  // 用 ref 記錄目前模擬的時間
  const simulatedTimeRef = useRef(0);

  // 關閉時，模擬將 time 推進到下一個 keyword 的時間
  const handleCloseClick = () => {
    if (!isNormalMode) {
      // 找到下一個 keyword
      const currentTime = simulatedTimeRef.current;
      const next = noteData.find(
        (item) => typeof item.time === "number" && item.time > currentTime
      );
      if (next) {
        simulatedTimeRef.current = next.time;
      }
    }
    if (window.electronAPI && window.electronAPI.closeMessageBox) {
      window.electronAPI.closeMessageBox();
    } else {
      window.close();
    }
    if (typeof onClose === "function") onClose();
  };

  const handleInformClick = () => {
    window.electronAPI.showInform();
  }

  const handleMouseEnter = () => {
    if (window.electronAPI && window.electronAPI.sendMessage) {
      window.electronAPI.sendMessage('mouse-enter-message');
    }
  };

  const handleMouseLeave = () => {
    if (window.electronAPI && window.electronAPI.sendMessage) {
      window.electronAPI.sendMessage('mouse-leave-message');
    }
  };

  async function startRecording() {
      setMessage("錄音中...");
      setError(''); setTranscript(''); audioChunksRef.current = []
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      mediaStreamRef.current = stream
      const mimeType = pickSupportedMime()
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mr
      mr.ondataavailable = ev => { if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      mr.start(50)
      setRecording(true)
  }
  async function stopRecording() {
      setMessage("辨識中...");
      const start = performance.now()
      setRecording(false)
      const mr = mediaRecorderRef.current; if (!mr) return
      await new Promise(res => { mr.onstop = () => res(); mr.stop() })
      mediaStreamRef.current?.getTracks().forEach(t => t.stop())
  
      // 直接合併 webm/ogg/mp4，避免前端 decode/轉碼
      const mimeType =  audioChunksRef.current[0]?.type || 'audio/webm'
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
      const filename =
        mimeType.includes('ogg') ? 'audio.ogg' :
        mimeType.includes('mp4') ? 'audio.mp4' : 'audio.webm'
  
      console.log('[debug] filename = ',filename, 'mimeType = ',mimeType,' size=', audioBlob.size)

      try {
        const fd = new FormData()
        fd.append('file', audioBlob, filename)
        fd.append('model', MODEL)
        fd.append('language', LANGUAGE)
  
        const r = await fetch(TRANSCRIBE_URL || 'https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: TRANSCRIBE_URL ? {} : { 'Authorization': await getAuthHeader(userKey) },
          body: fd
        })
        
        if (!r.ok) throw new Error('OpenAI/Relay error: ' + r.status + ' ' + (await r.text()))
        const json = await r.json()
        setTranscript(json.text ?? JSON.stringify(json))
        setLatencyMs(Math.round(performance.now() - start))
        setMessage("你說的是: " + (json.text ?? JSON.stringify(json)));
      } catch (e) {
        setError(e.message || String(e))
      }
    }

  const handleStartClick = () => {
    if (running) return;
    setRunning(true);

    if (typeof onStart === 'function') {
      try { onStart(); } catch (e) { console.warn(e); }
    }

    if (window.electronAPI) {
      if (window.electronAPI.startMessageBox) {
        window.electronAPI.startMessageBox();
      } else if (window.electronAPI.sendMessage) {
        window.electronAPI.sendMessage('start-message');
      }
    }
  };

  const sendMessage = async (message) => {
    if (window.electronAPI) {
      await window.electronAPI.showMessageBox(message);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const message = inputText.trim();
    setInputText('');
    setIsLoading(true);

    try {
      // 先顯示思考狀態
      await sendMessage('🤔 思考中...');

      // 使用 stream 功能逐字輸出
      await llmService.sendMessageStream(message, (chunk, fullResponse) => {
        // 每次接收到新的文字片段時更新 MessageBox
        sendMessage(fullResponse);
      });

    } catch (error) {
      console.error('發送訊息錯誤:', error);
      await sendMessage('❌ 錯誤: 無法獲取回應');
    } finally {
      setIsLoading(false);
    }
  }; 

  const handleKeyDown = (e) => {
    // Enter 發送，Shift+Enter 換行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    let cleanup = null;
    if (window.electronAPI && window.electronAPI.onMessageReceived) {
      cleanup = window.electronAPI.onMessageReceived((newMessage) => {
        setMessage(newMessage);
        setTimeout(() => {
          if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }, 0);
      });
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    if (!isNormalMode) {
      // 每次組件 mount 都執行
      const currentTime = simulatedTimeRef.current;
      const next = noteData.find(
        (item) => typeof item.time === "number" && item.time > currentTime
      );
      if (next) {
        setMessage(next.Keyword);
      } else {
        setMessage("（已無下一個關鍵字）");
      }
    }
    // eslint-disable-next-line
  }, []); // 只在 mount 時執行

  const lines = message.split('\n');

  if (!isNormalMode) {
    // 精簡模式：只顯示 message 和關閉按鈕
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <div className="message-box p-4 rounded-lg shadow-md relative flex flex-col"
          style={{ background: 'rgba(51, 51, 51, 0.75)', color: '#ffffff' }}>
          <button
            onClick={handleCloseClick}
            className="btn btn-xs btn-ghost text-white absolute right-3 top-3"
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Close"
          >
            ❌
          </button>
          <div className="text-base text-white leading-relaxed overflow-auto mb-3 flex-1 mt-5"
            style={{ maxHeight: '100%', whiteSpace: 'pre-wrap', textAlign: "center", fontSize: 24 }}>
            {message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <div className="h-full w-full avatar-no-drag">
        <div
          className="message-box p-4 rounded-lg shadow-md relative flex flex-col"
          style={{ background: 'rgba(51, 51, 51, 0.75)', color: '#ffffff' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Close：右上角 */}
          <button
            onClick={handleCloseClick}
            className="btn btn-xs btn-ghost text-white absolute right-3 top-3"
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Close"
          >
            ❌
          </button>
          <button
            onClick={() => handleInformClick()}
            className="btn btn-xs btn-ghost text-white absolute right-10 top-3"
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Help"
          >
            ❔
          </button>

          {/* 訊息顯示區（可滾動，撐滿上方空間） */}
          <div
            ref={messagesRef}
            className="text-base text-white leading-relaxed overflow-auto mb-3 flex-1 mt-5"
            style={{ maxHeight: '100%', whiteSpace: 'pre-wrap' }}
          >
            {lines.map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>

          {/* 最下面：🎙️、輸入框、✈️ 並排 */}
          <div className="mt-2 flex items-center gap-2">
            {/* 🎙️ Start 按鈕（左） */}
            <button
              onClick={async () => {
                if (!running) {
                  setRunning(true);
                  await startRecording();
                } else {
                  setRunning(false);
                  await stopRecording();
                }
              }}
              aria-pressed={running}
              title={running ? '停止錄音' : '開始錄音'}
              className={`btn btn-sm ${running ? 'btn-ghost' : 'btn-primary'} text-white px-2 py-1 min-h-0 h-auto`}
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              {running ? '🛑' : '🎙️'}
            </button>

            {/* 輸入框（中，伸縮） */}
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="對Avatar說..."
              className="flex-1 resize-none rounded-md p-3 text-sm text-gray-100 placeholder:text-gray-500"
              style={{
                background: 'rgba(20,20,20,0.5)',
                border: '1px solid rgba(255,255,255,0.06)',
                height: '32px',       // 固定高度，接近按鈕
                lineHeight: '18px',
                padding: '6px 12px',  // 小一點的內距，避免太高
                outline: 'none',
              }}
            />

            {/* ✈️ Send 按鈕（右） */}
            <button
              onClick={handleSend}
              className="btn btn-sm btn-primary text-white px-2 py-1 min-h-0 h-auto"
              style={{ WebkitAppRegion: 'no-drag' }}
              title="發送"
            >
              ✈️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBox;
