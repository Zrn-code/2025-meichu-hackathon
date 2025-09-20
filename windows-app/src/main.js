import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// 如果 Node.js 版本 < 18，可能需要 polyfill fetch
if (!globalThis.fetch) {
  import('node-fetch').then(({ default: fetch }) => {
    globalThis.fetch = fetch;
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}


let mainWindow;
let avatarWindow = null;
let messageBoxWindow = null;
let informWindow = null;
// informWindow 建立
const createInformWindow = (message = "") => {
  if (informWindow) {
    informWindow.show();
    informWindow.focus();
    informWindow.webContents.send('message-received', message);
    return;
  }

  const informW = 320;
  const informH = 180;
  const spacing = 10;

  // 計算初始位置：優先以 messageBox 的目標位置為基準，否則以 avatar 為基準，否則螢幕右下 fallback
  let startX, startY;
  if (messageBoxWindow && !messageBoxWindow.isDestroyed()) {
    // 如果 messageBox 存在，放在 messageBox 左側
    const mb = messageBoxWindow.getBounds();
    startX = mb.x - 10;
    startY = mb.y - 150;
  } else if (avatarWindow && !avatarWindow.isDestroyed()) {
    const av = avatarWindow.getBounds();
    // 放在 avatar 左側（與 messageBox 類似）
    startX = av.x - 20;
    startY = av.y - 150; // 與 avatar 同垂直位置
  } else {
    // fallback：螢幕右下
    const wa = screen.getPrimaryDisplay().workArea;
    startX = wa.x + wa.width - informW - 12;
    startY = wa.y + wa.height - informH - 12;
  }

  informWindow = new BrowserWindow({
    x: Math.round(startX),
    y: Math.round(startY),
    width: 320,
    height: 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 加載 inform.html
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    informWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/src/inform.html`);
  } else {
    informWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/inform.html`));
  }

  informWindow.on('closed', () => {
    informWindow = null;
  });

  // 初始穿透
  informWindow.setIgnoreMouseEvents(true, { forward: true });

  informWindow.webContents.once('dom-ready', () => {
    informWindow.webContents.send('message-received', message);
    setTimeout(() => {
      setupInformClickRegion();
    }, 100);
  });

  // 若 messageBox 存在，放在 messageBox 左側
  // if (messageBoxWindow) {
  //   updateInformPosition();
  // }
};

const closeInformWindow = () => {
  if (informWindow) {
    informWindow.close();
    informWindow = null;
  }
};

const updateInformPosition = () => {
  if (!informWindow || informWindow.isDestroyed() || !avatarWindow || avatarWindow.isDestroyed()) return;

  const informW = 320;
  const informH = 180;
  const spacing = 2; // 各視窗之間間距

  // 計算 messageBox 最終目標 (以 avatar 為基準)，即使 messageBox 正在動畫中也用這個目標來定位 inform
  let mbTargetX, mbTargetY;
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    const av = avatarWindow.getBounds();
    // messageBox 寬度預設 300, offset 與你的邏輯一致 (300 + 10)
    mbTargetX = av.x; // avatar 左邊: messageBox x
    mbTargetY = av.y-150;       // 與 avatar 同垂直位置
  } else if (messageBoxWindow && !messageBoxWindow.isDestroyed()) {
    // 若 avatar 不可用，但 messageBox 可用，就依 messageBox 當下位置
    const mb = messageBoxWindow.getBounds();
    mbTargetX = mb.x;
    mbTargetY = mb.y;
  } else {
    // 都沒有基準，直接 return
    return;
  }

  // inform 目標在 messageBox 左側
  const targetX = mbTargetX - informW - spacing;
  const targetY = mbTargetY;

  try {
    const cur = informWindow.getBounds();
    // 若位置差異非常小就不更新（避免不必要 setBounds）
    if (Math.abs(cur.x - targetX) <= 1 && Math.abs(cur.y - targetY) <= 1) {
      return;
    }
    // 直接立刻 setBounds（不做動畫）以保持穩定與同步
    informWindow.setBounds({ x: Math.round(targetX), y: Math.round(targetY), width: informW, height: informH });
  } catch (e) {
    // 若有錯誤（例如 window 尚在建立中），僅記 log
    console.error('[updateInformPosition] error', e);
  }
};

