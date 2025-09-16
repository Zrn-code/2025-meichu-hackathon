class FloatingCalculator {
  constructor() {
    this.container = null;
    this.avatar = null;
    this.dialog = null;
    this.display = null;
    this.isDialogOpen = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    
    // 計算機狀態
    this.currentInput = '0';
    this.previousInput = null;
    this.operator = null;
    this.waitingForOperand = false;
    
    this.init();
  }

  init() {
    // 檢查是否已啟用
    try {
      chrome.storage.local.get(['floatingEnabled'], (result) => {
        const enabled = result.floatingEnabled !== false;
        if (enabled) {
          this.createFloatingAvatar();
        }
      });
    } catch (error) {
      // 如果 Chrome API 不可用，直接創建
      this.createFloatingAvatar();
    }
  }

  createFloatingAvatar() {
    // 避免重複創建
    if (this.container) return;

    // 創建容器
    this.container = document.createElement('div');
    this.container.className = 'floating-avatar-container';
    
    // 設定初始位置為右上角，但允許自由移動
    this.container.style.position = 'fixed';
    this.container.style.top = '20px';
    this.container.style.right = '20px';
    this.container.style.zIndex = '2147483647';
    
    // 創建頭像
    this.avatar = document.createElement('div');
    this.avatar.className = 'floating-avatar';
    this.avatar.innerHTML = '🧮';
    
    // 創建計算機對話框
    this.createCalculatorDialog();
    
    // 添加事件監聽器
    this.setupEventListeners();
    
    // 添加到頁面
    this.container.appendChild(this.avatar);
    this.container.appendChild(this.dialog);
    document.body.appendChild(this.container);
  }

  createCalculatorDialog() {
    this.dialog = document.createElement('div');
    this.dialog.className = 'calculator-dialog';
    
    this.dialog.innerHTML = `
      <div class="calculator-header">
        <h3 class="calculator-title">
          <span>🧮</span>
          計算機
        </h3>
        <button class="close-btn">×</button>
      </div>
      <div class="calculator-content">
        <div class="calculator-display">
          <input type="text" class="display-input" value="0" readonly>
        </div>
        <div class="calculator-buttons">
          <button class="calc-btn clear-all">C</button>
          <button class="calc-btn clear-entry">CE</button>
          <button class="calc-btn backspace">⌫</button>
          <button class="calc-btn operator" data-operator="/">÷</button>
          
          <button class="calc-btn number" data-number="7">7</button>
          <button class="calc-btn number" data-number="8">8</button>
          <button class="calc-btn number" data-number="9">9</button>
          <button class="calc-btn operator" data-operator="*">×</button>
          
          <button class="calc-btn number" data-number="4">4</button>
          <button class="calc-btn number" data-number="5">5</button>
          <button class="calc-btn number" data-number="6">6</button>
          <button class="calc-btn operator" data-operator="-">−</button>
          
          <button class="calc-btn number" data-number="1">1</button>
          <button class="calc-btn number" data-number="2">2</button>
          <button class="calc-btn number" data-number="3">3</button>
          <button class="calc-btn operator" data-operator="+">+</button>
          
          <button class="calc-btn number zero" data-number="0">0</button>
          <button class="calc-btn decimal">.</button>
          <button class="calc-btn equals">=</button>
        </div>
      </div>
    `;
    
    this.display = this.dialog.querySelector('.display-input');
  }

  setupEventListeners() {
    // 頭像點擊事件
    this.avatar.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.isDragging) {
        this.toggleDialog();
      }
    });

    // 拖拽功能
    this.avatar.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));

    // 計算機按鈕事件
    const closeBtn = this.dialog.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => this.closeDialog());
    
    // 數字按鈕
    const numberButtons = this.dialog.querySelectorAll('.number');
    numberButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const number = btn.dataset.number;
        this.inputNumber(number);
      });
    });
    
    // 運算符按鈕
    const operatorButtons = this.dialog.querySelectorAll('.operator');
    operatorButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const operator = btn.dataset.operator;
        this.inputOperator(operator);
      });
    });
    
    // 等號按鈕
    const equalsBtn = this.dialog.querySelector('.equals');
    equalsBtn.addEventListener('click', () => this.calculate());
    
    // 小數點按鈕
    const decimalBtn = this.dialog.querySelector('.decimal');
    decimalBtn.addEventListener('click', () => this.inputDecimal());
    
    // 清除按鈕
    const clearAllBtn = this.dialog.querySelector('.clear-all');
    const clearEntryBtn = this.dialog.querySelector('.clear-entry');
    const backspaceBtn = this.dialog.querySelector('.backspace');
    
    clearAllBtn.addEventListener('click', () => this.clearAll());
    clearEntryBtn.addEventListener('click', () => this.clearEntry());
    backspaceBtn.addEventListener('click', () => this.backspace());

    // 點擊外部關閉對話框
    document.addEventListener('click', (e) => {
      if (this.isDialogOpen && 
          !this.dialog.contains(e.target) && 
          !this.avatar.contains(e.target)) {
        this.closeDialog();
      }
    });
  }

  handleMouseDown(e) {
    this.isDragging = false;
    this.dragOffset.x = e.clientX - this.container.offsetLeft;
    this.dragOffset.y = e.clientY - this.container.offsetTop;
    
    // 延遲判斷是否為拖拽
    setTimeout(() => {
      this.isDragging = true;
    }, 100);
  }

  handleMouseMove(e) {
    if (this.isDragging) {
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;
      
      // 允許在整個頁面中自由拖動
      this.container.style.left = x + 'px';
      this.container.style.top = y + 'px';
      this.container.style.right = 'auto';
      
      // 同時更新筆記框位置
      this.updateDialogPosition();
    }
  }

  updateDialogPosition() {
    if (this.dialog && this.container) {
      const containerRect = this.container.getBoundingClientRect();
      const dialogWidth = 280; // 計算機寬度較小
      
      // 計算對話框應該在左邊的位置
      let leftPos = containerRect.left - dialogWidth - 10;
      
      // 如果左邊空間不夠，就放到右邊
      if (leftPos < 10) {
        leftPos = containerRect.right + 10;
      }
      
      this.dialog.style.left = leftPos + 'px';
      this.dialog.style.top = containerRect.top + 'px';
      this.dialog.style.right = 'auto';
    }
  }

  // 計算機邏輯函數
  inputNumber(number) {
    if (this.waitingForOperand) {
      this.currentInput = number;
      this.waitingForOperand = false;
    } else {
      this.currentInput = this.currentInput === '0' ? number : this.currentInput + number;
    }
    this.updateDisplay();
  }

  inputOperator(nextOperator) {
    const inputValue = parseFloat(this.currentInput);

    if (this.previousInput === null) {
      this.previousInput = inputValue;
    } else if (this.operator) {
      const currentValue = this.previousInput || 0;
      const result = this.performCalculation(currentValue, inputValue, this.operator);

      this.currentInput = String(result);
      this.previousInput = result;
      this.updateDisplay();
    }

    this.waitingForOperand = true;
    this.operator = nextOperator;
  }

  calculate() {
    const inputValue = parseFloat(this.currentInput);

    if (this.previousInput !== null && this.operator) {
      const currentValue = this.previousInput || 0;
      const result = this.performCalculation(currentValue, inputValue, this.operator);

      this.currentInput = String(result);
      this.previousInput = null;
      this.operator = null;
      this.waitingForOperand = true;
      this.updateDisplay();
    }
  }

  performCalculation(firstValue, secondValue, operator) {
    switch (operator) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        return secondValue !== 0 ? firstValue / secondValue : 0;
      default:
        return secondValue;
    }
  }

  inputDecimal() {
    if (this.waitingForOperand) {
      this.currentInput = '0.';
      this.waitingForOperand = false;
    } else if (this.currentInput.indexOf('.') === -1) {
      this.currentInput += '.';
    }
    this.updateDisplay();
  }

  clearAll() {
    this.currentInput = '0';
    this.previousInput = null;
    this.operator = null;
    this.waitingForOperand = false;
    this.updateDisplay();
  }

  clearEntry() {
    this.currentInput = '0';
    this.updateDisplay();
  }

  backspace() {
    if (this.currentInput.length > 1) {
      this.currentInput = this.currentInput.slice(0, -1);
    } else {
      this.currentInput = '0';
    }
    this.updateDisplay();
  }

  updateDisplay() {
    if (this.display) {
      this.display.value = this.currentInput;
    }
  }

  handleMouseUp() {
    setTimeout(() => {
      this.isDragging = false;
    }, 100);
  }

  toggleDialog() {
    if (this.isDialogOpen) {
      this.closeDialog();
    } else {
      this.openDialog();
    }
  }

  openDialog() {
    this.isDialogOpen = true;
    this.updateDialogPosition();
    this.dialog.classList.add('show');
  }

  closeDialog() {
    this.isDialogOpen = false;
    this.dialog.classList.remove('show');
  }



  toggle() {
    if (this.container) {
      const isHidden = this.container.classList.contains('hidden');
      if (isHidden) {
        this.container.classList.remove('hidden');
        try {
          chrome.storage.local.set({floatingEnabled: true});
        } catch (error) {
          // Chrome API 不可用時忽略
        }
        return {enabled: true};
      } else {
        this.container.classList.add('hidden');
        this.closeDialog();
        try {
          chrome.storage.local.set({floatingEnabled: false});
        } catch (error) {
          // Chrome API 不可用時忽略
        }
        return {enabled: false};
      }
    } else {
      this.createFloatingAvatar();
      try {
        chrome.storage.local.set({floatingEnabled: true});
      } catch (error) {
        // Chrome API 不可用時忽略
      }
      return {enabled: true};
    }
  }

  clearDisplay() {
    this.clearAll();
  }
}

// 初始化
let floatingCalculator;
let isInitialized = false;

// 初始化函數
function initializeFloatingCalculator() {
  if (!isInitialized) {
    floatingCalculator = new FloatingCalculator();
    isInitialized = true;
  }
}

// 等待頁面載入完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFloatingCalculator);
} else {
  // 延遲初始化，確保頁面完全載入
  setTimeout(initializeFloatingCalculator, 100);
}

// 監聽來自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 確保擴充功能已初始化
  if (!isInitialized) {
    initializeFloatingCalculator();
  }
  
  try {
    if (request.action === 'toggle') {
      const result = floatingCalculator.toggle();
      sendResponse(result);
    } else if (request.action === 'clearDisplay') {
      floatingCalculator.clearDisplay();
      sendResponse({success: true});
    }
  } catch (error) {
    console.error('處理消息時出錯:', error);
    sendResponse({error: error.message});
  }
  
  return true; // 保持消息通道開啟
});