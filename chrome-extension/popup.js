/**
 * Popup Manager with Data Log Display
 */
class PopupManager {
    constructor() {
        this.logContainer = null;
        this.clearButton = null;
        this.init();
    }
    
    init() {
        console.log('Popup with data log initialized');
        this.logContainer = document.getElementById('logContainer');
        this.clearButton = document.getElementById('clearLogs');
        
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clearLogs());
        }
        
        this.loadDataLogs();
        
        // 每2秒自動刷新日誌，確保能看到最新數據
        setInterval(() => this.loadDataLogs(), 2000);
    }
    
    async loadDataLogs() {
        try {
            const result = await chrome.storage.local.get(['dataLogs']);
            const logs = result.dataLogs || [];
            
            this.displayLogs(logs);
            
        } catch (error) {
            console.error('Error loading data logs:', error);
            this.logContainer.innerHTML = '<div style="color: #f44336;">載入日誌時發生錯誤</div>';
        }
    }
    
    displayLogs(logs) {
        if (!logs || logs.length === 0) {
            this.logContainer.innerHTML = '<div style="color: #666;">暫無數據發送記錄</div>';
            return;
        }
        
        const html = logs.slice(0, 20).map(log => this.formatLogEntry(log)).join('');
        this.logContainer.innerHTML = html;
    }
    
    formatLogEntry(log) {
        const time = new Date(log.timestamp).toLocaleTimeString('zh-TW');
        const statusClass = log.status === 'success' ? 'success' : 
                           log.status === 'error' ? 'error' : 'failed';
        
        let dataPreview = '';
        if (log.data) {
            if (log.data.type === 'youtube_data') {
                // 顯示完整的 YouTube 數據
                const title = this.sanitizeText(log.data.title) || '未知標題';
                const channel = this.sanitizeText(log.data.channelName) || '未知頻道';
                
                dataPreview = `<div><strong>影片:</strong> ${title}</div>`;
                dataPreview += `<div><strong>頻道:</strong> ${channel}</div>`;
                
                if (log.data.videoId) {
                    dataPreview += `<div><strong>ID:</strong> ${log.data.videoId}</div>`;
                }
                
                // 顯示播放模式狀態
                dataPreview += `<div><strong>模式:</strong> `;
                const modes = [];
                if (log.data.isFullscreen) modes.push('全螢幕');
                if (log.data.isTheaterMode) modes.push('影劇模式');
                if (modes.length === 0) modes.push('一般模式');
                dataPreview += modes.join(', ') + `</div>`;
                
                // 顯示播放狀態
                if (log.data.isPlaying !== undefined) {
                    dataPreview += `<div><strong>狀態:</strong> ${log.data.isPlaying ? '播放中' : '暫停'}</div>`;
                }
                
                // 顯示時間信息
                if (log.data.currentTime !== undefined && log.data.duration !== undefined) {
                    const current = this.formatTime(log.data.currentTime);
                    const total = this.formatTime(log.data.duration);
                    dataPreview += `<div><strong>時間:</strong> ${current} / ${total}</div>`;
                }
                
                // 顯示 URL
                if (log.data.url) {
                    const shortUrl = log.data.url.length > 50 ? log.data.url.substring(0, 50) + '...' : log.data.url;
                    dataPreview += `<div><strong>URL:</strong> ${shortUrl}</div>`;
                }
                
            } else if (log.data.type === 'tab_count') {
                dataPreview = `<div><strong>標籤頁統計:</strong> 總共${log.data.totalTabs}個 (YouTube: ${log.data.youtubeTabs}個)</div>`;
            } else if (log.data.type === 'stop_monitoring') {
                dataPreview = `<div><strong>操作:</strong> 停止監控</div>`;
            } else {
                dataPreview = `<div><strong>資料類型:</strong> ${log.data.type || '未知'}</div>`;
            }
        }
        
        return `
            <div class="log-item ${statusClass}">
                <div class="log-time">
                    ${time}
                    <span class="log-status status-${statusClass}">${this.getStatusText(log.status)}</span>
                </div>
                <div class="log-data">${dataPreview}</div>
                ${log.statusText !== 'OK' ? `<div style="color: #f44336; font-size: 9px;">錯誤: ${log.statusText}</div>` : ''}
            </div>
        `;
    }
    
    sanitizeText(text) {
        if (!text) return '';
        
        // 移除或替換可能造成顯示問題的字符
        return text
            .replace(/[^\u0000-\u007F\u4e00-\u9fff\u3400-\u4dbf]/g, '') // 只保留ASCII和中文字符
            .trim();
    }
    
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    getStatusText(status) {
        switch (status) {
            case 'success': return '✓ 成功';
            case 'error': return '✗ 錯誤';
            case 'failed': return '! 失敗';
            default: return status;
        }
    }
    
    async clearLogs() {
        try {
            await chrome.storage.local.set({ dataLogs: [] });
            this.logContainer.innerHTML = '<div style="color: #666;">日誌已清除</div>';
            console.log('Data logs cleared');
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});