// inform page 點擊區域設置
const setupInformClickRegion = () => {
  if (informWindow && !informWindow.isDestroyed()) {
    informWindow.setIgnoreMouseEvents(true, { forward: true });
    informWindow.webContents.on('ipc-message', (event, channel) => {
      if (channel === 'mouse-enter-inform') {
        informWindow.setIgnoreMouseEvents(false);
      } else if (channel === 'mouse-leave-inform') {
        informWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    });
  }
};
// IPC handlers for inform window
ipcMain.handle('show-inform', () => {
  if (informWindow && !informWindow.isDestroyed()) {
    closeInformWindow();
  } else {
    createInformWindow();
  }
  return { success: true };
});

ipcMain.handle('close-inform', () => {
  closeInformWindow();
  return { success: true };
});

ipcMain.handle('is-inform-visible', () => {
  return { visible: informWindow !== null && !informWindow.isDestroyed() };
});

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: 'hiddenInset', // Hide the title bar but keep window controls
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

let lastAvatarImagePath = null;
const loadAvatarImage = (imagePath) => {
  // 如果沒給 imagePath，則用上次的，若第一次則用預設值
  let finalPath = imagePath;
  if (!finalPath) {
    finalPath = lastAvatarImagePath || '/avatar.jpg';
  }
  lastAvatarImagePath = finalPath;
  const urlParam = finalPath ? `?src=${encodeURIComponent(finalPath)}` : '';
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    avatarWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/src/avatar.html${urlParam}`);
  } else {
    // loadFile 不支援 query string，需用 loadURL 並組合 file:// 路徑
    const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/avatar.html`);
    const fileUrl = `file://${filePath.replace(/\\/g, '/')}${urlParam}`;
    avatarWindow.loadURL(fileUrl);
  }
}

const createAvatarWindow = () => {
  if (avatarWindow) {
    avatarWindow.show();
    return;
  }

  avatarWindow = new BrowserWindow({
    width: 80,
    height: 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // // 加載avatar窗口 - 使用主窗口的開發服務器
  // if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  //   avatarWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/src/avatar.html`);
  // } else {
  //   avatarWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/avatar.html`));
  // }
  loadAvatarImage(); // 使用預設圖片

  avatarWindow.on('closed', () => {
    avatarWindow = null;
    // 通知主窗口 avatar 已關閉
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('avatar-closed');
    }
  });

  // 監聽 Avatar 窗口移動，同步更新 MessageBox 位置
  avatarWindow.on('moved', () => {
    updateMessageBoxPosition();
    updateInformPosition();
  });

  // 設置窗口可拖動
  avatarWindow.setIgnoreMouseEvents(false);
};

const closeAvatarWindow = () => {
  if (avatarWindow) {
    avatarWindow.close();
    avatarWindow = null;
  }
  // 隱藏 avatar 時同時關閉 messagebox
  if (messageBoxWindow) {
    closeMessageBoxWindow();
  }
};

const createMessageBoxWindow = (message = "你好！我是你的桌面小助手 🐱") => {
  if (messageBoxWindow) {
    messageBoxWindow.show();
    // 發送新訊息到現有窗口
    messageBoxWindow.webContents.send('message-received', message);
    return;
  }

  messageBoxWindow = new BrowserWindow({
    width: 300,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 加載 MessageBox 窗口
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    messageBoxWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/src/messageBox.html`);
  } else {
    messageBoxWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/messageBox.html`));
  }

  messageBoxWindow.on('closed', () => {
    messageBoxWindow = null;
  });

  // 設置初始鼠標穿透 - 整個窗口都穿透點擊
  messageBoxWindow.setIgnoreMouseEvents(true, { forward: true });

  // 窗口加載完成後發送訊息並設置點擊區域
  messageBoxWindow.webContents.once('dom-ready', () => {
    messageBoxWindow.webContents.send('message-received', message);
    // 設置只有對話框區域可以點擊，其他區域穿透
    setTimeout(() => {
      setupMessageBoxClickRegion();
    }, 100);
  });

  // 如果 avatar 窗口存在，將 MessageBox 放在 avatar 左邊
  if (avatarWindow) {
    updateMessageBoxPosition();
    updateInformPosition();
  }
};

const closeMessageBoxWindow = () => {
  if (messageBoxWindow) {
    messageBoxWindow.close();
    messageBoxWindow = null;
    // 關閉 messageBox 時自動關閉 inform
    closeInformWindow();
  }
};

const updateMessageBoxPosition = () => {
  if (messageBoxWindow && !messageBoxWindow.isDestroyed() && avatarWindow && !avatarWindow.isDestroyed()) {
    const avatarBounds = avatarWindow.getBounds();
    const currentBounds = messageBoxWindow.getBounds();
    const targetBounds = {
      x: avatarBounds.x - 310, // MessageBox 寬度 (300) + 10px 間距
      y: avatarBounds.y,
      width: 300,
      height: 300  // 增加高度
    };

    // 添加動畫效果：使用 requestAnimationFrame 實現平滑移動
    const animatePosition = (startTime) => {
      const duration = 200; // 動畫持續時間 200ms
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      
      // 使用 easeOutCubic 緩動函數
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentX = currentBounds.x + (targetBounds.x - currentBounds.x) * easeProgress;
      const currentY = currentBounds.y + (targetBounds.y - currentBounds.y) * easeProgress;
      
      if (messageBoxWindow && !messageBoxWindow.isDestroyed()) {
        messageBoxWindow.setBounds({
          x: Math.round(currentX),
          y: Math.round(currentY),
          width: targetBounds.width,
          height: targetBounds.height
        });
        
        if (progress < 1) {
          setTimeout(() => animatePosition(startTime), 16); // 約 60fps
        }
      }
    };
    
    // 只有當位置實際發生變化時才執行動畫
    if (Math.abs(currentBounds.x - targetBounds.x) > 2 || Math.abs(currentBounds.y - targetBounds.y) > 2) {
      animatePosition(Date.now());
    }
  }
};

