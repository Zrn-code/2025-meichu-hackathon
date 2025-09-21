import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import llmService from './services/llmService';
import { getAuthHeader } from './services/apikey';
import audioPlaybackService from './services/audioPlaybackService';

import VideoStats from './VideoStats.jsx';
import Note from "./Note.jsx";

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

  // 影片展示相關狀態
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

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

  // Youyube 卡片資料
  const YoutubeInfo = [
    {
      id: 1,
      img: "youtubeCover/cover1.jpg",
      metadata: "youtubeCover/cover1.json",
      title: "電機系要燃燒新鮮的肝？高中成績最重要？要提早修物理？｜大學校系圖鑑 EP 1",
      view_count: 116562,
      like_count: 2002,
      upload_date: "2023-12-01T00:00:00Z",
      tags: ["台大", "電機系", "大學", "教育", "學習歷程"],
      url: "https://www.youtube.com/watch?v=Ia7MUrAk99o"
    },
    {
      id: 2,
      img: "youtubeCover/cover2.jpg",
      metadata: "youtubeCover/cover2.json",
      title: "AI Agents, Clearly Explained",
      view_count: 2915965,
      like_count: 77844,
      upload_date: "2025-04-08T00:00:00Z",
      tags: ["AI", "AI Agents", "教育", "科技", "人工智慧"],
      url: "https://www.youtube.com/watch?v=FwOTs4UxQS4"
    },
    {
      id: 3,
      img: "youtubeCover/cover3.jpg",
      metadata: "youtubeCover/cover3.json",
      title: "AI PC Revolution: The AMD Ryzen™ AI Architectural Advantage",
      view_count: 825060,
      like_count: 853,
      upload_date: "2024-03-19T00:00:00Z",
      tags: ["AMD", "AI", "處理器", "科技", "人工智慧"],
      url: "https://www.youtube.com/watch?v=UwxqlftCLOo"
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

    // 自動啟用語音播放檢查服務
    console.log('[App] 自動啟用語音播放監聽服務');
    setAudioPlaybackEnabled(true);
    setAudioPlaybackStatus('監聽中');
    setLastPlaybackMessage('自動開始監聽 YouTube 播放狀態...');

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

    // 監聽 notebook 更新事件

    // enter 輸入音訊
    const onKeyDown = e => { if (e.key === 'Enter' && !recording) startRecording().catch(err => setError(err.message)) }
    const onKeyUp = e => { if (e.key === 'Enter' && recording) stopRecording().catch(err => setError(err.message)) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // 音檔播放事件監聽
    const handleAudioPlayback = (event) => {
      const { content } = event.detail;
      setCurrentAudioContent(content);
      setLastPlaybackMessage(`播放: ${content.message}`);
      setAudioPlaybackStatus('播放中');
    };

    const handleAutoplayBlocked = (event) => {
      const { content, message } = event.detail;
      setLastPlaybackMessage(`自動播放被阻止: ${message}`);
      setAudioPlaybackStatus('被阻止');
    };

    window.addEventListener('audioPlayback', handleAudioPlayback);
    window.addEventListener('autoplayBlocked', handleAutoplayBlocked);

    // 監聽 MessageBox 顯示事件
    const handleShowMessageBox = (event) => {
      const { message } = event.detail;
      console.log(`[App] 收到 MessageBox 顯示請求: "${message}"`);
      sendMessage(`${message}`);
    };

    window.addEventListener('showMessageBox', handleShowMessageBox);

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
      window.removeEventListener('showMessageBox', handleShowMessageBox);
      
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

  // 切換當前影片的函數
  const switchToVideo = (videoIndex) => {
    setCurrentVideoIndex(videoIndex);
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
    <div className="p-6 max-w-none mx-auto w-full">
      <div className="grid grid-cols-12 gap-6">
        {/* lg:grid-cols-2  */}
        
        {/* 懸浮 Avatar 控制卡片 */}
        <div className="col-span-4 card shadow-lg border border-primary">
          <div className="card-body">
            <div className="flex items-center justify-between mb-2">
              <h2 className="card-title text-primary">😻 影片小助手 Avatar</h2>
              <div className="flex items-center gap-3">
                <button 
                  className={`btn btn-sm gap-2 ${avatarVisible ? 'btn-error' : 'btn-primary'}`}
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
            </div>
            <p className="text-base-content opacity-70 text-base mb-4">無論是追劇、或讀書，Avatar 都能成為你的最佳夥伴！</p>
              <Note />
          </div>
        </div>

        {/* -------------------------------------------------------------------------------------- */}
        {/* avatar 卡片*/}
        <div className="col-span-4 card shadow-lg border border-info">
          <div className="card-body">
            <h2 className="card-title text-info mb-4">🎭 Avatar 選擇</h2>
            <div className="space-y-4">
              {/* Avatar 1 - 章魚哥 */}
              <div className="flex items-center gap-4 p-4 bg-base-100 rounded-lg border border-base-300">
                <div className="avatar">
                  <div className="mask mask-squircle w-20">
                    <img src={AvatarInfo[0].img} alt="章魚哥" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base">🐙 章魚哥</h3>
                    <div className="badge badge-success badge-xs">陪伴型</div>
                  </div>
                  <p className="text-sm opacity-70">冷靜理性的音樂家</p>
                  <audio controls className="mt-2 w-full" style={{ height: '30px' }}>
                    <source src="/voice_wav/avatar1.mp3" type="audio/mpeg" />
                    您的瀏覽器不支援音頻播放
                  </audio>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => loadAvatar(avatarImages[0])}
                >
                  選擇
                </button>
              </div>

              {/* 黑客松活動敘述框 */}
              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-4 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🎉</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-primary mb-2">黑客松活動真的讚</h4>
                    <audio controls className="w-full" style={{ height: '32px' }}>
                      <source src="/voice_wav/avatar1r.wav" type="audio/mpeg" />
                      您的瀏覽器不支援音頻播放
                    </audio>
                  </div>
                </div>
              </div>

              {/* Avatar 2 - 派大星 */}
              <div className="flex items-center gap-4 p-4 bg-base-100 rounded-lg border border-base-300">
                <div className="avatar">
                  <div className="mask mask-squircle w-20">
                    <img src={AvatarInfo[1].img} alt="派大星" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base">⭐ 派大星</h3>
                    <div className="badge badge-success badge-xs">陪伴型</div>
                  </div>
                  <p className="text-sm opacity-70">樂觀開朗的好朋友</p>
                  <audio 
                    controls 
                    className="mt-2 w-full" 
                    style={{ height: '30px' }}
                    volume={1.0}
                    ref={(audioRef) => {
                      if (audioRef) {
                        audioRef.volume = 1.0; // 設定為最大音量
                      }
                    }}
                  >
                    <source src="/voice_wav/avatar2.mp3" type="audio/mpeg" />
                    您的瀏覽器不支援音頻播放
                  </audio>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => loadAvatar(avatarImages[1])}
                >
                  選擇
                </button>
              </div>
              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-4 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🎉</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-primary mb-2">AMD 產品好處多多</h4>
                    <audio controls className="w-full" style={{ height: '32px' }}>
                      <source src="/voice_wav/avatar2r.wav" type="audio/mpeg" />
                      您的瀏覽器不支援音頻播放
                    </audio>
                  </div>
                </div>
              </div>

            

              {/* Avatar 4 - 老師 */}
              <div className="flex items-center gap-4 p-4 bg-base-100 rounded-lg border border-base-300">
                <div className="avatar">
                  <div className="mask mask-squircle w-20">
                    <img src={AvatarInfo[3].img} alt="老師" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base">👩‍🏫 老師</h3>
                    <div className="badge badge-primary badge-xs">學習型</div>
                  </div>
                  <p className="text-sm opacity-70">知識淵博的教育者</p>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => loadAvatar(avatarImages[3])}
                >
                  選擇
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------------------------------- */}
        {/* YouTube 影片展示 */}
        <div className="col-span-4 card shadow-lg border border-info">
          <div className="card-body">
            <h2 className="card-title text-info mb-4">🎬 影片展示</h2>
            <div className="space-y-3">
              {/* 主要影片 */}
              <div className="bg-base-100 rounded-lg p-3 border border-base-300">
                <div className="aspect-video bg-base-200 rounded-lg mb-3 overflow-hidden">
                  <img
                    src={YoutubeInfo[currentVideoIndex].img}
                    alt="YouTube Video"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                  {YoutubeInfo[currentVideoIndex].title}
                </h3>
                <VideoStats 
                  view_count={YoutubeInfo[currentVideoIndex].view_count} 
                  like_count={YoutubeInfo[currentVideoIndex].like_count} 
                  upload_date={YoutubeInfo[currentVideoIndex].upload_date} 
                />
                <div className="flex gap-1 mt-2 flex-wrap">
                  {YoutubeInfo[currentVideoIndex].tags.map((tag, index) => (
                    <div key={index} className={`badge badge-${index % 3 === 0 ? 'primary' : index % 3 === 1 ? 'secondary' : 'accent'} badge-sm`}>
                      {tag}
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-sm btn-primary mt-3 w-full"
                  onClick={() => window.electronAPI?.openExternalUrl?.(YoutubeInfo[currentVideoIndex].url)}
                >
                  🔗 觀看影片
                </button>
              </div>

              {/* 推薦影片列表 */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold opacity-70">📺 推薦影片</h4>
                
                {YoutubeInfo.filter((_, index) => index !== currentVideoIndex).map((video, index) => {
                  const originalIndex = YoutubeInfo.findIndex(v => v.id === video.id);
                  return (
                    <div 
                      key={video.id}
                      className="flex gap-3 p-2 bg-base-100 rounded-lg border border-base-300 cursor-pointer hover:bg-base-200 transition-colors"
                      onClick={() => switchToVideo(originalIndex)}
                    >
                      <div className="w-16 h-12 bg-base-200 rounded flex-shrink-0 overflow-hidden">
                        <img
                          src={video.img}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium line-clamp-2">{video.title}</p>
                        <p className="text-xs opacity-60">
                          {(video.view_count / 1000000).toFixed(1)}M 次觀看
                        </p>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
