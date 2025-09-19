import React, { useState, useEffect } from 'react';
import './index.css';
import llmService from './services/llmService';

function App() {
  const [avatarVisible, setAvatarVisible] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [llmConnected, setLlmConnected] = useState(false);
  
  // Tab Monitor 相關狀態
  const [tabsData, setTabsData] = useState(null);
  const [serverStatus, setServerStatus] = useState({ isRunning: false, port: 3000 });
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

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

    const checkServerStatus = async () => {
      if (window.electronAPI && window.electronAPI.getServerStatus) {
        const result = await window.electronAPI.getServerStatus();
        setServerStatus(result);
      }
    };

    const loadTabsData = async () => {
      if (window.electronAPI && window.electronAPI.getTabsData) {
        const result = await window.electronAPI.getTabsData();
        if (result.success && result.data) {
          setTabsData(result.data);
          setLastUpdateTime(new Date());
        }
      }
    };
    
    checkAvatarStatus();
    checkLLMConnection();
    checkServerStatus();
    loadTabsData();

    // 監聽 avatar 關閉事件
    let cleanupAvatar = null;
    if (window.electronAPI && window.electronAPI.onAvatarClosed) {
      cleanupAvatar = window.electronAPI.onAvatarClosed(() => {
        setAvatarVisible(false);
      });
    }

    // 監聽標籤頁更新事件
    let cleanupTabs = null;
    if (window.electronAPI && window.electronAPI.onTabsUpdated) {
      cleanupTabs = window.electronAPI.onTabsUpdated((data) => {
        setTabsData(data);
        setLastUpdateTime(new Date());
      });
    }

    // 清理監聽器
    return () => {
      if (cleanupAvatar) {
        cleanupAvatar();
      }
      if (cleanupTabs) {
        cleanupTabs();
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 懸浮 Avatar 控制卡片 */}
        <div className="card shadow-lg border border-primary">
          <div className="card-body">
            <h2 className="card-title text-primary mb-2">😻 影片小助手 Avatar</h2>
          <p className="text-base-content opacity-70 text-base mb-6">無論是追劇、看電影或是讀書，Avatar 都能成為你的最佳夥伴！</p>
          
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
                  onClick={() => setUserInput("我搞不清楚現在的劇情")}
                  disabled={isLoading}
                >
                  ☀️ 懶人包
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

        {/* Chrome 標籤頁監控卡片 */}
        <div className="card shadow-lg border border-info">
          <div className="card-body">
            <h2 className="card-title text-info mb-2">
              <span>🌐</span>
              Chrome 標籤頁監控
            </h2>
            <p className="text-base-content opacity-70 text-sm mb-4">
              即時監控 Chrome 瀏覽器的標籤頁資訊，需要安裝對應的 Chrome 擴充功能。
            </p>
            
            {/* 服務器狀態 */}
            <div className="bg-base-100 rounded-lg p-4 border border-base-300 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">監控服務狀態:</span>
                <div className={`badge ${serverStatus.isRunning ? 'badge-success' : 'badge-error'} gap-1`}>
                  <div className={`w-2 h-2 rounded-full ${serverStatus.isRunning ? 'bg-base-100' : 'bg-base-content opacity-60'}`}></div>
                  {serverStatus.isRunning ? '運行中' : '未運行'}
                </div>
              </div>
              <div className="text-xs text-base-content opacity-60">
                {serverStatus.isRunning ? `監聽端口: ${serverStatus.port}` : '服務未啟動'}
              </div>
            </div>

            {/* 標籤頁統計資訊 */}
            {tabsData && (
              <div className="bg-base-100 rounded-lg p-4 border border-base-300 mb-4">
                <h3 className="font-semibold text-info mb-3">📊 標籤頁統計:</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{tabsData.totalTabs}</div>
                    <div className="text-xs text-base-content opacity-70">總標籤頁</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {tabsData.tabs ? tabsData.tabs.filter(tab => tab.isActive).length : 0}
                    </div>
                    <div className="text-xs text-base-content opacity-70">活動標籤頁</div>
                  </div>
                </div>

                {/* 最後更新時間 */}
                <div className="text-xs text-base-content opacity-60 text-center mb-3">
                  {lastUpdateTime ? `最後更新: ${lastUpdateTime.toLocaleTimeString()}` : '尚未接收資料'}
                </div>

                {/* 活動標籤頁資訊 */}
                {tabsData.tabs && (() => {
                  const activeTab = tabsData.tabs.find(tab => tab.isActive);
                  return activeTab ? (
                    <div className="bg-success bg-opacity-10 rounded-lg p-3 border border-success border-opacity-30">
                      <div className="text-sm font-semibold text-success mb-1">🔍 當前活動標籤頁:</div>
                      <div className="text-sm text-base-content truncate" title={activeTab.title}>
                        {activeTab.title || 'Loading...'}
                      </div>
                      <div className="text-xs text-base-content opacity-60 truncate" title={activeTab.url}>
                        {activeTab.url || 'about:blank'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-base-content opacity-60 text-center">
                      沒有活動標籤頁
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 最近標籤頁列表 */}
            {tabsData && tabsData.tabs && tabsData.tabs.length > 0 && (
              <div className="bg-base-100 rounded-lg p-4 border border-base-300">
                <h3 className="font-semibold text-info mb-3">📑 最近標籤頁 (最多顯示5個):</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tabsData.tabs.slice(0, 5).map((tab, index) => (
                    <div key={tab.id} className={`p-2 rounded border-l-4 ${tab.isActive ? 'border-l-success bg-success bg-opacity-10' : 'border-l-base-300 bg-base-200'}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 text-xs text-base-content opacity-60">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" title={tab.title}>
                            {tab.title || 'Loading...'}
                          </div>
                          <div className="text-xs text-base-content opacity-60 truncate" title={tab.url}>
                            {tab.url || 'about:blank'}
                          </div>
                        </div>
                        {tab.isActive && (
                          <div className="badge badge-success badge-sm">活動</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 沒有資料時的提示 */}
            {!tabsData && serverStatus.isRunning && (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🔍</div>
                <div className="text-sm text-base-content opacity-70">等待 Chrome 擴充功能連接...</div>
                <div className="text-xs text-base-content opacity-50 mt-1">
                  請確認已安裝並啟用 Tab Monitor 擴充功能
                </div>
              </div>
            )}

            {/* 服務未運行時的提示 */}
            {!serverStatus.isRunning && (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">⚠️</div>
                <div className="text-sm text-warning">監控服務未運行</div>
                <div className="text-xs text-base-content opacity-50 mt-1">
                  請重新啟動應用程式
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
