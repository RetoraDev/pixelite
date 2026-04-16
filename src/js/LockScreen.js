class LockScreen {
  constructor(editor) {
    this.editor = editor;
    
    // Lock screen state
    this.visible = false;
    this.pinInput = '';
    this.passwordInput = '';
    this.errorMessage = '';
    this.inactivityTimer = null;
    this.pageHideTriggered = false;
    this.blurOverlay = null;
    
    // Lock screen settings
    this.lockScreenMode = 'tap';
    this.lockScreenKey = '1234';
    this.lockScreenPassword = '';
    this.showAtStartup = false;
    this.lockOnPageHide = true;
    this.lockAfterInactivity = 'never';
    this.lockScreenMessage = __('Pantalla bloqueada||Pixelite is locked');
    this.useBlurBackdrop = true;
    
    // Load settings
    this.loadSettings();
    
    // Initialize UI
    this.init();
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  loadSettings() {
    try {
      const saved = localStorage.getItem('lock_screen_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.lockScreenMode = settings.mode || 'tap';
        this.lockScreenKey = settings.pin || '1234';
        this.lockScreenPassword = settings.password || '';
        this.showAtStartup = settings.showAtStartup || false;
        this.lockOnPageHide = settings.lockOnPageHide !== false;
        this.lockAfterInactivity = settings.lockAfterInactivity || 'never';
        this.lockScreenMessage = settings.message || __('Pantalla bloqueada||Pixelite is locked');
        this.useBlurBackdrop = settings.useBlurBackdrop !== false;
      }
    } catch (e) {
      console.warn('Failed to load lock screen settings:', e);
    }
  }
  
  saveSettings() {
    const settings = {
      mode: this.lockScreenMode,
      pin: this.lockScreenKey,
      password: this.lockScreenPassword,
      showAtStartup: this.showAtStartup,
      lockOnPageHide: this.lockOnPageHide,
      lockAfterInactivity: this.lockAfterInactivity,
      message: this.lockScreenMessage,
      useBlurBackdrop: this.useBlurBackdrop
    };
    localStorage.setItem('lock_screen_settings', JSON.stringify(settings));
  }
  
  init() {
    this.createLockScreen();
    if (this.showAtStartup) {
      setTimeout(() => this.show(), 100);
    }
    this.startInactivityTimer();
  }
  
  createLockScreen() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'lock-screen-overlay';
    if (this.useBlurBackdrop) {
      this.overlay.classList.add('blur-backdrop');
    }
    this.editor.uiLayer.appendChild(this.overlay);
    
    // Create container (fullscreen)
    this.container = document.createElement('div');
    this.container.className = 'lock-screen-container';
    this.overlay.appendChild(this.container);
    
    // Content wrapper
    this.content = document.createElement('div');
    this.content.className = 'lock-screen-content';
    this.container.appendChild(this.content);
    
    // Lock icon
    const icon = document.createElement('div');
    icon.className = 'lock-screen-icon icon icon-lock';
    this.content.appendChild(icon);
    
    // Message
    this.messageEl = document.createElement('div');
    this.messageEl.className = 'lock-screen-message';
    this.messageEl.textContent = this.lockScreenMessage;
    this.content.appendChild(this.messageEl);
    
    // Dynamic content container
    this.dynamicContent = document.createElement('div');
    this.content.appendChild(this.dynamicContent);
    
    // Error message
    this.errorEl = document.createElement('div');
    this.errorEl.className = 'lock-screen-error';
    this.content.appendChild(this.errorEl);
  }
  
  renderMode() {
    this.dynamicContent.innerHTML = '';
    this.errorEl.textContent = '';
    this.pinInput = '';
    this.passwordInput = '';
    
    switch (this.lockScreenMode) {
      case 'pin':
        this.renderPinMode();
        break;
      case 'password':
        this.renderPasswordMode();
        break;
      case 'tap':
      default:
        this.renderTapMode();
        break;
    }
  }
  
  renderPinMode() {
    // PIN display
    const pinDisplay = document.createElement('div');
    pinDisplay.className = 'lock-screen-pin-display';
    this.pinDots = [];
    for (let i = 0; i < 4; i++) {
      const dot = document.createElement('div');
      dot.className = 'pin-dot';
      pinDisplay.appendChild(dot);
      this.pinDots.push(dot);
    }
    this.dynamicContent.appendChild(pinDisplay);
    
    // Keyboard
    const keyboard = document.createElement('div');
    keyboard.className = 'lock-screen-keyboard';
    
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['backspace', '0', 'check']
    ];
    
    rows.forEach(row => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'keyboard-row';
      
      row.forEach(key => {
        const keyBtn = document.createElement('button');
        keyBtn.className = 'keyboard-key';
        
        if (key === 'backspace' || key === 'check') {
          const iconSpan = document.createElement('span');
          iconSpan.className = `icon icon-${key === 'backspace' ? 'backspace' : 'check-circle'}`;
          keyBtn.appendChild(iconSpan);
          
          if (key === 'backspace') {
            keyBtn.addEventListener('click', () => this.handlePinBackspace());
          } else {
            keyBtn.addEventListener('click', () => this.checkPin(this.pinInput));
          }
        } else {
          keyBtn.textContent = key;
          keyBtn.addEventListener('click', () => this.handlePinInput(key));
        }
        
        rowDiv.appendChild(keyBtn);
      });
      
      keyboard.appendChild(rowDiv);
    });
    
    this.dynamicContent.appendChild(keyboard);
  }
  
  handlePinInput(digit) {
    if (this.pinInput.length < 4) {
      this.pinInput += digit;
      this.updatePinDots();
      
      if (this.pinInput.length === 4) {
        setTimeout(() => this.checkPin(this.pinInput), 100);
      }
    }
  }
  
  handlePinBackspace() {
    this.pinInput = this.pinInput.slice(0, -1);
    this.updatePinDots();
  }
  
  updatePinDots() {
    if (!this.pinDots) return;
    for (let i = 0; i < this.pinDots.length; i++) {
      if (i < this.pinInput.length) {
        this.pinDots[i].classList.add('filled');
      } else {
        this.pinDots[i].classList.remove('filled');
      }
    }
  }
  
  renderPasswordMode() {
    const input = document.createElement('input');
    input.type = 'password';
    input.className = 'lock-screen-password-input';
    input.placeholder = __('Contraseña||Password');
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.checkPassword(input.value);
      }
    });
    this.dynamicContent.appendChild(input);
    this.passwordInputEl = input;
    
    const unlockBtn = document.createElement('button');
    unlockBtn.className = 'lock-screen-unlock-btn';
    unlockBtn.textContent = __('Desbloquear||Unlock');
    unlockBtn.addEventListener('click', () => this.checkPassword(input.value));
    this.dynamicContent.appendChild(unlockBtn);
    
    setTimeout(() => input.focus(), 100);
  }
  
  renderTapMode() {
    const tapArea = document.createElement('div');
    tapArea.className = 'lock-screen-tap-area';
    
    const tapIcon = document.createElement('span');
    tapIcon.className = 'icon icon-tap';
    
    const tapText = document.createElement('div');
    tapText.className = 'lock-screen-tap-text';
    tapText.textContent = __('Toque para desbloquear||Tap to unlock');
    
    tapArea.appendChild(tapIcon);
    tapArea.appendChild(tapText);
    
    this.overlay.addEventListener('click', () => this.unlock());
    
    this.dynamicContent.appendChild(tapArea);
  }
  
  checkPin(pin) {
    const expectedPin = this.lockScreenKey;
    if (pin === expectedPin) {
      this.unlock();
    } else {
      this.showError(__('PIN incorrecto||Invalid PIN'));
      this.pinInput = '';
      this.updatePinDots();
    }
  }
  
  checkPassword(password) {
    const expectedPassword = this.lockScreenPassword || this.lockScreenKey;
    if (password === expectedPassword) {
      this.unlock();
    } else {
      this.showError(__('Contraseña incorrecta||Invalid password'));
      if (this.passwordInputEl) {
        this.passwordInputEl.value = '';
        this.passwordInputEl.focus();
      }
    }
  }
  
  showError(message) {
    this.errorEl.textContent = message;
    setTimeout(() => {
      if (this.errorEl.textContent === message) {
        this.errorEl.textContent = '';
      }
    }, 2000);
  }
  
  setupEventListeners() {
    // Page hide event (tab switch, app background, etc)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.lockOnPageHide && !this.visible) {
        this.pageHideTriggered = true;
        this.show();
      }
    });
    
    // Page hide for older browsers
    window.addEventListener('pagehide', () => {
      if (this.lockOnPageHide && !this.visible) {
        this.pageHideTriggered = true;
        this.show();
      }
    });
    
    // User activity for inactivity timer
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach(event => {
      document.addEventListener(event, () => this.resetInactivityTimer());
    });
    
    // Prevent lock screen from being closed via back button
    window.addEventListener('popstate', (e) => {
      if (this.visible) {
        e.preventDefault();
        history.pushState(null, '', location.href);
      }
    });
  }
  
  startInactivityTimer() {
    this.resetInactivityTimer();
  }
  
  resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    
    if (this.lockAfterInactivity !== 'never' && !this.visible) {
      const timeout = this.getInactivityTimeout();
      if (timeout > 0) {
        this.inactivityTimer = setTimeout(() => {
          if (!this.visible) {
            this.show();
          }
        }, timeout);
      }
    }
  }
  
  getInactivityTimeout() {
    const timeouts = {
      '10s': 10000,
      '30s': 30000,
      '1m': 60000,
      '5m': 300000,
      '10m': 600000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000
    };
    return timeouts[this.lockAfterInactivity] || 0;
  }
  
  show() {
    if (this.visible) return;
    
    // Save current state before locking
    if (this.editor.saveProjectToLocalStorage) {
      this.editor.saveProjectToLocalStorage();
    }
    
    this.renderMode();
    this.messageEl.textContent = this.lockScreenMessage;
    
    if (this.useBlurBackdrop) {
      this.overlay.classList.add('blur-backdrop');
    } else {
      this.overlay.classList.remove('blur-backdrop');
    }
    
    // Reset overlay styles
    if (this.overlay) {
      this.overlay.style.backdropFilter = '';
      this.overlay.style.backgroundColor = '';
    }
    
    this.overlay.classList.add('visible');
    this.visible = true;
    
    // Push history state to prevent back button from bypassing lock
    history.pushState(null, '', location.href);
  }
  
  hide() {
    if (!this.visible) return;
    this.overlay.classList.remove('visible');
    this.visible = false;
    this.pageHideTriggered = false;
    this.resetInactivityTimer();
  }
  
  unlock() {
    this.hide();
    if (this.editor.onUnlock) {
      this.editor.onUnlock();
    }
  }
  
  updateSettings(settings) {
    if (settings.mode !== undefined) this.lockScreenMode = settings.mode;
    if (settings.pin !== undefined) this.lockScreenKey = settings.pin;
    if (settings.password !== undefined) this.lockScreenPassword = settings.password;
    if (settings.showAtStartup !== undefined) this.showAtStartup = settings.showAtStartup;
    if (settings.lockOnPageHide !== undefined) this.lockOnPageHide = settings.lockOnPageHide;
    if (settings.lockAfterInactivity !== undefined) {
      this.lockAfterInactivity = settings.lockAfterInactivity;
      this.resetInactivityTimer();
    }
    if (settings.message !== undefined) this.lockScreenMessage = settings.message;
    if (settings.useBlurBackdrop !== undefined) this.useBlurBackdrop = settings.useBlurBackdrop;
    
    this.saveSettings();
    
    if (this.visible) {
      this.renderMode();
      this.messageEl.textContent = this.lockScreenMessage;
    }
  }
  
  isLocked() {
    return this.visible;
  }
}
