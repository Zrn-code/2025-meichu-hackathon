// Popup JavaScript for Chrome Extension

document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleBtn');
  const sendNowBtn = document.getElementById('sendNowBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const statusDiv = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const tabCountDiv = document.getElementById('tabCount');
  const lastUpdateDiv = document.getElementById('lastUpdate');
  
  let isMonitoring = false;
  
  // 初始化
  init();
  
  function init() {
    refreshStatus();
    updateTabCount();
    
    // 每3秒更新標籤頁數量
    setInterval(updateTabCount, 3000);
  }
  
  // 刷新監控狀態
  function refreshStatus() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      if (response) {
        isMonitoring = response.isMonitoring;
        updateUI();
      }
    });
  }
  
  // 更新標籤頁數量
  async function updateTabCount() {
    try {
      const tabs = await chrome.tabs.query({});
      tabCountDiv.textContent = `${tabs.length} 個標籤頁`;
      lastUpdateDiv.textContent = `上次更新: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
      console.error('獲取標籤頁數量失敗:', error);
      tabCountDiv.textContent = '無法獲取';
    }
  }
  
  // 更新界面
  function updateUI() {
    if (isMonitoring) {
      statusText.textContent = '✅ 正在監控中';
      statusDiv.className = 'status monitoring';
      toggleBtn.textContent = '停止監控';
      toggleBtn.className = 'danger';
    } else {
      statusText.textContent = '❌ 監控已停止';
      statusDiv.className = 'status stopped';
      toggleBtn.textContent = '開始監控';
      toggleBtn.className = 'success';
    }
  }
  
  // 切換監控狀態
  toggleBtn.addEventListener('click', function() {
    const action = isMonitoring ? 'stopMonitoring' : 'startMonitoring';
    
    chrome.runtime.sendMessage({ action: action }, (response) => {
      if (response && response.success) {
        isMonitoring = !isMonitoring;
        updateUI();
        showMessage(response.message, 'success');
      } else {
        showMessage('操作失敗', 'error');
      }
    });
  });
  
  // 立即發送標籤頁資訊
  sendNowBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'sendTabsNow' }, (response) => {
      if (response && response.success) {
        showMessage('已發送標籤頁資訊', 'success');
      } else {
        showMessage('發送失敗', 'error');
      }
    });
  });
  
  // 刷新狀態
  refreshBtn.addEventListener('click', function() {
    refreshStatus();
    updateTabCount();
    showMessage('狀態已刷新', 'success');
  });
  
  // 顯示訊息
  function showMessage(message, type = 'info') {
    // 創建訊息元素
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      transition: opacity 0.3s ease;
      ${type === 'success' ? 'background: rgba(76, 175, 80, 0.9); color: white;' : ''}
      ${type === 'error' ? 'background: rgba(244, 67, 54, 0.9); color: white;' : ''}
      ${type === 'info' ? 'background: rgba(33, 150, 243, 0.9); color: white;' : ''}
    `;
    
    document.body.appendChild(messageDiv);
    
    // 3秒後自動移除
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(messageDiv)) {
          document.body.removeChild(messageDiv);
        }
      }, 300);
    }, 2000);
  }
  
  // 監聽來自 background script 的訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'statusUpdate') {
      isMonitoring = message.isMonitoring;
      updateUI();
    }
  });
});
