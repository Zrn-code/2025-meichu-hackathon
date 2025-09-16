# 故障排除指南

## 🔧 常見錯誤與解決方法

### 1. "Could not establish connection. Receiving end does not exist."

**原因**: 這個錯誤通常發生在擴充功能的popup嘗試與content script通訊，但content script還沒有完全載入。

**解決方法**:
- ✅ 已修正：popup.js現在會檢查`chrome.runtime.lastError`
- 🔄 重新整理頁面後再次嘗試
- 📱 確認擴充功能已正確安裝並啟用

### 2. 頭像沒有顯示

**可能原因**:
- 擴充功能被禁用
- Content script載入失敗
- 網站CSP (Content Security Policy) 阻擋

**解決步驟**:
1. 檢查 `chrome://extensions/` 確認擴充功能已啟用
2. 重新整理頁面
3. 開啟開發者工具查看Console錯誤訊息
4. 點擊擴充功能圖標檢查狀態

### 3. 筆記沒有儲存

**檢查項目**:
- 確認有 `storage` 權限
- 檢查瀏覽器儲存空間是否充足
- 確認沒有無痕模式限制

**解決方法**:
```javascript
// 在Console中檢查儲存內容
chrome.storage.local.get(null, function(items) {
  console.log(items);
});
```

### 4. 在某些網站無法使用

**常見限制網站**:
- Chrome內部頁面 (`chrome://`, `chrome-extension://`)
- 某些Google服務頁面
- 設有嚴格CSP的網站

**解決方案**:
- 這是正常現象，Chrome安全限制
- 在一般網站上應該正常運作

## 🛠️ 調試技巧

### 1. 開啟開發者工具
- 按 F12 或右鍵選擇「檢查」
- 查看Console標籤的錯誤訊息

### 2. 檢查擴充功能狀態
```javascript
// 在Console執行，檢查浮動筆記狀態
console.log('FloatingNotes initialized:', typeof floatingNotes !== 'undefined');
```

### 3. 手動觸發初始化
```javascript
// 如果頭像沒出現，在Console執行
if (typeof initializeFloatingNotes === 'function') {
  initializeFloatingNotes();
}
```

### 4. 清除儲存數據
```javascript
// 清除所有筆記數據
chrome.storage.local.clear(function() {
  console.log('所有數據已清除');
});
```

## 📋 檢查清單

### 安裝檢查
- [ ] Chrome版本 ≥ 88
- [ ] 擴充功能已載入
- [ ] 開發者模式已開啟
- [ ] 所有檔案都在資料夾中

### 功能檢查
- [ ] 頭像是否顯示
- [ ] 點擊頭像是否開啟對話框
- [ ] 拖拽功能是否正常
- [ ] 文字輸入是否儲存
- [ ] 重新載入頁面後筆記是否保留

### 權限檢查
- [ ] `storage` 權限
- [ ] `activeTab` 權限
- [ ] 無痕模式權限 (如需要)

## 🔄 重新安裝步驟

如果遇到持續問題：

1. 移除擴充功能
2. 清除瀏覽器緩存
3. 重新啟動Chrome
4. 重新載入擴充功能
5. 測試功能

## 📞 尋求協助

如果問題依然存在：
1. 記錄錯誤訊息
2. 記錄重現步驟
3. 提供Chrome版本資訊
4. 提供作業系統資訊

---

**大部分問題都可以通過重新整理頁面解決！** 🔄