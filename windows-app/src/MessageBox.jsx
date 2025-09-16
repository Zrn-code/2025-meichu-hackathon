import React, { useState, useEffect } from 'react';
import './index.css';
const MessageBox = () => {
  const [message, setMessage] = useState("你好！我是你的桌面小助手 🐱\n拖動我到任何地方吧～");

  const handleCloseClick = () => {
    if (window.electronAPI) {
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

  // 監聽來自主程序的訊息
  useEffect(() => {
    let cleanup = null;
    if (window.electronAPI && window.electronAPI.onMessageReceived) {
      cleanup = window.electronAPI.onMessageReceived((newMessage) => {
        setMessage(newMessage);
      });
    }

    // 清理監聽器
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <div className="h-full w-full avatar-no-drag">
        <div 
          className="bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-white/20"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="text-lg text-gray-700 leading-relaxed overflow-hidden max-h-64 overflow-y-auto">
            {message.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index < message.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button 
              className="btn btn-error px-2 py-1 min-h-0 h-auto"
              onClick={handleCloseClick}
            >
              關閉
            </button>
          </div>
        </div>
    
      </div>
    </div>
  );
};

export default MessageBox;