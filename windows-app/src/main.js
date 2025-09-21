import { app, BrowserWindow, ipcMain, shell, screen } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
const fs = require("fs");
const fsp = require("fs").promises;
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
let messagePanelWindow = null;
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
    startY = mb.y - 100;
  } else if (avatarWindow && !avatarWindow.isDestroyed()) {
    const av = avatarWindow.getBounds();
    // 放在 avatar 左側（與 messageBox 類似）
    startX = av.x - 310;
    startY = av.y - 100; // 與 avatar 同垂直位置
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
    mbTargetY = av.y-100;       // 與 avatar 同垂直位置
  } else if (messageBoxWindow && !messageBoxWindow.isDestroyed()) {
    // 若 avatar 不可用，但 messageBox 可用，就依 messageBox 當下位置
    const mb = messageBoxWindow.getBounds();
    mbTargetX = mb.x;
    mbTargetY = mb.y-100;
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

  // 取得螢幕資訊
  const display = screen.getPrimaryDisplay();
  const { x: screenX, y: screenY, width: screenW } = display.workArea;
  const avatarW = 80, avatarH = 80;
  const marginX = 16; // 距離螢幕邊緣的距離
  const marginY = 200; // 距離螢幕邊緣的距離

  avatarWindow = new BrowserWindow({
    width: avatarW,
    height: avatarH,
    x: screenX + screenW - avatarW - marginX, // 右上角
    y: screenY + marginY,
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

  loadAvatarImage(); // 使用預設圖片

  avatarWindow.on('closed', () => {
    avatarWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('avatar-closed');
    }
  });

  avatarWindow.on('moved', () => {
    updateMessageBoxPosition();
  });
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
  if( informWindow ) {
    closeInformWindow();
  }
};

const createMessageBoxWindow = (message = "你好！我是你的桌面小助手 🐱") => {
  console.log("Creating MessageBox window with message:", message);
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
  
  // 如果 avatar 窗口存在，將 MessageBox 放在 avatar 左邊
  if (avatarWindow) {
    updateMessageBoxPosition();
    updateMessagePanelPosition();
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

const updateMessagePanelPosition = () => {
  if (messagePanelWindow && !messagePanelWindow.isDestroyed() && avatarWindow && !avatarWindow.isDestroyed()) {
    const avatarBounds = messagePanelWindow.getBounds();
    const currentBounds = messagePanelWindow.getBounds();
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
      
      if (messagePanelWindow && !messagePanelWindow.isDestroyed()) {
        messagePanelWindow.setBounds({
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

// 建立 messagePanelWindow
const createMessagePanelWindow = (message = "") => {
  console.log("Creating MessagePanel window with message:", message);
  if (messagePanelWindow) {
    messagePanelWindow.show();
    // 發送新訊息到現有窗口
    messagePanelWindow.webContents.send('message-received', message);
    return;
  }

  messagePanelWindow = new BrowserWindow({
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

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    messagePanelWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/src/messagePanel.html`);
  } else {
    messagePanelWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/messagePanel.html`));
  }

  messagePanelWindow.on('closed', () => {
    messagePanelWindow = null;
  });
  // 可根據 avatarWindow 位置定位
  if (avatarWindow) {
    const av = avatarWindow.getBounds();
    messagePanelWindow.setBounds({
      x: av.x + av.width + 20,
      y: av.y,
      width: 400,
      height: 200,
    });
  }
};

const closeMessagePanelWindow = () => {
  if (messagePanelWindow) {
    messagePanelWindow.close();
    messagePanelWindow = null;
  }
};

// IPC handlers for MessagePanel window
ipcMain.handle('show-message-panel', (event, message) => {
  createMessagePanelWindow(message);
  return { success: true };
});

ipcMain.handle('close-message-panel', () => {
  closeMessagePanelWindow();
  return { success: true };
});

ipcMain.handle('is-message-panel-visible', () => {
  return { visible: messagePanelWindow !== null && !messagePanelWindow.isDestroyed() };
});

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
            
            // console.log('📊 標籤頁數據已更新:', result.data?.totalTabs || 0, '個標籤頁');
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

function isHttpUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

ipcMain.handle('open-external-url', async (_event, url) => {
  if (!isHttpUrl(url)) throw new Error('Only http(s) URLs are allowed.');
  await shell.openExternal(url); // 會用預設瀏覽器開啟
});

function resolveNotebookDir() {
  const candidates = [
    path.join(app.getAppPath(), "src", "data", "note"),
    path.join(process.resourcesPath || "", "src", "data", "note"),
    path.join(__dirname, "src", "data", "note"),
  ];
  for (const p of candidates) {
    try { fs.accessSync(p, fs.constants.R_OK); return p; } catch {}
  }
  return null;
}

// 幫你把任何常見結構展開成 [{keywords, url}, ...]
function extractNotePairs(data) {
  const out = [];
  const pushCandidate = (obj) => {
    if (obj && typeof obj === "object" && obj.Keyword != null && obj.url != null) {
      out.push({ keywords: String(obj.Keyword), url: String(obj.url) });
    }
  };

  data.forEach(pushCandidate);
  return out;
}

ipcMain.handle("notebook:list", async () => {
  const dir = resolveNotebookDir();
  if (!dir) return [];

  const files = await fsp.readdir(dir);
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
  const rows = [];

  for (const filename of jsonFiles) {
    const full = path.join(dir, filename);
    try {
      const text = await fsp.readFile(full, "utf8");
      const data = JSON.parse(text);
      const pairs = extractNotePairs(data);
      pairs.forEach((p, i) => {
        rows.push({
          id: `${filename}:${i}`,     // 供 React key 使用
          filename,
          keywords: p.keywords,
          url: p.url,
        });
        console.log(p.keywords, p.url);
      });
    } catch (e) {
      console.error("[notebook:list] 讀取失敗:", filename, e);
    }
  }
  return rows;
});

//
// function resolveYoutubeMetaDataDir() {
//   const candidates = [
//     path.join(app.getAppPath(), "public", "youtubeCover"),
//     path.join(process.resourcesPath || "", "public", "youtubeCover"),
//     path.join(__dirname, "public", "youtubeCover"),
//   ];
//   for (const p of candidates) {
//     try { fs.accessSync(p, fs.constants.R_OK); return p; } catch {}
//   }
//   return null;
// }

// function extractYoutubeMetaData(data) {
//   const out = [];
//   const pushCandidate = (obj) => {
//     if (obj && typeof obj === "object" && obj.title != null && obj.upload_date != null && obj.view_count != null && obj.like_count != null && obj.url != null) {
//       out.push({ title: String(obj.keywords), upload_date: String(obj.upload_date), view_count: obj.view_count, like_count: obj.like_count, tags: obj.tags, url: String(obj.url) } );
//     }
//   };

//   data.forEach(pushCandidate);
//   return out;
// }

// ipcMain.handle("fetch-youtube-metadata", async () => {
//   const dir = resolveYoutubeMetaDataDir();
//   if (!dir) return [];

//   const files = await fsp.readdir(dir);
//   const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
//   print("jsonFiles:", jsonFiles)
//   const rows = [];

//   for (const filename of jsonFiles) {
//     const full = path.join(dir, filename);
//     try {
//       const text = await fsp.readFile(full, "utf8");
//       const data = JSON.parse(text);
//       const pairs = extractYoutubeMetaData(data);
//       console.log(pairs)
//       pairs.forEach((p, i) => {
//         rows.push(p);
//         if (p == null){
//           print("NOTHING!")
//           console.log("null")
//         }
//       });
//     } catch (e) {
//       console.error("[youtube-metadata] 讀取失敗:", filename, e);
//     }
//   }
//   return rows;
// });