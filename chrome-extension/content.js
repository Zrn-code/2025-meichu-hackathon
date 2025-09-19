/**
 * YouTube Tab Monitor - Content Script
 * 在 YouTube 頁面中運行，監控視頻播放狀態
 */

class YouTubeMonitor {
    constructor() {
        this.video = null;
        this.isInitialized = false;
        this.lastData = null;
        this.observers = [];
        
        this.init();
    }
    
    init() {
        console.log('YouTube Monitor Content Script loaded');
        
        // 等待頁面完全加載
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
        
        // 監聽來自 background script 的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
    }
    
    setup() {
        // 等待視頻元素加載
        this.waitForVideo();
        
        // 監控 URL 變化（SPA 路由）
        this.observeUrlChanges();
        
        // 監控 DOM 變化
        this.observeDOMChanges();
        
        this.isInitialized = true;
    }
    
    waitForVideo() {
        const checkVideo = () => {
            const video = document.querySelector('video');
            if (video && video !== this.video) {
                this.video = video;
                this.setupVideoListeners();
                console.log('Video element found and listeners attached');
            } else if (!video) {
                // 如果沒找到視頻，繼續等待
                setTimeout(checkVideo, 500);
            }
        };
        
        checkVideo();
    }
    
    setupVideoListeners() {
        if (!this.video) return;
        
        // 移除舊的監聽器
        this.removeVideoListeners();
        
        // 添加事件監聽器
        const events = ['play', 'pause', 'timeupdate', 'loadedmetadata', 'seeking', 'seeked'];
        
        events.forEach(event => {
            this.video.addEventListener(event, () => {
                this.sendVideoData();
            });
        });
        
        // 初始數據發送
        setTimeout(() => this.sendVideoData(), 1000);
    }
    
    removeVideoListeners() {
        if (this.video) {
            const events = ['play', 'pause', 'timeupdate', 'loadedmetadata', 'seeking', 'seeked'];
            events.forEach(event => {
                this.video.removeEventListener(event, this.sendVideoData);
            });
        }
    }
    
    observeUrlChanges() {
        let lastUrl = location.href;
        
        const observer = new MutationObserver(() => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                console.log('URL changed:', currentUrl);
                
                // URL 變化時重新初始化
                setTimeout(() => {
                    this.waitForVideo();
                    this.sendVideoData();
                }, 1000);
            }
        });
        
        observer.observe(document, {
            childList: true,
            subtree: true
        });
        
        this.observers.push(observer);
    }
    
    observeDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach(mutation => {
                // 檢查是否有新的視頻標題或頻道信息
                if (mutation.target.matches && (
                    mutation.target.matches('h1.ytd-video-primary-info-renderer') ||
                    mutation.target.matches('.ytd-channel-name') ||
                    mutation.target.matches('#owner-name')
                )) {
                    shouldUpdate = true;
                }
            });
            
            if (shouldUpdate) {
                setTimeout(() => this.sendVideoData(), 500);
            }
        });
        
        observer.observe(document, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        this.observers.push(observer);
    }
    
    getVideoData() {
        try {
            const data = {
                // 基本信息
                url: location.href,
                isVideoPage: this.isVideoPage(),
                
                // 視頻狀態
                hasVideo: !!this.video,
                isPlaying: this.video ? !this.video.paused : false,
                currentTime: this.video ? Math.floor(this.video.currentTime) : 0,
                duration: this.video ? Math.floor(this.video.duration) : 0,
                volume: this.video ? this.video.volume : 0,
                playbackRate: this.video ? this.video.playbackRate : 1,
                
                // 視頻信息
                videoId: this.getVideoId(),
                title: this.getVideoTitle(),
                channelName: this.getChannelName(),
                viewCount: this.getViewCount(),
                description: this.getVideoDescription(),
                
                // 播放列表信息
                isPlaylist: this.isInPlaylist(),
                playlistId: this.getPlaylistId(),
                
                // 額外狀態
                isFullscreen: document.fullscreenElement !== null,
                quality: this.getVideoQuality(),
                
                // 時間戳
                timestamp: Date.now()
            };
            
            return data;
            
        } catch (error) {
            console.error('Error getting video data:', error);
            return null;
        }
    }
    
    isVideoPage() {
        return location.pathname === '/watch';
    }
    
    getVideoId() {
        const urlParams = new URLSearchParams(location.search);
        return urlParams.get('v') || null;
    }
    
    getVideoTitle() {
        const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer') ||
                           document.querySelector('#title h1') ||
                           document.querySelector('h1.title');
        return titleElement ? titleElement.textContent.trim() : null;
    }
    
    getChannelName() {
        const channelElement = document.querySelector('#owner-name a') ||
                             document.querySelector('.ytd-channel-name a') ||
                             document.querySelector('#channel-name a');
        return channelElement ? channelElement.textContent.trim() : null;
    }
    
    getViewCount() {
        const viewElement = document.querySelector('#info span.view-count') ||
                          document.querySelector('.view-count') ||
                          document.querySelector('#count .ytd-video-view-count-renderer');
        
        if (viewElement) {
            const viewText = viewElement.textContent;
            const match = viewText.match(/[\d,]+/);
            return match ? match[0].replace(/,/g, '') : null;
        }
        return null;
    }
    
    getVideoDescription() {
        const descElement = document.querySelector('#description') ||
                          document.querySelector('.ytd-video-secondary-info-renderer #description');
        return descElement ? descElement.textContent.trim().substring(0, 200) : null;
    }
    
    isInPlaylist() {
        return location.search.includes('list=');
    }
    
    getPlaylistId() {
        const urlParams = new URLSearchParams(location.search);
        return urlParams.get('list') || null;
    }
    
    getVideoQuality() {
        // 嘗試從設置菜單獲取當前畫質
        try {
            const qualityButton = document.querySelector('.ytp-settings-button');
            if (qualityButton) {
                // 這需要進一步的 DOM 解析，暫時返回 null
                return null;
            }
        } catch (error) {
            console.log('Could not get video quality');
        }
        return null;
    }
    
    sendVideoData() {
        const data = this.getVideoData();
        if (!data) return;
        
        // 檢查數據是否有顯著變化
        const currentDataString = JSON.stringify(data);
        if (this.lastData === currentDataString) {
            return;
        }
        
        this.lastData = currentDataString;
        
        // 發送到 background script
        chrome.runtime.sendMessage({
            type: 'VIDEO_DATA_UPDATE',
            data: data
        }).catch(error => {
            console.error('Error sending message to background:', error);
        });
    }
    
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'GET_VIDEO_DATA':
                const data = this.getVideoData();
                sendResponse({
                    success: true,
                    data: data
                });
                break;
                
            case 'FORCE_UPDATE':
                this.sendVideoData();
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ 
                    success: false, 
                    error: 'Unknown message type' 
                });
        }
    }
    
    destroy() {
        // 清理監聽器和觀察者
        this.removeVideoListeners();
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }
}

// 初始化 YouTube 監控器
const youtubeMonitor = new YouTubeMonitor();

// 頁面卸載時清理
window.addEventListener('beforeunload', () => {
    youtubeMonitor.destroy();
});