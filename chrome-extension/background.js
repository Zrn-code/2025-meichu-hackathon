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
        
        // 字幕預載相關
        this.subtitlePreloader = new SubtitlePreloader(this.serverUrl);
        this.processedVideos = new Set(); // 記錄已處理的視頻ID
        this.pendingSubtitleRequests = new Map(); // 待處理的字幕請求
        
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
                
                // 觸發字幕預載
                if (message.data && message.data.videoId) {
                    this.triggerSubtitlePreload(message.data);
                }
                
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
    
    // 觸發字幕預載
    triggerSubtitlePreload(videoData) {
        const videoId = videoData.videoId;
        
        // 避免重複處理同一個視頻
        if (this.processedVideos.has(videoId)) {
            return;
        }
        
        console.log(`🚀 Triggering subtitle preload for video: ${videoId}`);
        
        // 標記為已處理
        this.processedVideos.add(videoId);
        
        // 啟動字幕預載
        this.subtitlePreloader.preloadSubtitles(videoId, videoData)
            .then(result => {
                console.log(`✅ Subtitle preload completed for ${videoId}:`, result);
            })
            .catch(error => {
                console.error(`❌ Subtitle preload failed for ${videoId}:`, error);
                // 失敗時從已處理列表中移除，允許重試
                this.processedVideos.delete(videoId);
            });
    }
}

