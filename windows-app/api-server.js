import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';

class TabMonitorServer extends EventEmitter {
  constructor() {
    super();
    this.app = express();
    this.port = 3001;
    this.server = null;
    this.latestTabsData = null;
    this.isRunning = false;
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    // 啟用 CORS 來允許 Chrome Extension 的請求
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Access-Control-Allow-Origin']
    }));
    
    // 解析 JSON 請求
    this.app.use(express.json({ limit: '10mb' }));
    
    // 添加請求日志
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }
  
  setupRoutes() {
    // 健康檢查端點
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Tab Monitor Server is running'
      });
    });
    
    // 接收 Chrome Extension 的標籤頁資料
    this.app.post('/api/tabs', (req, res) => {
      try {
        const tabsData = req.body;
        
        // 驗證資料格式
        if (!tabsData || !Array.isArray(tabsData.tabs)) {
          return res.status(400).json({
            success: false,
            error: '無效的標籤頁資料格式'
          });
        }
        
        // 儲存最新的標籤頁資料
        this.latestTabsData = {
          ...tabsData,
          receivedAt: new Date().toISOString()
        };
        
        // 觸發事件通知其他組件
        this.emit('tabsUpdated', this.latestTabsData);
        
        // 記錄接收到的資料
        console.log(`✅ 收到標籤頁資料: ${tabsData.totalTabs} 個標籤頁`);
        console.log(`   活動標籤頁: ${this.getActiveTabTitle(tabsData.tabs)}`);
        
        res.json({
          success: true,
          message: '標籤頁資料已接收',
          receivedTabs: tabsData.totalTabs,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('處理標籤頁資料時發生錯誤:', error);
        res.status(500).json({
          success: false,
          error: '伺服器內部錯誤'
        });
      }
    });
    
    // 獲取最新的標籤頁資料
    this.app.get('/api/tabs', (req, res) => {
      res.json({
        success: true,
        data: this.latestTabsData,
        timestamp: new Date().toISOString()
      });
    });
    
    // 獲取標籤頁統計資訊
    this.app.get('/api/tabs/stats', (req, res) => {
      if (!this.latestTabsData) {
        return res.json({
          success: true,
          data: {
            totalTabs: 0,
            hasData: false,
            message: '尚未收到標籤頁資料'
          }
        });
      }
      
      const stats = this.calculateTabStats(this.latestTabsData.tabs);
      
      res.json({
        success: true,
        data: {
          ...stats,
          hasData: true,
          lastUpdated: this.latestTabsData.receivedAt
        }
      });
    });
    
    // 404 處理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: '找不到指定的端點'
      });
    });
  }
  
  // 啟動服務器
  start() {
    if (this.isRunning) {
      console.log('服務器已經在運行中');
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          console.error('無法啟動 API 服務器:', err);
          reject(err);
          return;
        }
        
        this.isRunning = true;
        console.log(`🚀 Tab Monitor API 服務器已啟動`);
        console.log(`   監聽端口: http://localhost:${this.port}`);
        console.log(`   健康檢查: http://localhost:${this.port}/health`);
        console.log(`   標籤頁端點: http://localhost:${this.port}/api/tabs`);
        
        resolve();
      });
    });
  }
  
  // 停止服務器
  stop() {
    if (!this.isRunning || !this.server) {
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        console.log('🛑 API 服務器已停止');
        resolve();
      });
    });
  }
  
  // 獲取活動標籤頁的標題
  getActiveTabTitle(tabs) {
    const activeTab = tabs.find(tab => tab.isActive);
    return activeTab ? activeTab.title : '無活動標籤頁';
  }
  
  // 計算標籤頁統計資訊
  calculateTabStats(tabs) {
    if (!tabs || tabs.length === 0) {
      return {
        totalTabs: 0,
        activeTabs: 0,
        loadingTabs: 0,
        uniqueDomains: 0
      };
    }
    
    const activeTabs = tabs.filter(tab => tab.isActive).length;
    const loadingTabs = tabs.filter(tab => tab.status === 'loading').length;
    
    // 計算唯一域名數量
    const domains = new Set();
    tabs.forEach(tab => {
      try {
        if (tab.url && tab.url.startsWith('http')) {
          const url = new URL(tab.url);
          domains.add(url.hostname);
        }
      } catch (e) {
        // 忽略無效的 URL
      }
    });
    
    return {
      totalTabs: tabs.length,
      activeTabs: activeTabs,
      loadingTabs: loadingTabs,
      uniqueDomains: domains.size
    };
  }
  
  // 獲取最新資料
  getLatestData() {
    return this.latestTabsData;
  }
  
  // 檢查服務器是否運行
  isServerRunning() {
    return this.isRunning;
  }
}

// 匯出服務器類別
export default TabMonitorServer;

// 如果直接執行此文件，則啟動服務器
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new TabMonitorServer();
  
  // 監聽標籤頁更新事件
  server.on('tabsUpdated', (data) => {
    console.log('📊 標籤頁資料已更新:', {
      總數: data.totalTabs,
      時間: data.receivedAt
    });
  });
  
  // 啟動服務器
  server.start().catch((error) => {
    console.error('啟動服務器失敗:', error);
    process.exit(1);
  });
  
  // 優雅關閉
  process.on('SIGINT', async () => {
    console.log('\n正在關閉服務器...');
    await server.stop();
    process.exit(0);
  });
}
