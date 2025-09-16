document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleFloat');
  const clearBtn = document.getElementById('clearDisplay');
  const status = document.getElementById('status');
  
  // 載入當前狀態
  chrome.storage.local.get(['floatingEnabled'], function(result) {
    const enabled = result.floatingEnabled !== false; // 默認啟用
    updateStatus(enabled);
  });
  
  // 切換浮動計算機
  toggleBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'toggle'}, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Content script not ready:', chrome.runtime.lastError.message);
          // 如果content script未準備好，直接切換狀態
          chrome.storage.local.get(['floatingEnabled'], function(result) {
            const currentEnabled = result.floatingEnabled !== false;
            const newEnabled = !currentEnabled;
            chrome.storage.local.set({floatingEnabled: newEnabled});
            updateStatus(newEnabled);
            // 提示用戶重新整理頁面
            status.textContent = newEnabled ? '請重新整理頁面以顯示計算機' : '計算機已隱藏';
          });
          return;
        }
        
        if (response) {
          updateStatus(response.enabled);
          chrome.storage.local.set({floatingEnabled: response.enabled});
        }
      });
    });
  });

  // 清空顯示器
  clearBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'clearDisplay'}, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Content script not ready:', chrome.runtime.lastError.message);
        }
      });
    });
    status.textContent = '計算機顯示器已清空';
  });
  
  function updateStatus(enabled) {
    status.textContent = enabled ? '計算機已啟用' : '計算機已隱藏';
  }
});