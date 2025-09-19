/**
 * YouTube Tab Monitor - Popup Script
 * 管理擴展彈窗界面
 */

class PopupManager {
    constructor() {
        this.isMonitoring = false;
        this.currentTabId = null;
        this.videoData = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateStatus();
        this.checkServerConnection();
        
        // 定期更新狀態
        setInterval(() => {
            this.updateStatus();
        }, 2000);
    }
    
    bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.updateStatus();
            this.checkServerConnection();
        });
        
        document.getElementById('toggleBtn').addEventListener('click', () => {
            this.toggleMonitoring();
        });
    }
    
    async updateStatus() {
        try {
            // 獲取當前監控狀態
            const response = await chrome.runtime.sendMessage({ 
                type: 'GET_MONITORING_STATUS' 
            });
            
            if (response) {
                this.isMonitoring = response.isMonitoring;
                this.currentTabId = response.currentTabId;
                
                this.updateStatusDisplay();
                
                // 如果正在監控，獲取視頻數據
                if (this.isMonitoring && this.currentTabId) {
                    this.requestVideoData();
                }
            }
            
            // 獲取當前標籤頁信息
            const [tab] = await chrome.tabs.query({ 
                active: true, 
                currentWindow: true 
            });
            
            this.updateTabInfo(tab);
            
        } catch (error) {
            console.error('Error updating status:', error);
            this.showError('更新狀態失敗');
        }
    }
    
    updateStatusDisplay() {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const toggleBtn = document.getElementById('toggleBtn');
        
        if (this.isMonitoring) {
            statusDot.className = 'status-dot active';
            statusText.textContent = '正在監控';
            toggleBtn.textContent = '停止監控';
            toggleBtn.className = 'btn';
        } else {
            statusDot.className = 'status-dot inactive';
            statusText.textContent = '未監控';
            toggleBtn.textContent = '開始監控';
            toggleBtn.className = 'btn primary';
        }
    }
    
    updateTabInfo(tab) {
        const tabInfo = document.getElementById('tabInfo');
        
        if (tab && tab.url && tab.url.includes('youtube.com')) {
            tabInfo.textContent = 'YouTube 頁面';
            tabInfo.style.color = '#22c55e';
        } else {
            tabInfo.textContent = '非 YouTube 頁面';
            tabInfo.style.color = '#6b7280';
        }
    }
    
    async requestVideoData() {
        try {
            if (!this.currentTabId) return;
            
            const response = await chrome.tabs.sendMessage(
                this.currentTabId, 
                { type: 'GET_VIDEO_DATA' }
            );
            
            if (response && response.success) {
                this.updateVideoDisplay(response.data);
            }
        } catch (error) {
            console.log('無法獲取視頻數據:', error);
        }
    }
    
    updateVideoDisplay(data) {
        if (!data || !data.hasVideo) {
            document.getElementById('videoInfo').style.display = 'none';
            return;
        }
        
        const videoInfo = document.getElementById('videoInfo');
        videoInfo.style.display = 'block';
        
        // 更新視頻標題
        const title = data.title || '未知視頻';
        document.getElementById('videoTitle').textContent = title;
        
        // 更新頻道名稱
        const channel = data.channelName || '未知頻道';
        document.getElementById('videoChannel').textContent = channel;
        
        // 更新播放進度
        const progress = data.duration > 0 ? (data.currentTime / data.duration) * 100 : 0;
        document.getElementById('progressFill').style.width = `${progress}%`;
        
        // 更新時間信息
        document.getElementById('currentTime').textContent = this.formatTime(data.currentTime);
        document.getElementById('duration').textContent = this.formatTime(data.duration);
        
        // 更新播放狀態
        document.getElementById('playStatus').textContent = data.isPlaying ? '播放中' : '已暫停';
        
        // 更新觀看次數
        const viewCount = data.viewCount || '未知';
        document.getElementById('viewCount').textContent = viewCount;
        
        this.videoData = data;
    }
    
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    async toggleMonitoring() {
        try {
            if (this.isMonitoring) {
                // 停止監控
                await chrome.runtime.sendMessage({ type: 'STOP_MONITORING' });
            } else {
                // 開始監控
                const [tab] = await chrome.tabs.query({ 
                    active: true, 
                    currentWindow: true 
                });
                
                if (!tab || !tab.url || !tab.url.includes('youtube.com')) {
                    this.showError('請在 YouTube 頁面開始監控');
                    return;
                }
                
                const response = await chrome.runtime.sendMessage({ 
                    type: 'START_MONITORING' 
                });
                
                if (!response.success) {
                    this.showError(response.error || '開始監控失敗');
                    return;
                }
            }
            
            // 立即更新狀態
            setTimeout(() => this.updateStatus(), 500);
            
        } catch (error) {
            console.error('Error toggling monitoring:', error);
            this.showError('操作失敗');
        }
    }
    
    async checkServerConnection() {
        const serverStatus = document.getElementById('serverStatus');
        
        try {
            const response = await fetch('http://localhost:3000/health', {
                method: 'GET',
                timeout: 3000
            });
            
            if (response.ok) {
                serverStatus.textContent = '已連接';
                serverStatus.style.color = '#22c55e';
            } else {
                throw new Error('Server responded with error');
            }
        } catch (error) {
            serverStatus.textContent = '未連接';
            serverStatus.style.color = '#ef4444';
        }
    }
    
    showError(message) {
        const errorMsg = document.getElementById('errorMsg');
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
        
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 3000);
    }
}

// 初始化彈窗管理器
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});