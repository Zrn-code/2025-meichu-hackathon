// 後端服務器配置
const BACKEND_CONFIG = {
  baseURL: "http://localhost:3000/api",
  chatEndpoint: "/chat",
  streamEndpoint: "/chat/stream"
};

class LLMService {
  constructor() {
    // 移除直接的 OpenAI 客戶端，改為使用 fetch 調用後端
    this.backendURL = BACKEND_CONFIG.baseURL;
    
    // 對話歷史記錄現在由後端管理，這裡只保留最近幾條用於 UI 顯示
    this.localHistory = [];
  }

  /**
   * 發送訊息到後端並獲取 stream 回應
   * @param {string} userMessage - 使用者的訊息
   * @param {function} onChunk - 接收每個文字片段的回調函數
   * @returns {Promise<string>} 完整的 LLM 回應
   */
  async sendMessageStream(userMessage, onChunk) {
    try {
      // 將使用者訊息加入本地歷史（用於 UI 顯示）
      this.localHistory.push({
        role: "user",
        content: userMessage
      });

      console.log('發送 Stream 請求到後端服務器:', userMessage);

      const response = await fetch(`${this.backendURL}${BACKEND_CONFIG.streamEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let fullResponse = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              
              if (parsed.content) {
                fullResponse = parsed.fullResponse || fullResponse + parsed.content;
                
                // 調用回調函數，傳遞當前片段和完整回應
                if (onChunk) {
                  onChunk(parsed.content, fullResponse);
                }
              }
            } catch (e) {
              // 忽略解析錯誤，繼續處理下一行
              console.warn('解析 stream 數據時出錯:', e);
            }
          }
        }
      }

      const assistantMessage = fullResponse || "抱歉，我現在無法回應 😅";

      // 將助手回應加入本地歷史
      this.localHistory.push({
        role: "assistant",
        content: assistantMessage
      });

      // 保持本地歷史在合理範圍內
      if (this.localHistory.length > 20) {
        this.localHistory = this.localHistory.slice(-10);
      }

      console.log('後端服務完整回應:', assistantMessage);

      return assistantMessage;
    } catch (error) {
      console.error('後端服務錯誤:', error);
      
      // 檢查是否為網路連線錯誤
      if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
        const errorMessage = "無法連線到後端服務 😟\n請確認後端服務器是否正在運行於 localhost:3000";
        if (onChunk) {
          onChunk(errorMessage, errorMessage);
        }
        return errorMessage;
      }
      
      const errorMessage = "抱歉，處理您的訊息時發生錯誤 😅\n請稍後再試";
      if (onChunk) {
        onChunk(errorMessage, errorMessage);
      }
      return errorMessage;
    }
  }

  /**
   * 發送訊息到後端並獲取回應（非 stream 版本，保持向後兼容）
   * @param {string} userMessage - 使用者的訊息
   * @returns {Promise<string>} 後端的回應
   */
  async sendMessage(userMessage) {
    try {
      console.log('發送非 Stream 請求到後端服務器:', userMessage);

      const response = await fetch(`${this.backendURL}${BACKEND_CONFIG.chatEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '後端服務返回錯誤');
      }

      const assistantMessage = data.response || "抱歉，我現在無法回應 😅";

      // 更新本地歷史
      this.localHistory.push({
        role: "user",
        content: userMessage
      }, {
        role: "assistant",
        content: assistantMessage
      });

      // 保持本地歷史在合理範圍內
      if (this.localHistory.length > 20) {
        this.localHistory = this.localHistory.slice(-10);
      }

      return assistantMessage;

    } catch (error) {
      console.error('後端服務錯誤:', error);
      
      if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
        return "無法連線到後端服務 😟\n請確認後端服務器是否正在運行於 localhost:3000";
      }
      
      return "抱歉，處理您的訊息時發生錯誤 😅\n請稍後再試";
    }
  }

  /**
   * 清除對話歷史
   */
  clearHistory() {
    this.localHistory = [];
  }

  /**
   * 獲取對話歷史（僅本地歷史，用於 UI 顯示）
   */
  getHistory() {
    return this.localHistory;
  }

  /**
   * 檢查後端服務是否可用
   */
  async checkConnection() {
    try {
      const response = await fetch(`${this.backendURL.replace('/api', '')}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('後端連線檢查失敗:', error);
      return false;
    }
  }

  /**
   * 獲取後端服務狀態
   */
  async getBackendStatus() {
    try {
      const response = await fetch(`${this.backendURL.replace('/api', '')}/health`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('獲取後端狀態失敗:', error);
      return null;
    }
  }
}

// 創建單例實例
const llmService = new LLMService();

export default llmService;