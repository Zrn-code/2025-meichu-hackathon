/**
 * YouTube Tab Monitor - Background Script
 * 處理標籤頁變化、數據收集和與 Python 服務器的通信
 */

class TabMonitor {
    constructor() {
        this.currentTabId = null;
        this.isMonitoring = false;
        this.serverUrl = 'http://localhost:3000';
        this.updateInterval = null;
        this.lastVideoData = null;
        
        this.init();
    }
    
    init() {
        console.log('YouTube Tab Monitor initialized');
        
        // 監聽標籤頁更新
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdated(tabId, changeInfo, tab);
        });
        
        // 監聽標籤頁激活
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.handleTabActivated(activeInfo.tabId);
        });
        
        // 監聽標籤頁創建
        chrome.tabs.onCreated.addListener((tab) => {
            this.sendTabInfo();
        });
        
        // 監聽標籤頁移除
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.sendTabInfo();
        });
        
        // 定期發送標籤頁統計信息
        setInterval(() => {
            this.sendTabInfo();
        }, 2000);
        
        // 監聽來自 content script 的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
        
        // 啟動時檢查當前活動標籤頁
        this.checkActiveTab();
    }
    
    async checkActiveTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && this.isYouTubeTab(tab)) {
                this.handleTabActivated(tab.id);
            }
        } catch (error) {
            console.error('Error checking active tab:', error);
        }
    }
    
    handleTabUpdated(tabId, changeInfo, tab) {
        // 當標籤頁完成加載且是 YouTube 頁面時
        if (changeInfo.status === 'complete' && this.isYouTubeTab(tab)) {
            console.log('YouTube tab updated:', tab.url);
            if (tabId === this.currentTabId) {
                this.startMonitoring(tabId);
            }
        }
    }
    
    async handleTabActivated(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            
            if (this.isYouTubeTab(tab)) {
                console.log('YouTube tab activated:', tab.url);
                this.currentTabId = tabId;
                this.startMonitoring(tabId);
            } else {
                console.log('Non-YouTube tab activated');
                this.stopMonitoring();
            }
        } catch (error) {
            console.error('Error handling tab activation:', error);
        }
    }
    
    isYouTubeTab(tab) {
        return tab.url && tab.url.includes('youtube.com');
    }
    
    startMonitoring(tabId) {
        if (this.isMonitoring && this.currentTabId === tabId) {
            return; // 已經在監控這個標籤頁
        }
        
        this.stopMonitoring(); // 停止之前的監控
        this.currentTabId = tabId;
        this.isMonitoring = true;
        
        console.log('Starting monitoring for tab:', tabId);
        
        // 注入 content script（如果還沒有注入）
        this.injectContentScript(tabId);
        
        // 開始定期更新
        this.updateInterval = setInterval(() => {
            this.requestVideoData(tabId);
        }, 1000); // 每秒更新一次
        
        // 立即請求一次數據
        this.requestVideoData(tabId);
    }
    
    stopMonitoring() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        this.isMonitoring = false;
        this.currentTabId = null;
        
        console.log('Monitoring stopped');
        
        // 通知服務器停止監控
        this.sendToServer({
            type: 'stop_monitoring',
            timestamp: Date.now()
        });
    }
    
    async injectContentScript(tabId) {
        try {
            // 檢查是否已經注入了 content script
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => window.youtubeMonitorInjected || false
            });
            
            if (!results[0].result) {
                // 只有在沒有注入時才注入
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });
                
                // 標記已注入
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => { window.youtubeMonitorInjected = true; }
                });
            }
        } catch (error) {
            console.error('Error injecting content script:', error);
        }
    }
    
    requestVideoData(tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'GET_VIDEO_DATA' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Content script not ready or tab closed');
                return;
            }
            
            if (response && response.success) {
                this.handleVideoData(response.data);
            }
        });
    }
    
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'VIDEO_DATA_UPDATE':
                this.handleVideoData(message.data);
                sendResponse({ success: true });
                break;
                
            case 'GET_MONITORING_STATUS':
                sendResponse({ 
                    isMonitoring: this.isMonitoring,
                    currentTabId: this.currentTabId
                });
                break;
                
            case 'START_MONITORING':
                if (sender.tab && this.isYouTubeTab(sender.tab)) {
                    this.startMonitoring(sender.tab.id);
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'Not a YouTube tab' });
                }
                break;
                
            case 'STOP_MONITORING':
                this.stopMonitoring();
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown message type' });
        }
    }
    
    handleVideoData(data) {
        if (!data) return;
        
        // 檢查數據是否有變化
        const dataString = JSON.stringify(data);
        if (this.lastVideoData === dataString) {
            return; // 數據沒有變化，不需要發送
        }
        
        this.lastVideoData = dataString;
        
        // 添加時間戳和標籤頁信息
        const enrichedData = {
            ...data,
            timestamp: Date.now(),
            tabId: this.currentTabId,
            type: 'youtube_data'
        };
        
        console.log('Video data updated:', enrichedData);
        
        // 發送到 Python 服務器
        this.sendToServer(enrichedData);
    }
    
    async sendToServer(data) {
        try {
            const response = await fetch(`${this.serverUrl}/api/youtube`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Data sent to server successfully:', result);
            
        } catch (error) {
            console.error('Error sending data to server:', error);
            // 可以選擇將數據暫存，等服務器恢復時重新發送
        }
    }
    
    async sendTabInfo() {
        try {
            // 獲取所有標籤頁
            const tabs = await chrome.tabs.query({});
            
            const tabsInfo = {
                type: 'tab_count',
                totalTabs: tabs.length,
                youtubeTabs: tabs.filter(tab => tab.url && tab.url.includes('youtube.com')).length,
                tabs: tabs.map(tab => ({
                    id: tab.id,
                    url: tab.url,
                    title: tab.title,
                    active: tab.active,
                    isYoutube: tab.url && tab.url.includes('youtube.com')
                })),
                timestamp: Date.now()
            };
            
            // 發送到服務器
            const response = await fetch(`${this.serverUrl}/api/tabs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tabsInfo)
            });
            
            if (!response.ok && response.status !== 404) {
                // 404 是正常的，表示端點還沒實現
                console.log('Tab info sent to server');
            }
            
        } catch (error) {
            // 靜默處理錯誤，避免過多日誌
        }
    }
}

// 初始化監控器
const tabMonitor = new TabMonitor();