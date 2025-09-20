import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import llmService from './services/llmService';
import { getAuthHeader } from './services/apikey';
import audioPlaybackService from './services/audioPlaybackService';

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

function App() {
  // ✅ 冷啟暖機：麥克風+編碼器先跑一下，之後再開始真正錄音
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = pickSupportedMime();
        const mr = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);

        // 微錄一段 300ms，確保產生 data
        mr.start(200);
        await new Promise(r => setTimeout(r, 300));
        if (mr.state === 'recording') {
          try { mr.requestData(); } catch {}
          mr.stop();
          await new Promise(r => (mr.onstop = () => r()));
        }
        s.getTracks().forEach(t => t.stop());
        if (mounted) console.debug('[warmup] primed');
      } catch (e) {
        console.debug('[warmup] skipped:', e?.message || e);
      }
    })();
    return () => { mounted = false; };
  }, []);
  const [avatarVisible, setAvatarVisible] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [llmConnected, setLlmConnected] = useState(false);
  
  // Tab Monitor 相關狀態
  const [tabsData, setTabsData] = useState(null);
  const [serverStatus, setServerStatus] = useState({ isRunning: false, port: 3000 });
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // speech to text
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [latencyMs, setLatencyMs] = useState(null)
  const [error, setError] = useState('')
  const [userKey, setUserKey] = useState('') // 僅在沒有代理端點時使用

  // 音檔播放相關狀態
  const [audioPlaybackEnabled, setAudioPlaybackEnabled] = useState(false);
  const [currentAudioContent, setCurrentAudioContent] = useState(null);
  const [audioPlaybackStatus, setAudioPlaybackStatus] = useState('停止');
  const [lastPlaybackMessage, setLastPlaybackMessage] = useState('');

  // 音訊 chain refs
  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  // Avatar 卡片資料
  const AvatarInfo = [
    {
      img: "avatar.jpg",
      title: "Avatar 選擇",
      personality: "傲嬌型",
      audioLabel: "(試聽音檔)"
    },
    {
      img: "avatar2.jpg",
      title: "Avatar 選擇",
      personality: "樂觀開朗",
      audioLabel: "(試聽音檔)"
    },
    {
      img: "avatar3.jpg",
      title: "Avatar 選擇",
      personality: "高冷型",
      audioLabel: "(試聽音檔)"
    },
    {
      img: "avatar4.jpg",
      title: "Avatar 選擇",
      personality: "???",
      audioLabel: "(試聽音檔)"
    }
  ];

  // const [Cardi, setCardI] = useState(0);
  // const Cardprev = useCallback(() => setCardI((p) => (p - 1 + AvatarInfo.length) % AvatarInfo.length), []);
  // const Cardnext = useCallback(() => setCardI((p) => (p + 1) % AvatarInfo.length), []);

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

    // enter 輸入音訊
    const onKeyDown = e => { if (e.key === 'Enter' && !recording) startRecording().catch(err => setError(err.message)) }
    const onKeyUp = e => { if (e.key === 'Enter' && recording) stopRecording().catch(err => setError(err.message)) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // 音檔播放事件監聽
    const handleAudioPlayback = (event) => {
      const { content } = event.detail;
      setCurrentAudioContent(content);
      setLastPlaybackMessage(`播放: ${content.message} (${content.emotion})`);
      setAudioPlaybackStatus('播放中');
    };

    const handleAutoplayBlocked = (event) => {
      const { content, message } = event.detail;
      setLastPlaybackMessage(`自動播放被阻止: ${message}`);
      setAudioPlaybackStatus('被阻止');
    };

    window.addEventListener('audioPlayback', handleAudioPlayback);
    window.addEventListener('autoplayBlocked', handleAutoplayBlocked);

    // 清理監聽器
    return () => {
      if (cleanupAvatar) {
        cleanupAvatar();
      }
      if (cleanupTabs) {
        cleanupTabs();
      }
      window.removeEventListener('keydown', onKeyDown); 
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('audioPlayback', handleAudioPlayback);
      window.removeEventListener('autoplayBlocked', handleAutoplayBlocked);
      
      // 停止音檔播放服務
      audioPlaybackService.stopPeriodicCheck();
      audioPlaybackService.stopCurrentAudio();
    };
  }, [recording]);

  // 切換懸浮 avatar 的顯示狀態
  const toggleAvatar = async () => {
    if (window.electronAPI) {
      const newState = !avatarVisible;
      await window.electronAPI.toggleAvatar(newState);
      setAvatarVisible(newState);
    }
  };

  // Avatar 圖片列表（可自動生成）
  const avatarImages = [
    '/avatar.jpg',
    '/avatar2.jpg',
    '/avatar3.jpg',
    '/avatar4.jpg',
  ];

  // 切換Avatar圖片
  const loadAvatar = async (img) => {
    if (window.electronAPI && avatarVisible) {
      await window.electronAPI.loadAvatar(img);
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

  // 音檔播放控制函數
  const toggleAudioPlayback = () => {
    if (audioPlaybackEnabled) {
      audioPlaybackService.stopPeriodicCheck();
      setAudioPlaybackStatus('已停止');
      setLastPlaybackMessage('');
    } else {
      audioPlaybackService.startPeriodicCheck(1000); // 每秒檢查一次
      setAudioPlaybackStatus('監聽中');
      setLastPlaybackMessage('開始監聽 YouTube 播放狀態...');
    }
    setAudioPlaybackEnabled(!audioPlaybackEnabled);
  };

  const manualCheckAudio = async () => {
    try {
      setAudioPlaybackStatus('手動檢查中...');
      // 檢查當前 YouTube 狀態並播放對應語音
      await audioPlaybackService.manualCheckAndPlay();
      setAudioPlaybackStatus('檢查完成');
    } catch (error) {
      setLastPlaybackMessage(`手動檢查錯誤: ${error.message}`);
      setAudioPlaybackStatus('檢查失敗');
    }
  };

  const stopCurrentAudio = () => {
    audioPlaybackService.stopCurrentAudio();
    setAudioPlaybackStatus('已停止播放');
  };

  // 開始錄音
  async function startRecording() {
    setError(''); setTranscript(''); audioChunksRef.current = []
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    mediaStreamRef.current = stream
    const mimeType = pickSupportedMime()
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = mr
    mr.ondataavailable = ev => { if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data) }
    mr.start(50) // 收小分片，縮短等待
    
    setRecording(true)
  }

  async function stopRecording() {
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
    // console.log('has showSaveFilePicker =', !!window.showSaveFilePicker);

    // 🔽🔽🔽 新增：停止錄音後立即下載音檔到本機
    //建立好 audioBlob 和 filename 之後
    // 取得 ArrayBuffer 丟給 main 寫檔
    // try {
    //   const buf = await audioBlob.arrayBuffer();
    //   const saveRes = await window.electronAPI.saveAudioFile(buf, filename, mimeType);
    //   if (!saveRes?.canceled) {
    //     // 可選：在你現有的 messageBox 彈個成功訊息
    //     await sendMessage?.(`✅ 已儲存音檔：${saveRes.filePath}`);
    //   }
    // } catch (e) {
    //   console.warn('儲存音檔失敗（將繼續轉寫）：', e);
    // }

    // 🔼🔼🔼 新增
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
    } catch (e) {
      setError(e.message || String(e))
    }
  }

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

        {/* 音檔播放控制卡片 */}
        <div className="card shadow-lg border border-secondary">
          <div className="card-body">
            <h2 className="card-title text-secondary mb-2">
              <span>🎵</span>
              語音播放控制
            </h2>
            <p className="text-base-content opacity-70 text-sm mb-4">
              自動檢查並播放與 YouTube 時間點對應的語音內容
            </p>
            
            {/* 播放狀態顯示 */}
            <div className="bg-base-100 rounded-lg p-4 border border-base-300 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">播放狀態:</span>
                <div className={`badge ${audioPlaybackEnabled ? 'badge-success' : 'badge-neutral'} gap-1`}>
                  <div className={`w-2 h-2 rounded-full ${audioPlaybackEnabled ? 'bg-base-100' : 'bg-base-content opacity-60'}`}></div>
                  {audioPlaybackStatus}
                </div>
              </div>
              {lastPlaybackMessage && (
                <div className="text-sm text-base-content opacity-70">
                  💬 {lastPlaybackMessage}
                </div>
              )}
            </div>

            {/* 當前播放內容 */}
            {currentAudioContent && (
              <div className="bg-base-100 rounded-lg p-4 border border-base-300 mb-4">
                <h3 className="font-semibold text-secondary mb-2">🎧 當前內容:</h3>
                <div className="space-y-1">
                  <div className="text-sm"><strong>訊息:</strong> {currentAudioContent.message}</div>
                  <div className="text-sm"><strong>情緒:</strong> {currentAudioContent.emotion}</div>
                  <div className="text-sm"><strong>時間點:</strong> {currentAudioContent.timestamp} 秒</div>
                  <div className="text-sm"><strong>影片ID:</strong> {currentAudioContent.video_id}</div>
                </div>
              </div>
            )}

            {/* 控制按鈕 */}
            <div className="flex gap-2 flex-wrap">
              <button 
                className={`btn ${audioPlaybackEnabled ? 'btn-error' : 'btn-success'}`}
                onClick={toggleAudioPlayback}
              >
                {audioPlaybackEnabled ? '⏸️ 停止監聽' : '▶️ 開始監聽'}
              </button>
              
              <button 
                className="btn btn-info"
                onClick={manualCheckAudio}
                disabled={audioPlaybackStatus === '手動檢查中...'}
              >
                🔍 手動測試
              </button>
              
              <button 
                className="btn btn-warning"
                onClick={stopCurrentAudio}
              >
                🔇 停止播放
              </button>
            </div>

            {/* 說明文字 */}
            <div className="mt-4 p-3 bg-base-200 rounded-lg">
              <div className="text-xs text-base-content opacity-70">
                <strong>使用說明:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• 點擊「開始監聽」後，系統每秒檢查是否有對應的語音內容</li>
                  <li>• 「手動測試」會播放測試音檔（時間點 60 秒）</li>
                  <li>• 確保 backend server 運行在 localhost:3000</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        {/* -------------------------------------------------------------------------------------- */}
        {/* 語音輸入提示卡 */}
        <div className="card shadow-lg border border-info">
          <div className="card-body">
            <h2 className="card-title text-info mb-2">
              Speech 2 text 區塊
            </h2>
            <p className="text-base-content opacity-70 text-sm mb-4">
              可以和Agent使用語音聊天
            </p>
            
            {!TRANSCRIBE_URL && (
            <div style={{ margin: '1rem 0', padding: '0.75rem', border: '1px solid #ddd', borderRadius: 8 }}>
              <strong>開發模式（未設代理端點）：</strong>
              <div>請貼上你的 OpenAI API Key（僅本機；正式環境請改用 Vercel Edge 代理）。</div>
              <input type="password" placeholder="sk-..." value={userKey} onChange={e => setUserKey(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} /> 
            </div>)}

            <button onMouseDown={() => !recording && startRecording()} onMouseUp={() => recording && stopRecording()}
                    disabled={recording} style={{ padding: '0.75rem 1.25rem', fontSize: '1.1rem', borderRadius: 12 }}>
              {recording ? '錄音中…放開停止' : '按住開始錄音（也可按 Enter）'}
            </button>

            {latencyMs !== null && <p>⏱️ 往返延遲：約 {latencyMs} ms</p>}
            {transcript && <div style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid #ddd', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>轉寫結果</div><div>{transcript}</div></div>}
            {error && <div style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid #f99', background: '#fff7f7', borderRadius: 8, color: '#900' }}>
            <div style={{ fontWeight: 600 }}>錯誤</div><div style={{ whiteSpace: 'pre-wrap' }}>{error}</div></div>}
          </div>
        </div>

        {/* -------------------------------------------------------------------------------------- */}
        {/* avatar 卡片*/}
        <div className="card shadow-lg border border-info">
          <div className="grid grid-cols-1 gap-0" >
            <div className="bg-base-100 rounded-lg ml-5 mr-5 mt-5">
              <div className="avatar m-3">
                <div className="mask mask-squircle w-24">
                  <img src={AvatarInfo[0].img} alt="Movie" />
                </div>
              </div>
              <div className="card-body">
                <h2 className="card-title">New movie is released!</h2>
                <p>Click the button to watch on Jetflix app.</p>
                <div className="card-actions justify-end">
                  <button
                    className="btn btn-primary"
                    onClick={() => loadAvatar(avatarImages[0])}
                  >
                    Avatar 1
                  </button>
                </div>
              </div>  
            </div>
            
            <div className="bg-base-100 rounded-lg ml-5 mr-5 mt-5">
              <div className="avatar m-3">
                <div className="mask mask-squircle w-24">
                  <img src={AvatarInfo[1].img} alt="Movie" />
                </div>
              </div>
              <div className="card-body">
                <h2 className="card-title">New movie is released!</h2>
                <p>Click the button to watch on Jetflix app.</p>
                <div className="card-actions justify-end">
                  <button
                    className="btn btn-primary"
                    onClick={() => loadAvatar(avatarImages[1])}
                  >
                    Avatar 2
                  </button>
                </div>
              </div>  
            </div>

            <div className="bg-base-100 rounded-lg m-5">
              <div className="avatar m-3">
                <div className="mask mask-squircle w-24">
                  <img src={AvatarInfo[2].img} alt="Movie" />
                </div>
              </div>
              <div className="card-body">
                <h2 className="card-title">New movie is released!</h2>
                <p>Click the button to watch on Jetflix app.</p>
                <div className="card-actions justify-end">
                  <button
                    className="btn btn-primary"
                    onClick={() => loadAvatar(avatarImages[2])}
                  >
                    Avatar 3
                  </button>
                </div>
              </div>  
            </div>


            <div className="bg-base-100 rounded-lg m-5">
              <div className="avatar m-3">
                <div className="mask mask-squircle w-24">
                  <img src={AvatarInfo[3].img} alt="Movie" />
                </div>
              </div>
              <div className="card-body">
                <h2 className="card-title">New movie is released!</h2>
                <p>Click the button to watch on Jetflix app.</p>
                <div className="card-actions justify-end">
                  <button
                    className="btn btn-primary"
                    onClick={() => loadAvatar(avatarImages[3])}
                  >
                    Avatar 4
                  </button>
                </div>
              </div>  
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