// 字幕預載器類
class SubtitlePreloader {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.preloadingTabs = new Set(); // 正在預載的標籤頁
        this.maxConcurrentPreloads = 3; // 最大並發預載數量
        this.preloadQueue = []; // 預載隊列
    }
    
    async preloadSubtitles(videoId, videoData) {
        try {
            // 檢查是否已經在預載隊列中
            if (this.preloadQueue.some(item => item.videoId === videoId)) {
                console.log(`Video ${videoId} already in preload queue`);
                return { success: false, reason: 'already_queued' };
            }
            
            // 添加到預載隊列
            const preloadItem = {
                videoId,
                videoData,
                timestamp: Date.now(),
                attempts: 0
            };
            
            this.preloadQueue.push(preloadItem);
            
            // 處理預載隊列
            this.processPreloadQueue();
            
            return { success: true, queued: true };
            
        } catch (error) {
            console.error('Error in preloadSubtitles:', error);
            return { success: false, error: error.message };
        }
    }
    
    async processPreloadQueue() {
        // 如果已經達到最大並發數量，等待
        if (this.preloadingTabs.size >= this.maxConcurrentPreloads) {
            return;
        }
        
        // 獲取下一個待處理項目
        const item = this.preloadQueue.shift();
        if (!item) {
            return;
        }
        
        try {
            await this.executePreload(item);
        } catch (error) {
            console.error('Error executing preload:', error);
        }
        
        // 繼續處理隊列中的其他項目
        if (this.preloadQueue.length > 0) {
            setTimeout(() => this.processPreloadQueue(), 500);
        }
    }
    
    async executePreload(item) {
        const { videoId, videoData } = item;
        
        try {
            console.log(`🔄 Executing preload for video: ${videoId}`);
            
            // 方法1: 嘗試從API直接獲取字幕信息
            const apiResult = await this.tryAPIPreload(videoId, videoData);
            if (apiResult.success) {
                console.log(`✅ API preload successful for ${videoId}`);
                return apiResult;
            }
            
            // 方法2: 創建隱藏iframe進行快速加載
            const iframeResult = await this.tryIframePreload(videoId, videoData);
            if (iframeResult.success) {
                console.log(`✅ Iframe preload successful for ${videoId}`);
                return iframeResult;
            }
            
            // 方法3: 使用背景標籤頁
            const tabResult = await this.tryBackgroundTabPreload(videoId, videoData);
            if (tabResult.success) {
                console.log(`✅ Background tab preload successful for ${videoId}`);
                return tabResult;
            }
            
            throw new Error('All preload methods failed');
            
        } catch (error) {
            console.error(`❌ Preload failed for ${videoId}:`, error);
            
            // 重試機制
            item.attempts++;
            if (item.attempts < 2) {
                console.log(`🔄 Retrying preload for ${videoId} (attempt ${item.attempts + 1})`);
                setTimeout(() => {
                    this.preloadQueue.unshift(item); // 重新加入隊列開頭
                    this.processPreloadQueue();
                }, 2000);
            }
            
            throw error;
        }
    }
    
    async tryAPIPreload(videoId, videoData) {
        try {
            // 嘗試通過現有API觸發字幕收集
            const response = await fetch(`${this.serverUrl}/api/youtube/subtitles/count`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.counts.total_count > 0) {
                    return { 
                        success: true, 
                        method: 'api',
                        subtitleCount: data.counts.total_count 
                    };
                }
            }
            
            return { success: false, method: 'api' };
            
        } catch (error) {
            console.error('API preload failed:', error);
            return { success: false, method: 'api', error: error.message };
        }
    }
    
    async tryIframePreload(videoId, videoData) {
        try {
            console.log(`🖼️ Trying iframe preload for ${videoId}`);
            
            // 創建隱藏的iframe來加載YouTube視頻
            return new Promise((resolve, reject) => {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.style.position = 'absolute';
                iframe.style.left = '-9999px';
                iframe.style.width = '1px';
                iframe.style.height = '1px';
                
                // YouTube嵌入URL
                const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&controls=0&cc_load_policy=1`;
                
                const timeout = setTimeout(() => {
                    document.body.removeChild(iframe);
                    resolve({ success: false, method: 'iframe', reason: 'timeout' });
                }, 10000);
                
                iframe.onload = () => {
                    console.log(`📺 Iframe loaded for ${videoId}`);
                    
                    // 等待一段時間讓字幕數據加載
                    setTimeout(() => {
                        clearTimeout(timeout);
                        document.body.removeChild(iframe);
                        
                        // 嘗試獲取字幕數據
                        this.checkSubtitleData(videoId).then(result => {
                            resolve({
                                success: result.hasSubtitles,
                                method: 'iframe',
                                subtitleCount: result.count
                            });
                        });
                    }, 5000);
                };
                
                iframe.onerror = () => {
                    clearTimeout(timeout);
                    document.body.removeChild(iframe);
                    resolve({ success: false, method: 'iframe', reason: 'load_error' });
                };
                
                iframe.src = embedUrl;
                document.body.appendChild(iframe);
            });
            
        } catch (error) {
            console.error('Iframe preload failed:', error);
            return { success: false, method: 'iframe', error: error.message };
        }
    }
    
    async tryBackgroundTabPreload(videoId, videoData) {
        try {
            console.log(`🔖 Trying background tab preload for ${videoId}`);
            
            // 檢查當前標籤頁數量，避免創建過多標籤頁
            const tabs = await chrome.tabs.query({});
            if (tabs.length > 50) {
                return { success: false, method: 'background_tab', reason: 'too_many_tabs' };
            }
            
            // 創建背景標籤頁
            const tab = await chrome.tabs.create({
                url: `https://www.youtube.com/watch?v=${videoId}`,
                active: false,
                pinned: true
            });
            
            this.preloadingTabs.add(tab.id);
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    this.closePreloadTab(tab.id);
                    resolve({ success: false, method: 'background_tab', reason: 'timeout' });
                }, 15000);
                
                // 監聽標籤頁更新
                const tabUpdateListener = (tabId, changeInfo, updatedTab) => {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        console.log(`🎯 Background tab ${tabId} loaded for ${videoId}`);
                        
                        // 等待字幕數據收集
                        setTimeout(async () => {
                            clearTimeout(timeout);
                            chrome.tabs.onUpdated.removeListener(tabUpdateListener);
                            
                            const result = await this.checkSubtitleData(videoId);
                            this.closePreloadTab(tab.id);
                            
                            resolve({
                                success: result.hasSubtitles,
                                method: 'background_tab',
                                subtitleCount: result.count
                            });
                        }, 8000); // 等待8秒收集字幕
                    }
                };
                
                chrome.tabs.onUpdated.addListener(tabUpdateListener);
            });
            
        } catch (error) {
            console.error('Background tab preload failed:', error);
            return { success: false, method: 'background_tab', error: error.message };
        }
    }
    
    async closePreloadTab(tabId) {
        try {
            this.preloadingTabs.delete(tabId);
            await chrome.tabs.remove(tabId);
            console.log(`🗑️ Closed preload tab ${tabId}`);
        } catch (error) {
            console.error('Error closing preload tab:', error);
        }
    }
    
    async checkSubtitleData(videoId) {
        try {
            const response = await fetch(`${this.serverUrl}/api/youtube/subtitles/count`);
            
            if (response.ok) {
                const data = await response.json();
                return {
                    hasSubtitles: data.success && data.counts.total_count > 0,
                    count: data.counts?.total_count || 0,
                    videoId: data.video_id
                };
            }
            
            return { hasSubtitles: false, count: 0 };
            
        } catch (error) {
            console.error('Error checking subtitle data:', error);
            return { hasSubtitles: false, count: 0 };
        }
    }
}

// 初始化監控器
const tabMonitor = new TabMonitor();