// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Avatar 相關
  toggleAvatar: (show) => ipcRenderer.invoke('toggle-avatar', show),
  isAvatarVisible: () => ipcRenderer.invoke('is-avatar-visible'),
  closeAvatar: () => ipcRenderer.invoke('close-avatar'),
  onAvatarClosed: (callback) => {
    ipcRenderer.on('avatar-closed', callback);
    return () => ipcRenderer.removeListener('avatar-closed', callback);
  },
  
  // MessageBox 相關
  showMessageBox: (message) => ipcRenderer.invoke('show-message-box', message),
  closeMessageBox: () => ipcRenderer.invoke('close-message-box'),
  isMessageBoxVisible: () => ipcRenderer.invoke('is-message-box-visible'),
  onMessageReceived: (callback) => {
    ipcRenderer.on('message-received', (event, message) => callback(message));
    return () => ipcRenderer.removeListener('message-received', callback);
  },
  
  // Tab Monitor 相關
  getTabsData: () => ipcRenderer.invoke('get-tabs-data'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  onTabsUpdated: (callback) => {
    ipcRenderer.on('tabs-updated', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('tabs-updated', callback);
  },
  
  // 發送訊息到主程序
  sendMessage: (channel, data) => ipcRenderer.send(channel, data),
});
