import OpenAI from 'openai';

// LLM 服務配置
const LLM_CONFIG = {
  baseURL: "http://localhost:8000/api/v1",
  apiKey: "lemonade", // required but unused
  model: "Llama-3.2-1B-Instruct-CPU",
  stream: true
};

class LLMService {
  constructor() {
    this.client = new OpenAI({
      baseURL: LLM_CONFIG.baseURL,
      apiKey: LLM_CONFIG.apiKey,
      stream: LLM_CONFIG.stream,
      dangerouslyAllowBrowser: true // 允許在瀏覽器中使用
    });
    
    // 對話歷史記錄
    this.conversationHistory = [
      {
        role: "system",
        content: "你是一個友善的桌面助手 avatar，請用繁體中文回答問題。回答必須非常簡潔，不超過20個字。"
      }
    ];
  }

  /**
   * 發送訊息到 LLM 並獲取 stream 回應
   * @param {string} userMessage - 使用者的訊息
   * @param {function} onChunk - 接收每個文字片段的回調函數
   * @returns {Promise<string>} 完整的 LLM 回應
   */
  async sendMessageStream(userMessage, onChunk) {
    try {
      // 將使用者訊息加入對話歷史
      this.conversationHistory.push({
        role: "user",
        content: userMessage
      });

      console.log('發送 Stream 請求到 LLM:', {
        model: LLM_CONFIG.model,
        messages: this.conversationHistory
      });

      const stream = await this.client.chat.completions.create({
        model: LLM_CONFIG.model,
        messages: this.conversationHistory,
        temperature: 0.7,
        max_tokens: 50, // 限制生成的 token 數量，大約對應 30-40 個中文字
        stream: true
      });

      let fullResponse = '';
      const MAX_CHARS = 50; // 最大字符數限制

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          // 檢查是否會超過字數限制
          if (fullResponse.length + content.length <= MAX_CHARS) {
            fullResponse += content;
            // 調用回調函數，傳遞當前片段和完整回應
            if (onChunk) {
              onChunk(content, fullResponse);
            }
          } else {
            // 如果會超過限制，只取能容納的部分
            const remainingChars = MAX_CHARS - fullResponse.length;
            if (remainingChars > 0) {
              const partialContent = content.substring(0, remainingChars);
              fullResponse += partialContent;
              if (onChunk) {
                onChunk(partialContent, fullResponse);
              }
            }
            // 達到字數限制，停止接收
            break;
          }
        }
      }

      const assistantMessage = fullResponse || "抱歉，我現在無法回應 😅";

      // 將助手回應加入對話歷史
      this.conversationHistory.push({
        role: "assistant",
        content: assistantMessage
      });

      console.log('LLM 完整回應:', assistantMessage);

      return assistantMessage;
    } catch (error) {
      console.error('LLM 服務錯誤:', error);
      
      // 檢查是否為網路連線錯誤
      if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
        const errorMessage = "無法連線到 LLM 服務 😟\n請確認本地 LLM server 是否正在運行於 localhost:8000";
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
   * 發送訊息到 LLM 並獲取回應（非 stream 版本，保持向後兼容）
   * @param {string} userMessage - 使用者的訊息
   * @returns {Promise<string>} LLM 的回應
   */
  async sendMessage(userMessage) {
    return this.sendMessageStream(userMessage, null);
  }

  /**
   * 清除對話歷史
   */
  clearHistory() {
    this.conversationHistory = [
      {
        role: "system",
        content: "你是一個友善的桌面助手 avatar，請用繁體中文回答問題。回答必須非常簡潔，不超過30個字，可以使用 emoji 讓回答更生動。"
      }
    ];
  }

  /**
   * 獲取對話歷史
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * 檢查 LLM 服務是否可用
   */
  async checkConnection() {
    try {
      const response = await fetch(`${LLM_CONFIG.baseURL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LLM_CONFIG.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error('LLM 連線檢查失敗:', error);
      return false;
    }
  }
}

// 創建單例實例
const llmService = new LLMService();

export default llmService;