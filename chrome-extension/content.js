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
                console.log('✅ Video element found and listeners attached');
                
                // 等待頁面完全加載後再嘗試獲取標題等資訊
                setTimeout(() => {
                    this.waitForPageContent();
                }, 1000);
                
            } else if (!video) {
                // 如果沒找到視頻，繼續等待
                setTimeout(checkVideo, 500);
            }
        };
        
        checkVideo();
    }
    
    waitForPageContent() {
        const checkContent = () => {
            const title = this.getVideoTitle();
            const channel = this.getChannelName();
            
            if (title && channel) {
                console.log('✅ Page content loaded:', { title, channel });
                return;
            }
            
            // 如果還沒加載完，繼續等待
            setTimeout(checkContent, 500);
        };
        
        checkContent();
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
                
                // 監聽軌道模式變化
                track.addEventListener('modechange', () => {
                    console.log(`🔄 Track ${i} mode changed to: ${track.mode}`);
                    // 當軌道模式改變時，重新檢查完整字幕
                    setTimeout(() => this.sendVideoData(), 500);
                });
            }
        }
        
        // 監聽字幕按鈕點擊
        this.setupSubtitleButtonListeners();
        
        // 監聽劇院模式和全螢幕切換
        this.setupViewModeListeners();
        
        // 初始數據發送
        setTimeout(() => this.sendVideoData(), 1000);
        
        // 延遲顯示彈出窗口（給用戶一些時間適應）
        setTimeout(() => {
            if (this.isVideoPage()) {
                console.log('🎥 YouTube video detected...');
            }
        }, 5000);
        
        // 延遲執行更積極的字幕檢查
        setTimeout(() => {
            console.log('🚀 Performing delayed subtitle check...');
            this.ensureSubtitleTracksLoaded();
            setTimeout(() => this.sendVideoData(), 2000);
        }, 3000);
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
    
    setupViewModeListeners() {
        // 監聽劇院模式按鈕
        const theaterButton = document.querySelector('.ytp-size-button');
        if (theaterButton) {
            theaterButton.addEventListener('click', () => {
                // 延遲發送數據，等待模式切換完成
                setTimeout(() => {
                    console.log('Theater mode toggled');
                    this.sendVideoData();
                }, 300);
            });
        }
        
        // 監聽全螢幕變化事件
        document.addEventListener('fullscreenchange', () => {
            console.log('Fullscreen state changed');
            setTimeout(() => this.sendVideoData(), 100);
        });
        
        // 監聽 ESC 鍵（可能退出全螢幕）
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                setTimeout(() => this.sendVideoData(), 100);
            }
        });
        
        // 使用 MutationObserver 監聽 DOM 變化來檢測劇院模式
        const watchFlexy = document.querySelector('ytd-watch-flexy');
        if (watchFlexy) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'theater' || 
                         mutation.attributeName === 'class')) {
                        console.log('Theater mode attribute changed');
                        setTimeout(() => this.sendVideoData(), 100);
                    }
                });
            });
            
            observer.observe(watchFlexy, {
                attributes: true,
                attributeFilter: ['theater', 'class', 'fullscreen']
            });
            
            this.observers.push(observer);
        }
        
        // 監聽 body 和 html 的 class 變化（YouTube 可能在這些元素上添加劇院模式標記）
        const bodyObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('theater') || 
                        target.classList.contains('theater-mode') ||
                        target.classList.contains('fullscreen')) {
                        console.log('Body/HTML class changed - view mode detected');
                        setTimeout(() => this.sendVideoData(), 100);
                    }
                }
            });
        });
        
        bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        bodyObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        
        this.observers.push(bodyObserver);
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
            console.log('🔍 Getting video data...');
            
            // 獲取基本數據
            const title = this.getVideoTitle();
            const channelName = this.getChannelName();
            const videoId = this.getVideoId();
            
            console.log('📹 Video ID:', videoId);
            console.log('📝 Title:', title);
            console.log('👤 Channel:', channelName);
            console.log('🎬 Video element:', !!this.video);
            
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
                videoId: videoId,
                title: title,
                channelName: channelName,
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
                isTheaterMode: this.isTheaterMode(),
                quality: this.getVideoQuality(),
                
                // 時間戳
                timestamp: Date.now()
            };
            
            console.log('📊 Final data:', data);
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
        // 嘗試多種可能的選擇器
        const titleSelectors = [
            'h1.ytd-watch-metadata #title',
            'h1.title.style-scope.ytd-video-primary-info-renderer',
            'h1.ytd-video-primary-info-renderer',
            '#above-the-fold #title h1',
            '#title h1',
            'h1[class*="title"]',
            'ytd-watch-metadata h1',
            '.ytd-video-primary-info-renderer h1'
        ];
        
        for (const selector of titleSelectors) {
            const titleElement = document.querySelector(selector);
            if (titleElement && titleElement.textContent.trim()) {
                return titleElement.textContent.trim();
            }
        }
        
        // 如果還是找不到，嘗試從 document.title 獲取
        const pageTitle = document.title;
        if (pageTitle && pageTitle !== 'YouTube' && !pageTitle.startsWith('(')) {
            // 移除 " - YouTube" 後綴
            return pageTitle.replace(' - YouTube', '');
        }
        
        return null;
    }
    
    getChannelName() {
        // 嘗試多種可能的選擇器
        const channelSelectors = [
            'ytd-watch-metadata ytd-channel-name a',
            '#owner #channel-name a',
            '#upload-info #owner-name a',
            '.ytd-channel-name a',
            '#channel-name a',
            '#owner-name a',
            'ytd-video-owner-renderer a',
            '.yt-simple-endpoint.style-scope.yt-formatted-string',
            'a[href*="/channel/"]',
            'a[href*="/@"]'
        ];
        
        for (const selector of channelSelectors) {
            const channelElement = document.querySelector(selector);
            if (channelElement && channelElement.textContent.trim()) {
                return channelElement.textContent.trim();
            }
        }
        
        return null;
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
    
    isTheaterMode() {
        // YouTube 劇院模式檢測
        try {
            // 方法 1: 檢查 body 或 html 上的 class
            const body = document.body;
            const html = document.documentElement;
            
            // YouTube 在劇院模式時會添加 theater 相關的 class
            if (body.classList.contains('theater') || 
                body.classList.contains('theater-mode') ||
                html.classList.contains('theater') ||
                html.classList.contains('theater-mode')) {
                return true;
            }
            
            // 方法 2: 檢查頁面容器的 class
            const pageContainer = document.querySelector('#page') || 
                                document.querySelector('#content') ||
                                document.querySelector('ytd-app');
            
            if (pageContainer && 
                (pageContainer.classList.contains('theater') || 
                 pageContainer.classList.contains('theater-mode') ||
                 pageContainer.hasAttribute('theater') ||
                 pageContainer.hasAttribute('theater-mode'))) {
                return true;
            }
            
            // 方法 3: 檢查播放器容器的狀態
            const playerContainer = document.querySelector('#movie_player') ||
                                  document.querySelector('.html5-video-player');
            
            if (playerContainer) {
                // 檢查是否有劇院模式相關的 class 或屬性
                if (playerContainer.classList.contains('ytp-large-width') ||
                    playerContainer.classList.contains('theater') ||
                    playerContainer.classList.contains('theater-mode') ||
                    playerContainer.hasAttribute('theater')) {
                    return true;
                }
            }
            
            // 方法 4: 檢查頁面佈局結構
            const watchFlexy = document.querySelector('ytd-watch-flexy');
            if (watchFlexy) {
                // YouTube 在劇院模式時會修改 ytd-watch-flexy 的屬性
                if (watchFlexy.hasAttribute('theater') ||
                    watchFlexy.classList.contains('theater') ||
                    watchFlexy.hasAttribute('fullscreen') ||
                    watchFlexy.getAttribute('theater') === '' ||
                    watchFlexy.getAttribute('theater') === 'true') {
                    return true;
                }
            }
            
            // 方法 5: 檢查劇院模式按鈕的狀態
            const theaterButton = document.querySelector('.ytp-size-button') ||
                                document.querySelector('[aria-label*="Theater"]') ||
                                document.querySelector('[aria-label*="劇院"]');
            
            if (theaterButton) {
                // 如果按鈕被按下或有 active 狀態
                if (theaterButton.classList.contains('ytp-button-active') ||
                    theaterButton.getAttribute('aria-pressed') === 'true') {
                    return true;
                }
            }
            
            // 方法 6: 透過視窗大小和播放器大小比較（不太準確但可作為輔助）
            const video = document.querySelector('video');
            if (video) {
                const videoRect = video.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                
                // 如果影片寬度接近視窗寬度，可能是劇院模式
                // 這個方法不太準確，因為全螢幕也會如此
                if (videoRect.width > windowWidth * 0.9 && !document.fullscreenElement) {
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('Error detecting theater mode:', error);
            return false;
        }
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
                trackInfo: null,
                debug: {
                    totalTracks: 0,
                    showingTracks: 0,
                    tracksWithCues: 0,
                    disabledTracks: 0,
                    hiddenTracks: 0,
                    methods: []
                }
            };
            
            if (this.video && this.video.textTracks) {
                fullSubtitles.debug.totalTracks = this.video.textTracks.length;
                
                // 先嘗試啟用所有字幕軌道來加載cues
                this.ensureSubtitleTracksLoaded();
                
                // 尋找當前啟用的字幕軌道
                for (let i = 0; i < this.video.textTracks.length; i++) {
                    const track = this.video.textTracks[i];
                    
                    // 統計調試信息
                    if (track.mode === 'showing') {
                        fullSubtitles.debug.showingTracks++;
                    } else if (track.mode === 'disabled') {
                        fullSubtitles.debug.disabledTracks++;
                    } else if (track.mode === 'hidden') {
                        fullSubtitles.debug.hiddenTracks++;
                    }
                    
                    if (track.cues && track.cues.length > 0) {
                        fullSubtitles.debug.tracksWithCues++;
                    }
                    
                    // 優先選擇showing模式的軌道
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
                        
                        // 添加詳細的調試信息
                        fullSubtitles.debug.methods.push('showing-mode');
                        console.log(`🎬 Found ${cues.length} subtitle cues in ${track.language || 'unknown'} language`);
                        console.log(`📊 Track info: Kind=${track.kind}, Label=${track.label}, Mode=${track.mode}`);
                        console.log(`⏱️ Video duration: ${this.video.duration}s, Total subtitle duration: ${cues.length > 0 ? cues[cues.length-1].endTime : 0}s`);
                        break;
                    }
                }
                
                // 如果沒有找到showing模式的軌道，嘗試找任何有cues的軌道
                if (!fullSubtitles.available) {
                    for (let i = 0; i < this.video.textTracks.length; i++) {
                        const track = this.video.textTracks[i];
                        
                        if (track.cues && track.cues.length > 0) {
                            fullSubtitles.available = true;
                            fullSubtitles.language = track.language;
                            fullSubtitles.trackInfo = {
                                kind: track.kind,
                                label: track.label,
                                language: track.language,
                                mode: track.mode,
                                fallback: true  // 標記為備用軌道
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
                            
                            fullSubtitles.debug.methods.push('fallback-mode');
                            console.log(`🔄 Using fallback track with ${cues.length} subtitle cues in ${track.language || 'unknown'} language (Mode: ${track.mode})`);
                            break;
                        }
                    }
                }
                
                // 如果還是沒有找到，嘗試更激進的方法
                if (!fullSubtitles.available) {
                    fullSubtitles.debug.methods.push('aggressive-search');
                    const aggressiveResult = this.getSubtitlesAggressively();
                    if (aggressiveResult && aggressiveResult.cues && aggressiveResult.cues.length > 0) {
                        Object.assign(fullSubtitles, aggressiveResult);
                        console.log(`🚀 Aggressively found ${aggressiveResult.cues.length} subtitle cues`);
                    }
                }
                
                // 輸出調試信息
                console.log(`🔍 Subtitle debug: Total=${fullSubtitles.debug.totalTracks}, Showing=${fullSubtitles.debug.showingTracks}, WithCues=${fullSubtitles.debug.tracksWithCues}, Disabled=${fullSubtitles.debug.disabledTracks}, Hidden=${fullSubtitles.debug.hiddenTracks}`);
                console.log(`🔍 Methods used: ${fullSubtitles.debug.methods.join(', ')}`);
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
                
            case 'REFRESH_SUBTITLE_DATA':
                console.log('🔄 Refreshing subtitle data requested from popup');
                // 重新檢查字幕軌道
                this.ensureSubtitleTracksLoaded();
                // 延遲發送更新的數據
                setTimeout(() => {
                    this.sendVideoData();
                }, 1000);
                sendResponse({ success: true });
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
    
    ensureSubtitleTracksLoaded() {
        // 確保字幕軌道被載入，嘗試各種方法激活字幕軌道
        try {
            if (!this.video || !this.video.textTracks) return;
            
            for (let i = 0; i < this.video.textTracks.length; i++) {
                const track = this.video.textTracks[i];
                
                // 如果軌道是disabled狀態且沒有cues，嘗試暫時啟用它來加載cues
                if (track.mode === 'disabled' && (!track.cues || track.cues.length === 0)) {
                    const originalMode = track.mode;
                    
                    // 暫時設置為hidden來觸發cues加載
                    track.mode = 'hidden';
                    
                    // 等待一小段時間讓cues加載
                    setTimeout(() => {
                        // 如果還是沒有cues，嘗試showing模式
                        if (!track.cues || track.cues.length === 0) {
                            track.mode = 'showing';
                            setTimeout(() => {
                                // 如果現在有cues了，可以恢復原始模式
                                if (track.cues && track.cues.length > 0) {
                                    console.log(`✅ Successfully loaded ${track.cues.length} cues for track ${i} (${track.language})`);
                                    // 可以選擇是否恢復原始模式，或保持showing來讓後續獲取
                                    // track.mode = originalMode;
                                }
                            }, 100);
                        } else {
                            console.log(`✅ Track ${i} (${track.language}) loaded ${track.cues.length} cues in hidden mode`);
                            // track.mode = originalMode;
                        }
                    }, 50);
                }
            }
        } catch (error) {
            console.error('Error ensuring subtitle tracks loaded:', error);
        }
    }
    
    getSubtitlesAggressively() {
        // 更激進的字幕獲取方法
        try {
            console.log('🚀 Attempting aggressive subtitle extraction...');
            
            // 方法1：嘗試從YouTube Player API獲取
            const aggressiveResult = this.tryYouTubePlayerAPI();
            if (aggressiveResult && aggressiveResult.cues && aggressiveResult.cues.length > 0) {
                return aggressiveResult;
            }
            
            // 方法2：嘗試從DOM中尋找字幕相關數據
            const domResult = this.tryExtractFromDOM();
            if (domResult && domResult.cues && domResult.cues.length > 0) {
                return domResult;
            }
            
            // 方法3：嘗試強制啟用所有字幕軌道
            const forceResult = this.tryForceEnableAllTracks();
            if (forceResult && forceResult.cues && forceResult.cues.length > 0) {
                return forceResult;
            }
            
            return null;
            
        } catch (error) {
            console.error('Error in aggressive subtitle extraction:', error);
            return null;
        }
    }
    
    tryYouTubePlayerAPI() {
        try {
            // 嘗試通過YouTube的內部API獲取字幕
            const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
            if (player && player.getSubtitlesUserSettings) {
                console.log('🔍 Found YouTube player with subtitle API');
                // 這裡可以嘗試調用YouTube的內部API
                // 注意：這些是非公開API，可能隨時改變
            }
            
            // 嘗試從window對象中尋找YouTube相關的數據
            if (window.ytInitialPlayerResponse) {
                console.log('🔍 Found ytInitialPlayerResponse');
                const playerResponse = window.ytInitialPlayerResponse;
                if (playerResponse.captions && playerResponse.captions.playerCaptionsTracklistRenderer) {
                    const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
                    if (tracks && tracks.length > 0) {
                        console.log(`🎯 Found ${tracks.length} caption tracks in playerResponse`);
                        // 這裡可以嘗試解析字幕軌道URL
                        return this.parsePlayerResponseCaptions(tracks);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error trying YouTube Player API:', error);
        }
        
        return null;
    }
    
    tryExtractFromDOM() {
        try {
            // 嘗試從DOM中提取字幕相關信息
            console.log('🔍 Trying to extract from DOM...');
            
            // 查找字幕相關的script標籤
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const content = script.textContent;
                if (content && (content.includes('captionTracks') || content.includes('subtitle'))) {
                    console.log('🎯 Found script with caption data');
                    // 這裡可以嘗試解析script中的字幕數據
                }
            }
            
        } catch (error) {
            console.error('Error extracting from DOM:', error);
        }
        
        return null;
    }
    
    tryForceEnableAllTracks() {
        try {
            // 強制啟用所有字幕軌道並等待載入
            console.log('🔍 Force enabling all subtitle tracks...');
            
            if (!this.video || !this.video.textTracks) return null;
            
            const results = [];
            
            for (let i = 0; i < this.video.textTracks.length; i++) {
                const track = this.video.textTracks[i];
                
                // 強制設置為showing模式
                track.mode = 'showing';
                
                // 立即檢查是否有cues
                if (track.cues && track.cues.length > 0) {
                    console.log(`✅ Force enabled track ${i} has ${track.cues.length} cues`);
                    
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
                    
                    return {
                        available: true,
                        cues: cues,
                        totalDuration: this.video.duration || 0,
                        language: track.language,
                        trackInfo: {
                            kind: track.kind,
                            label: track.label,
                            language: track.language,
                            mode: track.mode,
                            forced: true
                        }
                    };
                }
            }
            
        } catch (error) {
            console.error('Error force enabling tracks:', error);
        }
        
        return null;
    }
    
    parsePlayerResponseCaptions(tracks) {
        try {
            // 解析YouTube playerResponse中的字幕軌道
            console.log('🔍 Parsing player response captions...');
            
            // 這是一個複雜的過程，需要發送請求到字幕URL
            // 由於安全限制，我們可能無法直接獲取字幕內容
            // 但至少可以記錄找到的軌道信息
            
            for (const track of tracks) {
                console.log(`📝 Caption track found: ${track.name?.simpleText || 'Unknown'} (${track.languageCode})`);
                if (track.baseUrl) {
                    console.log(`🔗 Caption URL: ${track.baseUrl}`);
                }
            }
            
            // 返回基本信息，即使沒有實際的cues
            return {
                available: true,
                cues: [],
                totalDuration: this.video ? this.video.duration : 0,
                language: tracks[0]?.languageCode,
                trackInfo: {
                    kind: 'subtitles',
                    label: tracks[0]?.name?.simpleText,
                    language: tracks[0]?.languageCode,
                    mode: 'metadata',
                    foundInPlayerResponse: true,
                    tracksCount: tracks.length
                }
            };
            
        } catch (error) {
            console.error('Error parsing player response captions:', error);
        }
        
        return null;
    }
    
    // ===== 彈出窗口相關方法 =====
    

    

    

    

    

    

}

// 初始化 YouTube 監控器
const youtubeMonitor = new YouTubeMonitor();

// 頁面卸載時清理
window.addEventListener('beforeunload', () => {
    youtubeMonitor.destroy();
});