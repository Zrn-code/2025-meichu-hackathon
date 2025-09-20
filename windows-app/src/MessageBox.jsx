import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import llmService from './services/llmService';

const MessageBox = ({ onStart, onSend }) => {
  const [message, setMessage] = useState("你好！我是你的桌面小助手🐱");
  const [running, setRunning] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);

  const handleCloseClick = () => {
    if (window.electronAPI && window.electronAPI.closeMessageBox) {
      window.electronAPI.closeMessageBox();
    } else {
      window.close();
    }
  };

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

    setMessage(prev => prev + "\n\n已啟動。");
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

  const lines = message.split('\n');

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

          {/* 訊息顯示區（可滾動，撐滿上方空間） */}
          <div
            ref={messagesRef}
            className="text-base text-white leading-relaxed overflow-auto mb-3 flex-1"
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
              onClick={handleStartClick}
              disabled={running}
              aria-pressed={running}
              title={running ? '已啟動' : '開始'}
              className={`btn btn-sm ${running ? 'btn-disabled' : 'btn-primary'} text-white px-2 py-1 min-h-0 h-auto`}
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              {running ? 'Running…' : '🎙️'}
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