// 設定 MessageBox 窗口的點擊區域
const setupMessageBoxClickRegion = () => {
  if (messageBoxWindow && !messageBoxWindow.isDestroyed()) {
    // 預設穿透所有點擊
    messageBoxWindow.setIgnoreMouseEvents(true, { forward: true });
    
    // 監聽來自 renderer 的訊息來切換點擊狀態
    messageBoxWindow.webContents.on('ipc-message', (event, channel) => {
      if (channel === 'mouse-enter-message') {
        // 滑鼠進入對話框區域，禁用穿透
        messageBoxWindow.setIgnoreMouseEvents(false);
      } else if (channel === 'mouse-leave-message') {
        // 滑鼠離開對話框區域，啟用穿透
        messageBoxWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    });
  }
};

// 定期從後端服務器獲取標籤頁數據
let tabsUpdateTimer = null;
let lastTabsData = null;

const startTabsMonitoring = () => {
  const fetchTabsData = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/tabs');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // 檢查數據是否有變化
          const newDataStr = JSON.stringify(result.data);
          const lastDataStr = JSON.stringify(lastTabsData);
          
          if (newDataStr !== lastDataStr) {
            lastTabsData = result.data;
            
            // 向所有打開的窗口發送標籤頁更新事件
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(window => {
              if (window && !window.isDestroyed()) {
                window.webContents.send('tabs-updated', result.data);
              }
            });
            
            console.log('📊 標籤頁數據已更新:', result.data?.totalTabs || 0, '個標籤頁');
          }
        }
      }
    } catch (error) {
      // 連接失敗時不輸出錯誤，避免日誌噪音
      // console.error('獲取標籤頁數據失敗:', error.message);
    }
  };

  // 立即獲取一次數據
  fetchTabsData();
  
  // 每2秒檢查一次
  tabsUpdateTimer = setInterval(fetchTabsData, 2000);
  
  console.log('📡 開始監控後端服務器的標籤頁數據');
};

const stopTabsMonitoring = () => {
  if (tabsUpdateTimer) {
    clearInterval(tabsUpdateTimer);
    tabsUpdateTimer = null;
    console.log('🛑 停止監控標籤頁數據');
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  console.log('✅ Windows App 已啟動，將連接到後端服務器 (localhost:3000)');
  
  createWindow();
  
  // 開始監控標籤頁數據
  startTabsMonitoring();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 應用程式退出前的清理工作
app.on('before-quit', async () => {
  stopTabsMonitoring();
  console.log('✅ Windows App 正在關閉');
});

// IPC handlers for avatar window
ipcMain.handle('load-avatar', (event, imagePath) => {
  if (avatarWindow) {
    loadAvatarImage(imagePath);
    return { success: true };
  }
  return { success: false, error: 'Avatar 窗口不存在' };
}); 

ipcMain.handle('toggle-avatar', (event, show) => {
  if (show) {
    createAvatarWindow();
  } else {
    closeAvatarWindow();
  }
  return { success: true };
});

ipcMain.handle('is-avatar-visible', () => {
  return { visible: avatarWindow !== null && !avatarWindow.isDestroyed() };
});

ipcMain.handle('close-avatar', () => {
  closeAvatarWindow();
  return { success: true };
});

// IPC handlers for MessageBox window
ipcMain.handle('show-message-box', (event, message) => {
  createMessageBoxWindow(message);
  return { success: true };
});

ipcMain.handle('close-message-box', () => {
  closeMessageBoxWindow();
  return { success: true };
});

ipcMain.handle('is-message-box-visible', () => {
  return { visible: messageBoxWindow !== null && !messageBoxWindow.isDestroyed() };
});

// 後端服務器通信 IPC handlers
ipcMain.handle('get-tabs-data', async () => {
  try {
    const response = await fetch('http://localhost:3000/api/tabs');
    if (response.ok) {
      const result = await response.json();
      return { success: true, data: result.data };
    }
    return { success: false, error: '無法獲取標籤頁數據' };
  } catch (error) {
    return { success: false, error: `後端服務器連接失敗: ${error.message}` };
  }
});

ipcMain.handle('get-server-status', async () => {
  try {
    const response = await fetch('http://localhost:3000/health');
    if (response.ok) {
      const status = await response.json();
      return { 
        success: true, 
        isRunning: true,
        port: 3000,
        status: status
      };
    }
    return { success: false, isRunning: false };
  } catch (error) {
    return { success: false, isRunning: false, error: error.message };
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
