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
          
          await this.playAudio(content);
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
   * 這個方法需要根據實際的 YouTube 整合方式來實現
   * @returns {Promise<number|null>} 當前播放時間（秒）
   */
  async getCurrentYouTubeTime() {
    try {
      // TODO: 這裡需要根據實際的 YouTube 整合方式來實現
      // 如果是通過瀏覽器標籤頁，可能需要通過 chrome extension 或其他方式獲取
      
      // 可能的實現方式：
      // 1. 通過 Chrome Extension 與瀏覽器通信
      // 2. 通過 Electron 主進程獲取瀏覽器標籤頁資訊
      // 3. 如果有嵌入式播放器，可以直接獲取播放時間
      
      // 暫時返回 null，讓系統使用預設的測試時間
      console.log('[AudioPlayback] getCurrentYouTubeTime 尚未實現，返回 null');
      return null;
    } catch (error) {
      console.error('[AudioPlayback] 獲取 YouTube 時間時發生錯誤:', error);
      return null;
    }
  }

  /**
   * 獲取當前 YouTube 影片 ID
   * @returns {Promise<string|null>} 當前影片 ID
   */
  async getCurrentVideoId() {
    try {
      // 這裡需要根據實際的 YouTube 整合方式來實現
      // 暫時返回測試用的影片 ID
      return 'video_bb4be737';
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
   * 檢查服務狀態
   * @returns {Object} 服務狀態資訊
   */
  getStatus() {
    return {
      isChecking: this.isChecking,
      hasInterval: !!this.checkInterval,
      currentlyPlaying: !!this.currentAudio,
      lastPlayedLogId: this.lastPlayedLogId
    };
  }
}

// 創建全局實例
const audioPlaybackService = new AudioPlaybackService();

export default audioPlaybackService;