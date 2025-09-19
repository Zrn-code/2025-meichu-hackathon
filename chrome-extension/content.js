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
        
        // 監聽字幕軌道變化
        if (this.video.textTracks) {
            for (let i = 0; i < this.video.textTracks.length; i++) {
                const track = this.video.textTracks[i];
                track.addEventListener('cuechange', () => {
                    this.sendVideoData();
                });
            }
        }
        
        // 監聽字幕按鈕點擊
        this.setupSubtitleButtonListeners();
        
        // 初始數據發送
        setTimeout(() => this.sendVideoData(), 1000);
    }
    
    setupSubtitleButtonListeners() {
        // 監聽字幕按鈕的點擊
        const subtitleButton = document.querySelector('.ytp-subtitles-button') || 
                             document.querySelector('.ytp-cc-button');
        
        if (subtitleButton) {
            subtitleButton.addEventListener('click', () => {
                // 延遲發送數據，等待字幕狀態更新
                setTimeout(() => this.sendVideoData(), 100);
            });
        }
        
        // 使用 MutationObserver 監聽字幕容器的變化
        const subtitleContainer = document.querySelector('.ytp-caption-window-container') ||
                                document.querySelector('.caption-window');
        
        if (subtitleContainer) {
            const observer = new MutationObserver(() => {
                this.sendVideoData();
            });
            
            observer.observe(subtitleContainer, {
                childList: true,
                subtree: true,
                characterData: true
            });
            
            this.observers.push(observer);
        }
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
                
                // 字幕信息
                subtitles: this.getSubtitleData(),
                fullSubtitles: this.getFullSubtitleTrack(),
                
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
    
    getSubtitleData() {
        try {
            const subtitleData = {
                available: false,
                tracks: [],
                currentTrack: null,
                currentText: null,
                isEnabled: false
            };
            
            // 檢查字幕按鈕是否存在
            const subtitleButton = document.querySelector('.ytp-subtitles-button') || 
                                 document.querySelector('.ytp-cc-button');
            
            if (subtitleButton) {
                // 檢查字幕是否開啟
                subtitleData.isEnabled = subtitleButton.classList.contains('ytp-button-pressed') ||
                                       subtitleButton.getAttribute('aria-pressed') === 'true';
                
                // 獲取可用的字幕軌道
                subtitleData.tracks = this.getAvailableSubtitleTracks();
                subtitleData.available = subtitleData.tracks.length > 0;
                
                // 獲取當前選中的字幕軌道
                subtitleData.currentTrack = this.getCurrentSubtitleTrack();
                
                // 獲取當前顯示的字幕文本
                if (subtitleData.isEnabled) {
                    subtitleData.currentText = this.getCurrentSubtitleText();
                }
            }
            
            return subtitleData;
            
        } catch (error) {
            console.error('Error getting subtitle data:', error);
            return {
                available: false,
                tracks: [],
                currentTrack: null,
                currentText: null,
                isEnabled: false,
                error: error.message
            };
        }
    }
    
    getAvailableSubtitleTracks() {
        const tracks = [];
        
        try {
            // 方法1: 嘗試從字幕菜單獲取
            const subtitleMenu = document.querySelector('.ytp-panel-menu');
            if (subtitleMenu) {
                const trackItems = subtitleMenu.querySelectorAll('.ytp-menuitem');
                trackItems.forEach(item => {
                    const label = item.querySelector('.ytp-menuitem-label');
                    if (label && label.textContent.trim()) {
                        tracks.push({
                            language: label.textContent.trim(),
                            label: label.textContent.trim()
                        });
                    }
                });
            }
            
            // 方法2: 嘗試從 video element 的 textTracks 獲取
            if (this.video && this.video.textTracks) {
                for (let i = 0; i < this.video.textTracks.length; i++) {
                    const track = this.video.textTracks[i];
                    if (track.kind === 'subtitles' || track.kind === 'captions') {
                        tracks.push({
                            language: track.language || 'unknown',
                            label: track.label || track.language || `Track ${i + 1}`,
                            kind: track.kind,
                            mode: track.mode
                        });
                    }
                }
            }
            
        } catch (error) {
            console.error('Error getting subtitle tracks:', error);
        }
        
        return tracks;
    }
    
    getCurrentSubtitleTrack() {
        try {
            // 嘗試從 video element 的 textTracks 獲取當前啟用的軌道
            if (this.video && this.video.textTracks) {
                for (let i = 0; i < this.video.textTracks.length; i++) {
                    const track = this.video.textTracks[i];
                    if (track.mode === 'showing') {
                        return {
                            language: track.language || 'unknown',
                            label: track.label || track.language || `Track ${i + 1}`,
                            kind: track.kind,
                            mode: track.mode
                        };
                    }
                }
            }
            
            // 嘗試從字幕容器獲取語言信息
            const subtitleContainer = document.querySelector('.ytp-caption-segment') ||
                                    document.querySelector('.captions-text');
            
            if (subtitleContainer && subtitleContainer.closest('[lang]')) {
                const lang = subtitleContainer.closest('[lang]').getAttribute('lang');
                return {
                    language: lang,
                    label: lang,
                    detected: true
                };
            }
            
        } catch (error) {
            console.error('Error getting current subtitle track:', error);
        }
        
        return null;
    }
    
    getCurrentSubtitleText() {
        try {
            // 方法1: YouTube 字幕容器
            const subtitleSelectors = [
                '.ytp-caption-segment',
                '.captions-text .caption-line',
                '.ytp-caption-window-container .ytp-caption-segment',
                '.caption-window .caption-line-container'
            ];
            
            for (const selector of subtitleSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    const texts = Array.from(elements)
                        .map(el => el.textContent.trim())
                        .filter(text => text.length > 0);
                    
                    if (texts.length > 0) {
                        return {
                            text: texts.join('\n'),
                            lines: texts,
                            timestamp: this.video ? this.video.currentTime : 0
                        };
                    }
                }
            }
            
            // 方法2: 嘗試從 WebVTT cues 獲取
            if (this.video && this.video.textTracks) {
                for (let i = 0; i < this.video.textTracks.length; i++) {
                    const track = this.video.textTracks[i];
                    if (track.mode === 'showing' && track.cues) {
                        const currentTime = this.video.currentTime;
                        for (let j = 0; j < track.cues.length; j++) {
                            const cue = track.cues[j];
                            if (cue.startTime <= currentTime && cue.endTime >= currentTime) {
                                return {
                                    text: cue.text,
                                    startTime: cue.startTime,
                                    endTime: cue.endTime,
                                    timestamp: currentTime
                                };
                            }
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Error getting current subtitle text:', error);
        }
        
        return null;
    }
    
    getFullSubtitleTrack() {
        // 獲取完整的字幕軌道數據
        try {
            const fullSubtitles = {
                available: false,
                cues: [],
                totalDuration: 0,
                language: null,
                trackInfo: null
            };
            
            if (this.video && this.video.textTracks) {
                // 尋找當前啟用的字幕軌道
                for (let i = 0; i < this.video.textTracks.length; i++) {
                    const track = this.video.textTracks[i];
                    
                    if (track.mode === 'showing' && track.cues && track.cues.length > 0) {
                        fullSubtitles.available = true;
                        fullSubtitles.language = track.language;
                        fullSubtitles.trackInfo = {
                            kind: track.kind,
                            label: track.label,
                            language: track.language
                        };
                        
                        // 提取所有 cues
                        const cues = [];
                        for (let j = 0; j < track.cues.length; j++) {
                            const cue = track.cues[j];
                            cues.push({
                                startTime: cue.startTime,
                                endTime: cue.endTime,
                                text: cue.text,
                                id: cue.id || j.toString(),
                                duration: cue.endTime - cue.startTime
                            });
                        }
                        
                        fullSubtitles.cues = cues;
                        fullSubtitles.totalDuration = this.video.duration || 0;
                        
                        console.log(`Found ${cues.length} subtitle cues in ${track.language || 'unknown'} language`);
                        break;
                    }
                }
            }
            
            return fullSubtitles;
            
        } catch (error) {
            console.error('Error getting full subtitle track:', error);
            return {
                available: false,
                cues: [],
                totalDuration: 0,
                language: null,
                trackInfo: null,
                error: error.message
            };
        }
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
                
            case 'GET_FULL_SUBTITLES':
                const fullSubtitles = this.getFullSubtitleTrack();
                sendResponse({
                    success: true,
                    data: fullSubtitles,
                    videoId: this.getVideoId(),
                    title: this.getVideoTitle(),
                    duration: this.video ? this.video.duration : 0
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