// Chrome Extension Background Script
// 監控標籤頁變化並將資訊傳送給 Windows 應用程式

const WINDOWS_APP_URL = 'http://localhost:3001/api/tabs';
const UPDATE_INTERVAL = 2000; // 每2秒更新一次

let isMonitoring = false;
let updateTimer = null;

// 啟動時開始監控
chrome.runtime.onStartup.addListener(() => {
  startMonitoring();
});

// 安裝時開始監控
chrome.runtime.onInstalled.addListener(() => {
  startMonitoring();
});

// 監聽標籤頁變化事件
chrome.tabs.onCreated.addListener(() => {
  if (isMonitoring) {
    sendTabsInfo();
  }
});

chrome.tabs.onRemoved.addListener(() => {
  if (isMonitoring) {
    sendTabsInfo();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isMonitoring && (changeInfo.title || changeInfo.url)) {
    sendTabsInfo();
  }
});

chrome.tabs.onActivated.addListener(() => {
  if (isMonitoring) {
    sendTabsInfo();
  }
});

// 開始監控功能
function startMonitoring() {
  if (isMonitoring) return;
  
  isMonitoring = true;
  console.log('開始監控標籤頁');
  
  // 立即發送一次資訊
  sendTabsInfo();
  
  // 設定定期更新
  updateTimer = setInterval(() => {
    sendTabsInfo();
  }, UPDATE_INTERVAL);
}

// 停止監控功能
function stopMonitoring() {
  isMonitoring = false;
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  console.log('停止監控標籤頁');
}

// 收集並發送標籤頁資訊
async function sendTabsInfo() {
  try {
    // 獲取所有標籤頁
    const tabs = await chrome.tabs.query({});
    
    // 獲取當前活動標籤頁
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTabs.length > 0 ? activeTabs[0].id : null;
    
    // 組織標籤頁資訊
    const tabsInfo = {
      timestamp: new Date().toISOString(),
      totalTabs: tabs.length,
      activeTabId: activeTabId,
      tabs: tabs.map(tab => ({
        id: tab.id,
        title: tab.title || 'Loading...',
        url: tab.url || 'about:blank',
        isActive: tab.active,
        windowId: tab.windowId,
        index: tab.index,
        favIconUrl: tab.favIconUrl || null,
        status: tab.status || 'loading'
      }))
    };
    
    // 發送到 Windows 應用程式
    await sendToWindowsApp(tabsInfo);
    
  } catch (error) {
    console.error('收集標籤頁資訊時發生錯誤:', error);
  }
}

// 發送資料到 Windows 應用程式
async function sendToWindowsApp(data) {
  try {
    const response = await fetch(WINDOWS_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('成功發送標籤頁資訊到 Windows 應用程式');
    
  } catch (error) {
    console.error('發送資料到 Windows 應用程式失敗:', error.message);
    // 如果是網路錯誤，可能是 Windows app 未運行，暫時忽略
  }
}

// 處理來自 popup 的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startMonitoring':
      startMonitoring();
      sendResponse({ success: true, message: '開始監控' });
      break;
      
    case 'stopMonitoring':
      stopMonitoring();
      sendResponse({ success: true, message: '停止監控' });
      break;
      
    case 'getStatus':
      sendResponse({ 
        isMonitoring: isMonitoring,
        message: isMonitoring ? '正在監控中' : '監控已停止'
      });
      break;
      
    case 'sendTabsNow':
      sendTabsInfo();
      sendResponse({ success: true, message: '立即發送標籤頁資訊' });
      break;
      
    default:
      sendResponse({ success: false, message: '未知操作' });
  }
});

// 保存監控狀態
chrome.storage.local.get(['isMonitoring'], (result) => {
  if (result.isMonitoring !== false) {
    startMonitoring();
  }
});

// 當監控狀態改變時保存
function saveMonitoringState() {
  chrome.storage.local.set({ isMonitoring: isMonitoring });
}
