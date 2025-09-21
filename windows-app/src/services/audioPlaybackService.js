/**
 * 語音播放服務
 * 負責與 backend API 通信，檢查並播放語音內容
 */

class AudioPlaybackService {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.isChecking = false;
    this.checkInterval = null;
    this.lastPlayedLogId = null;
    this.currentAudio = null;
    this.replyIndex = 0; // 追蹤當前 reply 索引
    this.currentVideoId = null; // 追蹤當前影片 ID
    
    // 自動啟動檢查（延遲 2 秒讓應用程式完全載入）
    setTimeout(() => {
      this.startPeriodicCheck(1000);
      console.log('[AudioPlayback] 🚀 自動啟動語音播放檢查服務 (每秒檢查一次)');
    }, 2000);
  }

  /**
   * 開始定時檢查是否需要播放語音
   * @param {number} intervalMs - 檢查間隔（毫秒），預設 1000ms
   */
  startPeriodicCheck(intervalMs = 1000) {
    if (this.checkInterval) {
      this.stopPeriodicCheck();
    }

    console.log(`[AudioPlayback] ▶️ 開始定時檢查語音播放 (間隔: ${intervalMs}ms)`);
    this.isChecking = true;
    
    // 立即執行一次檢查
    this.checkAndPlayAudio();
    
    // 然後設定定時器
    this.checkInterval = setInterval(() => {
      this.checkAndPlayAudio();
    }, intervalMs);
  }

  /**
   * 停止定時檢查
   */
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.isChecking = false;
      console.log('[AudioPlayback] 停止定時檢查');
    }
  }

  /**
   * 檢查並播放語音（基於後端 YouTube 資料）
   */
  async checkAndPlayAudio() {
    try {
      // 呼叫 check-playback API（不再需要傳遞參數，後端會自動從 YouTube 資料獲取）
      const response = await this.fetchCheckPlayback();
      
      // 只在有新內容時才記錄詳細資訊
      if (response.success && response.content && response.content.file_path) {
        const content = response.content;
        
        // 檢查是否是新內容（避免重複播放）
        if (content.file_path !== this.lastPlayedLogId) {
          console.log(`[AudioPlayback] 🎵 播放新語音: "${content.message}"`);
          
          // 先觸發 MessageBox 顯示事件
          this.dispatchMessageBoxEvent(content);
          console.log('[AudioPlayback] 觸發 MessageBox 顯示事件');
          
          // 在播放音檔前顯示對應的 reply
          await this.showReplyMessage();
          
          // await this.playAudio(content);
          this.lastPlayedLogId = content.file_path;
          
          // 觸發自定義事件，讓其他組件知道有新語音播放
          this.dispatchPlaybackEvent(content);
        }
      } else if (!response.success) {
        // 只在錯誤時記錄
        console.warn(`[AudioPlayback] ⚠️ API 回應錯誤: ${response.error}`);
      }
      // 沒有內容時不記錄，避免過多日誌
    } catch (error) {
      // 區分連接錯誤和其他錯誤
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        console.warn('[AudioPlayback] 🔗 後端連接失敗，將繼續重試...');
      } else {
        console.error('[AudioPlayback] ❌ 檢查播放時發生錯誤:', error);
      }
    }
  }

  /**
   * 呼叫 check-playback API（後端會自動從 YouTube 資料獲取時間和影片ID）
   * @returns {Promise<Object>} API 回應
   */
  async fetchCheckPlayback() {
    const url = `${this.baseUrl}/api/check-playback`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API 錯誤: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 播放音檔
   * @param {Object} content - 包含音檔資訊的內容物件
   */
  async playAudio(content) {
    try {
      // 停止之前的音檔
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      if (!content.file_path) {
        console.warn('[AudioPlayback] 沒有可用的音檔路徑');
        return;
      }

      // 構建音檔 URL (使用 public 資料夾中的檔案)
      const audio_url = `/voice_wav/${content.file_path}`;

      console.log(`[AudioPlayback] 準備播放音檔: ${audio_url}`);
      console.log(`[AudioPlayback] 內容: "${content.message}"`);
      
      // 創建新的 Audio 物件
      this.currentAudio = new Audio(audio_url);
      
      // 預載音檔以提高播放成功率
      this.currentAudio.preload = 'auto';
      
      // 設置事件監聽器
      this.currentAudio.onloadstart = () => {
        console.log('[AudioPlayback] 開始載入音檔');
      };
      
      this.currentAudio.oncanplay = () => {
        console.log('[AudioPlayback] 音檔準備就緒，可以播放');
      };
      
      this.currentAudio.onplay = () => {
        console.log('[AudioPlayback] ✅ 音檔播放開始');
      };
      
      this.currentAudio.onended = () => {
        console.log('[AudioPlayback] 音檔播放完成');
        this.currentAudio = null;
      };
      
      this.currentAudio.onerror = (error) => {
        console.error('[AudioPlayback] 音檔載入/播放錯誤:', error);
        console.error('[AudioPlayback] 音檔 URL:', audio_url);
        this.currentAudio = null;
      };

      // 等待音檔載入並嘗試播放
      console.log('[AudioPlayback] 開始播放音檔...');
      
      // 添加載入檢查
      if (this.currentAudio.readyState >= 1) {
        // 音檔已載入足夠資料，直接播放
        const playPromise = this.currentAudio.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log('[AudioPlayback] ✅ 音檔播放成功');
        }
      } else {
        // 等待音檔載入
        return new Promise((resolve, reject) => {
          this.currentAudio.oncanplaythrough = async () => {
            try {
              const playPromise = this.currentAudio.play();
              if (playPromise !== undefined) {
                await playPromise;
                console.log('[AudioPlayback] ✅ 音檔播放成功（延遲載入）');
              }
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          
          // 設定超時，避免無限等待
          setTimeout(() => {
            reject(new Error('音檔載入超時'));
          }, 5000);
        });
      }
      
    } catch (error) {
      console.error('[AudioPlayback] 播放音檔時發生錯誤:', error);
      console.error('[AudioPlayback] 錯誤類型:', error.name);
      console.error('[AudioPlayback] 錯誤訊息:', error.message);
      
      // 如果自動播放失敗，通知用戶
      if (error.name === 'NotAllowedError') {
        console.warn('[AudioPlayback] ⚠️  瀏覽器阻止自動播放，需要用戶互動');
        this.notifyAutoplayBlocked(content);
      } else if (error.name === 'NotSupportedError') {
        console.error('[AudioPlayback] ❌ 不支援的音檔格式或來源');
      } else {
        console.error('[AudioPlayback] ❌ 其他播放錯誤:', error);
      }
    }
  }

  /**
   * 獲取當前 YouTube 播放時間
   * 通過後端 API 獲取來自 Chrome Extension 的 YouTube 播放時間
   * @returns {Promise<number|null>} 當前播放時間（秒）
   */
  async getCurrentYouTubeTime() {
    console.log('[AudioPlayback] 嘗試獲取當前 YouTube 播放時間...');
    try {
      // 方法1: 從後端 API 獲取當前 YouTube 狀態
      const response = await fetch(`${this.baseUrl}/api/youtube/current`);
      console.log(response);
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.youtube_data) {
          const youtubeData = data.youtube_data;
          
          // 檢查是否有有效的播放時間數據
          if (youtubeData.hasVideo && 
              typeof youtubeData.currentTime === 'number' && 
              youtubeData.currentTime >= 0) {
            
            console.log(`[AudioPlayback] ✅ 獲取到 YouTube 時間: ${youtubeData.currentTime}秒 (影片: ${youtubeData.title || youtubeData.videoId})`);
            return youtubeData.currentTime;
          } else {
            console.log('[AudioPlayback] ⚠️ YouTube 數據中沒有有效的播放時間');
            return null;
          }
        } else {
          console.log('[AudioPlayback] ⚠️ 沒有可用的 YouTube 數據');
          return null;
        }
      } else if (response.status === 404) {
        console.log('[AudioPlayback] ℹ️ YouTube API 端點尚未實現');
        // 嘗試方法2
        return await this.getCurrentYouTubeTimeFromCheck();
      } else {
        console.warn(`[AudioPlayback] ⚠️ YouTube API 回應錯誤: ${response.status}`);
        return null;
      }
    } catch (error) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        console.log('[AudioPlayback] 🔗 後端連接失敗，嘗試備用方法...');
        // 嘗試方法2
        return await this.getCurrentYouTubeTimeFromCheck();
      } else {
        console.error('[AudioPlayback] ❌ 獲取 YouTube 時間時發生錯誤:', error);
        return null;
      }
    }
  }

  /**
   * 從 check-playback API 獲取 YouTube 時間（備用方法）
   * @returns {Promise<number|null>} 當前播放時間（秒）
   */
  async getCurrentYouTubeTimeFromCheck() {
    try {
      const response = await this.fetchCheckPlayback();
      
      if (response.success && response.youtube_data) {
        const youtubeData = response.youtube_data;
        
        if (youtubeData.hasVideo && 
            typeof youtubeData.currentTime === 'number' && 
            youtubeData.currentTime >= 0) {
          
          console.log(`[AudioPlayback] ✅ 從 check-playback 獲取到 YouTube 時間: ${youtubeData.currentTime}秒`);
          return youtubeData.currentTime;
        }
      }
      
      console.log('[AudioPlayback] ⚠️ check-playback 中沒有 YouTube 時間數據');
      return null;
      
    } catch (error) {
      console.log('[AudioPlayback] ℹ️ 無法從 check-playback 獲取時間，使用預設值');
      return null;
    }
  }

  /**
   * 獲取當前 YouTube 影片 ID
   * 通過後端 API 獲取來自 Chrome Extension 的 YouTube 影片 ID
   * @returns {Promise<string|null>} 當前影片 ID
   */
  async getCurrentVideoId() {
    try {
      // 方法1: 從後端 API 獲取當前 YouTube 狀態
      const response = await fetch(`${this.baseUrl}/api/youtube/current`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.youtube_data && data.youtube_data.videoId) {
          console.log(`[AudioPlayback] ✅ 獲取到影片 ID: ${data.youtube_data.videoId}`);
          return data.youtube_data.videoId;
        }
      } else if (response.status !== 404) {
        console.warn(`[AudioPlayback] ⚠️ YouTube API 回應錯誤: ${response.status}`);
      }
      
      // 方法2: 從 check-playback API 獲取
      const checkResponse = await this.fetchCheckPlayback();
      if (checkResponse.success && checkResponse.youtube_data && checkResponse.youtube_data.videoId) {
        console.log(`[AudioPlayback] ✅ 從 check-playback 獲取到影片 ID: ${checkResponse.youtube_data.videoId}`);
        return checkResponse.youtube_data.videoId;
      }
      
      console.log('[AudioPlayback] ⚠️ 無法獲取當前影片 ID');
      return null;
      
    } catch (error) {
      console.error('[AudioPlayback] 獲取影片 ID 時發生錯誤:', error);
      return null;
    }
  }

  /**
   * 觸發播放事件，讓其他組件可以監聽
   * @param {Object} content - 播放的內容
   */
  dispatchPlaybackEvent(content) {
    const event = new CustomEvent('audioPlayback', {
      detail: {
        content: content,
        message: content.message,
        timestamp: new Date().toISOString()
      }
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  /**
   * 觸發 MessageBox 顯示事件
   * @param {Object} content - 播放的內容
   */
  dispatchMessageBoxEvent(content) {
    const event = new CustomEvent('showMessageBox', {
      detail: {
        message: content.message,
        timestamp: new Date().toISOString()
      }
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  /**
   * 通知用戶自動播放被阻止
   * @param {Object} content - 要播放的內容
   */
  notifyAutoplayBlocked(content) {
    const event = new CustomEvent('autoplayBlocked', {
      detail: {
        content: content,
        message: '瀏覽器阻止了自動播放，請點擊頁面後重試'
      }
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  /**
   * 手動檢查並播放語音內容（基於當前 YouTube 狀態）
   */
  async manualCheckAndPlay() {
    console.log('[AudioPlayback] 手動檢查當前 YouTube 狀態...');
    await this.checkAndPlayAudio();
  }

  /**
   * 停止當前播放的音檔
   */
  stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
      console.log('[AudioPlayback] 停止當前音檔');
    }
  }

  /**
   * 顯示對應的 reply 訊息
   */
  async showReplyMessage() {
    try {
      // 獲取當前影片 ID
      const videoId = await this.getCurrentVideoId();
      console.log(`[AudioPlayback] 當前影片 ID: ${videoId}`);
      
      if (!videoId) {
        console.warn('[AudioPlayback] 無法獲取影片 ID，跳過 MessageBox 顯示');
        return;
      }

      // 如果是新的影片，重置 reply 索引
      if (this.currentVideoId !== videoId) {
        this.currentVideoId = videoId;
        this.replyIndex = 0;
        console.log(`[AudioPlayback] 切換到新影片: ${videoId}，重置 reply 索引`);
      }

      // 嘗試載入對應的 avatar_talk JSON 檔案
      const avatarTalkPath = `/src/data/avatar_talk/${videoId}.json`;
      
      try {
        const response = await fetch(avatarTalkPath);
        if (response.ok) {
          const avatarTalkData = await response.json();
          
          // 檢查是否有對應索引的 reply
          if (this.replyIndex < avatarTalkData.length && avatarTalkData[this.replyIndex]) {
            const replyData = avatarTalkData[this.replyIndex];
            const replyMessage = replyData.Reply || replyData.reply || '';
            
            console.log(`[AudioPlayback] 📨 顯示 Reply ${this.replyIndex}: "${replyMessage}"`);
            
            // 使用 Electron API 顯示 MessageBox
            if (window.electronAPI && window.electronAPI.showMessageBox) {
              await window.electronAPI.showMessageBox(replyMessage);
              console.log(`[AudioPlayback] ✅ MessageBox 已顯示 Reply ${this.replyIndex} (via Electron API)`);
            } else {
              console.warn('[AudioPlayback] Electron API 不可用，無法顯示 MessageBox');
            }
            
            // 同時發送自定義事件作為備用
            if (typeof window !== 'undefined') {
              const event = new CustomEvent('showMessageBox', {
                detail: { message: replyMessage }
              });
              window.dispatchEvent(event);
              console.log(`[AudioPlayback] 📤 已發送 showMessageBox 事件作為備用: "${replyMessage}"`);
            }
            
            // 增加 reply 索引
            this.replyIndex++;
          } else {
            console.log(`[AudioPlayback] ⚠️ 沒有更多 Reply 可顯示 (索引: ${this.replyIndex})`);
          }
        } else {
          console.log(`[AudioPlayback] ⚠️ 找不到 avatar_talk 檔案: ${avatarTalkPath}`);
        }
      } catch (fetchError) {
        console.log(`[AudioPlayback] ℹ️ 無法載入 avatar_talk 檔案: ${fetchError.message}`);
      }
    } catch (error) {
      console.error('[AudioPlayback] 顯示 Reply 時發生錯誤:', error);
    }
  }

  /**
   * 重置 reply 索引（當切換影片時使用）
   * @param {string} videoId - 新的影片 ID
   */
  resetReplyIndex(videoId = null) {
    if (videoId) {
      this.currentVideoId = videoId;
    }
    this.replyIndex = 0;
    console.log(`[AudioPlayback] 🔄 重置 reply 索引為 0 (影片: ${this.currentVideoId})`);
  }

  /**
   * 檢查服務狀態
   * @returns {Object} 服務狀態資訊
   */
  getStatus() {
    return {
      isChecking: this.isChecking,
      hasInterval: !!this.checkInterval,
      currentlyPlaying: !!this.currentAudio,
      lastPlayedLogId: this.lastPlayedLogId,
      replyIndex: this.replyIndex,
      currentVideoId: this.currentVideoId
    };
  }
}

// 創建全局實例
const audioPlaybackService = new AudioPlaybackService();

export default audioPlaybackService;