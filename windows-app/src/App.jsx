import React, { useState, useEffect } from 'react';
import './index.css';
import llmService from './services/llmService';

function App() {
  const [avatarVisible, setAvatarVisible] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [llmConnected, setLlmConnected] = useState(false);

  // 檢查懸浮 avatar 的狀態和 LLM 連線狀態
  useEffect(() => {
    const checkAvatarStatus = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.isAvatarVisible();
        setAvatarVisible(result.visible);
      }
    };

    const checkLLMConnection = async () => {
      const isConnected = await llmService.checkConnection();
      setLlmConnected(isConnected);
    };
    
    checkAvatarStatus();
    checkLLMConnection();

    // 監聽 avatar 關閉事件
    let cleanup = null;
    if (window.electronAPI && window.electronAPI.onAvatarClosed) {
      cleanup = window.electronAPI.onAvatarClosed(() => {
        setAvatarVisible(false);
      });
    }

    // 清理監聽器
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  // 切換懸浮 avatar 的顯示狀態
  const toggleAvatar = async () => {
    if (window.electronAPI) {
      const newState = !avatarVisible;
      await window.electronAPI.toggleAvatar(newState);
      setAvatarVisible(newState);
    }
  };

  // 發送訊息到 MessageBox
  const sendMessage = async (message) => {
    if (window.electronAPI) {
      await window.electronAPI.showMessageBox(message);
    }
  };

  // 處理使用者輸入並與 LLM 對話
  const handleSendUserMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const message = userInput.trim();
    setUserInput('');
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

  // 處理 Enter 鍵發送
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendUserMessage();
    }
  };

  // 清除對話歷史
  const clearConversation = () => {
    llmService.clearHistory();
    sendMessage("對話歷史已清除 🗑️\n可以開始新的對話了！");
  };

  // 顯示對話歷史
  const showConversationHistory = () => {
    const history = llmService.getHistory();
    const historyText = history
      .filter(msg => msg.role !== 'system')
      .map(msg => {
        const role = msg.role === 'user' ? '👤 你' : '🤖 Avatar';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');
    
    if (historyText) {
      sendMessage(`📚 對話歷史:\n\n${historyText}`);
    } else {
      sendMessage("📚 目前沒有對話歷史");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="card shadow-lg border border-primary">
        <div className="card-body">
          <h2 className="card-title text-primary mb-2">懸浮 Avatar 控制</h2>
          <p className="text-base-content opacity-70 text-sm mb-6">你可以啟用一個可拖動的懸浮 Avatar，它會置頂顯示並支持拖動功能。</p>
          
          <div className="flex items-center gap-4 mb-6">
            <button 
              className={`btn gap-2 ${avatarVisible ? 'btn-error' : 'btn-primary'}`}
              onClick={toggleAvatar}
            >
              <span>🐱</span>
              {avatarVisible ? '隱藏 Avatar' : '顯示 Avatar'}
            </button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-content opacity-70">狀態:</span>
              <div className={`badge ${avatarVisible ? 'badge-success' : 'badge-neutral'} gap-1`}>
                <div className={`w-2 h-2 rounded-full ${avatarVisible ? 'bg-base-100' : 'bg-base-content opacity-60'}`}></div>
                {avatarVisible ? '已啟用' : '已停用'}
              </div>
            </div>
          </div>

          {/* LLM 連線狀態顯示 */}
          <div className="bg-base-100 rounded-lg p-4 border border-base-300 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold">LLM 服務狀態:</span>
              <div className={`badge ${llmConnected ? 'badge-success' : 'badge-error'} gap-1`}>
                <div className={`w-2 h-2 rounded-full ${llmConnected ? 'bg-base-100' : 'bg-base-content opacity-60'}`}></div>
                {llmConnected ? '已連線' : '未連線'}
              </div>
            </div>
            {!llmConnected && (
              <div className="text-sm text-warning">
                ⚠️ 請確認本地 LLM server 運行於 localhost:8000
              </div>
            )}
          </div>

          {/* 對話輸入區域 */}
          {avatarVisible && (
            <div className="bg-base-100 rounded-lg p-4 border border-base-300 mb-4">
              <h3 className="font-semibold text-primary mb-3">💬 與 Avatar 對話:</h3>
              
              {/* 文字輸入區 */}
              <div className="flex gap-2 mb-3">
                <textarea
                  className="textarea textarea-bordered flex-1 resize-none"
                  placeholder="輸入你想對 Avatar 說的話..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  rows={2}
                  disabled={isLoading || !llmConnected}
                />
                <button 
                  className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
                  onClick={handleSendUserMessage}
                  disabled={!userInput.trim() || isLoading || !llmConnected}
                >
                  {isLoading ? '思考中...' : '發送'}
                </button>
              </div>

              {/* 快捷按鈕 */}
              <div className="flex gap-2 flex-wrap mb-3">
                <button 
                  className="btn btn-sm btn-outline btn-primary"
                  onClick={() => setUserInput("你好，請介紹一下自己")}
                  disabled={isLoading}
                >
                  👋 打招呼
                </button>
                <button 
                  className="btn btn-sm btn-outline btn-info"
                  onClick={() => setUserInput("今天天氣怎麼樣？")}
                  disabled={isLoading}
                >
                  ☀️ 聊天氣
                </button>
                <button 
                  className="btn btn-sm btn-outline btn-warning"
                  onClick={() => setUserInput("給我一些健康小提醒")}
                  disabled={isLoading}
                >
                  💡 健康提醒
                </button>
              </div>

              {/* 對話控制按鈕 */}
              <div className="flex gap-2 justify-end">
                <button 
                  className="btn btn-sm btn-outline btn-info"
                  onClick={showConversationHistory}
                  disabled={isLoading}
                >
                  📚 查看歷史
                </button>
                <button 
                  className="btn btn-sm btn-outline btn-error"
                  onClick={clearConversation}
                  disabled={isLoading}
                >
                  🗑️ 清除對話
                </button>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}

export default App;
