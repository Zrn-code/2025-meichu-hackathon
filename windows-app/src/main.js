import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow;
let avatarWindow = null;
let messageBoxWindow = null;

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

  // 加載avatar窗口 - 使用主窗口的開發服務器
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    avatarWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/src/avatar.html`);
  } else {
    avatarWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/avatar.html`));
  }

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
  }
};

const closeMessageBoxWindow = () => {
  if (messageBoxWindow) {
    messageBoxWindow.close();
    messageBoxWindow = null;
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

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

// IPC handlers for avatar window
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
