/**
 * Pixelite: Real-time collaborative pixel art editor with animation support
 * Copyright (C) RETORA 2026
 * Licensed under the Pixelite License (see LICENSE file for full terms)
 * 
 * Source: https://github.com/RetoraDev/pixelite
 * Version: v1.0.1 dev
 * Built: 3/26/2026, 3:41:58 AM
 * Platform: Development
 * Debug: false
 * Minified: false
 */

const COPYRIGHT = "(C) RETORA 2026";
const VERSION = "v1.0.1 dev";
const HOST = "wss://pixelite.onrender.com";
const DEBUG = false;

// Global language processor
window.__ = function(text) {
  if (typeof text !== 'string') return text;

  // Get current language from SettingsManager if available
  const language = window.settings?.getLanguage?.() || 0;

  // First handle parenthetical cases (ES|EN) - these are the highest priority
  // Matches patterns like (Hello|Hola) and replaces with the appropriate language
  const parenRegex = /\(([^|)]+)\|([^)]+)\)/g;
  text = text.replace(parenRegex, (match, enText, esText) => {
    return language === 0 ? esText : enText;
  });

  // Then handle simple split case (text||text)
  // These are lower priority and won't interfere with already processed parentheses
  const simpleSplitRegex = /([^|(]+\|\|[^|)]+)/g;
  text = text.replace(simpleSplitRegex, match => {
    const parts = match.split('||');
    return parts[language] || parts[0];
  });
  
  // Fix some artifacts
  text = text.replace('))', ')');

  return text;
};

// Open external URL
window.openExternalUrl = url => {
  // Ensure URL is properly encoded
  const encodedUrl = encodeURI(url);
  
  const isCordova = typeof window.cordova != undefined;
  
  if (isCordova) {
    navigator.app.loadUrl(encodedUrl, { openExternal: true });
  } else {
    const a = document.createElement('a');
    a.href = encodedUrl;
    a.target = '_blank';
    a.click();
  }
};

// fetch() polyfill for file protocol 
(function() {
  'use strict';
  
  // Only apply polyfill if running in file protocol
  if (window.location.protocol !== 'file:') {
    return;
  }

  // Check if we need to polyfill
  const originalFetch = window.fetch;

  async function fileProtocolFetch(input, init = {}) {
    // Handle Request object if passed
    let url = input;
    let options = { ...init };

    if (input instanceof Request) {
      url = input.url;
      options = {
        method: input.method,
        headers: input.headers,
        body: input.body,
        mode: input.mode,
        credentials: input.credentials,
        cache: input.cache,
        redirect: input.redirect,
        referrer: input.referrer,
        integrity: input.integrity,
        ...init
      };
    }

    // Parse URL to determine if it's relative or absolute
    let fullUrl;
    try {
      fullUrl = new URL(url, window.location.href);
    } catch (e) {
      fullUrl = new URL(url);
    }

    // For absolute URLs with different protocol, use original fetch if available
    if (fullUrl.protocol !== 'file:' && fullUrl.protocol !== 'about:' && originalFetch) {
      return originalFetch(input, init);
    }

    // Handle file:// or relative paths
    const filePath = fullUrl.href.replace(/^file:\/\//, '').replace(/^\//, '');
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Determine method
      const method = (options.method || 'GET').toUpperCase();
      
      xhr.open(method, fullUrl.href, true);
      
      // Set headers
      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            xhr.setRequestHeader(key, value);
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        } else if (typeof options.headers === 'object') {
          Object.entries(options.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }
      }
      
      // Set response type for blob/buffer/etc
      if (options.responseType) {
        xhr.responseType = options.responseType;
      }
      
      // Handle credentials
      xhr.withCredentials = options.credentials === 'include';
      
      // Handle timeout
      if (options.timeout) {
        xhr.timeout = options.timeout;
      }
      
      // Create Response object
      function createResponse(xhr) {
        const headers = new Headers();
        const responseHeaders = xhr.getAllResponseHeaders();
        responseHeaders.split('\r\n').forEach(line => {
          const [key, value] = line.split(': ');
          if (key && value) {
            headers.append(key, value);
          }
        });
        
        let body = xhr.response;
        
        // Handle different response types
        if (xhr.responseType === '' || xhr.responseType === 'text') {
          body = xhr.responseText;
        }
        
        const responseInit = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headers
        };
        
        return new Response(body, responseInit);
      }
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(createResponse(xhr));
        } else {
          reject(new TypeError(`Failed to fetch: ${xhr.status} ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new TypeError('Failed to fetch: Network error'));
      };
      
      xhr.ontimeout = () => {
        reject(new TypeError('Failed to fetch: Timeout'));
      };
      
      // Send request
      if (options.body) {
        xhr.send(options.body);
      } else {
        xhr.send();
      }
    });
  }

  // Override fetch
  window.fetch = fileProtocolFetch;
  
  // Also polyfill window.fetch if needed for older browsers
  if (!window.Promise) {
    console.warn('Promise polyfill required for fetch polyfill');
  }
})();

// Settings Manager Class
class SettingsManager {
  constructor(editor) {
    this.editor = editor;
    this.categories = [];
    this.settings = new Map();
    this.values = new Map();
    this.listeners = new Map();
    this.initialized = false;
    this.language = 0; // 0 = Español, 1 = English
    
    // Load saved settings
    this.load();
  }

  // Category management
  addCategory(config) {
    const category = {
      id: config.id || `category-${this.categories.length}`,
      title: config.title || 'Category',
      icon: config.icon || 'icon-settings',
      settings: [],
      addSetting: setting => this.addSetting(config.id, setting)
    };
    
    this.categories.push(category);
    return category;
  }

  // Add setting to category
  addSetting(categoryId, config) {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) throw new Error(`Category ${categoryId} not found`);

    const setting = {
      id: config.id || `setting-${Date.now()}-${Math.random()}`,
      label: config.label || 'Setting',
      description: config.description || '',
      type: config.type || 'boolean', // 'boolean', 'number', 'select', 'text', 'color', 'range'
      defaultValue: config.defaultValue,
      value: config.defaultValue,
      options: config.options || [], // for select type
      min: config.min,
      max: config.max,
      step: config.step,
      
      // Callbacks
      needsReload: config.needsReload || false,
      onInit: config.onInit || null,
      onUpdate: config.onUpdate || null,
      
      // UI
      visible: config.visible !== false,
      disabled: config.disabled || false
    };

    category.settings.push(setting);
    this.settings.set(setting.id, setting);
    
    // Set initial value
    const savedValue = this.values.get(setting.id);
    if (savedValue !== undefined) {
      setting.value = savedValue;
    } else {
      this.values.set(setting.id, setting.defaultValue);
    }
    
    return setting;
  }

  // Get setting value
  get(settingId) {
    return this.values.get(settingId);
  }

  // Get language (for global __ function)
  getLanguage() {
    return this.language;
  }

  // Update setting value
  set(settingId, value, skipSave = false) {
    const setting = this.settings.get(settingId);
    if (!setting) return false;

    const oldValue = this.values.get(settingId);
    if (oldValue === value) return false;

    // Update value
    this.values.set(settingId, value);
    setting.value = value;

    // Trigger onUpdate callback
    if (setting.onUpdate) {
      setting.onUpdate(value, oldValue, this.editor);
    }

    // Notify listeners
    if (this.listeners.has(settingId)) {
      this.listeners.get(settingId).forEach(cb => cb(value, oldValue));
    }

    // Auto-save if not skipped
    if (!skipSave) {
      this.save();
    }

    // Check if reload needed
    if (setting.needsReload) {
      this.pendingReload = true;
    }

    return true;
  }

  // Subscribe to setting changes
  subscribe(settingId, callback) {
    if (!this.listeners.has(settingId)) {
      this.listeners.set(settingId, []);
    }
    this.listeners.get(settingId).push(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(settingId);
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  }

  // Initialize all settings
  init() {
    if (this.initialized) return;
    
    // Run onInit for all settings
    this.settings.forEach(setting => {
      if (setting.onInit) {
        setting.onInit(this.get(setting.id), this.editor);
      }
    });
    
    this.initialized = true;
  }

  // Save settings to localStorage
  save() {
    const saveData = {
      language: this.language,
      values: {}
    };
    
    this.values.forEach((value, key) => {
      saveData.values[key] = value;
    });
    
    localStorage.setItem('app_settings', JSON.stringify(saveData));
  }

  // Load settings from localStorage
  load() {
    try {
      const saved = localStorage.getItem('app_settings');
      if (saved) {
        const data = JSON.parse(saved);
        this.language = data.language || 0;
        
        if (data.values) {
          Object.entries(data.values).forEach(([key, value]) => {
            this.values.set(key, value);
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  // Reset setting to default
  reset(settingId) {
    const setting = this.settings.get(settingId);
    if (setting) {
      this.set(settingId, setting.defaultValue);
    }
  }

  // Reset all settings to defaults
  resetAll() {
    this.settings.forEach(setting => {
      this.set(setting.id, setting.defaultValue, true);
    });
    this.save();
  }

  // Check if restart is needed
  isRestartNeeded() {
    return this.pendingReload || false;
  }
}

// Settings UI Manager
class SettingsUI {
  constructor(settingsManager, editor) {
    this.settings = settingsManager;
    this.editor = editor;
    this.visible = false;
    
    this.initUI();
  }

  initUI() {
    // Create overlay (full screen, no backdrop)
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.style.display = 'none';
    
    // Create container (full screen)
    this.container = document.createElement('div');
    this.container.className = 'settings-container';
    this.overlay.appendChild(this.container);

    // Header with app-style
    this.header = document.createElement('div');
    this.header.className = 'settings-header';
    this.container.appendChild(this.header);

    this.title = document.createElement('div');
    this.title.className = 'settings-title';
    this.title.textContent = __('Ajustes||Settings');
    this.header.appendChild(this.title);

    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'settings-close';
    this.closeBtn.innerHTML = '&times;';
    this.closeBtn.addEventListener('click', () => this.hide());
    this.header.appendChild(this.closeBtn);

    // Main content area
    this.mainContent = document.createElement('div');
    this.mainContent.className = 'settings-main';
    this.container.appendChild(this.mainContent);

    // Sidebar with categories (like app bottom bar)
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'settings-sidebar';
    this.mainContent.appendChild(this.sidebar);

    // Content area
    this.content = document.createElement('div');
    this.content.className = 'settings-content';
    this.mainContent.appendChild(this.content);

    // Footer with action buttons (like app top bar)
    this.footer = document.createElement('div');
    this.footer.className = 'settings-footer';
    this.container.appendChild(this.footer);

    this.resetAllBtn = document.createElement('button');
    this.resetAllBtn.className = 'settings-btn secondary';
    this.resetAllBtn.textContent = __('Restablecer todo||Reset all');
    this.resetAllBtn.addEventListener('click', () => this.showResetConfirm());
    this.footer.appendChild(this.resetAllBtn);

    this.doneBtn = document.createElement('button');
    this.doneBtn.className = 'settings-btn primary';
    this.doneBtn.textContent = __('Hecho||Done');
    this.doneBtn.addEventListener('click', () => this.hide());
    this.footer.appendChild(this.doneBtn);

    setTimeout(() => this.editor.editorElement.appendChild(this.overlay));

    // Build category list
    this.buildCategories();
    
    // Show first category by default
    if (this.settings.categories.length > 0) {
      this.showCategory(this.settings.categories[0].id);
    }
  }

  buildCategories() {
    this.sidebar.innerHTML = '';
    
    this.settings.categories.forEach(category => {
      const item = document.createElement('div');
      item.className = 'settings-category-item';
      item.dataset.category = category.id;
      
      const icon = document.createElement('span');
      icon.className = `icon ${category.icon}`;
      
      const label = document.createElement('span');
      label.textContent = __(category.title);
      
      item.appendChild(icon);
      item.appendChild(label);
      
      item.addEventListener('click', () => this.showCategory(category.id));
      
      this.sidebar.appendChild(item);
    });
  }

  showCategory(categoryId) {
    // Update active state
    document.querySelectorAll('.settings-category-item').forEach(item => {
      item.classList.toggle('active', item.dataset.category === categoryId);
    });

    const category = this.settings.categories.find(c => c.id === categoryId);
    if (!category) return;

    this.content.innerHTML = '';
    
    const categoryTitle = document.createElement('h3');
    categoryTitle.className = 'settings-category-title';
    categoryTitle.textContent = __(category.title);
    this.content.appendChild(categoryTitle);

    category.settings.forEach(setting => {
      if (!setting.visible) return;
      
      const settingElement = this.createSettingElement(setting);
      this.content.appendChild(settingElement);
    });
  }

  createSettingElement(setting) {
    const container = document.createElement('div');
    container.className = `setting-item ${setting.disabled ? 'disabled' : ''}`;
    container.dataset.setting = setting.id;

    const infoContainer = document.createElement('div');
    infoContainer.className = 'setting-info';
    
    const label = document.createElement('div');
    label.className = 'setting-label';
    label.textContent = __(setting.label);
    
    const description = document.createElement('div');
    description.className = 'setting-description';
    description.textContent = __(setting.description);
    
    infoContainer.appendChild(label);
    infoContainer.appendChild(description);
    
    const control = document.createElement('div');
    control.className = 'setting-control';

    switch (setting.type) {
      case 'boolean':
        this.createBooleanControl(control, setting);
        break;
      case 'number':
      case 'range':
        this.createRangeControl(control, setting);
        break;
      case 'select':
        this.createSelectControl(control, setting);
        break;
      case 'text':
        this.createTextControl(control, setting);
        break;
      case 'color':
        this.createColorControl(control, setting);
        break;
    }

    container.appendChild(infoContainer);
    container.appendChild(control);

    return container;
  }

  createBooleanControl(control, setting) {
    const toggle = document.createElement('label');
    toggle.className = 'switch';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.settings.get(setting.id);
    input.disabled = setting.disabled;
    
    const slider = document.createElement('span');
    slider.className = 'slider';
    
    toggle.appendChild(input);
    toggle.appendChild(slider);
    control.appendChild(toggle);

    input.addEventListener('change', (e) => {
      this.settings.set(setting.id, e.target.checked);
      if (setting.needsReload) {
        this.showRestartWarning();
      }
    });

    this.settings.subscribe(setting.id, (value) => {
      input.checked = value;
    });
  }

  createRangeControl(control, setting) {
    const wrapper = document.createElement('div');
    wrapper.className = 'range-wrapper';
    
    const input = document.createElement('input');
    input.type = 'range';
    input.min = setting.min || 0;
    input.max = setting.max || 100;
    input.step = setting.step || 1;
    input.value = this.settings.get(setting.id);
    input.disabled = setting.disabled;
    
    const valueDisplay = document.createElement('input');
    valueDisplay.className = 'range-value';
    valueDisplay.type = 'number';
    valueDisplay.min = setting.min || 0;
    valueDisplay.max = setting.max || 100;
    valueDisplay.value = input.value;
    valueDisplay.disabled = setting.disabled;
    
    wrapper.appendChild(input);
    wrapper.appendChild(valueDisplay);
    control.appendChild(wrapper);

    input.addEventListener('input', (e) => {
      valueDisplay.value = e.target.value;
    });
    
    valueDisplay.addEventListener('input', (e) => {
      input.value = e.target.value;
    });

    const changeHandler = (e) => {
      this.settings.set(setting.id, parseInt(e.target.value));
      if (setting.needsReload) {
        this.showRestartWarning();
      }
    };
    
    input.addEventListener("change", (e) => changeHandler(e));
    valueDisplay.addEventListener("change", (e) => changeHandler(e));

    this.settings.subscribe(setting.id, (value) => {
      input.value = value;
      valueDisplay.value = value;
    });
  }

  createSelectControl(control, setting) {
    const select = document.createElement('select');
    select.disabled = setting.disabled;
    
    setting.options.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = __(option.label);
      opt.selected = option.value === this.settings.get(setting.id);
      select.appendChild(opt);
    });
    
    control.appendChild(select);

    select.addEventListener('change', (e) => {
      this.settings.set(setting.id, e.target.value);
      if (setting.needsReload) {
        this.showRestartWarning();
      }
    });

    this.settings.subscribe(setting.id, (value) => {
      select.value = value;
    });
  }

  createTextControl(control, setting) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = this.settings.get(setting.id);
    input.disabled = setting.disabled;
    input.placeholder = setting.placeholder || '';
    
    control.appendChild(input);

    input.addEventListener('change', (e) => {
      this.settings.set(setting.id, e.target.value);
      if (setting.needsReload) {
        this.showRestartWarning();
      }
    });

    this.settings.subscribe(setting.id, (value) => {
      input.value = value;
    });
  }

  createColorControl(control, setting) {
    const wrapper = document.createElement('div');
    wrapper.className = 'color-wrapper';
    
    const input = document.createElement('input');
    input.type = 'color';
    input.value = this.settings.get(setting.id);
    input.disabled = setting.disabled;
    
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = this.settings.get(setting.id);
    textInput.disabled = setting.disabled;
    
    wrapper.appendChild(input);
    wrapper.appendChild(textInput);
    control.appendChild(wrapper);

    input.addEventListener('input', (e) => {
      textInput.value = e.target.value;
    });

    textInput.addEventListener('input', (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        input.value = e.target.value;
      }
    });

    input.addEventListener('change', (e) => {
      this.settings.set(setting.id, e.target.value);
      if (setting.needsReload) {
        this.showRestartWarning();
      }
    });

    textInput.addEventListener('change', (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        this.settings.set(setting.id, e.target.value);
      }
    });

    this.settings.subscribe(setting.id, (value) => {
      input.value = value;
      textInput.value = value;
    });
  }

  showRestartWarning() {
    this.editor.showButtonToast(
      __('Algunos cambios requieren reiniciar||Some changes require restart'),
      __('Reiniciar||Restart'),
      () => {
        this.editor.showPopup(
          __('Reiniciar aplicación||Restart app'),
          __('¿Reiniciar la app? Los cambios sin guardar se perderán||Restart the app? Unsaved changes will be lost'),
          [
            {
              text: __('No||No'),
              class: "cancel",
              action: () => {
                this.editor.hidePopup();
              }
            },
            {
              text: __('Sí||Yes'),
              action: () => {
                window.location.reload();
              }
            }
          ]
        );
      }
    );
  }

  showResetConfirm() {
    if (this.editor) {
      this.editor.showPopup(
        __('Restablecer ajustes||Reset settings'),
        __('¿Estás seguro?||Are you sure?'),
        [
          {
            text: __('Cancelar||Cancel'),
            class: 'cancel',
            action: () => this.editor.hidePopup()
          },
          {
            text: __('Restablecer||Reset'),
            action: () => {
              this.settings.resetAll();
              this.showCategory(this.settings.categories[0].id);
              this.editor.hidePopup();
            }
          }
        ]
      );
    }
  }

  show() {
    this.overlay.style.display = 'flex';
    this.visible = true;
    
    this.buildCategories();
    if (this.settings.categories.length > 0) {
      this.showCategory(this.settings.categories[0].id);
    }
  }

  hide() {
    this.overlay.style.display = 'none';
    this.visible = false;
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
}

// Grid Manager Class
class GridManager {
  constructor(editor) {
    this.editor = editor;
    this.grids = [];
    this.panelVisible = false;
    
    this.initOverlay();
    this.initUI();
  }

  initOverlay() {
    // Create or get grid overlay
    this.overlay = document.querySelector('.grid-overlay');
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'grid-overlay';
      this.editor.canvasWrapper.appendChild(this.overlay);
    }
  }

  initUI() {
    // Grid panel
    this.panel = document.createElement('div');
    this.panel.className = 'grid-panel';
    
    // Header
    const header = document.createElement('div');
    header.className = 'grid-panel-header';
    
    const title = document.createElement('div');
    title.className = 'grid-panel-title';
    title.textContent = __('Cuadrículas||Grids');
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'grid-panel-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.hide());
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'grid-toolbar';
    
    const addBtn = document.createElement('button');
    addBtn.className = 'grid-btn primary';
    addBtn.innerHTML = `
      <span class="icon icon-add"></span>
      <span>${__('Añadir cuadrícula||Add grid')}</span>
    `;
    addBtn.addEventListener('click', () => this.addGrid());
    
    toolbar.appendChild(addBtn);
    this.panel.appendChild(toolbar);

    // Grid list container
    this.listContainer = document.createElement('div');
    this.listContainer.className = 'grid-list';
    this.panel.appendChild(this.listContainer);

    // Add to editor
    this.editor.uiLayer.appendChild(this.panel);
  }

  addGrid() {
    const newGrid = {
      id: 'grid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      width: 8,
      height: 8,
      color: '#ff0000',
      opacity: 0.3,
      enabled: true
    };
    
    this.grids.push(newGrid);
    this.renderList();
    this.renderGrids();
  }

  removeGrid(id) {
    this.grids = this.grids.filter(g => g.id !== id);
    this.renderList();
    this.renderGrids();
  }

  duplicateGrid(id) {
    const original = this.grids.find(g => g.id === id);
    if (original) {
      const newGrid = {
        id: 'grid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        width: original.width,
        height: original.height,
        color: original.color,
        opacity: original.opacity,
        enabled: original.enabled
      };
      const index = this.grids.findIndex(g => g.id === id);
      this.grids.splice(index + 1, 0, newGrid);
      this.renderList();
      this.renderGrids();
    }
  }

  moveGridDown(id) {
    const index = this.grids.findIndex(g => g.id === id);
    if (index < this.grids.length - 1) {
      const temp = this.grids[index];
      this.grids[index] = this.grids[index + 1];
      this.grids[index + 1] = temp;
      this.renderList();
      this.renderGrids();
    }
  }

  moveGridUp(id) {
    const index = this.grids.findIndex(g => g.id === id);
    if (index > 0) {
      const temp = this.grids[index];
      this.grids[index] = this.grids[index - 1];
      this.grids[index - 1] = temp;
      this.renderList();
      this.renderGrids();
    }
  }

  updateGrid(id, updates) {
    const grid = this.grids.find(g => g.id === id);
    if (grid) {
      Object.assign(grid, updates);
      this.renderList();
      this.renderGrids();
    }
  }

  renderList() {
    this.listContainer.innerHTML = '';
    
    if (this.grids.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'grid-empty';
      empty.textContent = __('Sin cuadrículas||No grids');
      this.listContainer.appendChild(empty);
      return;
    }

    this.grids.forEach((grid, idx) => {
      const item = document.createElement('div');
      item.className = 'grid-item';
      item.dataset.id = grid.id;
      if (idx === this.grids.length - 1) {
        item.style.borderBottom = 'none';
      }

      // Info container
      const info = document.createElement('div');
      info.className = 'grid-info';
      
      // Title row with inline inputs
      const titleRow = document.createElement('div');
      titleRow.className = 'grid-title-row';
      
      const widthInput = document.createElement('input');
      widthInput.type = 'number';
      widthInput.className = 'grid-dimension-input';
      widthInput.value = grid.width;
      widthInput.min = 1;
      widthInput.max = 256;
      widthInput.step = 1;
      widthInput.addEventListener('change', (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value)) value = grid.width;
        value = Math.max(1, Math.min(256, value));
        widthInput.value = value;
        this.updateGrid(grid.id, { width: value });
      });
      
      const xSpan = document.createElement('span');
      xSpan.className = 'grid-dimension-sep';
      xSpan.textContent = '×';
      
      const heightInput = document.createElement('input');
      heightInput.type = 'number';
      heightInput.className = 'grid-dimension-input';
      heightInput.value = grid.height;
      heightInput.min = 1;
      heightInput.max = 256;
      heightInput.step = 1;
      heightInput.addEventListener('change', (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value)) value = grid.height;
        value = Math.max(1, Math.min(256, value));
        heightInput.value = value;
        this.updateGrid(grid.id, { height: value });
      });
      
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'grid-color-inline';
      colorInput.value = grid.color;
      colorInput.addEventListener('change', (e) => {
        this.updateGrid(grid.id, { color: e.target.value });
      });
      
      titleRow.appendChild(widthInput);
      titleRow.appendChild(xSpan);
      titleRow.appendChild(heightInput);
      titleRow.appendChild(colorInput);
      
      // Controls row
      const controlsRow = document.createElement('div');
      controlsRow.className = 'grid-controls-row';
      
      // Opacity control
      const opacityControl = document.createElement('div');
      opacityControl.className = 'grid-opacity-control';
      
      const opacityLabel = document.createElement('span');
      opacityLabel.className = 'grid-opacity-label';
      opacityLabel.textContent = __('Opacidad||Opacity') + ':';
      
      const opacitySlider = document.createElement('input');
      opacitySlider.type = 'range';
      opacitySlider.className = 'grid-opacity-slider';
      opacitySlider.min = 0;
      opacitySlider.max = 100;
      opacitySlider.value = Math.round(grid.opacity * 100);
      opacitySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        opacityValue.textContent = value + '%';
        this.updateGrid(grid.id, { opacity: value / 100 });
      });
      
      const opacityValue = document.createElement('span');
      opacityValue.className = 'grid-opacity-value';
      opacityValue.textContent = Math.round(grid.opacity * 100) + '%';
      
      opacityControl.appendChild(opacityLabel);
      opacityControl.appendChild(opacitySlider);
      opacityControl.appendChild(opacityValue);
      
      controlsRow.appendChild(opacityControl);
      
      info.appendChild(titleRow);
      info.appendChild(controlsRow);
      
      // Actions container
      const actions = document.createElement('div');
      actions.className = 'grid-actions';
      
      // Toggle visibility button
      const visibilityBtn = document.createElement('button');
      visibilityBtn.className = 'ui-button grid-action-btn';
      visibilityBtn.innerHTML = grid.enabled ? 
        '<div class="icon icon-visible"></div>' : 
        '<div class="icon icon-hidden"></div>';
      visibilityBtn.title = __('Visibilidad||Toggle Visibility');
      visibilityBtn.addEventListener('click', () => {
        this.updateGrid(grid.id, { enabled: !grid.enabled });
      });
      actions.appendChild(visibilityBtn);
      
      // Move up button
      const moveUpBtn = document.createElement('button');
      moveUpBtn.className = 'ui-button grid-action-btn';
      moveUpBtn.innerHTML = '<div class="icon icon-up"></div>';
      moveUpBtn.title = __('Subir||Move Up');
      if (idx > 0) {
        moveUpBtn.addEventListener('click', () => this.moveGridUp(grid.id));
      } else {
        moveUpBtn.disabled = true;
        moveUpBtn.classList.add('disabled');
      }
      actions.appendChild(moveUpBtn);
      
      // Move down button
      const moveDownBtn = document.createElement('button');
      moveDownBtn.className = 'ui-button grid-action-btn';
      moveDownBtn.innerHTML = '<div class="icon icon-down"></div>';
      moveDownBtn.title = __('Bajar||Move Down');
      if (idx < this.grids.length - 1) {
        moveDownBtn.addEventListener('click', () => this.moveGridDown(grid.id));
      } else {
        moveDownBtn.disabled = true;
        moveDownBtn.classList.add('disabled');
      }
      actions.appendChild(moveDownBtn);
      
      // Duplicate button
      const duplicateBtn = document.createElement('button');
      duplicateBtn.className = 'ui-button grid-action-btn';
      duplicateBtn.innerHTML = '<div class="icon icon-copy"></div>';
      duplicateBtn.title = __('Duplicar||Duplicate');
      duplicateBtn.addEventListener('click', () => this.duplicateGrid(grid.id));
      actions.appendChild(duplicateBtn);
      
      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'ui-button grid-action-btn';
      removeBtn.innerHTML = '<div class="icon icon-close"></div>';
      removeBtn.title = __('Eliminar||Remove');
      removeBtn.addEventListener('click', () => this.removeGrid(grid.id));
      actions.appendChild(removeBtn);
      
      item.appendChild(info);
      item.appendChild(actions);
      
      this.listContainer.appendChild(item);
    });
  }

  renderGrids() {
    // Clear overlay
    this.overlay.innerHTML = '';

    // Get canvas transform
    const width = this.editor.project.width;
    const height = this.editor.project.height;

    // Set overlay size
    Object.assign(this.overlay.style, {
      position: 'absolute',
      width: width + 'px',
      height: height + 'px'
    });

    // Render each enabled grid
    this.grids.forEach(grid => {
      if (!grid.enabled) return;

      const gridLayer = document.createElement('div');
      gridLayer.className = 'grid-layer';
      
      // Create grid pattern using linear gradients
      const horizontalGradient = `linear-gradient(to bottom, 
        ${grid.color} 1px, 
        transparent 1px
      )`;
      
      const verticalGradient = `linear-gradient(to right, 
        ${grid.color} 1px, 
        transparent 1px
      )`;
      
      // We don't want to show grids at the same pixel size of canvas so reduce scale to have a thinner line
      const scale = 8;

      // Calculate scaled grid size
      const scaledWidth = Math.max(1, grid.width * scale);
      const scaledHeight = Math.max(1, grid.height * scale);

      Object.assign(gridLayer.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: 100 * scale + '%',
        height: 100 * scale + '%',
        backgroundImage: `${verticalGradient}, ${horizontalGradient}`,
        backgroundSize: `${scaledWidth}px ${scaledHeight}px`,
        transform: `scale(${1 / scale})`,
        transformOrigin: '0 0',
        backgroundPosition: `-1px -1px`,
        backgroundRepeat: 'repeat',
        opacity: grid.opacity,
        pointerEvents: 'none',
        zIndex: '10'
      });

      this.overlay.appendChild(gridLayer);
    });
  }

  show() {
    // Hide other panels
    this.editor.menuPanel.classList.remove('visible');
    this.editor.animationPanel.classList.remove('visible');
    this.editor.layersPanel.classList.remove('visible');
    this.editor.animationButton.classList.remove('active');
    this.editor.layersButton.classList.remove('active');
    
    // Show our panel
    this.panel.classList.add('visible');
    this.editor.gridsButton.classList.add("active");
    this.panelVisible = true;
    this.renderList();
    this.renderGrids();
  }

  hide() {
    this.panel.classList.remove('visible');
    this.editor.menuPanel.classList.remove('visible');
    this.editor.gridsButton.classList.remove("active");
    this.panelVisible = false;
  }

  toggle() {
    if (this.panelVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  updateTransform() {
    this.renderGrids();
  }
}

class ReferenceManager {
  constructor(editor) {
    this.editor = editor;
    
    // Trace reference (single)
    this.traceImage = null;
    this.traceOpacity = 0.5;
    this.traceOnTop = false;
    
    // Floating references (multiple)
    this.floatingRefs = [];
    this.nextId = 1;
    this.selectedRef = null;
    
    // Drag state
    this.dragState = null;
    this.resizeState = null;
    
    // UI Elements
    this.traceControls = null;
    this.floatingContainer = null;
    this.deleteZone = null;
    
    this.init();
  }

  init() {
    this.createTraceControls();
    this.createFloatingContainer();
    this.setupDeleteZone();
    this.setupEventListeners();
  }

  createTraceControls() {
    // Create trace reference controls
    this.traceControls = document.createElement("div");
    this.traceControls.className = "trace-reference-controls";
    
    // Opacity control
    const opacityContainer = document.createElement("div");
    opacityContainer.className = "trace-opacity-control";
    
    this.traceOpacityValue = document.createElement("span");
    this.traceOpacityValue.className = "trace-opacity-value";
    this.traceOpacityValue.textContent = this.traceOpacity * 100 + "%";
    opacityContainer.appendChild(this.traceOpacityValue);
    
    this.traceOpacitySlider = document.createElement("input");
    this.traceOpacitySlider.type = "range";
    this.traceOpacitySlider.min = "0";
    this.traceOpacitySlider.max = "100";
    this.traceOpacitySlider.value = this.traceOpacity * 100;
    this.traceOpacitySlider.className = "trace-opacity-slider";
    this.traceOpacitySlider.addEventListener("input", (e) => {
      this.traceOpacity = parseInt(e.target.value) / 100;
      this.updateOpacityValue(e.target.value + "%");
      this.editor.render();
    });
    opacityContainer.appendChild(this.traceOpacitySlider);
    
    this.traceControls.appendChild(opacityContainer);
    
    // Toggle top/bottom button
    this.traceToggleBtn = this.editor.createButton("trace-toggle", "icon-switch-tool", () => {
      this.traceOnTop = !this.traceOnTop;
      this.editor.render();
    });
    this.traceToggleBtn.title = __("Alternar capa||Toggle Layer");
    this.traceControls.appendChild(this.traceToggleBtn);
    
    // Remove button
    this.traceRemoveBtn = this.editor.createButton("trace-remove", "icon-close", () => {
      this.removeTraceReference();
    });
    this.traceRemoveBtn.title = __("Eliminar||Remove");
    this.traceControls.appendChild(this.traceRemoveBtn);
    
    this.editor.uiLayer.appendChild(this.traceControls);
  }

  createFloatingContainer() {
    this.floatingContainer = document.createElement("div");
    this.floatingContainer.className = "floating-references-container";
    this.editor.overlayLayer.appendChild(this.floatingContainer);
  }

  setupDeleteZone() {
    this.deleteZone = document.createElement("div");
    this.deleteZone.className = "delete-zone";
    this.deleteZone.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    this.editor.overlayLayer.appendChild(this.deleteZone);
  }

  setupEventListeners() {
    // Global mouse/touch events for dragging
    document.addEventListener("mousemove", (e) => this.handleDragMove(e));
    document.addEventListener("mouseup", (e) => this.handleDragEnd(e));
    document.addEventListener("touchmove", (e) => this.handleDragMove(e), { passive: false });
    document.addEventListener("touchend", (e) => this.handleDragEnd(e));
    document.addEventListener("touchcancel", (e) => this.handleDragEnd(e));
    
    // Delete zone events
    this.deleteZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.deleteZone.classList.add("drag-over");
    });
    
    this.deleteZone.addEventListener("dragleave", () => {
      this.deleteZone.classList.remove("drag-over");
    });
    
    this.deleteZone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.deleteZone.classList.remove("drag-over");
      
      if (this.selectedRef) {
        this.removeFloatingReference(this.selectedRef.id);
        this.selectedRef = null;
      }
    });
  }

  // Method to show reference type selection
  showReferenceTypeDialog() {
    this.editor.showPopup(
      __("Cargar Referencia||Load Reference"),
      __("¿Qué tipo de referencia quieres cargar?||What type of reference do you want to load?"),
      [
        {
          text: __("Cancelar||Cancel"),
          class: "cancel",
          action: () => this.editor.hidePopup()
        },
        {
          text: __("Traza||Trace"),
          action: () => {
            this.editor.hidePopup();
            this.loadReference("trace");
          }
        },
        {
          text: __("Flotante||Floating"),
          action: () => {
            this.editor.hidePopup();
            this.loadReference("floating");
          }
        }
      ]
    );
  }
  
  loadReference(type) {
    const fileBrowser = this.editor.getFileBrowser({
      title: __("Cargar imagen||Load image"),
      mode: "open",
      fileTypes: ["png", "jpg", "jpeg", "gif","webp"],
      onConfirm: async (fileInfo) => {
        try {
          const fileData = await this.editor.readFile(fileInfo);
          await this.createReference(type, fileData);
        } catch (error) {
          this.editor.showToast(__(`Error al cargar imagen: ${error.message}||Error loading image: ${error.message}`), 5000);
        }
      }
    });
    fileBrowser.show();
  }

  async createReference(type, imageData) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (type === "trace") {
          this.setTraceReference(img);
        } else {
          this.addFloatingReference(img);
        }
        resolve();
      };
      img.onerror = reject;
      img.src = imageData;
    });
  }

  setTraceReference(img) {
    // Remove existing trace
    this.traceImage = img;
    
    // Show controls
    this.traceControls.classList.add("visible");
    
    // Center image in view
    const containerRect = this.editor.canvasContainer.getBoundingClientRect();
    const scale = Math.min(
      containerRect.width / img.width * 0.8,
      containerRect.height / img.height * 0.8
    );
    
    // Store for rendering
    this.traceImageData = {
      img: img,
      scale: scale,
      x: 0,
      y: 0
    };
    
    this.editor.render();
    this.editor.showToast(__("Referencia de traza cargada||Trace reference loaded"));
  }

  addFloatingReference(img) {
    const id = `ref_${this.nextId++}`;
    
    // Get container dimensions
    const containerRect = this.editor.canvasContainer.getBoundingClientRect();
    
    // Calculate initial size and position
    const maxSize = 200;
    const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
    const width = img.width * scale;
    const height = img.height * scale;
    
    // Center in view
    const x = (containerRect.width - width) / 2;
    const y = (containerRect.height - height) / 2;
    
    const ref = {
      id: id,
      img: img,
      x: x,
      y: y,
      width: width,
      height: height,
      scale: scale,
      rotation: 0
    };
    
    this.floatingRefs.push(ref);
    this.renderFloatingReference(ref);
    
    this.editor.showToast(__("Referencia flotante añadida||Floating reference added"));
  }

  startDrag(e, ref) {
    e.preventDefault();
    e.stopPropagation();
    
    this.selectedRef = ref;
    this.updateSelection();
    
    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
    
    this.dragState = {
      ref: ref,
      startX: clientX,
      startY: clientY,
      startLeft: ref.x,
      startTop: ref.y
    };
    
    // Bring to top when starting drag
    this.bringToTop(ref);
    
    // Show delete zone
    this.deleteZone.classList.add("visible");
    this.deleteZone.classList.remove("drag-over"); // Reset any previous drag-over state
  }

  startResize(e, ref) {
    e.preventDefault();
    e.stopPropagation();
    
    this.selectedRef = ref;
    this.updateSelection();
    
    const el = document.getElementById(ref.id);
    const rect = el.getBoundingClientRect();
    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
    
    // Detect resize direction based on click position
    const threshold = 20;
    let direction = 'se'; // default
    
    // Bring to top when starting resizing
    this.bringToTop(ref);
    
    if (e.type.startsWith("touch") && e.touches.length === 2) {
      // Pinch gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      this.resizeState = {
        ref: ref,
        type: "pinch",
        startDistance: distance,
        startWidth: ref.width,
        startHeight: ref.height,
        startScale: ref.scale,
        startX: ref.x,
        startY: ref.y,
        centerX: (touch1.clientX + touch2.clientX) / 2,
        centerY: (touch1.clientY + touch2.clientY) / 2
      };
    } else {
      // Edge resize - detect which edge
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      
      if (relativeX < threshold) direction = 'w';
      else if (relativeX > rect.width - threshold) direction = 'e';
      
      if (relativeY < threshold) direction = (direction === 'w' ? 'nw' : direction === 'e' ? 'ne' : 'n');
      else if (relativeY > rect.height - threshold) direction = (direction === 'w' ? 'sw' : direction === 'e' ? 'se' : 's');
      
      this.resizeState = {
        ref: ref,
        type: "edge",
        direction: direction,
        startX: clientX,
        startY: clientY,
        startLeft: ref.x,
        startTop: ref.y,
        startWidth: ref.width,
        startHeight: ref.height,
        aspect: ref.width / ref.height
      };
      
      // Update cursor
      el.style.cursor = direction + '-resize';
      el.classList.add("resizing");
    }
  }

  handleDragMove(e) {
    if (!this.dragState && !this.resizeState) return;
    
    e.preventDefault();
    
    if (this.dragState) {
      this.handleDrag(e);
    } else if (this.resizeState) {
      this.handleResize(e);
    }
  }

  handleDrag(e) {
    const state = this.dragState;
    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - state.startX;
    const deltaY = clientY - state.startY;
    
    state.ref.x = state.startLeft + deltaX;
    state.ref.y = state.startTop + deltaY;
    
    const el = document.getElementById(state.ref.id);
    if (el) {
      el.style.left = state.ref.x + "px";
      el.style.top = state.ref.y + "px";
      
      const rect = this.deleteZone.getBoundingClientRect();
      const isOverDelete = clientX >= rect.left && clientX <= rect.right &&
                          clientY >= rect.top && clientY <= rect.bottom;
      
      if (isOverDelete) {
        el.classList.add("over-delete");
      } else {
        el.classList.remove("over-delete");
      }
    }
  }
  
  handleDragEnd(e) {
    if (this.dragState) {
      // Get final position
      const clientX = e.type.startsWith("touchend") ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.type.startsWith("touchend") ? e.changedTouches[0].clientY : e.clientY;
      
      const rect = this.deleteZone.getBoundingClientRect();
      const isOverDelete = clientX >= rect.left && clientX <= rect.right &&
                          clientY >= rect.top && clientY <= rect.bottom;
      
      if (isOverDelete) {
        // Delete the reference
        this.removeFloatingReference(this.dragState.ref.id);
        this.selectedRef = null;
      }
      
      const el = document.getElementById(this.dragState.ref.id);
      if (el) {
        el.classList.remove("grabbing");
      }
      
      this.dragState = null;
    }
    
    if (this.resizeState) {
      const el = document.getElementById(this.resizeState.ref.id);
      if (el) {
        el.classList.remove("resizing");
        el.classList.remove("grabbing");
        el.classList.remove("over-delete");
      }
      this.resizeState = null;
    }
    
    // Always remove delete zone styling
    this.deleteZone.classList.remove("visible", "drag-over");
  }

  handleResize(e) {
    const state = this.resizeState;
    if (!state) return;
    
    e.preventDefault();
    
    if (state.type === "pinch" && e.touches?.length === 2) {
      // Pinch resize
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const scale = distance / state.startDistance;
      const newWidth = Math.max(20, state.startWidth * scale);
      const newHeight = Math.max(20, state.startHeight * scale);
      
      state.ref.width = newWidth;
      state.ref.height = newHeight;
      state.ref.scale = state.startScale * scale;
      
      // Adjust position to keep center
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      if (state.centerX && state.centerY) {
        const deltaX = centerX - state.centerX;
        const deltaY = centerY - state.centerY;
        state.ref.x = state.startX + deltaX;
        state.ref.y = state.startY + deltaY;
      }
      
      state.centerX = centerX;
      state.centerY = centerY;
      
    } else if (state.type === "edge") {
      // Edge resize
      const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
      
      const deltaX = clientX - state.startX;
      const deltaY = clientY - state.startY;
      
      let newWidth = state.startWidth;
      let newHeight = state.startHeight;
      let newX = state.startLeft;
      let newY = state.startTop;
      
      const direction = state.direction;
      const keepAspect = e.shiftKey || direction == 'se'; // Hold Shift to keep aspect ratio
      
      // Handle different resize directions
      if (direction.includes('e')) {
        newWidth = Math.max(20, state.startWidth + deltaX);
        if (keepAspect) newHeight = newWidth / state.aspect;
      }
      if (direction.includes('w')) {
        const change = Math.min(deltaX, state.startWidth - 20);
        newWidth = Math.max(20, state.startWidth - change);
        newX = state.startLeft + (state.startWidth - newWidth);
        if (keepAspect) {
          newHeight = newWidth / state.aspect;
          newY = state.startTop + (state.startHeight - newHeight) / 2;
        }
      }
      if (direction.includes('s')) {
        newHeight = Math.max(20, state.startHeight + deltaY);
        if (keepAspect) newWidth = newHeight * state.aspect;
      }
      if (direction.includes('n')) {
        const change = Math.min(deltaY, state.startHeight - 20);
        newHeight = Math.max(20, state.startHeight - change);
        newY = state.startTop + (state.startHeight - newHeight);
        if (keepAspect) {
          newWidth = newHeight * state.aspect;
          newX = state.startLeft + (state.startWidth - newWidth) / 2;
        }
      }
      
      state.ref.width = newWidth;
      state.ref.height = newHeight;
      state.ref.x = newX;
      state.ref.y = newY;
    }
    
    // Update element
    const el = document.getElementById(state.ref.id);
    if (el) {
      el.style.width = state.ref.width + "px";
      el.style.height = state.ref.height + "px";
      el.style.left = state.ref.x + "px";
      el.style.top = state.ref.y + "px";
    }
  }

  handleDragMove(e) {
    if (!this.dragState && !this.resizeState) return;
    
    e.preventDefault();
    
    if (this.dragState) {
      this.handleDrag(e);
      
      // Check if over delete zone during drag
      const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
      
      const rect = this.deleteZone.getBoundingClientRect();
      const isOverDelete = clientX >= rect.left && clientX <= rect.right &&
                          clientY >= rect.top && clientY <= rect.bottom;
      
      if (isOverDelete) {
        this.deleteZone.classList.add("drag-over");
      } else {
        this.deleteZone.classList.remove("drag-over");
      }
      
    } else if (this.resizeState) {
      this.handleResize(e);
    }
  }
  
  bringToTop(ref) {
    // Update z-index of all floating references
    const allRefs = this.floatingContainer.children;
    let maxZIndex = 20; // Base z-index from CSS
    
    // Find current max z-index
    for (let i = 0; i < allRefs.length; i++) {
      const zIndex = parseInt(window.getComputedStyle(allRefs[i]).zIndex) || 20;
      if (zIndex > maxZIndex) maxZIndex = zIndex;
    }
    
    // Set this reference to top
    const el = document.getElementById(ref.id);
    if (el) {
      el.style.zIndex = (maxZIndex + 1).toString();
    }
    
    // Update selected reference
    this.selectedRef = ref;
    this.updateSelection();
  }

  updateSelection() {
    // Update selection styling
    const allRefs = this.floatingContainer.children;
    for (let i = 0; i < allRefs.length; i++) {
      allRefs[i].classList.remove("selected");
    }
    
    if (this.selectedRef) {
      const el = document.getElementById(this.selectedRef.id);
      if (el) el.classList.add("selected");
    }
  }

  renderFloatingReference(ref) {
    // Remove existing element if any
    const existing = document.getElementById(ref.id);
    if (existing) existing.remove();
    
    // Create element
    const el = document.createElement("div");
    el.id = ref.id;
    el.className = "floating-reference";
    if (this.selectedRef && this.selectedRef.id === ref.id) {
      el.classList.add("selected");
    }
    
    el.style.left = ref.x + "px";
    el.style.top = ref.y + "px";
    el.style.width = ref.width + "px";
    el.style.height = ref.height + "px";
    el.style.transform = `rotate(${ref.rotation}deg)`;
    
    // Create image
    const img = document.createElement("img");
    img.src = ref.img.src;
    img.draggable = false;
    el.appendChild(img);
    
    // Create resize handles for all edges
    const positions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    positions.forEach(pos => {
      const handle = document.createElement("div");
      handle.className = `resize-handle ${pos}`;
      handle.setAttribute('data-direction', pos);
      
      handle.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        this.startResize(e, ref);
      });
      
      handle.addEventListener("touchstart", (e) => {
        e.stopPropagation();
        if (e.touches.length === 1) this.startResize(e, ref);
      }, { passive: false });
      
      el.appendChild(handle);
    });
    
    // Click/tap to bring to top and select
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this.bringToTop(ref);
    });
    
    // Main element events for dragging
    el.addEventListener("mousedown", (e) => {
      // Only start drag if not clicking a handle
      if (!e.target.classList.contains('resize-handle')) {
        this.startDrag(e, ref);
        el.classList.add("grabbing");
      }
    });
    
    el.addEventListener("touchstart", (e) => {
      if (!e.target.classList.contains('resize-handle')) {
        this.startDrag(e, ref);
        el.classList.add("grabbing");
      } else if (e.touches.length === 2) {
        this.startResize(e, ref);
      }
    }, { passive: false });
    
    this.floatingContainer.appendChild(el);
  }

  removeTraceReference() {
    this.traceImage = null;
    this.traceImageData = null;
    this.traceControls.classList.remove("visible");
    this.editor.render();
    this.editor.showToast(__("Referencia de traza eliminada||Trace reference removed"));
  }

  removeFloatingReference(id) {
    // Find the reference
    const index = this.floatingRefs.findIndex(ref => ref.id === id);
    if (index === -1) return;
    
    // Remove from array
    this.floatingRefs.splice(index, 1);
    
    // Remove DOM element
    const el = document.getElementById(id);
    if (el) el.remove();
    
    // Clear selection if this was the selected reference
    if (this.selectedRef && this.selectedRef.id === id) {
      this.selectedRef = null;
    }
    
    // Show toast notification
    this.editor.showToast(__("Referencia eliminada||Reference removed"));
  }

  updateOpacityValue(value) {
    if (this.traceOpacityValue) {
      this.traceOpacityValue.textContent = value;
    }
  }

  // Render methods called from editor.render()
  renderBottom(ctx, width, height) {
    if (this.traceImage && !this.traceOnTop) {
      this.drawTraceReference(ctx, width, height);
    }
  }

  renderTop(ctx, width, height) {
    if (this.traceImage && this.traceOnTop) {
      this.drawTraceReference(ctx, width, height);
    }
  }

  drawTraceReference(ctx, width, height) {
    if (!this.traceImage) return;
    
    ctx.globalAlpha = this.traceOpacity;
    ctx.drawImage(this.traceImage, 0, 0, width, height);
    ctx.globalAlpha = 1.0;
  }

  // Clean up
  destroy() {
    // Remove all floating references
    this.floatingRefs.forEach(ref => {
      const el = document.getElementById(ref.id);
      if (el) el.remove();
    });
    this.floatingRefs = [];
    
    // Remove trace controls
    if (this.traceControls) {
      this.traceControls.remove();
    }
    
    // Remove container
    if (this.floatingContainer) {
      this.floatingContainer.remove();
    }
  }
}

// Spritesheet Loader
class SpritesheetLoader {
  constructor(editor) {
    this.editor = editor;
    
    // Spritesheet data
    this.image = null;
    this.imageData = null;
    this.imageUrl = null;
    
    // Grid settings
    this.frameWidth = 16;
    this.frameHeight = 16;
    this.offsetX = 0;
    this.offsetY = 0;
    
    // Calculated frames
    this.frames = [];
    this.totalFrames = 0;
    this.cols = 0;
    this.rows = 0;
    
    // UI elements
    this.fullCanvas = null;
    this.previewContainer = null;
    this.widthInput = null;
    this.heightInput = null;
    this.offsetXInput = null;
    this.offsetYInput = null;
    this.frameCountSpan = null;
    
    // Preview thumbnails
    this.thumbnailCanvases = [];
    this.thumbnailWidth = 60;
    this.thumbnailHeight = 60;
    
    // Lazy loading
    this.scrollTimeout = null;
    
    // Selected frames
    this.selectedFrames = new Set();
    
    // Popup buttons reference
    this.popupButtons = [];
  }

  show() {
    // Reset state
    this.frames = [];
    this.selectedFrames.clear();
    this.offsetX = 0;
    this.offsetY = 0;
    this.frameWidth = 16;
    this.frameHeight = 16;
    
    // Show file browser first
    this.showFileBrowser();
  }

  showFileBrowser() {
    const fileBrowser = this.editor.getFileBrowser({
      title: __("Cargar Spritesheet||Load Spritesheet"),
      mode: "open",
      fileTypes: ["png", "jpg", "jpeg", "gif", "webp"],
      onConfirm: async fileInfo => {
        try {
          const fileData = await this.editor.readFile(fileInfo);
          this.showSpritesheetDialog();
          await this.loadImage(fileData);
          this.updateGrid();
        } catch (error) {
          this.editor.showToast(__(`Error al cargar imagen: ${error.message}||Error loading image: ${error.message}`), 5000);
        }
      }
    });
    
    fileBrowser.show();
  }

  showSpritesheetDialog() {
    // Create popup content
    const content = this.createPopupContent();
    
    // Show popup with custom buttons
    this.editor.showPopup(
      __("Cargar Spritesheet||Load Spritesheet"),
      content,
      [
        {
          text: __("Cancelar||Cancel"),
          class: "cancel",
          action: () => {
            this.cleanup();
            this.editor.hidePopup();
          }
        },
        {
          text: __("Cargar seleccionados||Load selected"),
          action: () => {
            this.loadSelectedFrames();
          }
        }
      ],
      true
    );
    
    // Store reference to popup buttons for enabling/disabling
    this.popupButtons = this.editor.popupButtons;
  }

  createPopupContent() {
    const container = document.createElement("div");
    container.className = "spritesheet-loader-container";

    // Main content area - split horizontally
    const mainContent = document.createElement("div");
    mainContent.className = "spritesheet-main-content";
    container.appendChild(mainContent);

    // Left side - Full spritesheet
    const leftSide = document.createElement("div");
    leftSide.className = "spritesheet-left-side";
    mainContent.appendChild(leftSide);

    const leftLabel = document.createElement("div");
    leftLabel.className = "spritesheet-section-label";
    leftLabel.textContent = __("Spritesheet Completo||Full Spritesheet");
    leftSide.appendChild(leftLabel);

    const canvasContainer = document.createElement("div");
    canvasContainer.className = "spritesheet-canvas-container";
    leftSide.appendChild(canvasContainer);

    this.fullCanvas = document.createElement("canvas");
    this.fullCanvas.className = "spritesheet-full-canvas";
    canvasContainer.appendChild(this.fullCanvas);

    // Add click handler to canvas
    this.fullCanvas.addEventListener("click", (e) => this.handleCanvasClick(e));

    // Right side - Frame previews and controls
    const rightSide = document.createElement("div");
    rightSide.className = "spritesheet-right-side";
    mainContent.appendChild(rightSide);

    // Frame previews label
    const previewLabel = document.createElement("div");
    previewLabel.className = "spritesheet-section-label";
    previewLabel.textContent = __("Frames Individuales||Individual Frames");
    rightSide.appendChild(previewLabel);

    // Scrollable preview container
    this.previewContainer = document.createElement("div");
    this.previewContainer.className = "spritesheet-preview-container";
    rightSide.appendChild(this.previewContainer);

    // Frame count display
    this.frameCountSpan = document.createElement("div");
    this.frameCountSpan.className = "spritesheet-frame-count";
    this.frameCountSpan.textContent = __("0 frames||0 frames");
    rightSide.appendChild(this.frameCountSpan);

    // Controls
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "spritesheet-controls";
    rightSide.appendChild(controlsContainer);

    // Size inputs
    const sizeRow = document.createElement("div");
    sizeRow.className = "spritesheet-input-row";
    controlsContainer.appendChild(sizeRow);

    const widthLabel = document.createElement("span");
    widthLabel.className = "spritesheet-input-label";
    widthLabel.textContent = __("Ancho||Width") + ":";
    sizeRow.appendChild(widthLabel);

    this.widthInput = document.createElement("input");
    this.widthInput.type = "number";
    this.widthInput.value = this.frameWidth;
    this.widthInput.className = "spritesheet-number-input";
    this.widthInput.addEventListener("change", () => this.updateGrid());
    sizeRow.appendChild(this.widthInput);

    const xLabel = document.createElement("span");
    xLabel.className = "spritesheet-x-label";
    xLabel.textContent = "x";
    sizeRow.appendChild(xLabel);

    this.heightInput = document.createElement("input");
    this.heightInput.type = "number";
    this.heightInput.value = this.frameHeight;
    this.heightInput.className = "spritesheet-number-input";
    this.heightInput.addEventListener("change", () => this.updateGrid());
    sizeRow.appendChild(this.heightInput);

    // Offset X input
    const offsetXRow = document.createElement("div");
    offsetXRow.className = "spritesheet-input-row";
    controlsContainer.appendChild(offsetXRow);

    const offsetXLabel = document.createElement("span");
    offsetXLabel.className = "spritesheet-input-label";
    offsetXLabel.textContent = __("Offset X||Offset X") + ":";
    offsetXRow.appendChild(offsetXLabel);

    this.offsetXInput = document.createElement("input");
    this.offsetXInput.type = "number";
    this.offsetXInput.value = this.offsetX;
    this.offsetXInput.className = "spritesheet-number-input";
    this.offsetXInput.addEventListener("change", () => this.updateGrid());
    offsetXRow.appendChild(this.offsetXInput);

    // Offset Y input
    const offsetYRow = document.createElement("div");
    offsetYRow.className = "spritesheet-input-row";
    controlsContainer.appendChild(offsetYRow);

    const offsetYLabel = document.createElement("span");
    offsetYLabel.className = "spritesheet-input-label";
    offsetYLabel.textContent = __("Offset Y||Offset Y") + ":";
    offsetYRow.appendChild(offsetYLabel);

    this.offsetYInput = document.createElement("input");
    this.offsetYInput.type = "number";
    this.offsetYInput.value = this.offsetY;
    this.offsetYInput.className = "spritesheet-number-input";
    this.offsetYInput.addEventListener("change", () => this.updateGrid());
    offsetYRow.appendChild(this.offsetYInput);

    // Selection controls
    const selectionRow = document.createElement("div");
    selectionRow.className = "spritesheet-selection-row";
    controlsContainer.appendChild(selectionRow);

    const selectAllBtn = document.createElement("button");
    selectAllBtn.className = "ui-button spritesheet-select-btn";
    selectAllBtn.textContent = __("Seleccionar todo||Select All");
    selectAllBtn.addEventListener("click", () => this.selectAllFrames());
    selectionRow.appendChild(selectAllBtn);

    const deselectAllBtn = document.createElement("button");
    deselectAllBtn.className = "ui-button spritesheet-select-btn";
    deselectAllBtn.textContent = __("Deseleccionar todo||Deselect All");
    deselectAllBtn.addEventListener("click", () => this.deselectAllFrames());
    selectionRow.appendChild(deselectAllBtn);

    // Add scroll listener for lazy loading
    this.previewContainer.addEventListener("scroll", () => {
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      this.scrollTimeout = setTimeout(() => {
        this.updateVisibleThumbnails();
      }, 100);
    });

    return container;
  }

  // Handle click on the main canvas
  handleCanvasClick(e) {
    if (!this.image || !this.frames.length) return;
    
    // Get click coordinates relative to canvas
    const rect = this.fullCanvas.getBoundingClientRect();
    const scaleX = this.fullCanvas.width / rect.width;
    const scaleY = this.fullCanvas.height / rect.height;
    
    const canvasX = Math.floor((e.clientX - rect.left) * scaleX);
    const canvasY = Math.floor((e.clientY - rect.top) * scaleY);
    
    // Check if click is within grid bounds
    if (canvasX < this.offsetX || canvasY < this.offsetY) return;
    if (canvasX >= this.offsetX + this.cols * this.frameWidth) return;
    if (canvasY >= this.offsetY + this.rows * this.frameHeight) return;
    
    // Calculate which frame was clicked
    const col = Math.floor((canvasX - this.offsetX) / this.frameWidth);
    const row = Math.floor((canvasY - this.offsetY) / this.frameHeight);
    const frameIndex = row * this.cols + col;
    
    if (frameIndex >= 0 && frameIndex < this.frames.length) {
      // Get the corresponding preview item
      const items = this.previewContainer.children;
      if (items[frameIndex]) {
        // Toggle selection
        this.toggleFrameSelection(frameIndex, items[frameIndex]);
      }
    }
  }

  async loadImage(fileData) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.imageUrl = fileData;
        
        // Set canvas size
        this.fullCanvas.width = img.width;
        this.fullCanvas.height = img.height;
        
        // Draw image
        const ctx = this.fullCanvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        
        // Store image data for frame extraction
        this.imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        // Auto-calculate reasonable frame size
        this.autoDetectFrameSize();
        
        resolve();
      };
      img.onerror = reject;
      img.src = fileData;
    });
  }

  autoDetectFrameSize() {
    if (!this.image) return;
    
    const width = this.image.width;
    const height = this.image.height;
    
    // Common frame sizes in pixel art
    const commonSizes = [8, 12, 16, 20, 24, 28, 32, 48, 64];
    
    // Find the largest common size that divides evenly
    for (const size of commonSizes.reverse()) {
      if (width % size === 0 && height % size === 0) {
        this.frameWidth = size;
        this.frameHeight = size;
        break;
      }
    }
    
    // If no match, use 16x16 as default
    if (this.frameWidth === 16 && width % 16 !== 0) {
      this.frameWidth = 16;
      this.frameHeight = 16;
    }
    
    // Update inputs
    if (this.widthInput) {
      this.widthInput.value = this.frameWidth;
      this.heightInput.value = this.frameHeight;
    }
  }

  updateGrid() {
    // Get values from inputs
    this.frameWidth = parseInt(this.widthInput.value) || 16;
    this.frameHeight = parseInt(this.heightInput.value) || 16;
    this.offsetX = parseInt(this.offsetXInput.value) || 0;
    this.offsetY = parseInt(this.offsetYInput.value) || 0;
    
    if (!this.image) return;
    
    // Calculate grid dimensions
    const availableWidth = this.image.width - this.offsetX;
    const availableHeight = this.image.height - this.offsetY;
    
    this.cols = Math.floor(availableWidth / this.frameWidth);
    this.rows = Math.floor(availableHeight / this.frameHeight);
    this.totalFrames = this.cols * this.rows;
    
    // Update frame count
    this.frameCountSpan.textContent = __(`${this.totalFrames} frames||${this.totalFrames} frames`);
    
    // Enable/disable load button
    if (this.popupButtons && this.popupButtons.length > 1) {
      this.popupButtons[1].disabled = this.totalFrames === 0;
    }
    
    // Clear existing frames
    this.frames = [];
    this.thumbnailCanvases = [];
    this.previewContainer.innerHTML = "";
    this.selectedFrames.clear();
    
    // Create frame previews
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const frameIndex = row * this.cols + col;
        this.createFramePreview(frameIndex, col, row);
      }
    }
    
    // Draw grid overlay on full canvas
    this.drawGridOverlay();
    
    // Update visible thumbnails
    this.updateVisibleThumbnails();
  }

  createFramePreview(index, col, row) {
    // Calculate frame position
    const x = this.offsetX + col * this.frameWidth;
    const y = this.offsetY + row * this.frameHeight;
    
    // Store frame data
    this.frames[index] = {
      index,
      x, y,
      width: this.frameWidth,
      height: this.frameHeight,
      col, row
    };
    
    // Create preview item
    const item = document.createElement("div");
    item.className = "frame-preview-item";
    if (this.selectedFrames.has(index)) {
      item.classList.add("selected");
    }
    item.dataset.index = index;
    
    // Click to select/deselect
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleFrameSelection(index, item);
    });
    
    // Thumbnail canvas
    const canvas = document.createElement("canvas");
    canvas.width = this.thumbnailWidth;
    canvas.height = this.thumbnailHeight;
    canvas.className = "frame-thumbnail-canvas";
    
    // Store for lazy loading
    this.thumbnailCanvases[index] = {
      canvas,
      item,
      x, y,
      loaded: false
    };
    
    // Frame info
    const info = document.createElement("div");
    info.className = "frame-info";
    info.textContent = `${index + 1}: ${col},${row}`;
    
    item.appendChild(canvas);
    item.appendChild(info);
    
    this.previewContainer.appendChild(item);
  }

  updateVisibleThumbnails() {
    if (!this.previewContainer) return;
    
    const containerRect = this.previewContainer.getBoundingClientRect();
    const items = this.previewContainer.children;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rect = item.getBoundingClientRect();
      
      // Check if item is visible in scroll container
      const isVisible = rect.top < containerRect.bottom && rect.bottom > containerRect.top;
      
      if (isVisible && this.thumbnailCanvases[i] && !this.thumbnailCanvases[i].loaded) {
        this.renderThumbnail(i);
      }
    }
  }

  renderThumbnail(index) {
    const thumb = this.thumbnailCanvases[index];
    if (!thumb || thumb.loaded || !this.imageData) return;
    
    const frame = this.frames[index];
    if (!frame) return;
    
    const ctx = thumb.canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, thumb.canvas.width, thumb.canvas.height);
    
    // Create temporary canvas with frame data
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = this.frameWidth;
    frameCanvas.height = this.frameHeight;
    const frameCtx = frameCanvas.getContext("2d");
    frameCtx.imageSmoothingEnabled = false;
    
    // Put image data
    const frameData = this.editor.ctx.createImageData(this.frameWidth, this.frameHeight);
    for (let fy = 0; fy < this.frameHeight; fy++) {
      for (let fx = 0; fx < this.frameWidth; fx++) {
        const srcX = frame.x + fx;
        const srcY = frame.y + fy;
        const srcIndex = (srcY * this.image.width + srcX) * 4;
        const dstIndex = (fy * this.frameWidth + fx) * 4;
        
        frameData.data[dstIndex] = this.imageData.data[srcIndex];
        frameData.data[dstIndex + 1] = this.imageData.data[srcIndex + 1];
        frameData.data[dstIndex + 2] = this.imageData.data[srcIndex + 2];
        frameData.data[dstIndex + 3] = this.imageData.data[srcIndex + 3];
      }
    }
    frameCtx.putImageData(frameData, 0, 0);
    
    // Draw scaled to thumbnail
    ctx.drawImage(frameCanvas, 0, 0, this.frameWidth, this.frameHeight, 0, 0, thumb.canvas.width, thumb.canvas.height);
    
    thumb.loaded = true;
  }

  drawGridOverlay() {
    const ctx = this.fullCanvas.getContext("2d");
    
    // Restore original image
    ctx.clearRect(0, 0, this.fullCanvas.width, this.fullCanvas.height);
    ctx.drawImage(this.image, 0, 0);
    
    // Draw grid
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let col = 0; col <= this.cols; col++) {
      const x = this.offsetX + col * this.frameWidth;
      ctx.beginPath();
      ctx.moveTo(x, this.offsetY);
      ctx.lineTo(x, this.offsetY + this.rows * this.frameHeight);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let row = 0; row <= this.rows; row++) {
      const y = this.offsetY + row * this.frameHeight;
      ctx.beginPath();
      ctx.moveTo(this.offsetX, y);
      ctx.lineTo(this.offsetX + this.cols * this.frameWidth, y);
      ctx.stroke();
    }
    
    // Highlight selected frames
    ctx.fillStyle = "rgba(255, 255, 0, 0.2)";
    this.selectedFrames.forEach(index => {
      const frame = this.frames[index];
      if (frame) {
        ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
      }
    });
  }

  toggleFrameSelection(index, item) {
    if (this.selectedFrames.has(index)) {
      this.selectedFrames.delete(index);
      item.classList.remove("selected");
    } else {
      this.selectedFrames.add(index);
      item.classList.add("selected");
    }
    
    // Update grid overlay
    this.drawGridOverlay();
  }

  selectAllFrames() {
    for (let i = 0; i < this.frames.length; i++) {
      this.selectedFrames.add(i);
    }
    
    // Update UI
    const items = this.previewContainer.children;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.add("selected");
    }
    
    this.drawGridOverlay();
  }

  deselectAllFrames() {
    this.selectedFrames.clear();
    
    // Update UI
    const items = this.previewContainer.children;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove("selected");
    }
    
    this.drawGridOverlay();
  }

  loadSelectedFrames() {
    if (this.selectedFrames.size === 0) {
      this.editor.showToast(__("Selecciona al menos un frame||Select at least one frame"), 2000);
      return;
    }
    
    // Ask if user wants new project or add to current
    this.showLoadOptionDialog();
  }

  showLoadOptionDialog() {
    this.editor.showPopup(
      __("Cargar Frames||Load Frames"),
      __("¿Cómo quieres cargar los frames?||How do you want to load the frames?"),
      [
        {
          text: __("Cancelar||Cancel"),
          class: "cancel",
          action: () => this.editor.hidePopup()
        },
        {
          text: __("Nuevo Proyecto||New Project"),
          action: () => {
            this.editor.hidePopup();
            this.createNewProjectFromFrames();
          }
        },
        {
          text: __("Añadir al proyecto||Add to project"),
          action: () => {
            this.editor.hidePopup();
            this.addFramesToProject();
          }
        }
      ]
    );
  }

  createNewProjectFromFrames() {
    if (this.selectedFrames.size === 0) return;
    
    // Sort selected frames by index
    const sortedIndices = Array.from(this.selectedFrames).sort((a, b) => a - b);
    
    // Create new project with first frame's dimensions
    const firstFrame = this.frames[sortedIndices[0]];
    this.editor.newProject(firstFrame.width, firstFrame.height);

    // Add each selected frame as a new frame
    sortedIndices.forEach(index => {
      const frame = this.frames[index];
      this.addFrameToProject(frame);
    });
    
    // Remove first frame
    this.editor.removeFrame(0, true);
    
    // Set current frame to first
    this.editor.project.currentFrame = 0;
    
    // Update UI
    this.editor.updateFramesUI();
    this.editor.render();
    
    this.editor.showToast(__(`${sortedIndices.length} frames cargados||${sortedIndices.length} frames loaded`));
    this.cleanup();
    this.editor.hidePopup();
  }

  addFramesToProject() {
    if (this.selectedFrames.size === 0) return;
    
    // Check if frame dimensions match current project
    const firstFrame = this.frames[Array.from(this.selectedFrames)[0]];
    if (firstFrame.width !== this.editor.project.width || firstFrame.height !== this.editor.project.height) {
      this.editor.showPopup(
        __("Dimensiones diferentes||Different dimensions"),
        __(`Los frames tienen tamaño ${firstFrame.width}x${firstFrame.height} pero el proyecto actual es ${this.editor.project.width}x${this.editor.project.height}. ¿Redimensionar proyecto?||Frames are ${firstFrame.width}x${firstFrame.height} but current project is ${this.editor.project.width}x${this.editor.project.height}. Resize project?`),
        [
          {
            text: __("Cancelar||Cancel"),
            class: "cancel",
            action: () => this.editor.hidePopup()
          },
          {
            text: __("Redimensionar||Resize"),
            action: () => {
              this.editor.hidePopup();
              this.editor.resizeCanvas(0, 0, firstFrame.width, firstFrame.height, true);
              this.performAddFrames();
            }
          },
          {
            text: __("Mantener tamaño||Keep size"),
            action: () => {
              this.editor.hidePopup();
              this.performAddFrames();
            }
          }
        ]
      );
    } else {
      this.performAddFrames();
    }
  }

  performAddFrames() {
    // Sort selected frames
    const sortedIndices = Array.from(this.selectedFrames).sort((a, b) => a - b);
    
    // Add frames
    sortedIndices.forEach(index => {
      const frame = this.frames[index];
      this.addFrameToProject(frame);
    });
    
    // Update UI
    this.editor.updateFramesUI();
    this.editor.render();
    
    this.editor.showToast(__(`${sortedIndices.length} frames añadidos||${sortedIndices.length} frames added`));
    this.cleanup();
    this.editor.hidePopup();
  }

  addFrameToProject(frameData) {
    // Create new frame
    const newFrame = {
      layers: []
    };
    
    // Copy layers from current frame structure
    const currentFrame = this.editor.project.frames[this.editor.project.currentFrame];
    for (let i = 0; i < currentFrame.layers.length; i++) {
      const layer = currentFrame.layers[i];
      const newLayer = this.editor.createBlankLayer(
        this.editor.project.width, 
        this.editor.project.height, 
        layer.name
      );
      newLayer.visible = layer.visible;
      newFrame.layers.push(newLayer);
    }
    
    // Draw spritesheet frame on first layer
    const targetLayer = newFrame.layers[0];
    const ctx = targetLayer.ctx;
    
    // Create image data from spritesheet
    const imageData = this.editor.ctx.createImageData(this.frameWidth, this.frameHeight);
    for (let y = 0; y < this.frameHeight; y++) {
      for (let x = 0; x < this.frameWidth; x++) {
        const srcX = frameData.x + x;
        const srcY = frameData.y + y;
        const srcIndex = (srcY * this.image.width + srcX) * 4;
        const dstIndex = (y * this.frameWidth + x) * 4;
        
        // Copy pixel data
        for (let c = 0; c < 4; c++) {
          imageData.data[dstIndex + c] = this.imageData.data[srcIndex + c];
        }
      }
    }
    
    // Handle different dimensions
    if (this.frameWidth !== this.editor.project.width || this.frameHeight !== this.editor.project.height) {
      // Create temporary canvas with frame size
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = this.frameWidth;
      tempCanvas.height = this.frameHeight;
      const tempCtx = tempCanvas.getContext("2d");
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.putImageData(imageData, 0, 0);
      
      // Calculate centering position
      const centerX = Math.floor((this.editor.project.width - this.frameWidth) / 2);
      const centerY = Math.floor((this.editor.project.height - this.frameHeight) / 2);
      
      // Draw centered
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(tempCanvas, centerX, centerY);
    } else {
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Add frame to project
    this.editor.project.frames.push(newFrame);
    this.editor.project.frameTimes.push(this.editor.defaultFrameTime);
  }

  cleanup() {
    // Clean up resources
    this.image = null;
    this.imageData = null;
    this.frames = [];
    this.selectedFrames.clear();
    this.thumbnailCanvases = [];
  }
}

// Undo History Manager 
class HistoryManager {
  constructor(editor) {
    this.editor = editor;
    this.history = [];
    this.historyIndex = -1;
    this.maxHistoryLength = Infinity;
    this.currentBatch = null;
  }

  // Start a new batch of operations (for grouping multiple changes)
  startBatch(type, description) {
    if (this.currentBatch) {
      this.endBatch();
    }
    this.currentBatch = {
      type: type,
      description: description,
      timestamp: Date.now(),
      operations: []
    };
  }

  // End the current batch and add to history
  endBatch() {
    if (this.currentBatch && this.currentBatch.operations.length > 0) {
      this.addToHistory(this.currentBatch);
    }
    this.currentBatch = null;
  }

  // Add a change to history
  addChange(change) {
    if (this.currentBatch) {
      this.currentBatch.operations.push(change);
    } else {
      this.addToHistory({
        type: change.type,
        description: change.description,
        timestamp: Date.now(),
        operations: [change]
      });
    }
  }

  // Add entry to history
  addToHistory(entry) {
    // Remove any history after current index
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // Add new entry
    this.history.push(entry);
    this.historyIndex++;
    
    // Limit history size
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  // Undo/Redo
  undo() {
    if (this.historyIndex < 0) return null;
    
    const entry = this.history[this.historyIndex];
    this.applyHistoryEntry(entry, true);
    this.historyIndex--;
    
    return {
      entry,
      message: __(`(Deshacer|Undo) '${entry.description}'`)
    };
  }
  
  redo() {
    if (this.historyIndex >= this.history.length - 1) return null;
    
    this.historyIndex++;
    const entry = this.history[this.historyIndex];
    this.applyHistoryEntry(entry, false);
    
    return {
      entry,
      message: __(`(Rehacer|Redo) '${entry.description}'`)
    };
  }

  // Apply a history entry (undo or redo)
  applyHistoryEntry(entry, isUndo, project) {
    const operations = isUndo ? [...entry.operations].reverse() : entry.operations;
    
    if (!project) project = this.editor.project;
    
    operations.forEach(operation => {
      switch (operation.type) {
        case 'draw':
          this.applyDrawOperation(project, operation, isUndo);
          break;
        case 'add_frame':
          this.applyAddFrameOperation(project, operation, isUndo);
          break;
        case 'remove_frame':
          this.applyRemoveFrameOperation(project, operation, isUndo);
          break;
        case 'duplicate_frame':
          this.applyDuplicateFrameOperation(project, operation, isUndo);
          break;
        case 'edit_frame':
          this.applyEditFrameOperation(project, operation, isUndo);
          break;
        case 'move_frame':
          this.applyMoveFrameOperation(project, operation, isUndo);
          break;
        case 'change_animation_fps':
          this.applyChangeFPSOperation(project, operation, isUndo);
          break;
        case 'add_layer':
          this.applyAddLayerOperation(project, operation, isUndo);
          break;
        case 'remove_layer':
          this.applyRemoveLayerOperation(project, operation, isUndo);
          break;
        case 'duplicate_layer':
          this.applyDuplicateLayerOperation(project, operation, isUndo);
          break;
        case 'rename_layer':
          this.applyRenameLayerOperation(project, operation, isUndo);
          break;
        case 'merge_layers':
          this.applyMergeLayersOperation(project, operation, isUndo);
          break;
        case 'change_layer_visibility':
          this.applyLayerVisibilityOperation(project, operation, isUndo);
          break;
        case 'move_layer':
          this.applyMoveLayerOperation(project, operation, isUndo);
          break;
        case 'transform':
          this.applyTransformOperation(project, operation, isUndo);
          break;
        case 'color_adjustment':
          this.applyColorAdjustmentOperation(project, operation, isUndo);
          break;
        case 'resize_canvas':
          this.applyResizeCanvasOperation(project, operation, isUndo);
          break;
      }
    });
    
    // Update UI after applying operations
    this.editor.updateFramesUI();
    this.editor.updateLayersUI();
    this.editor.render();
  }

  // Specific operation handlers
  applyDrawOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, pixels } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    const ctx = layer.ctx;
    
    pixels.forEach(pixel => {
      const { x, y, oldColor, newColor } = pixel;
      const colorToApply = isUndo ? oldColor : newColor;
      
      if (colorToApply === 'transparent') {
        ctx.clearRect(x, y, 1, 1);
      } else {
        ctx.fillStyle = colorToApply;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }

  applyAddFrameOperation(project, operation, isUndo) {
    if (isUndo) {
      // Remove the frame that was added
      project.frames.splice(operation.index, 1);
      project.frameTimes.splice(operation.index, 1);
      project.currentFrame = Math.min(operation.index, project.frames.length - 1);
    } else {
      // Add the frame back
      const newFrame = {
        layers: operation.layers.map(layerData => {
          const layer = this.editor.createBlankLayer(project.width, project.height, layerData.name);
          layer.visible = layerData.visible;
          
          // Restore layer content if available
          if (layerData.imageData) {
            const ctx = layer.ctx;
            const imageData = new ImageData(
              new Uint8ClampedArray(layerData.imageData),
              project.width,
              project.height
            );
            ctx.putImageData(imageData, 0, 0);
          }
          
          return layer;
        })
      };
      
      project.frames.splice(operation.index, 0, newFrame);
      project.frameTimes.splice(operation.index, 0, operation.frameTime);
      project.currentFrame = operation.index;
    }
  }

  applyRemoveFrameOperation(project, operation, isUndo) {
    this.applyAddFrameOperation(project, operation, !isUndo);
  }
  
  applyDuplicateFrameOperation(project, operation, isUndo) {
    if (isUndo) {
      // Remove the duplicated frame
      project.frames.splice(operation.index, 1);
      project.frameTimes.splice(operation.index, 1);
      project.currentFrame = Math.min(operation.index, this.editor.project.frames.length - 1);
    } else {
      // Restore the duplicated frame
      const newFrame = {
        layers: operation.layers.map(layerData => {
          const layer = this.editor.createBlankLayer(project.width, project.height, layerData.name);
          layer.visible = layerData.visible;
          
          if (layerData.imageData) {
            const ctx = layer.ctx;
            const imageData = new ImageData(
              new Uint8ClampedArray(layerData.imageData),
              project.width,
              project.height
            );
            ctx.putImageData(imageData, 0, 0);
          }
          
          return layer;
        })
      };
      
      project.frames.splice(operation.index, 0, newFrame);
      project.frameTimes.splice(operation.index, 0, operation.frameTime);
      project.currentFrame = operation.index;
    }
  }

  applyEditFrameOperation(project, operation, isUndo) {
    const { frameIndex, property, oldValue, newValue } = operation;
    
    if (property === 'time') {
      project.frameTimes[frameIndex] = isUndo ? oldValue : newValue;
    }
  }

  applyMoveFrameOperation(project, operation, isUndo) {
    const { fromIndex, toIndex } = operation;
    
    if (isUndo) {
      // Move back to original position
      const frame = project.frames.splice(toIndex, 1)[0];
      const frameTime = project.frameTimes.splice(toIndex, 1)[0];
      project.frames.splice(fromIndex, 0, frame);
      project.frameTimes.splice(fromIndex, 0, frameTime);
    } else {
      // Move to new position again
      const frame = project.frames.splice(fromIndex, 1)[0];
      const frameTime = project.frameTimes.splice(fromIndex, 1)[0];
      project.frames.splice(toIndex, 0, frame);
      project.frameTimes.splice(toIndex, 0, frameTime);
    }
  }

  applyChangeFPSOperation(project, operation, isUndo) {
    project.frameTimes = isUndo ? operation.oldFrameTimes : operation.newFrameTimes;
    
    const fps = isUndo ? operation.oldFPS : operation.newFPS;
    
    project.currentFrameTime = 1000 / operation.newFPS;
    
    this.editor.fpsInput.value = fps;
  }

  applyAddLayerOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = project.frames[frameIndex];
    
    if (isUndo) {
      // Remove the added layer
      frame.layers.splice(layerIndex, 1);
      project.currentLayer = Math.min(layerIndex, frame.layers.length - 1);
    } else {
      // Add the layer back
      const layer = this.editor.createBlankLayer(project.width, project.height, layerData.name);
      layer.visible = layerData.visible;
      
      if (layerData.imageData) {
        const ctx = layer.ctx;
        const imageData = new ImageData(
          new Uint8ClampedArray(layerData.imageData),
          project.width,
          project.height
        );
        ctx.putImageData(imageData, 0, 0);
      }
      
      frame.layers.splice(layerIndex, 0, layer);

      project.currentLayer = layerIndex;
    }
  }

  applyRemoveLayerOperation(project, operation, isUndo) {
    // Apply 'Add Layer' operation in reverse
    this.applyAddLayerOperation(project, operation, !isUndo);
  }
  
  applyDuplicateLayerOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = this.editor.project.frames[frameIndex];
    
    if (isUndo) {
      // Remove the duplicated layer
      frame.layers.splice(layerIndex, 1);
      this.editor.project.currentLayer = Math.min(layerIndex, frame.layers.length - 1);
    } else {
      // Restore the duplicated layer
      const layer = this.editor.createBlankLayer(
        this.editor.project.width, 
        this.editor.project.height,
        layerData.name
      );
      layer.visible = layerData.visible;
      
      if (layerData.imageData) {
        const ctx = layer.ctx;
        const imageData = new ImageData(
          new Uint8ClampedArray(layerData.imageData),
          this.editor.project.width,
          this.editor.project.height
        );
        ctx.putImageData(imageData, 0, 0);
      }
      
      frame.layers.splice(layerIndex, 0, layer);
      this.editor.project.currentLayer = layerIndex;
    }
  }
  
  applyRenameLayerOperation(project, operation, isUndo) {
    const { layerIndex, previousName, newName } = operation;
    
    // Rename the layer in all frames
    project.frames.forEach(frame => {
      const layer = frame.layers[layerIndex];
      
      layer.name = isUndo ? previousName : newName;
    });
  }
  
  applyMergeLayersOperation(project, operation, isUndo) {
    const { frameIndex, sourceIndex, targetIndex, sourceData, targetData } = operation;
    const frame = projectframes[frameIndex];
    
    if (isUndo) {
      // Restore both layers to their original state
      const sourceLayer = this.editor.createBlankLayer(project.width, project.height, sourceData.name);
      sourceLayer.visible = sourceData.visible;
      
      const sourceImageData = new ImageData(
        new Uint8ClampedArray(sourceData.imageData),
        project.width,
        project.height
      );
      sourceLayer.ctx.putImageData(sourceImageData, 0, 0);
      
      const targetLayer = frame.layers[targetIndex];
      targetLayer.ctx.clearRect(0, 0, project.width, project.height);
      
      const targetImageData = new ImageData(
        new Uint8ClampedArray(targetData.imageData),
        project.width,
        project.height
      );
      targetLayer.ctx.putImageData(targetImageData, 0, 0);
      
      // Reinsert source layer at original position
      frame.layers.splice(sourceIndex, 0, sourceLayer);
      
      // Adjust current layer if needed
      if (sourceIndex <= project.currentLayer) {
        project.currentLayer++;
      }
      
    } else {
      // Perform merge again
      const sourceLayer = frame.layers[sourceIndex];
      const targetLayer = frame.layers[targetIndex];
      
      targetLayer.ctx.drawImage(sourceLayer.canvas, 0, 0);
      frame.layers.splice(sourceIndex, 1);
      
      if (sourceIndex < project.currentLayer) {
        project.currentLayer--;
      } else if (sourceIndex === project.currentLayer) {
        project.currentLayer = targetIndex;
      }
    }
  }

  applyLayerVisibilityOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, visible } = operation;
    const frame = project.frames[frameIndex];
    frame.layers[layerIndex].visible = isUndo ? !visible : visible;
  }

  applyMoveLayerOperation(project, operation, isUndo) {
    const { frameIndex, fromIndex, toIndex } = operation;
    const frame = project.frames[frameIndex];
    
    if (isUndo) {
      // Move back to original position
      const layer = frame.layers.splice(toIndex, 1)[0];
      frame.layers.splice(fromIndex, 0, layer);
    } else {
      // Move to new position again
      const layer = frame.layers.splice(fromIndex, 1)[0];
      frame.layers.splice(toIndex, 0, layer);
    }
  }

  applyTransformOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, transformType, transformData } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    const ctx = layer.ctx;
    
    // We'll store the entire image data for transformations
    // This is still more efficient than full project snapshots
    // But we can optimize this in the future
    
    ctx.clearRect(0, 0, project.width, project.height);
    
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? transformData.oldImageData : transformData.newImageData),
      project.width,
      project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
  }

  applyColorAdjustmentOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, adjustmentType, adjustmentData } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    const ctx = layer.ctx;
    
    // Similar to transform, store the image data for color adjustments
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? adjustmentData.oldImageData : adjustmentData.newImageData),
      project.width,
      project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  applyResizeCanvasOperation(project, operation, isUndo) {
    const { oldWidth, oldHeight, newWidth, newHeight, cropX, cropY, framesData } = operation;
    
    // Store current frame/layer indices
    const currentFrame = project.currentFrame;
    const currentLayer = project.currentLayer;
    
    // Determine which dimensions to use
    const targetWidth = isUndo ? oldWidth : newWidth;
    const targetHeight = isUndo ? oldHeight : newHeight;
    
    // Resize project dimensions first
    project.width = targetWidth;
    project.height = targetHeight;
    this.editor.resetCanvasSize();
    
    // Restore/transform each layer
    project.frames.forEach((frame, fIndex) => {
      // Make sure we have data for this frame
      const frameData = framesData && framesData[fIndex];
      if (!frameData) return;
      
      frame.layers.forEach((layer, lIndex) => {
        const layerData = frameData.layers && frameData.layers[lIndex];
        if (!layerData) return;
        
        // Ensure we have valid image data array
        const expectedLength = 4 * oldWidth * oldHeight;
        let imageDataArray = layerData.imageData;
        
        // If the array length doesn't match, create a blank array of correct size
        if (!imageDataArray || imageDataArray.length !== expectedLength) {
          imageDataArray = new Array(expectedLength).fill(0);
        }
        
        if (isUndo) {
          // Undo: restore original size and content
          const imageData = new ImageData(
            new Uint8ClampedArray(imageDataArray),
            oldWidth,
            oldHeight
          );
          
          // Create temp canvas with original size
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = oldWidth;
          tempCanvas.height = oldHeight;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.putImageData(imageData, 0, 0);
          
          // Resize layer canvas to original size
          layer.canvas.width = oldWidth;
          layer.canvas.height = oldHeight;
          
          // Draw back to resized canvas
          layer.ctx.clearRect(0, 0, oldWidth, oldHeight);
          layer.ctx.drawImage(tempCanvas, 0, 0);
        } else {
          // Redo: crop to new size
          const imageData = new ImageData(
            new Uint8ClampedArray(imageDataArray),
            oldWidth,
            oldHeight
          );
          
          // Create temp canvas with original content
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = oldWidth;
          tempCanvas.height = oldHeight;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.putImageData(imageData, 0, 0);
          
          // Resize layer canvas to new size
          layer.canvas.width = newWidth;
          layer.canvas.height = newHeight;
          
          // Draw cropped area
          layer.ctx.clearRect(0, 0, newWidth, newHeight);
          layer.ctx.drawImage(tempCanvas, -cropX, -cropY);
        }
      });
    });
    
    // Restore frame/layer indices
    project.currentFrame = Math.min(currentFrame, project.frames.length - 1);
    project.currentLayer = Math.min(currentLayer, 
      project.frames[project.currentFrame].layers.length - 1);
    
    // Update transform and render
    this.editor.updateCanvasTransform();
    this.editor.render();
  }
  
  // Generate timelapse by replaying history
  async generateTimelapse(fps, scale, progressCallback) {
    // Create a temporary project to replay history
    const tempProject = this.editor.getNewProjectData(this.editor.project.width, this.editor.project.height);
    const tempFrameTimes = [...this.editor.project.frameTimes];
    
    // Get canvas for rendering
    const { canvas: tempCanvas, ctx: tempCtx } = this.editor.getTempCanvas(tempProject.width * scale, tempProject.height * scale);
    
    // Set up media recording
    const stream = tempCanvas.captureStream();
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8000000
    });
    
    const chunks = [];
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
      
      recorder.start();
      
      // Replay history to create timelapse
      this.replayHistoryForTimelapse(
        tempProject, 
        tempFrameTimes, 
        tempCanvas, 
        tempCtx, 
        scale, 
        fps, 
        progressCallback,
        () => {
          setTimeout(() => recorder.stop(), 1000 / fps);
        }
      );
    });
  }

  async replayHistoryForTimelapse(project, frameTimes, canvas, ctx, scale, fps, progressCallback, onComplete) {
    const frameInterval = 1000 / fps;
    let currentHistoryIndex = 0;
    let lastFrameIndex = project.currentFrame || 0;
    
    const renderFrame = async () => {
      if (currentHistoryIndex >= this.history.length) {
        onComplete();
        return;
      }
      
      // Apply next history entry
      const entry = this.history[currentHistoryIndex];
      this.applyHistoryEntryToProject(entry, project, frameTimes, false);
      
      // Check if frame has changed
      const currentFrameIndex = project.currentFrame || 0;
      const frameChanged = currentFrameIndex !== lastFrameIndex;
      lastFrameIndex = currentFrameIndex;
      
      // Always clear the canvas completely for each frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      if (!this.editor.transparentBackground) {
        ctx.fillStyle = this.editor.secondaryColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Create temporary canvas for the frame layers layers
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = project.width;
      layerCanvas.height = project.height;
      const layerCtx = this.editor.getCanvasContext(layerCanvas);
      
      // Draw current frame
      const frame = project.frames[currentFrameIndex];
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];
        if (layer.visible) {
          // Clear the temporary canvas
          layerCtx.clearRect(0, 0, project.width, project.height);
          
          // If we have image data, put it on the canvas
          if (layer.imageData) {
            const imageData = new ImageData(
              new Uint8ClampedArray(layer.imageData),
              project.width,
              project.height
            );
            layerCtx.putImageData(imageData, 0, 0);
          } else if (layer.canvas) {
            // If we have a canvas, draw it
            layerCtx.drawImage(layer.canvas, 0, 0);
          }
          
          // Draw scaled to the main canvas
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            layerCanvas, 
            0, 0, project.width, project.height,
            0, 0, canvas.width, canvas.height
          );
        }
      }
      
      // Update progress
      progressCallback(Math.floor((currentHistoryIndex / this.history.length) * 100), canvas.toDataURL());
      
      currentHistoryIndex++;
      
      // Schedule next frame
      if (currentHistoryIndex < this.history.length) {
        setTimeout(renderFrame, frameInterval);
      } else {
        setTimeout(() => {
          onComplete();
        }, frameInterval);
      }
    };
    
    // Start rendering
    renderFrame();
  }

  // Project-specific operation handlers (similar to the main ones but for a target project) used to generate timelapse
  applyHistoryEntryToProject(entry, project, frameTimes, isUndo) {
    const operations = isUndo ? [...entry.operations].reverse() : entry.operations;
    
    operations.forEach(operation => {
      switch (operation.type) {
        case 'add_frame':
          this.applyAddFrameToProject(operation, project, frameTimes, isUndo);
          break;
        case 'remove_frame':
          this.applyRemoveFrameToProject(operation, project, frameTimes, isUndo);
          break;
        case 'edit_frame':
          if (operation.property === 'time') {
            frameTimes[operation.frameIndex] = isUndo ? operation.oldValue : operation.newValue;
          }
          break;
        case 'move_frame':
          this.applyMoveFrameToProject(operation, project, frameTimes, isUndo);
          break;
        case 'change_animation_fps':
          // This affects the global FPS, so we might not need to apply it per project
          break;
        case 'add_layer':
          this.applyAddLayerToProject(operation, project, isUndo);
          break;
        case 'remove_layer':
          this.applyRemoveLayerToProject(operation, project, isUndo);
          break;
        case 'change_layer_visibility':
          const frame = project.frames[operation.frameIndex];
          if (frame && frame.layers[operation.layerIndex]) {
            frame.layers[operation.layerIndex].visible = isUndo ? !operation.visible : operation.visible;
          }
          break;
        case 'move_layer':
          this.applyMoveLayerToProject(operation, project, isUndo);
          break;
        case 'transform':
          this.applyTransformToProject(operation, project, isUndo);
          break;
        case 'color_adjustment':
          this.applyColorAdjustmentToProject(operation, project, isUndo);
          break;
        case 'draw':
          this.applyDrawToProject(operation, project, isUndo);
          break;
      }
    });
  }
  
  applyAddFrameToProject(operation, project, frameTimes, isUndo) {
    if (isUndo) {
      project.frames.splice(operation.index, 1);
      frameTimes.splice(operation.index, 1);
    } else {
      const newFrame = {
        layers: operation.layers.map(layerData => {
          const canvas = document.createElement('canvas');
          const ctx = this.editor.getCanvasContext(canvas);
          const layer = {
            canvas: canvas,
            ctx: ctx,
            visible: layerData.visible,
            name: layerData.name
          };
          layer.canvas.width = project.width;
          layer.canvas.height = project.height;
          
          if (layerData.imageData) {
            const ctx = layer.ctx;
            const imageData = new ImageData(
              new Uint8ClampedArray(layerData.imageData),
              project.width,
              project.height
            );
            ctx.putImageData(imageData, 0, 0);
          }
          
          return layer;
        })
      };
      
      project.frames.splice(operation.index, 0, newFrame);
      frameTimes.splice(operation.index, 0, operation.frameTime);
    }
  }

  applyRemoveFrameToProject(operation, project, frameTimes, isUndo) {
    if (isUndo) {
      const restoredFrame = {
        layers: operation.layers.map(layerData => {
          const canvas = document.createElement('canvas');
          const ctx = this.editor.getCanvasContext(canvas);
          const layer = {
            canvas: canvas,
            ctx: ctx,
            visible: layerData.visible,
            name: layerData.name
          };
          layer.canvas.width = project.width;
          layer.canvas.height = project.height;
          
          if (layerData.imageData) {
            const ctx = layer.ctx;
            ctx.putImageData(
              new ImageData(
                new Uint8ClampedArray(layerData.imageData),
                project.width,
                project.height
              ),
              0, 0
            );
          }
          
          return layer;
        })
      };
      
      project.frames.splice(operation.index, 0, restoredFrame);
      frameTimes.splice(operation.index, 0, operation.frameTime);
    } else {
      project.frames.splice(operation.index, 1);
      frameTimes.splice(operation.index, 1);
    }
  }

  applyMoveFrameToProject(operation, project, frameTimes, isUndo) {
    const { fromIndex, toIndex } = operation;
    
    if (isUndo) {
      const frame = project.frames.splice(toIndex, 1)[0];
      const frameTime = frameTimes.splice(toIndex, 1)[0];
      project.frames.splice(fromIndex, 0, frame);
      frameTimes.splice(fromIndex, 0, frameTime);
    } else {
      const frame = project.frames.splice(fromIndex, 1)[0];
      const frameTime = frameTimes.splice(fromIndex, 1)[0];
      project.frames.splice(toIndex, 0, frame);
      frameTimes.splice(toIndex, 0, frameTime);
    }
  }

  applyAddLayerToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = project.frames[frameIndex];
    
    if (isUndo) {
      frame.layers.splice(layerIndex, 1);
    } else {
      const canvas = document.createElement('canvas');
      const ctx = this.editor.getCanvasContext(canvas);
      const layer = {
        canvas: canvas,
        ctx: ctx,
        visible: layerData.visible,
        name: layerData.name
      };
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
      
      if (layerData.imageData) {
        const ctx = layer.ctx;
        const imageData = new ImageData(
          new Uint8ClampedArray(layerData.imageData),
          project.width,
          project.height
        );
        ctx.putImageData(imageData, 0, 0);
      }
      
      frame.layers.splice(layerIndex, 0, layer);
    }
  }

  applyRemoveLayerToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = project.frames[frameIndex];
    
    if (isUndo) {
      const canvas = document.createElement('canvas');
      const ctx = this.editor.getCanvasContext(canvas);
      const layer = {
        canvas: canvas,
        ctx: ctx,
        visible: layerData.visible,
        name: layerData.name
      };
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
      
      if (layerData.imageData) {
        const ctx = layer.ctx;
        ctx.putImageData(
          new ImageData(
            new Uint8ClampedArray(layerData.imageData),
            project.width,
            project.height
          ),
          0, 0
        );
      }
      
      frame.layers.splice(layerIndex, 0, layer);
    } else {
      frame.layers.splice(layerIndex, 1);
    }
  }

  applyMoveLayerToProject(operation, project, isUndo) {
    const { frameIndex, fromIndex, toIndex } = operation;
    const frame = project.frames[frameIndex];
    
    if (isUndo) {
      const layer = frame.layers.splice(toIndex, 1)[0];
      frame.layers.splice(fromIndex, 0, layer);
    } else {
      const layer = frame.layers.splice(fromIndex, 1)[0];
      frame.layers.splice(toIndex, 0, layer);
    }
  }

  applyTransformToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, transformData } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    
    if (!layer.canvas) {
      layer.canvas = document.createElement('canvas');
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
    }
    
    const ctx = layer.ctx;
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? transformData.oldImageData : transformData.newImageData),
      transformData.oldWidth || project.width,
      transformData.oldHeight || project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
    
    // Update dimensions if they changed
    if (transformData.newWidth && transformData.newHeight) {
      layer.canvas.width = isUndo ? transformData.oldWidth : transformData.newWidth;
      layer.canvas.height = isUndo ? transformData.oldHeight : transformData.newHeight;
    }
  }
  
  applyColorAdjustmentToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, adjustmentData } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    
    if (!layer.canvas) {
      layer.canvas = document.createElement('canvas');
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
    }
    
    const ctx = layer.ctx;
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? adjustmentData.oldImageData : adjustmentData.newImageData),
      project.width,
      project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  applyDrawToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, pixels } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    
    project.currentFrame  = frameIndex;
    project.currentLayer = layerIndex
    
    if (!layer.canvas) {
      layer.canvas = document.createElement('canvas');
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
    }
    
    const ctx = layer.ctx;
    
    pixels.forEach(pixel => {
      const { x, y, oldColor, newColor } = pixel;
      const colorToApply = isUndo ? oldColor : newColor;
      
      if (colorToApply === 'transparent') {
        ctx.clearRect(x, y, 1, 1);
      } else {
        ctx.fillStyle = colorToApply;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
  
  // Serialize history for saving
  serialize() {
    return JSON.stringify({
      history: this.history,
      historyIndex: this.historyIndex
    });
  }

  // Deserialize history from loaded data
  deserialize(data) {
    try {
      const parsed = JSON.parse(data);
      this.history = parsed.history || [];
      this.historyIndex = parsed.historyIndex || -1;
      return true;
    } catch (error) {
      console.error('Error deserializing history:', error);
      return false;
    }
  }

  // Clear history
  clear() {
    this.history = [];
    this.historyIndex = -1;
    this.currentBatch = null;
  }
}

// Collaboration Manager
class CollabManager {
  constructor(editor) {
    this.editor = editor;
    this.ws = null;
    this.host = HOST;
    this.sessionId = null;
    this.sessionName = '';
    this.memberId = null;
    this.memberName = this.editor.collabMemberName;
    this.memberColor = this.editor.collabMemberColor;
    this.isHost = false;
    this.isConnected = false;
    this.manualDisconnect = false;
    this.chatVisible = false;
    
    // Members tracking
    this.members = new Map();
    
    // Permissions
    this.permissions = {
      undoRedo: 'host',
      addRemoveFrames: 'everyone',
      addRemoveLayers: 'everyone',
      draw: 'everyone',
      chat: 'everyone'
    };
    
    // Visible cursors tracking
    this.cursors = new Map();
    this.cursorContainer = null;
    
    // Current trace being drawn
    this.currentTrace = null;
    this.tracePoints = [];
    
    // Chat
    this.chatMessages = [];
    
    // Throttle cursor updates
    this.lastCursorSend = 0;
    this.CURSOR_THROTTLE = 50;
    
    // Initialize
    this.initUI();
  }

  getColorHex(colorName) {
    const colors = {
      red: '#ff4444',
      blue: '#4444ff',
      green: '#44ff44',
      yellow: '#ffff44',
      orange: '#ff5722',
      purple: '#aa44ff',
      pink: '#ff44aa',
      cyan: '#44ffff',
      brown: '#8b4513',
      gray: '#888888',
      lime: '#aaff44',
      indigo: '#4b0082'
    };
    return colors[colorName] || '#ffffff';
  }
  
  wrapMemberName(member, displayName) {
    return `<span style="color:${this.getColorHex(member.color)}">${displayName || member.name}</span>`;
  }

  initUI() {
    // Create cursor container
    this.cursorContainer = document.createElement('div');
    this.cursorContainer.className = 'collab-cursor-container';
    this.editor.uiLayer.appendChild(this.cursorContainer);
    
    // Create Chat button
    this.chatButton = document.createElement('button');
    this.chatButton.className = 'collab-chat-button';
    this.chatButton.textContent = "Chat";
    this.chatButton.addEventListener("click", () => this.openChat());
    this.editor.animationPanel.appendChild(this.chatButton);

    // Create chat container
    this.chatContainer = document.createElement('div');
    this.chatContainer.className = 'collab-chat-container';
    
    // Chat messages area
    this.chatMessagesDiv = document.createElement('div');
    this.chatMessagesDiv.className = 'collab-chat-messages';
    this.chatContainer.appendChild(this.chatMessagesDiv);
    
    // Close button
    const closeButton = document.createElement("div");
    closeButton.className = "panel-close collab-chat-close";
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", () => this.closeChat());
    this.chatContainer.appendChild(closeButton);
    
    // Chat input
    const chatInputDiv = document.createElement('div');
    chatInputDiv.className = 'collab-chat-input-container';
    
    this.chatInput = document.createElement('input');
    this.chatInput.type = 'text';
    this.chatInput.placeholder = __('Escribe un mensaje...||Type a message...');
    this.chatInput.className = 'collab-chat-input';
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.chatInput.value.trim()) {
        this.sendChatMessage(this.chatInput.value.trim());
        this.chatInput.value = '';
      }
    });
    
    const sendBtn = document.createElement('button');
    sendBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
    sendBtn.className = 'collab-chat-send';
    sendBtn.addEventListener('click', () => {
      if (this.chatInput.value.trim()) {
        this.sendChatMessage(this.chatInput.value.trim());
        this.chatInput.value = '';
      }
    });
    
    chatInputDiv.appendChild(this.chatInput);
    chatInputDiv.appendChild(sendBtn);
    this.chatContainer.appendChild(chatInputDiv);
    
    this.editor.animationPanel.appendChild(this.chatContainer);

    // Ping indicator
    this.pingIndicator = document.createElement('div');
    this.pingIndicator.className = 'collab-ping-indicator';
    this.pingIndicator.innerHTML = `
      <span class="ping-dot" style="background-color: #44ff44;"></span>
      <span class="ping-value">---</span>
    `;
    this.editor.uiLayer.appendChild(this.pingIndicator);

    // Session overlay
    this.createSessionOverlay();
  }

  createSessionOverlay() {
    this.sessionOverlay = document.createElement('div');
    this.sessionOverlay.className = "collab-session-overlay";
    
    // Header
    const header = document.createElement('div');
    header.className = "collab-session-header";
    
    const title = document.createElement('h2');
    title.className = "collab-session-title";
    title.textContent = __('Sesión Colaborativa||Collaborative Session');
    
    const closeBtn = document.createElement('button');
    closeBtn.className = "collab-close-btn";
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      this.sessionOverlay.style.display = 'none';
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Content
    this.sessionContent = document.createElement('div');
    this.sessionContent.className = "collab-session-content";
    
    this.sessionOverlay.appendChild(header);
    this.sessionOverlay.appendChild(this.sessionContent);
    document.body.appendChild(this.sessionOverlay);
  }

  hookEditorMethods() {
    const self = this;
    
    // Store original methods
    const originalAddFrame = this.editor.addFrame;
    const originalRemoveFrame = this.editor.removeFrame;
    const originalMoveFrame = this.editor.moveFrame;
    const originalAddLayer = this.editor.addLayer;
    const originalRemoveLayer = this.editor.removeLayer;
    const originalMoveLayer = this.editor.moveLayer;
    const originalSetLayerVisibility = this.editor.setLayerVisibility;
    const originalUndo = this.editor.undo;
    const originalRedo = this.editor.redo;
    
    this.editor._originalAddFrame = originalAddFrame;
    this.editor._originalRemoveFrame = originalRemoveFrame;
    this.editor._originalMoveFrame = originalMoveFrame;
    this.editor._originalAddLayer = originalAddLayer;
    this.editor._originalRemoveLayer = originalRemoveLayer;
    this.editor._originalMoveLayer = originalMoveLayer;
    this.editor._originalSetLayerVisibility = originalSetLayerVisibility;
    this.editor._originalUndo = originalUndo;
    this.editor._originalRedo = originalRedo;
    
    // Hook into drawing by intercepting tool methods
    this.hookToolMethods();
    
    // Hook into frame methods
    this.editor.addFrame = function(...args) {
      const result = originalAddFrame.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveFrames')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.removeFrame = function(...args) {
      const result = originalRemoveFrame.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveFrames')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.moveFrame = function(...args) {
      const result = originalMoveFrame.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveFrames')) {
        self.sendFullState();
      }
      return result;
    };
    
    // Hook into layer methods
    this.editor.addLayer = function(...args) {
      const result = originalAddLayer.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveLayers')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.removeLayer = function(...args) {
      const result = originalRemoveLayer.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveLayers')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.moveLayer = function(...args) {
      const result = originalMoveLayer.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveLayers')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.setLayerVisibility = function(...args) {
      const result = originalSetLayerVisibility.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveLayers')) {
        self.sendFullState();
      }
      return result;
    };
    
    // Hook into undo/redo
    this.editor.undo = function() {
      if (self.isConnected && !self.isHost && !self.canPerformAction('undoRedo')) {
        self.editor.showToast(__('No tienes permiso para deshacer'), 1000);
        return;
      }
      const result = originalUndo.call(this);
      if (self.isConnected && self.isHost) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.redo = function() {
      if (self.isConnected && !self.isHost && !self.canPerformAction('undoRedo')) {
        self.editor.showToast(__('No tienes permiso para rehacer'), 1000);
        return;
      }
      const result = originalRedo.call(this);
      if (self.isConnected && self.isHost) {
        self.sendFullState();
      }
      return result;
    };
  }

  hookToolMethods() {
    const self = this;
    
    const tools = this.editor.tools;
    
    Object.keys(tools).forEach(toolName => {
      // Store original tool methods
      const tool = tools[toolName];
      const originalOnDown = tool.onDown;
      const originalOnMove = tool.onMove;
      const originalOnUp = tool.onUp;
      
      tool.originalOnDown = originalOnDown;
      tool.originalOnMove = originalOnMove;
      tool.originalOnUp = originalOnUp;
      
      tool.onDown = function(x, y) {
        // Start new trace
        if (self.isConnected && self.canPerformAction('draw')) {
          self.currentTrace = {
            tool: toolName,
            brushSize: self.editor.brushSize,
            color: self.editor.getColor(),
            points: [{ x, y }],
            frame: self.editor.project.currentFrame,
            layer: self.editor.project.currentLayer
          };
          self.tracePoints = [{ x, y }];
        }
        
        if (originalOnDown) {
          originalOnDown.call(self.editor, x, y);
        }
      };
      
      tool.onMove = function(x, y) {
        // Add to current trace
        if (self.isConnected && self.canPerformAction('draw') && self.currentTrace) {
          self.currentTrace.points.push({ x, y });
          
          // Send cursor update (throttled)
          self.sendCursorUpdate(x, y, true);
        }
        
        if (originalOnMove) {
          originalOnMove.call(self.editor, x, y);
        }
      };
      
      tool.onUp = function(x, y, startX, startY) {
        // Complete the trace and send it
        if (self.isConnected && self.canPerformAction('draw') && self.currentTrace) {
          // Add final point if different
          const lastPoint = self.currentTrace.points[self.currentTrace.points.length - 1];
          if (lastPoint.x !== x || lastPoint.y !== y) {
            self.currentTrace.points.push({ x, y });
          }
          
          self.sendTraceComplete(self.currentTrace);
          self.currentTrace = null;
          self.sendCursorUpdate(0, 0, false);
        }
        
        if (originalOnUp) {
          originalOnUp.call(self.editor, x, y, startX, startY);
        }
      };
    });
  }
  
  restoreEditorMethods() {
    this.editor.addFrame = this.editor._originalAddFrame;
    this.editor.removeFrame = this.editor._originalRemoveFrame;
    this.editor.moveFrame = this.editor._originalMoveFrame;
    this.editor.addLayer = this.editor._originalAddLayer;
    this.editor.removeLayer = this.editor._originalRemoveLayer;
    this.editor.moveLayer = this.editor._originalMoveLayer;
    this.editor.setLayerVisibility = this.editor._originalSetLayerVisibility;
    this.editor.undo = this.editor._originalUndo;
    this.editor.redo = this.editor._originalRedo;
    
    const tools = this.editor.tools;
    
    Object.keys(tools).forEach(toolName => {
      const tool = tools[toolName];

      tool.onDown = tool.originalOnDown;
      tool.onMove = tool.originalOnMove;
      tool.onUp = tool.originalOnUp;
    });
  }
  
  updateMemberName(newName) {
    this.sendMessage({
      type: 'name_update',
      oldName: this.memberName,
      newName: newName
    });
    
    this.memberName = newName;
  }
  
  updateMemberColor(newColor) {
    this.sendMessage({
      type: 'color_update',
      oldColor: this.memberColor,
      newColor: newColor
    });
    
    this.memberColor = newColor;
  }

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    
    this.editor.showLoadingScreen(__('Conectando...||Connecting...'));
    
    this.ws = new WebSocket(this.host);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.editor.hideLoadingScreen();
      this.manualDisconnect = false;
      this.startPingInterval();
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.handleDisconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.editor.hideLoadingScreen();
      this.editor.showToast(__('Error de conexión||Connection error'), 3000);
    };
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'session_created':
        this.handleSessionCreated(message);
        break;
      case 'session_joined':
        this.handleSessionJoined(message);
        break;
      case 'member_joined':
        this.handleMemberJoined(message.member);
        break;
      case 'member_left':
        this.handleMemberLeft(message.memberId, message.memberName);
        break;
      case 'member_kicked':
        this.handleMemberKicked(message.memberId, message.memberName);
        break;
      case 'you_were_kicked':
        this.handleYouWereKicked();
        break;
      case 'trace_complete':
        this.handleTraceComplete(message);
        break;
      case 'cursor_update':
        this.handleRemoteCursor(message);
        break;
      case 'name_update':
        this.handleNameUpdate(message);
        break;
      case 'color_update':
        this.handleColorUpdate(message);
        break;
      case 'chat_message':
        this.handleChatMessage(message);
        break;
      case 'full_state':
        this.handleFullState(message);
        break;
      case 'session_ended':
        this.handleSessionEnded(message.reason);
        break;
      case 'pong':
        this.handlePong(message.timestamp);
        break;
    }
  }

  handleSessionCreated(message) {
    this.sessionId = message.sessionId;
    this.sessionName = message.sessionName;
    this.memberId = message.memberId;
    this.isHost = true;
    this.isConnected = true;
    
    this.clearChatMessages();
    
    this.members.clear();
    this.members.set(this.memberId, {
      id: this.memberId,
      name: this.memberName,
      color: this.memberColor,
      isHost: true
    });
    
    this.chatButton.style.display = 'flex';
    this.pingIndicator.style.display = 'flex';
    this.sendFullState();
    this.renderSessionMenu();
    this.sessionOverlay.style.display = 'flex';
    
    this.hookEditorMethods();
    
    this.editor.showToast(__('Sesión creada||Session created'), 2000);
  }

  handleSessionJoined(message) {
    this.sessionId = message.sessionId;
    this.sessionName = message.sessionName;
    this.memberId = message.memberId;
    this.isHost = message.isHost;
    this.isConnected = true;
    
    this.members.clear();
    message.members.forEach(member => {
      this.members.set(member.id, member);
    });
    
    this.clearChatMessages();
    
    // Load project state if available
    if (message.projectData) {
      this.applyFullState(message.projectData);
    }
    
    this.chatButton.style.display = 'flex';
    this.pingIndicator.style.display = 'flex';
    this.renderSessionMenu();
    this.sessionOverlay.style.display = 'flex';
    
    this.hookEditorMethods();
    
    this.editor.showToast(__('Conectado a la sesión||Connected to the session'), 2000);
  }

  handleMemberJoined(member) {
    if (member.id === this.memberId) return;
    this.members.set(member.id, member);
    this.editor.showToast(`${this.wrapMemberName(member)} ${__('se unió||joined')}`, 2000);
    if (this.isHost) {
      this.sendFullState(member.id);
    }
    this.renderSessionMenu();
  }

  handleMemberLeft(memberId, memberName) {
    const member = this.members.get(memberId);
    if (member) {
      this.members.delete(memberId);
      this.removeUserCursor(memberId);
      this.editor.showToast(`${this.wrapMemberName(member, member.name || memberName)} ${__('salió||left')}`, 2000);
      this.renderSessionMenu();
    }
  }

  handleMemberKicked(memberId, memberName) {
    const member = this.members.get(memberId);
    if (member) {
      this.members.delete(memberId);
      this.removeUserCursor(memberId);
      this.editor.showToast(`${member.name || memberName} ${__('fue expulsado')}`, 3000);
      this.renderSessionMenu();
    }
  }

  handleYouWereKicked() {
    this.manualDisconnect = false;
    this.disconnect();
    this.editor.showToast(__('Has sido expulsado de la sesión'), 4000);
  }

  handleTraceComplete(message) {
    const { memberId, data } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    // Show name tag at the last point
    const lastPoint = data.points[data.points.length - 1];
    this.showCursor(memberId, member.name, member.color, lastPoint.x, lastPoint.y);
    
    // Apply the trace using the editor's drawing methods
    this.applyTrace(data);
  }

  applyTrace(trace) {
    const { tool, brushSize, color, points, frame, layer } = trace;
    
    const frameObj = this.editor.project?.frames[frame];
    if (!frameObj) return;
    
    const layerObj = frameObj.layers[layer];
    if (!layerObj) return;
    
    const ctx = layerObj.ctx;
    
    // Store original brush size and color
    const originalBrushSize = this.editor.brushSize;
    const originalSelectedColor = this.editor.selectedColor;
    const originalPrimaryColor = this.editor.primaryColor;
    
    // Temporarily set for drawing
    this.editor.brushSize = brushSize;
    this.editor.selectedColor = 'primary';
    this.editor.primaryColor = color;
    
    // Get the tool
    const toolObj = this.editor.tools[tool];
    if (!toolObj) return;
    
    // Need to temporarily set the current tool to draw properly
    const originalTool = this.editor.currentTool;
    this.editor.currentTool = toolObj;
    
    // Draw the trace using the tool's original methods
    if (points.length === 1) {
      // Single point (click)
      if (toolObj.originalOnDown) {
        toolObj.originalOnDown.call(this.editor, points[0].x, points[0].y);
      }
      if (toolObj.originalOnUp) {
        toolObj.originalOnUp.call(this.editor, points[0].x, points[0].y);
      }
    } else {
      // Stroke with multiple points
      if (toolObj.originalOnDown) {
        toolObj.originalOnDown.call(this.editor, points[0].x, points[0].y);
      }
      
      // Draw the stroke
      for (let i = 1; i < points.length; i++) {
        if (toolObj.originalOnMove) {
          toolObj.originalOnMove.call(this.editor, points[i].x, points[i].y);
        }
      }
      
      if (toolObj.originalOnUp) {
        toolObj.originalOnUp.call(this.editor, points[points.length - 1].x, points[points.length - 1].y);
      }
    }
    
    // Restore original values
    this.editor.brushSize = originalBrushSize;
    this.editor.selectedColor = originalSelectedColor;
    this.editor.primaryColor = originalPrimaryColor;
    this.editor.currentTool = originalTool;
    
    // Force a render to show the drawing
    this.editor.render();
  }
  
  handleRemoteCursor(message) {
    const { memberId, x, y, active } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    if (active) {
      this.showCursor(memberId, member.name, member.color, x, y);
    } else {
      this.hideCursor(memberId);
    }
  }
  
  handleNameUpdate(message) {
    const { memberId, oldName, newName } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    member.name = newName;
    
    this.editor.showToast(`${this.wrapMemberName(member, oldName)}</span> ${__("(ha cambiado su nombre a|has changed name to)")} ${this.wrapMemberName(member, newName)}`);
  }
  
  handleColorUpdate(message) {
    const { memberId, oldColor, newColor } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    member.color = newColor;
    
    this.editor.showToast(`${this.wrapMemberName(member)}</span> ${__("(ha cambiado su color|has changed color)")}`);
  }

  handleChatMessage(message) {
    this.chatMessages.push(message);
    this.addMessageHtml(message);
    if (!this.chatVisible) {
      this.chatButton.classList.add('new-message');
    }
    this.scrollMessagesToBottom();
  }

  handleFullState(message) {
    if (message.memberId === this.memberId) return;
    this.applyFullState(message.state);
    this.editor.showOperationMessage(__('Proyecto sincronizado||Project synchronized'), 1000);
  }

  handleSessionEnded(reason) {
    this.disconnect(false);
    this.editor.showToast(reason || __('La sesión ha terminado'), 3000);
  }

  handlePong(timestamp) {
    const ping = Date.now() - timestamp;
    this.updatePingIndicator(ping);
  }

  handleDisconnect() {
    this.isConnected = false;
    this.stopPingInterval();
    this.cleanupDisconnect();
  }

  cleanupDisconnect() {
    this.isConnected = false;
    this.sessionId = null;
    this.sessionName = '';
    this.isHost = false;
    this.members.clear();
    this.removeAllCursors();
    this.currentTrace = null;
    this.chatButton.style.display = 'none';
    this.chatContainer.style.display = 'none';
    this.pingIndicator.style.display = 'none';
    this.sessionOverlay.style.display = 'none';
    
    this.restoreEditorMethods();
    
    if (!this.manualDisconnect) {
      this.editor.showToast(__('Desconectado'), 2000);
    }
  }

  sendTraceComplete(trace) {
    this.sendMessage({
      type: 'trace_complete',
      data: trace
    });
  }

  sendCursorUpdate(x, y, active) {
    const now = Date.now();
    if (now - this.lastCursorSend < this.CURSOR_THROTTLE) return;
    this.lastCursorSend = now;
    
    this.sendMessage({
      type: 'cursor_update',
      x: Math.round(x),
      y: Math.round(y),
      active: active
    });
  }

  sendChatMessage(text) {
    this.sendMessage({
      type: 'chat_message',
      message: text
    });
  }

  sendFullState(toMemberId) {
    if (!this.isHost || !this.isConnected) return;
    
    const state = this.getFullState();
    this.sendMessage({
      type: 'full_state',
      state: state,
      toMemberId: toMemberId || null
    });
  }

  getFullState() {
    const state = {
      width: this.editor.project.width,
      height: this.editor.project.height,
      frames: [],
      currentFrame: this.editor.project.currentFrame,
      currentLayer: this.editor.project.currentLayer
    };
    
    for (let f = 0; f < this.editor.project.frames.length; f++) {
      const frame = this.editor.project.frames[f];
      const frameData = { layers: [] };
      
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];
        const imageData = layer.ctx.getImageData(0, 0, state.width, state.height);
        
        frameData.layers.push({
          name: layer.name,
          visible: layer.visible,
          imageData: Array.from(imageData.data)
        });
      }
      
      state.frames.push(frameData);
    }
    
    return state;
  }

  applyFullState(state) {
    const project = {
      width: state.width,
      height: state.height,
      frames: [],
      currentFrame: state.currentFrame,
      currentLayer: state.currentLayer
    };
    
    for (let f = 0; f < state.frames.length; f++) {
      const frameData = state.frames[f];
      const frame = { layers: [] };
      
      for (let l = 0; l < frameData.layers.length; l++) {
        const layerData = frameData.layers[l];
        const canvas = document.createElement('canvas');
        canvas.width = state.width;
        canvas.height = state.height;
        const ctx = canvas.getContext('2d');
        
        if (layerData.imageData) {
          const imageData = new ImageData(
            new Uint8ClampedArray(layerData.imageData),
            state.width,
            state.height
          );
          ctx.putImageData(imageData, 0, 0);
        }
        
        frame.layers.push({
          canvas: canvas,
          ctx: ctx,
          name: layerData.name,
          visible: layerData.visible
        });
      }
      
      project.frames.push(frame);
    }
    
    this.editor.project = project;
    this.editor.resetCanvasSize();
    this.editor.render();
  }

  createSession(sessionName, password) {
    this.memberName = this.editor.collabMemberName;
    this.memberColor = this.editor.collabMemberColor;
    
    this.connectWebSocket();
    
    const checkConnection = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        clearInterval(checkConnection);
        this.sendMessage({
          type: 'create_session',
          sessionName: sessionName,
          password: password || undefined,
          userName: this.memberName,
          userColor: this.memberColor
        });
      }
    }, 100);
  }

  joinSession(sessionId, password) {
    this.memberName = this.editor.collabMemberName;
    this.memberColor = this.editor.collabMemberColor;
    
    this.connectWebSocket();
    
    const checkConnection = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        clearInterval(checkConnection);
        this.sendMessage({
          type: 'join_session',
          sessionId: sessionId,
          password: password || undefined,
          userName: this.memberName,
          userColor: this.memberColor
        });
      }
    }, 100);
  }

  disconnect(manualDisconnect = true) {
    this.manualDisconnect = manualDisconnect;
    if (this.ws) {
      this.sendMessage({ type: 'leave_session' });
      this.ws.close();
    }
    this.cleanupDisconnect();
  }

  kickMember(memberId) {
    if (!this.isHost) return;
    
    this.sendMessage({
      type: 'kick_member',
      memberId: memberId
    });
  }

  showCursor(memberId, name, color, canvasX, canvasY) {
    const screenPos = this.canvasToScreen(canvasX, canvasY);
    if (!screenPos) return;
    
    let cursor = this.cursors.get(memberId);
    
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.className = "collab-cursor-item";
      
      cursor.innerHTML = `
        <div class="collab-cursor-ping"></div>
        <div class="collab-cursor-name"></div>
      `;
      
      this.cursorContainer.appendChild(cursor);
      this.cursors.set(memberId, cursor);
    }
    
    cursor.style.left = `${screenPos.x}px`;
    cursor.style.top = `${screenPos.y}px`;
    cursor.querySelector('div:first-child').style.borderColor = this.getColorHex(color);
    cursor.querySelector('div:last-child').textContent = name;
    cursor.querySelector('div:last-child').style.backgroundColor = this.getColorHex(color);
    cursor.style.opacity = '1';
    
    cursor.isVisible = true;
    cursor.lastUpdate = Date.now();
    
    if (!cursor._interval) {
      cursor._interval = setInterval(() => {
        if (cursor.isVisible && Date.now() - cursor.lastUpdate >= 2000) {
          this.hideCursor(memberId);
        }
      }, 200);
    }
  }

  hideCursor(memberId) {
    const cursor = this.cursors.get(memberId);
    if (cursor) {
      cursor.style.opacity = '0';
      cursor.lastUpdate = Date.now();
      cursor.isVisible = false;
    }
  }

  removeUserCursor(memberId) {
    const cursor = this.cursors.get(memberId);
    if (cursor) {
      cursor.remove();
      clearInterval(cursor._interval);
      this.cursors.delete(memberId);
    }
  }

  removeAllCursors() {
    this.cursors.forEach(cursor => cursor.remove());
    this.cursors.clear();
  }
  
  openChat() {
    this.chatButton.style.display = 'none';
    this.chatButton.classList.remove('new-message');
    this.chatContainer.style.display = 'flex';
    this.chatVisible = true;
  }
  
  closeChat() {
    this.chatButton.style.display = 'block';
    this.chatContainer.style.display = 'none';
    this.chatVisible = false;
  }

  canvasToScreen(canvasX, canvasY) {
    if (!this.editor.project) return null;
    
    const rect = this.editor.canvasContainer.getBoundingClientRect();
    
    const screenX = rect.left + rect.width / 2 + 
                   (canvasX - this.editor.project.width / 2) * this.editor.scale + 
                   this.editor.posX;
    const screenY = rect.top + rect.height / 2 + 
                   (canvasY - this.editor.project.height / 2) * this.editor.scale + 
                   this.editor.posY;
    
    return { x: screenX, y: screenY };
  }
  
  renderSessionMenu() {
    this.sessionContent.innerHTML = '';
    
    // Session info
    const infoCard = document.createElement('div');
    infoCard.style.cssText = `
      background-color: var(--ui-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    `;
    
    infoCard.innerHTML = `
      <div style="margin-bottom: 12px;">
        <span style="color: var(--text-dim);">${__('Sala||Room')}:</span>
        <span style="color: var(--text-color); font-weight: bold; margin-left: 8px;">${this.sessionName || __('Sala sin nombre||Unnamed room')}</span>
      </div>
      <div style="margin-bottom: 12px;">
        <span style="color: var(--text-dim);">${__('Miembros||Members')}:</span>
        <span style="color: var(--text-color); font-weight: bold; margin-left: 8px;">${this.members.size}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: var(--text-dim);">${__('ID||ID')}:</span>
        <span style="color: var(--text-color); font-family: monospace; background: var(--bg-color); padding: 4px 8px; border-radius: 4px; flex: 1; font-size: 12px;">${this.sessionId || 'Unknown'}</span>
        <button id="copyIdBtn" style="background: var(--ui-highlight); border: none; border-radius: 4px; color: var(--text-color); padding: 4px 8px; cursor: pointer;">
          ${__('Copiar||Copy')}
        </button>
      </div>
    `;
    
    const copyBtn = infoCard.querySelector('#copyIdBtn');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this.sessionId);
      this.editor.showToast(__('ID copiado||ID copied'), 1000);
    });
    
    this.sessionContent.appendChild(infoCard);
    
    // Members list
    const membersSection = document.createElement('div');
    membersSection.style.cssText = `
      background-color: var(--ui-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    `;
    
    membersSection.innerHTML = `<h3 style="margin: 0 0 12px 0;">${__('Miembros||Members')}</h3>`;
    
    const membersList = document.createElement('div');
    membersList.style.cssText = `display: flex; flex-direction: column; gap: 8px;`;
    
    this.members.forEach(member => {
      const memberItem = document.createElement('div');
      memberItem.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        background-color: ${member.id === this.memberId ? 'var(--primary-color)' : 'var(--bg-color)'};
        border-radius: 6px;
        color: ${member.id === this.memberId ? 'white' : 'var(--text-color)'};
      `;
      
      const nameSpan = document.createElement('span');
      nameSpan.style.cssText = `font-weight: bold; display: flex; align-items: center; gap: 8px;`;
      nameSpan.style.color = member.id === this.memberId ? 'white' : this.getColorHex(member.color);
      
      const nameText = document.createElement('span');
      nameText.textContent = member.name;
      nameSpan.appendChild(nameText);
      
      if (member.isHost) {
        const hostBadge = document.createElement('span');
        hostBadge.style.cssText = `
          background-color: gold;
          color: black;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 3px;
        `;
        hostBadge.textContent = 'HOST';
        nameSpan.appendChild(hostBadge);
      }
      
      if (member.id === this.memberId) {
        const youBadge = document.createElement('span');
        youBadge.style.cssText = `
          background-color: rgba(255,255,255,0.3);
          color: white;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 3px;
        `;
        youBadge.textContent = __('TÚ||YOU');
        nameSpan.appendChild(youBadge);
      }
      
      memberItem.appendChild(nameSpan);
      
      // Kick button for host
      if (this.isHost && member.id !== this.memberId) {
        const kickBtn = document.createElement('button');
        kickBtn.textContent = __('Expulsar||Kick');
        kickBtn.style.cssText = `
          background-color: #ff4444;
          border: none;
          border-radius: 4px;
          color: white;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          transition: filter 0.2s;
        `;
        kickBtn.addEventListener('mouseenter', () => {
          kickBtn.style.filter = 'brightness(1.2)';
        });
        kickBtn.addEventListener('mouseleave', () => {
          kickBtn.style.filter = 'none';
        });
        kickBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirmKickMember(member);
        });
        memberItem.appendChild(kickBtn);
      }
      
      membersList.appendChild(memberItem);
    });
    
    membersSection.appendChild(membersList);
    this.sessionContent.appendChild(membersSection);
    
    // Disconnect button
    const disconnectBtn = document.createElement('button');
    disconnectBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background-color: ${this.isHost ? '#ff4444' : 'var(--ui-highlight)'};
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: filter 0.2s;
    `;
    disconnectBtn.textContent = this.isHost ? __('Terminar sesión||End Session') : __('Desconectar||Disconnect');
    disconnectBtn.addEventListener('mouseenter', () => {
      disconnectBtn.style.filter = 'brightness(1.2)';
    });
    disconnectBtn.addEventListener('mouseleave', () => {
      disconnectBtn.style.filter = 'none';
    });
    disconnectBtn.addEventListener('click', () => {
      this.editor.showPopup(
        this.isHost ? __('Terminar sesión||End Session') : __('Desconectar||Disconnect'),
        this.isHost ? __('¿Terminar la sesión para todos?||End session for everyone?') : __('¿Desconectarse de la sesión?||Disconnect from session?'),
        [
          {
            text: __('Cancelar||Cancel'),
            class: 'cancel',
            action: () => this.editor.hidePopup()
          },
          {
            text: __('Sí||Yes'),
            action: () => {
              this.disconnect();
              this.sessionOverlay.style.display = 'none';
              this.editor.hidePopup();
            }
          }
        ]
      );
    });
    
    this.sessionContent.appendChild(disconnectBtn);
  }

  renderSessionMenu() {
    this.sessionContent.innerHTML = '';
    
    // Session info
    const infoCard = document.createElement('div');
    infoCard.className = "collab-info-card";
    
    infoCard.innerHTML = `
      <div class="collab-info-item">
        <span class="collab-info-label">${__('Sala||Room')}:</span>
        <span class="collab-info-value">${this.sessionName || __('Sala sin nombre||Unnamed room')}</span>
      </div>
      <div class="collab-info-item">
        <span class="collab-info-label">${__('Miembros||Members')}:</span>
        <span class="collab-info-value">${this.members.size}</span>
      </div>
      <div class="collab-info-item">
        <span style="collab-info-label">${__('ID||ID')}:</span>
        <span class="collab-info-value token">${this.sessionId || 'Unknown'}</span>
        <button id="copyIdBtn" class="collab-copy-btn">
          ${__('Copiar||Copy')}
        </button>
      </div>
    `;
    
    const copyBtn = infoCard.querySelector('#copyIdBtn');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this.sessionId);
      this.editor.showToast(__('ID copiado||ID copied'), 1000);
    });
    
    this.sessionContent.appendChild(infoCard);
    
    // Members list
    const membersSection = document.createElement('div');
    membersSection.className = "collab-members-section";
    
    membersSection.innerHTML = `<h3>${__('Miembros||Members')}</h3>`;
    
    const membersList = document.createElement('div');
    membersList.className = "collab-members-list";
    
    this.members.forEach(member => {
      const memberItem = document.createElement('div');
      memberItem.className = member.id === this.memberId ? "collab-member-item current-user" : "collab-member-item";
      
      const nameSpan = document.createElement('span');
      nameSpan.className = "collab-member-name";
      nameSpan.style.color = member.id === this.memberId ? 'white' : this.getColorHex(member.color);
      
      const nameText = document.createElement('span');
      nameText.textContent = member.name;
      nameSpan.appendChild(nameText);
      
      if (member.isHost) {
        const hostBadge = document.createElement('span');
        hostBadge.className = "collab-host-badge";
        hostBadge.textContent = 'HOST';
        nameSpan.appendChild(hostBadge);
      }
      
      if (member.id === this.memberId) {
        const youBadge = document.createElement('span');
        youBadge.className = "collab-you-badge";
        youBadge.textContent = __('TÚ||YOU');
        nameSpan.appendChild(youBadge);
      }
      
      memberItem.appendChild(nameSpan);
      
      // Kick button for host
      if (this.isHost && member.id !== this.memberId) {
        const kickBtn = document.createElement('button');
        kickBtn.textContent = __('Expulsar||Kick');
        kickBtn.className = "collab-kick-button";
        kickBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirmKickMember(member);
        });
        memberItem.appendChild(kickBtn);
      }
      
      membersList.appendChild(memberItem);
    });
    
    membersSection.appendChild(membersList);
    this.sessionContent.appendChild(membersSection);
    
    // Disconnect button
    const disconnectBtn = document.createElement('button');
    disconnectBtn.className = this.isHost ? "collab-disconnect-btn danger" : "collab-disconnect-btn";
    disconnectBtn.textContent = this.isHost ? __('Terminar sesión||End Session') : __('Desconectar||Disconnect');
    disconnectBtn.addEventListener('click', () => {
      this.editor.showPopup(
        this.isHost ? __('Terminar sesión||End Session') : __('Desconectar||Disconnect'),
        this.isHost ? __('¿Terminar la sesión para todos?||End session for everyone?') : __('¿Desconectarse de la sesión?||Disconnect from session?'),
        [
          {
            text: __('Cancelar||Cancel'),
            class: 'cancel',
            action: () => this.editor.hidePopup()
          },
          {
            text: __('Sí||Yes'),
            action: () => {
              this.disconnect();
              this.sessionOverlay.style.display = 'none';
              this.editor.hidePopup();
            }
          }
        ]
      );
    });
    
    this.sessionContent.appendChild(disconnectBtn);
  }

  confirmKickMember(member) {
    this.editor.showPopup(
      __('Expulsar miembro||Kick member'),
      `${__('¿Expulsar a||Kick')} ${this.wrapMemberName(member)}?`,
      [
        {
          text: __('Cancelar||Cancel'),
          class: 'cancel',
          action: () => this.editor.hidePopup()
        },
        {
          text: __('Expulsar||Kick'),
          action: () => {
            this.kickMember(member.id);
            this.editor.hidePopup();
          }
        }
      ]
    );
  }
  
  clearChatMessages() {
    this.chatMessages = [];
    this.renderChatMessages();
  }

  renderChatMessages() {
    this.chatMessagesDiv.innerHTML = '';
    this.chatMessages.forEach(msg => this.addMessageHtml(msg));
    this.scrollMessagesToBottom();
  }
  
  addMessageHtml(msg) {
    const msgEl = document.createElement('div');
    msgEl.className = "collab-chat-message";
    msgEl.innerHTML = `
      <span class="collab-chat-name" style="color: ${this.getColorHex(msg.memberColor)};">${this.escapeHtml(msg.memberName || 'Unknown')}:</span>
      <span class="collab-chat-text"> ${this.escapeHtml(msg.message)}</span>
    `;
    this.chatMessagesDiv.appendChild(msgEl);
  }
  
  scrollMessagesToBottom() {
    this.chatMessagesDiv.scrollTop = this.chatMessagesDiv.scrollHeight;
  }

  updatePingIndicator(ping) {
    const dot = this.pingIndicator.querySelector('.ping-dot');
    const value = this.pingIndicator.querySelector('.ping-value');
    
    let color = '#44ff44';
    if (ping > 100) color = '#ffff44';
    if (ping > 200) color = '#ff8844';
    if (ping > 300) color = '#ff4444';
    
    if (dot) dot.style.backgroundColor = color;
    if (value) value.textContent = `${ping}ms`;
  }

  startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.sendMessage({ type: 'ping', timestamp: Date.now() });
    }, 5000);
  }

  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  canPerformAction(action) {
    if (!this.isConnected) return true;
    if (this.isHost) return true;
    return this.permissions && this.permissions[action] === 'everyone';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Handles multiple palettes, loading, saving, and Lospec import
class PaletteManager {
  constructor(editor) {
    this.editor = editor;
    this.palettes = [];
    this.currentPaletteId = null;
    this.recentColors = JSON.parse(localStorage.getItem("recentColors")) || [];
    
    this.init();
  }

  init() {
    this.loadPalettes();
  }

  getDefaultPalettes() {
    return [
      {
        id: "nes",
        name: "NES",
        colors: [
          "#7c7c7c", "#bcbcbc", "#fcfcfc", "#a80020",
          "#e40058", "#f85898", "#f8a4c0", "#940084",
          "#d800cc", "#f878f8", "#f8b8f8", "#4428bc",
          "#6844fc", "#9878f8", "#d8b8f8", "#0000bc", 
          "#0000fc", "#6888fc", "#b8b8f8", "#0058f8",
          "#0078f8", "#3cbcfc", "#a4e4fc", "#004058", 
          "#008888", "#00e8d8", "#00fcfc", "#007800", 
          "#00a800", "#00b800", "#b8f8d8", "#006800", 
          "#00a844", "#58f898", "#b8f8b8", "#005800", 
          "#58d854", "#b8f818", "#d8f878", "#503000", 
          "#ac7c00", "#f8b800", "#fce0a8", "#a81000", 
          "#fca044", "#f8d878", "#f0d0b0", "#881400", 
          "#f83800", "#e45c10", "#f87858", "#080808", 
          "#787878", "#000000"
        ]
      },
      {
        id: "gb-original",
        name: "Game Boy",
        colors: ["#071821", "#306850", "#86c06c", "#e0f8cf"]
      },
      {
        id: "gb-pocket",
        name: "Game Boy Pocket",
        colors: ["#111111", "#555555", "#aaaaaa", "#eeeeee"]
      },
      {
        id: "commodore-64",
        name: "Commodore 64",
        colors: [
          "#000000", "#ffffff", "#68372b", "#70a4b2", 
          "#6f3d86", "#588d43", "#352879", "#b8c76f",
          "#6f4f25", "#433900", "#9a6759", "#444444", 
          "#6c6c6c", "#9ad284", "#6c5eb5", "#959595"
        ]
      },
      {
        id: "tic-80",
        name: "TIC-80 (SWEETIE-16)",
        colors: [
          "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", 
          "#ffcd75", "#a7f070", "#38b764", "#257179",
          "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", 
          "#f4f4f4", "#94b0c2", "#566c86", "#333c57"
        ]
      },
      {
        id: "pico-8",
        name: "PICO-8",
        colors: [
          "#000000", "#1d2b53", "#7e2553", "#008751", 
          "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
          "#ff004d", "#ffa300", "#ffec27", "#00e436", 
          "#29adff", "#83769c", "#ff77a8", "#ffccaa"
        ]
      },
      {
        id: "arne-16",
        name: "Arne 16",
        colors: [
          "#000000", "#9d9d9d", "#ffffff", "#be2633", 
          "#e06f8b", "#2c3e2b", "#7e8c6d", "#e0cdaa", 
          "#2f2e2e", "#4c4c4c", "#d6a13b", "#f5f2b0", 
          "#3b4e8f", "#617fce", "#8ba2d9", "#cacaca"
        ]
      },
      {
        id: "endesga-32",
        name: "ENDESGA 32",
        colors: [
          "#222034", "#45283c", "#663931", "#8f563b", 
          "#df7126", "#d9a066", "#eec39a", "#fbf236", 
          "#99e550", "#6abe30", "#37946e", "#4b692f", 
          "#524b24", "#323c39", "#3f3f74", "#306082", 
          "#5b6ee1", "#639bff", "#5fcde4", "#cbd3b5", 
          "#a7a36b", "#9b7031", "#6b4c2c", "#4a2824", 
          "#412e28", "#372126", "#1b1d2b", "#1e1918", 
          "#0c0f1a", "#05060f", "#b94629", "#ce6a39"
        ]
      },
      {
        id: "aap-64",
        name: "AAP-64",
        colors: [
          "#000000", "#141414", "#282828", "#3c3c3c", 
          "#505050", "#646464", "#787878", "#8c8c8c", 
          "#a0a0a0", "#b4b4b4", "#c8c8c8", "#dcdcdc", 
          "#f0f0f0", "#ffffff", "#1e2a3a", "#2c3e4e", 
          "#3a5262", "#486676", "#567a8a", "#648e9e", 
          "#72a2b2", "#80b6c6", "#8ecada", "#9cdede", 
          "#aae2e2", "#b8e6e6", "#c6eaea", "#d4eeee", 
          "#e2f2f2", "#f0f6f6"
        ]
      },
      {
        id: "cga",
        name: "CGA",
        colors: [
          "#000000", "#00aa00", "#aa0000", "#aa5500",
          "#ffffff"
        ]
      },
      {
        id: "ega",
        name: "EGA",
        colors: [
          "#000000", "#0000aa", "#00aa00", "#00aaaa",
          "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa",
          "#555555", "#5555ff", "#55ff55", "#55ffff", 
          "#ff5555", "#ff55ff", "#ffff55", "#ffffff"
        ]
      },
      {
        // Based on GBA's 15-bit RGB: 5 bits per channel
        id: "gba",
        name: "GB 15-bit",
        colors: [
          "#000000", "#111111", "#222222", "#333333",
          "#444444", "#555555", "#666666", "#777777",
          "#888888", "#999999", "#aaaaaa", "#bbbbbb",
          "#cccccc", "#dddddd", "#eeeeee", "#ffffff",
          "#7a2b2b", "#9a3a3a", "#ba4a4a", "#da5a5a",
          "#fa6a6a", "#2b5a2b", "#3a6a3a", "#4a7a4a",
          "#5a8a5a", "#6a9a6a", "#2b2b7a", "#3a3a9a",
          "#4a4aba", "#5a5ada", "#6a6afa", "#7a2b7a",
          "#9a3a9a", "#ba4aba", "#da5ada", "#fa6afa",
          "#2b7a7a", "#3a9a9a", "#4ababa", "#5adada",
          "#6afafa"
        ]
      },
      {
        id: "futuristic-green",
        name: "Futuristic Green",
        colors: [
          "#0a0f0a", "#0f1a0f", "#1a2a1a", "#2a3f2a",
          "#3f553f", "#557055", "#709070", "#8fb58f",
          "#b0d0b0", "#c8e6c8", "#e0f5e0", "#f0fff0",
          "#00ff00", "#33ff33", "#66ff66", "#99ff99", 
          "#ccffcc", "#ffff00", "#ccff33", "#99ff66", 
          "#66ff99", "#33ffcc", "#00ffff"
        ]
      },
      {
        id: "futuristic-blue",
        name: "Futuristic Blue",
        colors: [
          "#0a0a1a", "#0a0f2a", "#0f1a3f", "#1a2a55",
          "#2a3f6a", "#3f5580", "#557095", "#7090aa", 
          "#8fb5c0", "#b0d0d5", "#c8e6ea", "#e0f5f5", 
          "#00aaff", "#33bbff", "#66ccff", "#99ddff", 
          "#cceeff", "#ffffff", "#00ccff", "#33ddff", 
          "#66eaff", "#99f2ff", "#ccf9ff"
        ]
      },
      {
        id: "sunset",
        name: "Sunset",
        colors: [
          "#282b39", "#3a2e3f", "#633b4a", "#ab4f63", 
          "#d6726c", "#f1a67a", "#fad68f", "#fcf1bc", 
          "#b2e1e8", "#7fb3cd", "#5585b2", "#394779", 
          "#1f2f46", "#121e2c", "#0d121f"
        ]
      },
      {
        id: "dreamcast",
        name: "Dreamcast",
        colors: [
          "#000000", "#111111", "#222222", "#333333", 
          "#444444", "#555555", "#666666", "#777777", 
          "#888888", "#999999", "#aaaaaa", "#bbbbbb", 
          "#cccccc", "#dddddd", "#eeeeee", "#ffffff", 
          "#7a2b2b", "#9a3a3a", "#ba4a4a", "#da5a5a", 
          "#fa6a6a", "#2b5a2b", "#3a6a3a", "#4a7a4a", 
          "#5a8a5a", "#6a9a6a", "#2b2b7a", "#3a3a9a", 
          "#4a4aba", "#5a5ada", "#6a6afa", "#7a2b7a"
        ]
      }
    ];
  }
  
  loadPalettes() {
    try {
      const saved = localStorage.getItem("palettes");
      if (saved) {
        this.palettes = JSON.parse(saved);
        // Ensure each palette has an id
        this.palettes.forEach(p => {
          if (!p.id) p.id = 'palette_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        });
      } else {
        this.palettes = this.getDefaultPalettes();
      }
      this.currentPaletteId = this.palettes[0]?.id || null;
      this.savePalettes();
    } catch (e) {
      console.warn("Failed to load palettes:", e);
      this.palettes = this.getDefaultPalettes();
      this.currentPaletteId = this.palettes[0].id;
    }
  }

  savePalettes() {
    localStorage.setItem("palettes", JSON.stringify(this.palettes));
  }

  getCurrentPalette() {
    return this.palettes.find(p => p.id === this.currentPaletteId) || this.palettes[0];
  }

  getCurrentColors() {
    const palette = this.getCurrentPalette();
    return palette ? palette.colors : [];
  }

  addPalette(name, colors = []) {
    const newPalette = {
      id: 'palette_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: name || __('Nueva paleta||New palette'),
      colors: [...colors],
      createdAt: Date.now()
    };
    this.palettes.push(newPalette);
    this.currentPaletteId = newPalette.id;
    this.savePalettes();
    return newPalette;
  }

  removePalette(id) {
    const index = this.palettes.findIndex(p => p.id === id);
    if (index === -1) return;
    
    this.palettes.splice(index, 1);
    
    if (this.palettes.length === 0) {
      this.palettes = [this.getDefaultPalette()];
    }
    
    if (this.currentPaletteId === id) {
      this.currentPaletteId = this.palettes[0].id;
    }
    
    this.savePalettes();
  }

  renamePalette(id, newName) {
    const palette = this.palettes.find(p => p.id === id);
    if (palette) {
      palette.name = newName;
      this.savePalettes();
    }
  }

  setCurrentPalette(id) {
    if (this.palettes.find(p => p.id === id)) {
      this.currentPaletteId = id;
      this.savePalettes();
    }
  }

  addColorToPalette(paletteId, color) {
    const palette = this.palettes.find(p => p.id === paletteId);
    if (palette && !palette.colors.includes(color)) {
      palette.colors.push(color);
      this.savePalettes();
      return true;
    }
    return false;
  }

  removeColorFromPalette(paletteId, index) {
    const palette = this.palettes.find(p => p.id === paletteId);
    if (palette && palette.colors[index]) {
      palette.colors.splice(index, 1);
      this.savePalettes();
      return true;
    }
    return false;
  }

  moveColorInPalette(paletteId, fromIndex, toIndex) {
    const palette = this.palettes.find(p => p.id === paletteId);
    if (palette && fromIndex >= 0 && toIndex >= 0 && fromIndex < palette.colors.length && toIndex < palette.colors.length) {
      const color = palette.colors.splice(fromIndex, 1)[0];
      palette.colors.splice(toIndex, 0, color);
      this.savePalettes();
      return true;
    }
    return false;
  }

  updatePaletteColors(paletteId, colors) {
    const palette = this.palettes.find(p => p.id === paletteId);
    if (palette) {
      palette.colors = [...colors];
      this.savePalettes();
      return true;
    }
    return false;
  }

  addToRecent(color) {
    this.recentColors = [color, ...this.recentColors.filter(c => c !== color)].slice(0, 20);
    localStorage.setItem("recentColors", JSON.stringify(this.recentColors));
  }

  getRecentColors() {
    return this.recentColors;
  }

  // Lospec API integration
  async importFromLospec(slug) {
    const url = `https://lospec.com/palette-list/${slug}.json`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(__('Paleta no encontrada||Palette not found'));
        }
        throw new Error(__('Error al cargar paleta||Error loading palette'));
      }
      
      const data = await response.json();
      
      if (!data.name || !data.colors || !Array.isArray(data.colors)) {
        throw new Error(__('Formato de paleta inválido||Invalid palette format'));
      }
      
      const colors = data.colors.map(c => c.startsWith('#') ? c : '#' + c);
      
      return {
        name: data.name,
        author: data.author,
        colors: colors,
        slug: slug
      };
    } catch (error) {
      console.error('Lospec import error:', error);
      throw error;
    }
  }

  showLospecImportDialog() {
    const content = document.createElement("div");
    content.className = "lospec-import-dialog";
    
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = __("Slug de la paleta (ej: greyt-bit)||Palette slug (e.g., greyt-bit)");
    content.appendChild(input);
    
    this.editor.showPopup(
      __("Importar de Lospec||Import from Lospec"),
      content,
      [
        {
          text: __("Cancelar||Cancel"),
          class: "cancel",
          action: () => this.editor.hidePopup()
        },
        {
          text: __("Importar||Import"),
          action: async () => {
            const slug = input.value.trim().toLowerCase();
            if (!slug) {
              this.editor.showToast(__("Ingresa un slug válido||Enter a valid slug"), 2000);
              return;
            }
            
            try {
              this.editor.showLoadingScreen("Importing Lospec Palette...");
                    
              const paletteData = await this.importFromLospec(slug);
              
              this.editor.hideLoadingScreen();
              
              const existing = this.palettes.find(p => p.name.toLowerCase() === paletteData.name.toLowerCase());
              
              if (existing) {
                this.editor.showPopup(
                  __("Paleta existente||Existing palette"),
                  __(`La paleta "${paletteData.name}" ya existe. ¿Deseas reemplazarla?||Palette "${paletteData.name}" already exists. Do you want to replace it?`),
                  [
                    {
                      text: __("Cancelar||Cancel"),
                      class: "cancel",
                      action: () => this.editor.hidePopup()
                    },
                    {
                      text: __("Reemplazar||Replace"),
                      action: () => {
                        this.updatePaletteColors(existing.id, paletteData.colors);
                        this.editor.colorPicker?.updatePaletteGrid();
                        this.editor.hidePopup();
                        this.editor.showToast(__(`Paleta "${paletteData.name}" actualizada||Palette "${paletteData.name}" updated`));
                      }
                    }
                  ]
                );
              } else {
                this.addPalette(paletteData.name, paletteData.colors);
                this.editor.colorPicker?.updatePaletteGrid();
                this.editor.showToast(__(`Paleta "${paletteData.name}" importada||Palette "${paletteData.name}" imported`));
                this.editor.hidePopup();
              }
            } catch (error) {
              this.editor.hideLoadingScreen();
              this.editor.showToast(error.message, 3000);
            }
          }
        }
      ]
    );
    
    setTimeout(() => input.focus(), 100);
  }

  showPaletteManagerDialog() {
    const container = document.createElement("div");
    container.className = "palette-manager-container";
    
    const listContainer = document.createElement("div");
    listContainer.className = "palette-manager-list";
    container.appendChild(listContainer);
    
    const renderList = () => {
      listContainer.innerHTML = "";
      
      this.palettes.forEach(palette => {
        const isActice = palette.id === this.currentPaletteId;
        
        const item = document.createElement("div");
        item.className = `palette-manager-item ${isActice ? 'active' : ''}`;
        
        const preview = document.createElement("div");
        preview.className = "palette-manager-preview";
        palette.colors.slice(0, 8).forEach(color => {
          const swatch = document.createElement("div");
          swatch.className = "palette-manager-swatch";
          swatch.style.backgroundColor = color;
          preview.appendChild(swatch);
        });
        
        const info = document.createElement("div");
        info.className = "palette-manager-info";
        
        const nameSpan = document.createElement("div");
        nameSpan.className = "palette-manager-name";
        nameSpan.textContent = palette.name;
        info.appendChild(nameSpan);
        
        const countSpan = document.createElement("div");
        countSpan.className = "palette-manager-count";
        countSpan.textContent = `${palette.colors.length} ${__("colores||colors")}`;
        info.appendChild(countSpan);
        
        const actions = document.createElement("div");
        actions.className = "palette-manager-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "ui-button palette-manager-btn";
        editBtn.innerHTML = '<div class="icon icon-settings"></div>';
        editBtn.title = __("Editar||Edit");
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.showPaletteEditor(palette.id);
        });
        actions.appendChild(editBtn);
        
        if (this.palettes.length > 1) {
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "ui-button palette-manager-btn";
          deleteBtn.innerHTML = '<div class="icon icon-close"></div>';
          deleteBtn.title = __("Eliminar||Delete");
          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.editor.showPopup(
              __("Eliminar paleta||Delete palette"),
              __(`¿Eliminar la paleta "${palette.name}"?||Delete palette "${palette.name}"?`),
              [
                {
                  text: __("Cancelar||Cancel"),
                  class: "cancel",
                  action: () => {
                    this.editor.hidePopup();
                    this.showPaletteManagerDialog();
                  }
                },
                {
                  text: __("Eliminar||Delete"),
                  action: () => {
                    this.removePalette(palette.id);
                    renderList();
                    this.editor.colorPicker?.updatePaletteGrid();
                    this.editor.hidePopup();
                    this.showPaletteManagerDialog();
                  }
                }
              ]
            );
          });
          actions.appendChild(deleteBtn);
        }
        
        item.appendChild(preview);
        item.appendChild(info);
        item.appendChild(actions);
        
        item.addEventListener("click", () => {
          this.setCurrentPalette(palette.id);
          this.editor.colorPicker?.updatePaletteGrid();
          this.editor.hidePopup();
        });
        
        listContainer.appendChild(item);
        
      });
    };
    
    renderList();
    
    const actionRow = document.createElement("div");
    actionRow.className = "palette-manager-actions-row";
    
    const newBtn = document.createElement("button");
    newBtn.className = "ui-button highlight palette-manager-action-btn";
    newBtn.innerHTML = __("Nueva paleta||New palette");
    newBtn.addEventListener("click", () => {
      const name = prompt(__("Nombre de la paleta||Palette name"), __("Mi paleta||My palette"));
      if (name) {
        this.addPalette(name);
        renderList();
        this.editor.colorPicker?.updatePaletteGrid();
      }
    });
    actionRow.appendChild(newBtn);
    
    const importBtn = document.createElement("button");
    importBtn.className = "ui-button highlight palette-manager-action-btn";
    importBtn.innerHTML = "JASC-PAL";
    importBtn.addEventListener("click", () => {
      this.editor.loadPalette();
    });
    actionRow.appendChild(importBtn);
    
    const lospecBtn = document.createElement("button");
    lospecBtn.className = "ui-button highlight palette-manager-action-btn";
    lospecBtn.innerHTML = "Lospec";
    lospecBtn.addEventListener("click", () => {
      this.editor.hidePopup();
      this.showLospecImportDialog();
    });
    actionRow.appendChild(lospecBtn);
    
    container.appendChild(actionRow);
    
    this.editor.showPopup(
      __("Gestor de paletas||Palette Manager"),
      container,
      [
        {
          text: __("Cerrar||Close"),
          action: () => this.editor.hidePopup()
        }
      ]
    );
  }

  showPaletteEditor(paletteId) {
    const palette = this.palettes.find(p => p.id === paletteId);
    if (!palette) return;
    
    const container = document.createElement("div");
    container.className = "palette-editor-container";
    
    // Name row
    const nameRow = document.createElement("div");
    nameRow.className = "palette-editor-name-row";
    
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = palette.name;
    nameInput.className = "palette-editor-name-input";
    nameRow.appendChild(nameInput);
    
    nameInput.addEventListener("change", () => {
      if (nameInput.value.trim()) {
        this.renamePalette(paletteId, nameInput.value.trim());
        this.editor.colorPicker?.updatePaletteGrid();
        this.editor.showToast(__("Paleta renombrada||Palette renamed"));
      }
    });
    
    container.appendChild(nameRow);
    
    // Use the same palette-grid class as main color picker
    const colorsGrid = document.createElement("div");
    colorsGrid.className = "palette-grid";
    colorsGrid.style.maxHeight = "300px";
    colorsGrid.style.overflowY = "auto";
    container.appendChild(colorsGrid);
    
    // Create delete zone for drag-to-delete
    const deleteZone = document.createElement("div");
    deleteZone.className = "delete-zone palette-delete-zone";
    deleteZone.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    // Delete zone events
    let draggedIndex = null;
    
    deleteZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      deleteZone.classList.add("drag-over");
    });
    
    deleteZone.addEventListener("dragleave", () => {
      deleteZone.classList.remove("drag-over");
    });
    
    deleteZone.addEventListener("drop", (e) => {
      e.preventDefault();
      deleteZone.classList.remove("drag-over");
      if (draggedIndex !== null) {
        this.removeColorFromPalette(paletteId, draggedIndex);
        renderColors();
        this.editor.colorPicker?.updatePaletteGrid();
        draggedIndex = null;
      }
    });
    
    const renderColors = () => {
      colorsGrid.innerHTML = "";
      
      palette.colors.forEach((color, index) => {
        const colorElement = document.createElement("div");
        colorElement.className = "palette-color";
        colorElement.style.backgroundColor = color;
        colorElement.style.cursor = "grab";
        colorElement.draggable = true;
        colorElement.dataset.index = index;
        
        // Click to select color
        colorElement.addEventListener("click", () => {
          this.editor.colorPicker?.updateSlidersFromHex(color);
        });
        
        // Drag events
        colorElement.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", index.toString());
          draggedIndex = index;
          colorElement.classList.add("dragging");
          colorElement.style.cursor = "grabbing";
          deleteZone.classList.add("visible");
        });
        
        colorElement.addEventListener("dragend", () => {
          colorElement.classList.remove("dragging");
          colorElement.style.cursor = "grab";
          deleteZone.classList.remove("visible", "drag-over");
          draggedIndex = null;
        });
        
        colorElement.addEventListener("dragover", (e) => {
          e.preventDefault();
        });
        
        colorElement.addEventListener("drop", (e) => {
          e.preventDefault();
          const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
          const toIndex = index;
          if (fromIndex !== toIndex) {
            this.moveColorInPalette(paletteId, fromIndex, toIndex);
            renderColors();
            this.editor.colorPicker?.updatePaletteGrid();
          }
        });
        
        colorsGrid.appendChild(colorElement);
      });
      
      // Add color button
      const addButton = document.createElement("div");
      addButton.className = "palette-add-button";
      addButton.innerHTML = "+";
      addButton.title = __("Añadir color||Add new color");
      addButton.style.cursor = "pointer";
      addButton.addEventListener("click", () => {
        this.editor.showHexColorInputDialog().then(color => {
          this.addColorToPalette(paletteId, color);
          renderColors();
          this.editor.colorPicker?.updatePaletteGrid();
        }).catch(() => {});
      });
      colorsGrid.appendChild(addButton);
    };
    
    renderColors();
    container.appendChild(deleteZone);
    
    this.editor.showPopup(
      palette.name,
      container,
      [
        {
          text: __("Cerrar||Close"),
          action: () => {
            this.editor.hidePopup();
            this.showPaletteManagerDialog();
          }
        }
      ]
    );
  }
}

// Handles all color picker UI and logic
class ColorPicker {
  constructor(editor) {
    this.editor = editor;
    
    // Color state
    this.selectedColorTab = 'rgb';
    this.colorPickerPreviewColor = editor.primaryColor;
    this.isColorPicking = false;
    this.colorPickStartX = 0;
    this.colorPickStartY = 0;
    this.colorPickLine = null;
    this.colorPickStartPos = null;
    this.colorPickTimeout = null;
    this.colorPickStartTime = null;
    
    // UI Elements
    this.overlay = null;
    this.colorPicker = null;
    this.rgbTab = null;
    this.hsvTab = null;
    this.paletteTab = null;
    this.rgbContent = null;
    this.hsvContent = null;
    this.paletteContent = null;
    this.currentColorPreview = null;
    this.recentColorsGrid = null;
    this.paletteGrid = null;
    this.deleteZone = null;
    this.floatingColors = new Map();
    this.floatingColorsDeleteZone = null;
    
    this.init();
  }

  init() {
    this.createColorPicker();
    this.createFloatingColorsDeleteZone();
    this.initColorPickerDrag();
    if (this.editor.autoLoadRecentFloatingColors) {
      this.loadFloatingColors(JSON.parse(localStorage.getItem("floatingColors")) || []);
    }
  }

  createColorPicker() {
    // Create overlay
    this.overlay = document.createElement("div");
    this.overlay.className = "color-picker-overlay";
    this.overlay.style.display = "none";
    this.editor.uiLayer.appendChild(this.overlay);
    
    this.overlay.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.overlay.classList.add("drag-over");
    });
    
    this.overlay.addEventListener("dragleave", () => {
      this.overlay.classList.remove("drag-over");
    });
    
    this.overlay.addEventListener("drop", (e) => {
      e.preventDefault();
      this.overlay.classList.remove("drag-over");
      const index = parseInt(e.dataTransfer.getData("text/plain"));
      const currentPalette = this.editor.paletteManager.getCurrentPalette();
      const color = currentPalette?.colors[index];
      if (color && this.floatingColorsDeleteZone) {
        this.addFloatingPaletteColor(color, e.clientX, e.clientY);
      }
    });
        
    // Create picker
    this.colorPicker = document.createElement("div");
    this.colorPicker.className = "color-picker";
    this.overlay.appendChild(this.colorPicker);
    
    // Block overlay events
    this.colorPicker.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    this.colorPicker.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    this.colorPicker.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    
    // Header
    const header = document.createElement("div");
    header.className = "color-picker-header";
    this.colorPicker.appendChild(header);
    
    const title = document.createElement("div");
    title.className = "color-picker-title";
    title.textContent = __("Recoge Color||Color Picker");
    header.appendChild(title);
    
    const closeBtn = document.createElement("div");
    closeBtn.className = "panel-close color-picker-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);
    
    // Tabs
    const tabs = document.createElement("div");
    tabs.className = "color-picker-tabs";
    this.colorPicker.appendChild(tabs);
    
    this.rgbTab = this.createTab("RGB", () => this.showTab("rgb"));
    this.hsvTab = this.createTab("HSV", () => this.showTab("hsv"));
    this.paletteTab = this.createTab(__("Paleta||Palette"), () => this.showTab("palette"));
    
    // Content
    const content = document.createElement("div");
    content.className = "color-picker-content";
    this.colorPicker.appendChild(content);
    
    // RGB Tab
    this.rgbContent = document.createElement("div");
    this.rgbContent.className = "color-picker-tab-content rgb-content";
    content.appendChild(this.rgbContent);
    this.createColorSlider("r", __("Rojo||Red"), 0, 255, this.rgbContent);
    this.createColorSlider("g", __("Verde||Green"), 0, 255, this.rgbContent);
    this.createColorSlider("b", __("Azul||Blue"), 0, 255, this.rgbContent);
    
    // HSV Tab
    this.hsvContent = document.createElement("div");
    this.hsvContent.className = "color-picker-tab-content hsv-content";
    content.appendChild(this.hsvContent);
    this.createColorSlider("h", __("Tono||Hue"), 0, 360, this.hsvContent);
    this.createColorSlider("s", __("Saturación||Saturation"), 0, 100, this.hsvContent, "%");
    this.createColorSlider("v", __("Valor||Value"), 0, 100, this.hsvContent, "%");
    
    // Palette Tab
    this.paletteContent = document.createElement("div");
    this.paletteContent.className = "color-picker-tab-content palette-content";
    content.appendChild(this.paletteContent);
    
    const paletteActions = document.createElement("div");
    paletteActions.className = "palette-actions";
    this.paletteContent.appendChild(paletteActions);
    
    const loadBtn = this.editor.createButton("load-palette", "icon-folder", () => this.loadPalette());
    loadBtn.textContent = __("Cargar||Load");
    paletteActions.appendChild(loadBtn);
    
    const saveBtn = this.editor.createButton("save-palette", "icon-save", () => this.savePalette());
    saveBtn.textContent = __("Guardar||Save");
    paletteActions.appendChild(saveBtn);
    
    const manageBtn = this.editor.createButton("manage-palettes", "icon-settings", () => {
      this.editor.paletteManager.showPaletteManagerDialog();
    });
    manageBtn.textContent = __("Gestionar||Manage");
    paletteActions.appendChild(manageBtn);
    
    this.paletteGrid = document.createElement("div");
    this.paletteGrid.className = "palette-grid";
    this.paletteContent.appendChild(this.paletteGrid);
    
    // Recent Colors
    const recentContainer = document.createElement("div");
    recentContainer.className = "recent-colors";
    this.colorPicker.appendChild(recentContainer);
    
    const recentTitle = document.createElement("div");
    recentTitle.className = "recent-colors-title";
    recentTitle.textContent = __("Colores Recientes||Recent Colors");
    recentContainer.appendChild(recentTitle);
    
    this.recentColorsGrid = document.createElement("div");
    this.recentColorsGrid.className = "recent-colors-grid";
    recentContainer.appendChild(this.recentColorsGrid);
    
    // Footer
    const footer = document.createElement("div");
    footer.className = "color-picker-footer";
    this.colorPicker.appendChild(footer);
    
    this.currentColorPreview = document.createElement("div");
    this.currentColorPreview.className = "current-color-preview";
    this.currentColorPreview.addEventListener("click", () => this.showHexInputDialog());
    footer.appendChild(this.currentColorPreview);
    
    const confirmBtn = this.editor.createButton("confirm-color", null, () => this.confirmSelection());
    confirmBtn.textContent = __("Usar color||Pick color");
    footer.appendChild(confirmBtn);
    
    // Delete zone
    this.deleteZone = document.createElement("div");
    this.deleteZone.className = "delete-zone palette-delete-zone";
    this.deleteZone.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    this.overlay.appendChild(this.deleteZone);
    
    this.setupDeleteZoneEvents();
    
    // Show RGB tab by default
    this.showTab("rgb");
    this.updatePaletteGrid();
  }

  createFloatingColorsDeleteZone() {
    this.floatingColorsDeleteZone = document.createElement("div");
    this.floatingColorsDeleteZone.className = "delete-zone";
    this.floatingColorsDeleteZone.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    this.editor.overlayLayer.appendChild(this.floatingColorsDeleteZone);
    
    this.floatingColorsDeleteZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.floatingColorsDeleteZone.classList.add("drag-over");
    });
    
    this.floatingColorsDeleteZone.addEventListener("dragleave", () => {
      this.floatingColorsDeleteZone.classList.remove("drag-over");
    });
  }

  createTab(name, onClick) {
    const tab = document.createElement("div");
    tab.className = "color-picker-tab";
    tab.textContent = name;
    tab.addEventListener("click", onClick);
    this.colorPicker.querySelector(".color-picker-tabs").appendChild(tab);
    return tab;
  }

  createColorSlider(channel, label, min, max, container, suffix = "") {
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "color-slider-container";
    
    const labelElement = document.createElement("label");
    labelElement.textContent = label;
    sliderContainer.appendChild(labelElement);
    
    const controls = document.createElement("div");
    controls.className = "slider-controls";
    sliderContainer.appendChild(controls);
    
    const decreaseBtn = document.createElement("button");
    decreaseBtn.className = "slider-btn decrease";
    decreaseBtn.innerHTML = "&minus;";
    decreaseBtn.addEventListener("click", () => this.adjustChannel(channel, -1));
    controls.appendChild(decreaseBtn);
    
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.value = channel === "r" ? 255 : 0;
    slider.className = `color-slider ${channel}-slider`;
    slider.addEventListener("input", e => this.handleSliderChange(channel, e.target.value));
    controls.appendChild(slider);
    
    const increaseBtn = document.createElement("button");
    increaseBtn.className = "slider-btn increase";
    increaseBtn.innerHTML = "+";
    increaseBtn.addEventListener("click", () => this.adjustChannel(channel, 1));
    controls.appendChild(increaseBtn);
    
    const valueInput = document.createElement("input");
    valueInput.type = "number";
    valueInput.min = min;
    valueInput.max = max;
    valueInput.value = channel === "r" ? 255 : 0;
    valueInput.className = `color-value ${channel}-value`;
    valueInput.addEventListener("change", e => this.handleValueChange(channel, e.target.value));
    controls.appendChild(valueInput);
    
    const suffixElement = document.createElement("span");
    suffixElement.className = "suffix";
    suffixElement.textContent = suffix;
    controls.appendChild(suffixElement);
    
    container.appendChild(sliderContainer);
  }

  setupDeleteZoneEvents() {
    this.deleteZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.deleteZone.classList.add("drag-over");
    });
    
    this.deleteZone.addEventListener("dragleave", () => {
      this.deleteZone.classList.remove("drag-over");
    });
    
    this.deleteZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.deleteZone.classList.remove("drag-over");
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
      this.removeColorFromPalette(fromIndex);
    });
  }

  showTab(tabName) {
    const tabContents = this.colorPicker.querySelectorAll(".color-picker-tab-content");
    tabContents.forEach(content => content.style.display = "none");
    
    const tabs = this.colorPicker.querySelectorAll(".color-picker-tab");
    tabs.forEach(tab => tab.classList.remove("active"));
    
    if (tabName === "rgb") {
      this.rgbContent.style.display = "block";
      this.rgbTab.classList.add("active");
      this.updateSlidersFromHex(this.colorPickerPreviewColor);
    } else if (tabName === "hsv") {
      this.hsvContent.style.display = "block";
      this.hsvTab.classList.add("active");
      this.updateSlidersFromHex(this.colorPickerPreviewColor);
    } else if (tabName === "palette") {
      this.paletteContent.style.display = "block";
      this.paletteTab.classList.add("active");
      this.updatePaletteGrid();
    }
  }

  updateSlidersFromHex(hex) {
    if (!hex) return;
    
    const rgb = this.hexToRgb(hex);
    this.updateSlider("r", rgb.r);
    this.updateSlider("g", rgb.g);
    this.updateSlider("b", rgb.b);
    
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.updateSlider("h", hsv.h);
    this.updateSlider("s", hsv.s);
    this.updateSlider("v", hsv.v);
    
    this.currentColorPreview.style.backgroundColor = hex;
    this.colorPickerPreviewColor = hex;
  }

  updateSlider(channel, value) {
    const slider = this.colorPicker.querySelector(`.${channel}-slider`);
    const valueInput = this.colorPicker.querySelector(`.${channel}-value`);
    if (slider) slider.value = value;
    if (valueInput) valueInput.value = value;
  }

  handleSliderChange(channel, value) {
    this.updateSlider(channel, value);
    this.updateColorFromSliders(channel === "r" || channel === "g" || channel === "b");
  }

  handleValueChange(channel, value) {
    const slider = this.colorPicker.querySelector(`.${channel}-slider`);
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    value = Math.max(min, Math.min(max, parseInt(value) || 0));
    this.updateSlider(channel, value);
    this.updateColorFromSliders();
  }

  adjustChannel(channel, delta) {
    const valueInput = this.colorPicker.querySelector(`.${channel}-value`);
    const slider = this.colorPicker.querySelector(`.${channel}-slider`);
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    let newValue = parseInt(valueInput.value) + delta;
    newValue = Math.max(min, Math.min(max, newValue));
    this.updateSlider(channel, newValue);
    this.updateColorFromSliders();
  }

  updateColorFromSliders(rgbMode = true) {
    if (rgbMode) {
      const r = parseInt(this.colorPicker.querySelector(".r-value").value);
      const g = parseInt(this.colorPicker.querySelector(".g-value").value);
      const b = parseInt(this.colorPicker.querySelector(".b-value").value);
      const hex = this.rgbToHex(r, g, b);
      this.colorPickerPreviewColor = hex;
      this.currentColorPreview.style.backgroundColor = hex;
    } else {
      const h = parseInt(this.colorPicker.querySelector(".h-value").value);
      const s = parseInt(this.colorPicker.querySelector(".s-value").value);
      const v = parseInt(this.colorPicker.querySelector(".v-value").value);
      const rgb = this.hsvToRgb(h, s, v);
      const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
      this.colorPickerPreviewColor = hex;
      this.currentColorPreview.style.backgroundColor = hex;
    }
  }

  confirmSelection() {
    const hex = this.colorPickerPreviewColor;
    if (!hex) return;
    
    if (this.editor.selectedColor === "primary") {
      this.editor.primaryColor = hex;
    } else {
      this.editor.secondaryColor = hex;
    }
    
    this.editor.updateColorIndicator();
    this.editor.paletteManager.addToRecent(hex);
    this.updateRecentColorsGrid();
    this.hide();
  }

  updatePaletteGrid() {
    if (!this.paletteGrid) return;
    
    this.paletteGrid.innerHTML = "";
    const currentPalette = this.editor.paletteManager.getCurrentPalette();
    if (!currentPalette) return;
    
    for (let i = 0; i < currentPalette.colors.length; i++) {
      const color = currentPalette.colors[i];
      const colorElement = document.createElement("div");
      colorElement.className = "palette-color";
      colorElement.style.backgroundColor = color;
      colorElement.style.cursor = "grab";
      colorElement.draggable = true;
      colorElement.dataset.index = i;
      
      colorElement.addEventListener("click", () => {
        this.updateSlidersFromHex(color);
      });
      
      colorElement.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", i.toString());
        colorElement.classList.add("dragging");
        colorElement.style.cursor = "grabbing";
        this.deleteZone.classList.add("visible");
      });
      
      colorElement.addEventListener("dragend", () => {
        colorElement.classList.remove("dragging");
        colorElement.style.cursor = "grab";
        this.deleteZone.classList.remove("visible");
      });
      
      colorElement.addEventListener("dragover", e => e.preventDefault());
      
      colorElement.addEventListener("drop", e => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
        const toIndex = i;
        if (fromIndex !== toIndex) {
          this.editor.paletteManager.moveColorInPalette(currentPalette.id, fromIndex, toIndex);
          this.updatePaletteGrid();
        }
      });
      
      this.paletteGrid.appendChild(colorElement);
    }
    
    const addButton = document.createElement("div");
    addButton.className = "palette-add-button";
    addButton.innerHTML = "+";
    addButton.title = __("Añadir color||Add new color");
    addButton.style.cursor = "pointer";
    addButton.addEventListener("click", () => {
      this.showHexInputDialog().then(color => {
        this.editor.paletteManager.addColorToPalette(currentPalette.id, color);
        this.updatePaletteGrid();
        this.editor.showToast(__("Color añadido a la paleta||Color added to palette"));
      }).catch(() => {});
    });
    this.paletteGrid.appendChild(addButton);
  }

  updateRecentColorsGrid() {
    if (!this.recentColorsGrid) return;
    
    this.recentColorsGrid.innerHTML = "";
    const recent = this.editor.paletteManager.getRecentColors();
    
    recent.forEach(color => {
      const colorElement = document.createElement("div");
      colorElement.className = "recent-color";
      colorElement.style.backgroundColor = color;
      colorElement.addEventListener("click", () => {
        this.updateSlidersFromHex(color);
      });
      this.recentColorsGrid.appendChild(colorElement);
    });
  }

  removeColorFromPalette(index) {
    const currentPalette = this.editor.paletteManager.getCurrentPalette();
    if (currentPalette) {
      this.editor.paletteManager.removeColorFromPalette(currentPalette.id, index);
      this.updatePaletteGrid();
      this.editor.showToast(__("Color quitado de la paleta||Color removed from palette"));
    }
  }

  loadPalette() {
    const fileBrowser = this.editor.getFileBrowser({
      title: __("Cargar paleta||Load palette"),
      mode: "open",
      fileTypes: ["pal"],
      onConfirm: async fileInfo => {
        try {
          const fileData = await this.editor.readFile(fileInfo);
          this.editor.parsePalFile(fileData);
          this.updatePaletteGrid();
          this.editor.showToast(__("Paleta cargada||Palette loaded successfully"));
        } catch (error) {
          this.editor.showToast(__(`(Error al cargar paleta|Error loading palette): ${error.message}`), 5000);
        }
      }
    });
    fileBrowser.show();
  }

  savePalette() {
    const currentPalette = this.editor.paletteManager.getCurrentPalette();
    if (!currentPalette || currentPalette.colors.length === 0) {
      this.editor.showToast(__("No hay paleta que guardar||No palette to save"), 3000);
      return;
    }
    
    const fileBrowser = this.editor.getFileBrowser({
      title: __("Guardar paleta||Save palette"),
      mode: "saveAs",
      fileTypes: ["pal"],
      defaultType: "pal",
      defaultName: currentPalette.name || "palette",
      onConfirm: async fileInfo => {
        try {
          const palContent = this.editor.generatePalFile();
          await this.editor.saveFile(fileInfo.name, "pal", palContent);
          this.editor.showToast(__("Paleta guardada||Palette saved successfully"));
        } catch (error) {
          this.editor.showToast(__(`(Error al guardar la paleta|Error saving palette): ${error.message}`), 5000);
        }
      }
    });
    fileBrowser.show();
  }

  initColorPickerDrag() {
    this.colorPickLine = document.createElement("div");
    this.colorPickLine.className = "color-pick-line";
    this.colorPickLine.style.display = "none";
    this.editor.uiLayer.appendChild(this.colorPickLine);
    
    this.editor.colorIndicator.addEventListener("mousedown", (e) => this.handleColorPickStart(e));
    document.addEventListener("mousemove", (e) => this.handleColorPickMove(e));
    document.addEventListener("mouseup", (e) => this.handleColorPickEnd(e));
    
    this.editor.colorIndicator.addEventListener("touchstart", (e) => this.handleColorPickStart(e), { passive: false });
    document.addEventListener("touchmove", (e) => this.handleColorPickMove(e), { passive: false });
    document.addEventListener("touchend", (e) => this.handleColorPickEnd(e));
    document.addEventListener("touchcancel", (e) => this.handleColorPickEnd(e));
    
    this.editor.colorIndicator.addEventListener("click", (e) => {
      if (!this.isColorPicking && !this.colorPickTimeout) {
        this.toggleSelectedColor();
      }
    });
  }

  handleColorPickStart(e) {
    if (this.editor.isDrawing || this.editor.isPanning) return;
    
    if (e.type.startsWith("touch")) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    this.colorPickStartTime = Date.now();
    this.colorPickStartPos = {
      x: e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX,
      y: e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY
    };
    
    if (this.colorPickTimeout) {
      clearTimeout(this.colorPickTimeout);
      this.colorPickTimeout = null;
    }
    
    this.colorPickTimeout = setTimeout(() => {
      if (!this.isColorPicking) {
        this.isColorPicking = true;
        this.editor.colorIndicator.classList.add("dragging");
        
        const rect = this.editor.colorIndicator.getBoundingClientRect();
        this.colorPickStartX = rect.left + rect.width / 2;
        this.colorPickStartY = rect.top + rect.height / 2;
        
        this.colorPickLine.style.display = "block";
        this.updateColorPickLine(this.colorPickStartX, this.colorPickStartY, this.colorPickStartPos.x, this.colorPickStartPos.y);
      }
    }, 200);
  }

  handleColorPickMove(e) {
    if (!this.colorPickStartPos) return;
    
    if (e.type.startsWith("touch")) {
      e.preventDefault();
    }
    
    let clientX, clientY;
    if (e.type.startsWith("touch")) {
      if (!e.touches || e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    if (!this.isColorPicking) {
      const movedDistance = Math.hypot(clientX - this.colorPickStartPos.x, clientY - this.colorPickStartPos.y);
      
      if (movedDistance > 10 && this.colorPickTimeout) {
        clearTimeout(this.colorPickTimeout);
        this.colorPickTimeout = null;
        this.isColorPicking = true;
        this.editor.colorIndicator.classList.add("dragging");
        
        const rect = this.editor.colorIndicator.getBoundingClientRect();
        this.colorPickStartX = rect.left + rect.width / 2;
        this.colorPickStartY = rect.top + rect.height / 2;
        
        this.colorPickLine.style.display = "block";
        this.updateColorPickLine(this.colorPickStartX, this.colorPickStartY, clientX, clientY);
      }
      return;
    }
    
    this.updateColorPickLine(this.colorPickStartX, this.colorPickStartY, clientX, clientY);
  }

  handleColorPickEnd(e) {
    if (this.colorPickTimeout) {
      clearTimeout(this.colorPickTimeout);
      this.colorPickTimeout = null;
    }
    
    let clientX, clientY;
    if (e.type.startsWith("touchend") || e.type.startsWith("touchcancel")) {
      if (!e.changedTouches || e.changedTouches.length === 0) {
        this.cleanupColorPicking();
        return;
      }
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    if (!this.isColorPicking) {
      const isShortTap = Date.now() - this.colorPickStartTime < 300;
      const movedDistance = this.colorPickStartPos ? 
        Math.hypot(clientX - this.colorPickStartPos.x, clientY - this.colorPickStartPos.y) : 0;
      
      if (isShortTap && movedDistance < 15) {
        this.toggleSelectedColor();
      }
      
      this.colorPickStartPos = null;
      return;
    }
    
    const rect = this.editor.canvasContainer.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      const canvasPos = this.editor.getCanvasPosition(clientX, clientY);
      if (canvasPos) {
        this.editor.pickColor(canvasPos.x, canvasPos.y);
      }
    }
    
    this.cleanupColorPicking();
  }

  cleanupColorPicking() {
    this.isColorPicking = false;
    this.colorPickStartPos = null;
    this.colorPickLine.style.display = "none";
    this.editor.colorIndicator.classList.remove("dragging");
    
    if (this.colorPickTimeout) {
      clearTimeout(this.colorPickTimeout);
      this.colorPickTimeout = null;
    }
  }

  updateColorPickLine(startX, startY, endX, endY) {
    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;
    
    this.colorPickLine.style.width = `${length}px`;
    this.colorPickLine.style.left = `${startX}px`;
    this.colorPickLine.style.top = `${startY}px`;
    this.colorPickLine.style.transform = `rotate(${angle}deg)`;
    this.colorPickLine.style.transformOrigin = "0 0";
  }

  toggleSelectedColor() {
    this.editor.selectedColor = this.editor.selectedColor === "primary" ? "secondary" : "primary";
    this.editor.updateColorIndicator();
  }

  show() {
    const color = this.editor.selectedColor === "primary" ? this.editor.primaryColor : this.editor.secondaryColor;
    this.updateSlidersFromHex(color);
    this.updateRecentColorsGrid();
    this.updatePaletteGrid();
    this.overlay.style.display = "flex";
  }

  hide() {
    this.overlay.style.display = "none";
  }

  isVisible() {
    return this.overlay.style.display === "flex";
  }

  showHexInputDialog() {
    const content = document.createElement("div");
    content.className = "hex-input-dialog";
    
    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.value = this.colorPickerPreviewColor;
    textInput.placeholder = "#RRGGBB";
    textInput.className = "hex-input-text";
    content.appendChild(textInput);
    
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = this.colorPickerPreviewColor;
    colorInput.className = "hex-input-color";
    colorInput.addEventListener("change", () => {
      textInput.value = colorInput.value;
    });
    content.appendChild(colorInput);
    
    textInput.addEventListener("input", () => {
      if (this.isValidHex(textInput.value)) {
        let val = textInput.value;
        if (!val.startsWith("#")) val = "#" + val;
        colorInput.value = val;
      }
    });
    
    return new Promise((resolve, reject) => {
      this.editor.showPopup(__("Entrada Hexadecimal||Hex Input"), content, [
        {
          text: __("Cancelar||Cancel"),
          class: "cancel",
          action: () => {
            this.editor.hidePopup();
            reject();
          }
        },
        {
          text: __("Seleccionar||Select"),
          action: () => {
            if (this.isValidHex(textInput.value)) {
              let hex = textInput.value;
              if (!hex.startsWith("#")) hex = "#" + hex;
              this.editor.hidePopup();
              resolve(hex);
            } else {
              this.editor.showToast(__("Expresión hexadecimal inválida||Invalid HEX color expression"));
              reject();
            }
          }
        }
      ]);
    });
  }
    
  loadFloatingColors(colors) {
    if (!colors) return;
    if (!colors.length || !colors.forEach) return;
    this.removeAllFloatingPaletteColors();
    colors.forEach(entry => {
      this.addFloatingPaletteColor(entry.color, entry.x, entry.y);
    });
  }
  
  addFloatingPaletteColor(color, clientX, clientY) {
    const colorElement = document.createElement("div");
    colorElement.className = "palette-color floating";
    colorElement.style.backgroundColor = color;
    colorElement.style.cursor = "grab";
    
    const id = `color_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    colorElement.dataset.color = color;
    colorElement.dataset.id = id;
    colorElement.dataset.x = clientX;
    colorElement.dataset.y = clientY;
    
    colorElement.style.top = `${clientY}px`;
    colorElement.style.left = `${clientX}px`;
    colorElement.style.touchAction = "none";
    colorElement.style.userSelect = "none";
    
    // Click to select color
    colorElement.addEventListener("click", (e) => {
      e.stopPropagation();
      this.editor.setColor(color);
    });
    
    // Pointer event handlers for smooth dragging
    let isDragging = false;
    let startX, startY;
    let startLeft, startTop;
    
    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      colorElement.setPointerCapture(e.pointerId);
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(colorElement.style.left) || 0;
      startTop = parseFloat(colorElement.style.top) || 0;
      
      colorElement.style.cursor = "grabbing";
      colorElement.classList.add("dragging");
      if (this.floatingColorsDeleteZone) {
        this.floatingColorsDeleteZone.classList.add("visible");
      }
    };
    
    const onPointerMove = (e) => {
      if (!isDragging) return;
      
      e.preventDefault();
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      const newLeft = startLeft + deltaX;
      const newTop = startTop + deltaY;
      
      colorElement.style.left = `${newLeft}px`;
      colorElement.style.top = `${newTop}px`;
      colorElement.dataset.x = newLeft;
      colorElement.dataset.y = newTop;
      
      if (this.floatingColorsDeleteZone) {
        const rect = this.floatingColorsDeleteZone.getBoundingClientRect();
        const isOverDelete = e.clientX >= rect.left && e.clientX <= rect.right &&
                            e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (isOverDelete) {
          this.floatingColorsDeleteZone.classList.add("drag-over");
        } else {
          this.floatingColorsDeleteZone.classList.remove("drag-over");
        }
      }
    };
    
    const onPointerUp = (e) => {
      if (!isDragging) return;
      
      e.preventDefault();
      
      if (this.floatingColorsDeleteZone) {
        const rect = this.floatingColorsDeleteZone.getBoundingClientRect();
        const isOverDelete = e.clientX >= rect.left && e.clientX <= rect.right &&
                            e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (isOverDelete) {
          this.removeFloatingPaletteColor(colorElement.dataset.id);
        } else {
          this.saveFloatingColors();
        }
      }
      
      isDragging = false;
      colorElement.style.cursor = "grab";
      colorElement.classList.remove("dragging");
      if (this.floatingColorsDeleteZone) {
        this.floatingColorsDeleteZone.classList.remove("visible", "drag-over");
      }
      
      colorElement.releasePointerCapture(e.pointerId);
    };
    
    colorElement.addEventListener("pointerdown", onPointerDown);
    colorElement.addEventListener("pointermove", onPointerMove);
    colorElement.addEventListener("pointerup", onPointerUp);
    colorElement.addEventListener("pointercancel", onPointerUp);
    colorElement.addEventListener("contextmenu", (e) => e.preventDefault());
    
    this.editor.overlayLayer.appendChild(colorElement);
    this.floatingColors.set(id, colorElement);
    this.saveFloatingColors();
  }
  
  removeFloatingPaletteColor(id) {
    const element = this.floatingColors.get(id);
    if (element) {
      element.remove();
      this.floatingColors.delete(id);
      this.saveFloatingColors();
    }
  }
  
  removeAllFloatingPaletteColors() {
    this.floatingColors.forEach((element, id) => {
      if (element) element.remove();
    });
    this.floatingColors.clear();
    this.saveFloatingColors();
  }
  
  saveFloatingColors() {
    localStorage.setItem("floatingColors", this.getFloatingColorsData());
  }
  
  getFloatingColorsData() {
    return JSON.stringify(
      Array.from(this.floatingColors).map(entry => entry[1]).map(element => {
        return {
          color: element.dataset.color,
          x: element.dataset.x,
          y: element.dataset.y
        };
      })
    );
  }

  // Color conversion utilities
  rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      v: Math.round(v * 100)
    };
  }

  hsvToRgb(h, s, v) {
    h /= 360; s /= 100; v /= 100;
    let r, g, b;
    
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  isValidHex(text) {
    return /^#?([a-f\d]{3}|[a-f\d]{6})$/i.test(text);
  }
}

// File Browser class
class FileBrowser {
  constructor(options = {}) {
    // Default options
    this.options = {
      container: document.body,
      onConfirm: null,
      onCancel: null,
      onError: null,
      fileTypes: ["pxl", "png", "jpg", "jpeg"],
      defaultType: "pxl",
      allowMultiple: false,
      mode: "open", // 'open', 'save', 'saveAs'
      defaultName: "untitled"
    };
    
    this.mimeMap = {
      pxl: "text/plain, application/json, application/octet-stream",
      pal: "text/plain, application/octet-stream",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      psd: "applicationimage/vnd.adobe.photoshop, application/x-photoshop, application/photoshop, application/psd, image/psd, application/octet-stream",
      txt: "text/plain, application/octet-stream",
      project: "application/*",
      default: "*"
    };
    
    Object.assign(this.options, options);

    // State
    this.selectedFile = null;
    this.selectedType = this.options.defaultType;
    this.isCordova = typeof window.cordova !== "undefined";
    this.isFilePluginAvailable = this.isCordova && typeof window.File !== "undefined";
    this.currentDirectory = null;
    this.currentPath = null;
    this.workingDirectory = "";
    this.lastMode = null;
    this.visible = false;

    // Initialize
    this.initUI();
  }

  // UI Setup
  initUI() {
    // Overlay
    this.overlay = document.createElement("div");
    this.overlay.className = "popup-overlay";

    // Dialog
    this.dialog = document.createElement("div");
    this.dialog.className = "popup-content";
    this.overlay.appendChild(this.dialog);

    // Title
    this.title = document.createElement("div");
    this.title.className = "file-browser-title";
    this.title.textContent = this.options.title 
                              ? this.options.title
                              : this.options.mode === "save" 
                                || this.options.mode === "saveAs" 
                                  ? __("Guardar Archivo||Save File") : __("Abrir Archivo||Open File");
    this.dialog.appendChild(this.title);

    this.contentArea = document.createElement("div");
    this.contentArea.className = "file-browser-content";
    this.dialog.appendChild(this.contentArea);

    this.buttonContainer = document.createElement("div");
    this.buttonContainer.className = "file-browser-buttons";
    this.dialog.appendChild(this.buttonContainer);

    // Content area
    this.initContentArea();

    // Buttons
    this.initButtons();

    // Add to DOM
    this.options.container.appendChild(this.overlay);
  }

  initContentArea() {
    this.contentArea.innerHTML = "";

    // Store references to existing elements if they exist
    const existingFilenameInput = this.filenameInput;
    const existingTypeSelect = this.typeSelect;
    const existingFileList = this.fileList;

    if (this.isCordova && this.isFilePluginAvailable) {
      this.initCordovaUI();
    } else {
      this.initBrowserUI();
    }

    // Preserve values if elements were recreated
    if (existingFilenameInput && this.filenameInput && existingFilenameInput.value) {
      this.filenameInput.value = existingFilenameInput.value;
    }

    if (existingTypeSelect && this.typeSelect && existingTypeSelect.value) {
      this.typeSelect.value = existingTypeSelect.value;
      this.selectedType = existingTypeSelect.value;
    }
  }

  initCordovaUI() {
    // Set full screen
    // this.overlay.classList.add("fullscreen");
    
    // Clear existing content but preserve elements if they exist
    this.pathDisplay = this.pathDisplay || document.createElement("div");
    this.fileList = this.fileList || document.createElement("div");

    this.pathDisplay.className = "cordova-path";
    this.fileList.className = "file-browser-list cordova-file-list";

    this.contentArea.innerHTML = "";
    this.contentArea.appendChild(this.pathDisplay);
    this.contentArea.appendChild(this.fileList);

    // For save mode, add filename input
    if (this.options.mode === "save" || this.options.mode === "saveAs") {
      this.filenameInput = this.filenameInput || document.createElement("input");
      this.filenameInput.type = "text";
      this.filenameInput.className = "file-browser-filename";
      this.filenameInput.value = this.options.defaultName || "untitled";
      this.contentArea.appendChild(this.filenameInput);

      this.typeSelect = this.typeSelect || document.createElement("select");
      this.typeSelect.className = "file-browser-type";
      this.typeSelect.innerHTML = ""; // Clear existing options

      this.options.fileTypes.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type.toUpperCase();
        if (type === this.options.defaultType) option.selected = true;
        this.typeSelect.appendChild(option);
      });

      this.contentArea.appendChild(this.typeSelect);
    }
  }

  initBrowserUI() {
    this.contentArea.innerHTML = "";

    if (this.options.mode === "open") {
      // Reuse or create file input
      this.fileInput = this.fileInput || document.createElement("input");
      this.fileInput.type = "file";
      this.fileInput.style.display = "none";
      this.fileInput.accept = this.getAccept();
      this.fileInput.multiple = this.options.allowMultiple;

      // Remove existing event listeners
      const newFileInput = this.fileInput.cloneNode();
      this.fileInput = newFileInput;

      this.fileInput.addEventListener("change", e => this.handleFileSelect(e));
      this.contentArea.appendChild(this.fileInput);

      // Reuse or create browse button
      const browseButton = document.createElement("button");
      browseButton.className = "file-browser-browse";
      browseButton.textContent = __("Escoger Archivos||Browse Files");
      browseButton.addEventListener("click", () => this.fileInput.click());
      this.contentArea.appendChild(browseButton);
    } else {
      // Reuse or create filename input
      this.filenameInput = this.filenameInput || document.createElement("input");
      this.filenameInput.type = "text";
      this.filenameInput.className = "file-browser-filename";
      this.filenameInput.value = this.options.defaultName || "untitled";
      this.contentArea.appendChild(this.filenameInput);

      // Reuse or create type select
      this.typeSelect = this.typeSelect || document.createElement("select");
      this.typeSelect.className = "file-browser-type";
      this.typeSelect.innerHTML = "";

      this.options.fileTypes.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type.toUpperCase();
        if (type === this.options.defaultType) option.selected = true;
        this.typeSelect.appendChild(option);
      });

      this.contentArea.appendChild(this.typeSelect);
    }
  }

  initButtons() {
    this.buttonContainer.innerHTML = "";

    // Cancel button
    this.cancelButton = document.createElement("button");
    this.cancelButton.className = "file-browser-cancel";
    this.cancelButton.textContent = __("Cancelar||Cancel");
    this.cancelButton.addEventListener("click", () => this.handleCancel());
    this.buttonContainer.appendChild(this.cancelButton);

    // Confirm/Save button when appropriate
    if (this.options.mode === "save" || this.options.mode === "saveAs") {
      this.confirmButton = document.createElement("button");
      this.confirmButton.className = "file-browser-confirm";
      this.confirmButton.textContent = __("Guardar||Save");
      this.confirmButton.addEventListener("click", () => this.handleConfirm());
      this.buttonContainer.appendChild(this.confirmButton);
    }
  }

  updateExistingUI() {
    // Update filename input if it exists
    if (this.filenameInput && this.options.defaultName) {
      this.filenameInput.value = this.options.defaultName;
    }

    // Update title
    if (this.title) {
      this.title.textContent = this.options.title 
                              ? this.options.title
                              : this.options.mode === "save" 
                                || this.options.mode === "saveAs" 
                                  ? "Save File" : "Open File";
    }

    // Update others
    this.initContentArea();
    this.initButtons();
  }

  /* ====================== */
  /* === CORDOVA METHODS == */
  /* ====================== */
  async loadCordovaFiles(path = this.currentPath) {
    try {
      this.fileList.innerHTML = '<div class="loading">Loading files...</div>';

      let dirEntry;
      if (path) {
        dirEntry = await new Promise((resolve, reject) => {
          window.resolveLocalFileSystemURL(path.endsWith("/") ? path : path + "/", resolve, reject);
        });
      } else {
        // Use external storage if available (more likely to be visible)
        try {
          dirEntry = await new Promise((resolve, reject) => {
            window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory || cordova.file.dataDirectory, resolve, reject);
          });
        } catch (error) {
          // Fallback to persistent storage
          dirEntry = await new Promise((resolve, reject) => {
            window.requestFileSystem(window.PERSISTENT || 1, 0, fs => resolve(fs.root), reject);
          });
        }
      }

      // Read directory
      const reader = dirEntry.createReader();
      const entries = await new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });

      // Update UI
      this.currentDirectory = dirEntry;
      this.currentPath = dirEntry.toURL();
      this.workingDirectory = dirEntry.fullPath;
      this.updatePathDisplay(dirEntry);
      this.renderFileList(entries, dirEntry);
    } catch (error) {
      this.showError(`Error loading files: ${error.message}`);
      if (this.options.onError) this.options.onError(error);
      throw error;
    }
  }

  async getDirectoryEntry(path) {
    return new Promise((resolve, reject) => {
      window.resolveLocalFileSystemURL(path, resolve, reject);
    });
  }

  async getRootDirectory() {
    if (window.PERSISTENT) {
      return new Promise((resolve, reject) => {
        window.requestFileSystem(window.PERSISTENT, 0, fs => resolve(fs.root), reject);
      });
    } else {
      return window.cordova.file.dataDirectory;
    }
  }

  updatePathDisplay(dirEntry) {
    const path = dirEntry.fullPath || dirEntry.nativeURL;
    this.pathDisplay.textContent = path;
  }

  renderFileList(entries, dirEntry) {
    this.fileList.innerHTML = "";

    // Sort entries: directories first, then files; both alphabetically by name
    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      // Both directory or both files, sort by name case-insensitive
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    if (this.isRootPath(dirEntry)) {
      // Add native open if on root directory
      if (this.options.mode === "open") {
        this.addListItem({
          text: "[File Selector]",
          icon: "folder",
          onClick: () => {
            const input = document.createElement("input");
            input.type = "file";
            input.style.display = "none";
            input.accept = this.getAccept();
            input.multiple = this.options.allowMultiple;
            input.addEventListener("change", e => this.handleFileSelect(e));
            input.addEventListener("cancel", e => this.renderFileList(entries, dirEntry));
            input.click();
            this.fileList.innerHTML = "";
          }
        });
      }
    } else {
      // Add parent directory link if not root
      this.addParentDirectoryItem(dirEntry);
    }

    // Add files and directories
    entries.forEach(entry => {
      if (entry.isDirectory) {
        this.addDirectoryItem(entry);
      } else {
        this.addFileItem(entry);
      }
    });

    if (this.fileList.children.length === 0) {
      this.fileList.innerHTML = '<div class="empty">No files found</div>';
    }
  }
  
  addListItem({
    text = "",
    type = "directory",
    icon = "folder",
    onClick = null
  }) {
    const item = document.createElement("div");
    item.className = `file-item ${type}`;

    const iconSpan = document.createElement("span");
    iconSpan.className = `icon ${icon}`;

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    item.appendChild(iconSpan);
    item.appendChild(textSpan);

    item.addEventListener("click", () => onClick?.(item));
    
    item.addEventListener("touchend", () => item.scrollTo({ left: 0, behavior: "smooth" }));
    
    this.fileList.appendChild(item);
  }

  addParentDirectoryItem(dirEntry) {
    const parentItem = document.createElement("div");
    parentItem.className = "file-item directory";

    // Clear innerHTML, create icon div and text span instead
    const icon = document.createElement("span");
    icon.className = "icon folder";

    const text = document.createElement("span");
    text.textContent = ".. (Parent Directory)";

    parentItem.appendChild(icon);
    parentItem.appendChild(text);

    parentItem.addEventListener("click", () => this.goUp());
    this.fileList.appendChild(parentItem);
  }

  addDirectoryItem(entry) {
    const item = document.createElement("div");
    item.className = "file-item directory";

    const icon = document.createElement("span");
    icon.className = "icon folder";

    const text = document.createElement("span");
    text.textContent = entry.name;

    item.appendChild(icon);
    item.appendChild(text);

    item.addEventListener("click", () => {
      this.loadCordovaFiles(entry.toURL());
    });
    
    item.addEventListener("touchend", () => item.scrollTo({ left: 0, behavior: "smooth" }));
    
    this.fileList.appendChild(item);
  }

  addFileItem(entry) {
    const ext = entry.name.split(".").pop().toLowerCase();
    if (!this.options.fileTypes.includes(ext)) return;

    const item = document.createElement("div");
    item.className = "file-item file";

    const icon = document.createElement("span");

    // Decide icon based on file type
    if (["png", "gif", "jpg", "jpeg"].includes(ext)) {
      icon.className = "icon image-file";
    } else if (ext === "pxl") {
      icon.className = "icon project-file";
    } else {
      icon.className = "icon text-file";
    }

    const text = document.createElement("span");
    text.textContent = entry.name;

    item.appendChild(icon);
    item.appendChild(text);

    item.addEventListener("click", () => {
      this.selectedFile = entry;
      this.selectedType = ext;

      if (this.options.mode === "open" && this.options.onConfirm) {
        this.options.onConfirm({
          name: entry.name,
          type: ext,
          entry: entry,
          fullPath: entry.toURL()
        });
        this.hide();
      } else {
        this.filenameInput.value = entry.name;
      }
    });
    this.fileList.appendChild(item);
  }

  /* ====================== */
  /* === BROWSER METHODS == */
  /* ====================== */
  handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const ext = file.name.split(".").pop().toLowerCase();

    if (this.options.onConfirm) {
      this.options.onConfirm({
        name: file.name,
        type: ext,
        file: file
      });
    }
    
    event.target.value = "";

    this.hide();
  }

  /* ====================== */
  /* ==== CORE METHODS ==== */
  /* ====================== */
  show() {
    // Make sure UI is initialized for current mode
    if (this.lastMode !== this.options.mode) {
      this.contentArea.innerHTML = "";
      this.initContentArea();
    }

    this.overlay.classList.add("visible");
    this.selectedFile = null;
    this.visible = true;

    // Reset or update UI elements based on mode
    if (this.filenameInput) {
      this.filenameInput.value = this.options.defaultName || "untitled";
    }

    if (this.typeSelect && this.options.defaultType) {
      this.typeSelect.value = this.options.defaultType;
      this.selectedType = this.options.defaultType;
    }

    if (this.isCordova && this.isFilePluginAvailable) {
      this.loadCordovaFiles();
    }
  }

  hide() {
    this.overlay.classList.remove("visible");
    this.visible = false;
  }

  refresh() {
    this.contentArea.innerHTML = "";
    this.initContentArea();

    if (this.isCordova && this.isFilePluginAvailable) {
      this.loadCordovaFiles();
    }
  }

  goUp() {
    if (!this.isRootPath(this.currentDirectory)) {
      this.loadCordovaFiles(this.currentDirectory.toURL().split("/").slice(0, -2).join("/") || "/");
    } else {
      this.hide();
    }
  }

  isRootPath(dirEntry) {
    return dirEntry.fullPath == "/" || dirEntry.fullPath == cordova.file.dataDirectory;
  }
  
  getAccept() {
    const mimeStack = [];
    this.options.fileTypes.forEach(extension => {
      const type = this.mimeMap[extension] || this.mimeMap.default;
      const mimes = type.split(',').map(mime => mime.trim());
      mimes.forEach(mime => {
        if (!mimeStack.includes(mime)) {
          mimeStack.push(mime);
        }
      });
    });
    return mimeStack.join(', ');
  }

  updateOptions(newOptions) {
    const oldMode = this.options.mode;
    Object.assign(this.options, newOptions);
    this.selectedFile = null;
    this.selectedType = this.options.defaultType || "pxl";

    // Re-initialize UI if mode changed or UI elements don't exist
    if (oldMode !== this.options.mode || (this.options.mode === "saveAs" && !this.filenameInput) || (this.options.mode === "open" && this.isCordova && !this.fileList)) {
      this.contentArea.innerHTML = "";
      this.initContentArea();
      this.updateExistingUI();
    } else {
      this.updateExistingUI();
    }

    this.lastMode = this.options.mode;
  }

  handleConfirm() {
    if (this.options.mode !== "save" && this.options.mode !== "saveAs") return;

    let filename = this.filenameInput ? this.filenameInput.value.trim() : this.options.defaultName;
    if (!filename) filename = this.options.defaultName;

    const fileType = this.typeSelect ? this.typeSelect.value : this.options.defaultType;
    const fullFilename = filename.endsWith(`.${fileType}`) ? filename : `${filename}.${fileType}`;

    if (this.options.onConfirm) {
      const result = {
        name: fullFilename,
        type: fileType
      };

      if (this.isCordova && this.isFilePluginAvailable && this.currentDirectory) {
        result.directory = this.currentDirectory;
      }

      this.options.onConfirm(result);
    }

    this.hide();
  }

  handleCancel() {
    if (this.options.onCancel) {
      this.options.onCancel();
    }
    this.hide();
  }

  showError(message) {
    this.fileList.innerHTML = `<div class="error">${message}</div>`;
  }

  destroy() {
    // Remove event listeners from file input
    if (this.fileInput) {
      const newFileInput = this.fileInput.cloneNode(false);
      this.fileInput.parentNode?.replaceChild(newFileInput, this.fileInput);
      this.fileInput = newFileInput;
    }

    // Remove overlay
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    this.fileBrowser = null;
  }
}

class PixelArtEditor {
  constructor(container) {
    this.container = container || document.createElement("div");
    this.container.classList.add("app-container");
    document.body.appendChild(this.container);
    
    this.version = VERSION;

    this.tools = {};
    this.currentTool = null;
    this.lastTool = null;
    this.isDrawing = false;
    this.isPanning = false;
    this.brushSize = localStorage.getItem("brushSize") ? parseInt(localStorage.getItem("brushSize")) : 1;
    this.maxBrushSize = 8;
    this.minBrushSize = 1;
    this.defaultWidth = 32;
    this.defaultHeight = 32;
    this.startX = 0;
    this.startY = 0;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.primaryColor = localStorage.getItem("primaryColor") || "#000000";
    this.secondaryColor = localStorage.getItem("secondaryColor") || "#ff00ff";
    this.selectedColor = "primary";
    this.transparentBackground = true;
    this.project = null;
    this.historyManager = new HistoryManager(this);
    this.touchDistance = 0;
    this.touchCenterX = 0;
    this.touchCenterY = 0;
    this.minScale = 1;
    this.maxScale = 35;
    this.popupOpen = false;
    this.toolDropdownOpen = false;
    this.toolSettingsOpen = false;
    this.isPlaying = false;
    this.animationInterval = null;
    this.defaultFrameTime = 1000 / 12; // Default frame time
    this.showMiniView = false;
    this.useCordova = window.location.href.startsWith("file");
    this.deviceReady = false;
    this.isFilePluginAvailable = false;
    this.fileBrowser = null;
    this.defaultFileBrowserPathUrl = null;
    this.timelapseFPS = 30;
    this.isCanvasResizing = false;
    this.canvasResizeState = {
      x: 0, y : 0,
      width: 0, height: 0
    };
    
    // Some settings
    this.registerLayerVisibilityChanges = false;
    this.autoLoadRecentFloatingColors = false;
    this.usePerProjectFloatingColors = false;
    
    // Collab Session
    this.collabMemberName = localStorage.getItem('collab_username') || 'user_' + Math.floor(Math.random() * 10000);
    this.collabMemberColor = localStorage.getItem('collab_user_color') || ['red', 'blue', 'green', 'yellow', 'orange', 'purple'][Math.floor(Math.random() * 6)];
    
    // Temporary variables
    this.tempLine = null;
    this.tempRect = null;
    this.tempEllipse = null;
    this.tempCanvas = null;
    this.tempCtx = null;
    this.tempColor = null;
    
    try {
      this.initSettings();
      this.initUI();
      this.initCollab();
      this.initBrushUI();
      this.initCanvas();
      this.initTools();
      this.initEventListeners();

      this.gridManager = new GridManager(this);
      this.spritesheetLoader = new SpritesheetLoader(this);
      this.referenceManager = new ReferenceManager(this);
      this.paletteManager = new PaletteManager(this);
      this.colorPicker = new ColorPicker(this);

      if (this.useCordova) {
        this.initCordova();
      }

      this.newProject();

      if (this.showMiniView) {
        this.animationPreview.classList.add("visible");
      }
    } catch (error) {
      console.error("Editor initialization error:", error);
      this.showError(error);
      throw error;
    }
  }
  
  initSettings() {
    // Create settings manager
    this.settings = new SettingsManager(this);
    
    window.settings = this.settings;
    
    // Define categories and settings
    
    // General category
    const generalCat = this.settings.addCategory({
      id: 'general',
      title: 'General||General',
      icon: 'icon-general'
    });
    
    // Language setting
    generalCat.addSetting({
      id: 'language',
      label: 'Idioma||Language',
      description: 'Selecciona el idioma de la interfaz||Select interface language',
      type: 'select',
      defaultValue: "0",
      options: [
        { value: "0", label: 'Español' },
        { value: "1", label: 'English' }
      ],
      needsReload: true,
      onInit: (value, editor) => {
        editor.settings.language = value;
      },
      onUpdate: (value, oldValue, editor) => {
        editor.settings.language = value;
        editor.settings.save();
      }
    });

    // Theme setting
    generalCat.addSetting({
      id: 'theme',
      label: 'Tema||Theme',
      description: 'Oscuro / Claro||Dark / Light',
      type: 'select',
      defaultValue: 'dark',
      options: [
        { value: 'dark', label: 'Oscuro||Dark' },
        { value: 'light', label: 'Claro||Light' }
      ],
      needsReload: false,
      onInit: (value, editor) => {
        document.body.classList.add(`theme-${value}`);
      },
      onUpdate: (value, oldValue, editor) => {
        document.body.classList.remove(`theme-${oldValue}`);
        document.body.classList.add(`theme-${value}`);
      }
    });

    // Editor category
    const editorCat = this.settings.addCategory({
      id: 'editor',
      title: 'Editor||Editor',
      icon: 'icon-editor'
    });

    editorCat.addSetting({
      id: 'autoSave',
      label: 'Auto-guardado||Auto-save',
      description: 'Guardar automáticamente cada 5 minutos||Auto-save every 5 minutes',
      type: 'boolean',
      defaultValue: false,
      onInit: (value, editor) => {
        if (value) {
          editor.startAutoSave();
        } else {
          editor.stopAutoSave();
        }
      },
      onUpdate: (value, oldValue, editor) => {
        if (value) {
          editor.startAutoSave();
        } else {
          editor.stopAutoSave();
        }
      }
    });
    
    editorCat.addSetting({
      id: 'showPreview',
      label: 'Mostrar Vista Previa por defecto||Show Preview by default',
      description: 'Mostrar recuadro de vista previa al iniciar la app||Show preview window at startup',
      type: 'boolean',
      defaultValue: false,
      onInit: (value, editor) => {
        editor.showMiniView = value;
      }
    });
    
    editorCat.addSetting({
      id: 'registerLayerVisibilityChanges',
      label: 'Registrar cambios de visibilidad||Register visibility changes',
      description: 'Registrar cambios de visibilidad de capas en la historia de deshacer||Register layer visibility changes in undo history',
      type: 'boolean',
      defaultValue: false,
      onInit: (value, editor) => {
        editor.registerLayerVisibilityChanges = value;
      },
      onUpdate: (value, oldScale, editor) => {
        editor.registerLayerVisibilityChanges = value;
      }
    });
    
    editorCat.addSetting({
      id: 'autoLoadRecentFloatingColors',
      label: 'Cargar colores flotantes recientes||Load recent floating colors',
      description: 'Cargar colores flotantes recientes automáticamente al iniciar la app||Auto-load recent floating colors on startup',
      type: 'boolean',
      defaultValue: false,
      onInit: (value, editor) => {
        editor.autoLoadRecentFloatingColors = value;
      }
    });
    
    editorCat.addSetting({
      id: 'usePerProjectFloatingColors',
      label: 'Usar colores flotantes por proyecto||Use per project floating colors',
      description: 'Los colores flotantes se guardan de forma independiente para cada proyecto||Floating colors are saved independently for each project',
      type: 'boolean',
      defaultValue: false,
      onInit: (value, editor) => {
        editor.usePerProjectFloatingColors = value;
      },
      onUpdate: (value, oldValue, editor) => {
        editor.usePerProjectFloatingColors = value;
      }
    });
    
    // Canvas category
    const canvasCat = this.settings.addCategory({
      id: 'canvas',
      title: 'Lienzo||Canvas',
      icon: 'icon-canvas'
    });

    canvasCat.addSetting({
      id: 'defaultWidth',
      label: 'Ancho predeterminado||Default width',
      description: 'Ancho por defecto para nuevos proyectos||Default width for new projects',
      type: 'number',
      defaultValue: 32,
      min: 8,
      max: 512,
      step: 8,
      onInit: (value, editor) => {
        editor.defaultWidth = value;
      },
      onUpdate: (value, oldValue, editor) => {
        editor.defaultWidth = value;
      }
    });

    canvasCat.addSetting({
      id: 'defaultHeight',
      label: 'Alto predeterminado||Default height',
      description: 'Alto por defecto para nuevos proyectos||Default height for new projects',
      type: 'number',
      defaultValue: 32,
      min: 8,
      max: 512,
      step: 8,
      onInit: (value, editor) => {
        editor.defaultHeight = value;
      },
      onUpdate: (value, oldValue, editor) => {
        editor.defaultHeight = value;
      }
    });

    canvasCat.addSetting({
      id: 'smooth-panning',
      label: 'Paneo Suave||Smooth Panning',
      description: 'Movimiento suave del lienzo||Smooth movement of the canvas',
      type: 'boolean',
      defaultValue: false,
      onInit: (value, editor) => {
        if (value) {
          editor.setSmoothPanning(true);
        } else {
          editor.setSmoothPanning(false);
        }
      },
      onUpdate: (value, oldValue, editor) => {
        if (value) {
          editor.setSmoothPanning(true);
        } else {
          editor.setSmoothPanning(false);
        }
      }
    });

    // Animation category
    const animCat = this.settings.addCategory({
      id: 'animation',
      title: 'Animación||Animation',
      icon: 'icon-animation'
    });

    animCat.addSetting({
      id: 'defaultFPS',
      label: 'FPS predeterminado||Default FPS',
      description: 'Fotogramas por segundo para nuevas animaciones||Frames per second for new animations',
      type: 'number',
      defaultValue: 12,
      min: 1,
      max: 60,
      step: 1,
      onInit: (value, editor) => {
        editor.defaultFrameTime = 1000 / value;
      }
    });

    // Performance category
    const perfCat = this.settings.addCategory({
      id: 'performance',
      title: 'Rendimiento||Performance',
      icon: 'icon-performance'
    });

    perfCat.addSetting({
      id: 'zoomLimit',
      label: 'Limité de Zoom||Zoom Limit',
      description: 'Límitar el zoom hasta cierto punto||Limit zoom to certain point',
      type: 'boolean',
      defaultValue: true,
      step: 10,
      onInit: (value, editor) => {
        editor.minScale = value ? 1 : 0;
      },
      onUpdate: (value, oldValue, editor) => {
        editor.minScale = value ? 1 : 0;
      }
    });
    
    perfCat.addSetting({
      id: 'maxUndoSteps',
      label: 'Pasos de deshacer máximos||Max undo steps',
      description: 'Límite de historial de deshacer (0 = Ilimitado)||Undo history limit (0 = Unlimited)',
      type: 'number',
      defaultValue: 50,
      min: 0,
      max: 2000,
      step: 10,
      onInit: (value, editor) => {
        editor.historyManager.maxHistoryLength = value ? value : Infinity;
      },
      onUpdate: (value, oldValue, editor) => {
        editor.historyManager.maxHistoryLength = value ? value : Infinity;
      }
    });
    
    perfCat.addSetting({
      id: 'maxBrushSize',
      label: 'Tamaño máximo del pincel||Max brush size',
      description: 'Límite del tamaño del pincel, Pinceles muy anchos pueden ralentizar la app||Brush size limit, wide brushes can slow down the app',
      type: 'number',
      defaultValue: 8,
      min: 3,
      max: 32,
      step: 1,
      onInit: (value, editor) => {
        editor.maxBrushSize = value;
      },
      onUpdate: (value, oldValue, editor) => {
        editor.maxBrushSize = value;
      }
    });
    
    // Collaboration category
    const collabCat = this.settings.addCategory({
      id: 'collab',
      title: 'Colaboración||Collaboration',
      icon: 'icon-collab'
    });
    
    collabCat.addSetting({
      id: 'memberName',
      label: 'Nombre en pantalla||Display name',
      description: 'Nombre a mostrar en sesiones colaborativas||Name to show in collaborative sessions',
      type: 'text',
      defaultValue: this.collabMemberName,
      needsReload: false,
      onInit: (value, editor) => {
        editor.collabMemberName = value.length > 3 ? value : `user_${Math.floor(Math.random() * 10000)}`;
      },
      onUpdate: (value, oldValue, editor) => {
        editor.collabMemberName = value.length > 3 ? value : `user_${Math.floor(Math.random() * 10000)}`;
        this.collabManager.updateMemberName(editor.collabMemberName);
        localStorage.setItem('collab_username', value);
      }
    });
    
    collabCat.addSetting({
      id: 'memberColor',
      label: 'Color||Color',
      description: 'Color con el que se muestra tu nombre||Color with which your name is shown',
      type: 'select',
      defaultValue: this.collabMemberColor,
      options: [
        { value: 'red', label: 'Rojo||Red' },
        { value: 'blue', label: 'Azul||Blue' },
        { value: 'green', label: 'Verde||Green' },
        { value: 'yellow', label: 'Amarillo||Yellow' },
        { value: 'orange', label: 'Naranja||Orange' },
        { value: 'purple', label: 'Púrpura||Purple' },
        { value: 'pink', label: 'Rosa||Pink' },
        { value: 'cyan', label: 'Cian||Cyan' },
        { value: 'brown', label: 'Marrón||Brown' },
        { value: 'gray', label: 'Gris||Gray' },
        { value: 'lime', label: 'Lima||Lime' },
        { value: 'indigo', label: 'Indigo||Indigo' }
      ],
      needsReload: false,
      onInit: (value, editor) => {
        this.collabMemberColor = value;
      },
      onUpdate: (value, oldValue, editor) => {
        this.collabMemberColor = value;
        this.collabManager.memberColor = value;
        this.collabManager.updateMemberColor(value);
        localStorage.setItem('collab_user_color', value);
      }
    });
    
    // Initialize settings
    this.settings.init();
    
    // Create settings UI
    this.settingsUI = new SettingsUI(this.settings, this);
  }
  
  initCollab() {
    this.collabManager = new CollabManager(this);
  }

  // Auto-save functionality
  startAutoSave() {
    if (this.autoSaveInterval) return;
    
    this.autoSaveInterval = setInterval(() => {
      if (this.project) {
        this.saveProject(true);
        this.showToast(__('Proyecto auto-guardado||Project auto-saved'));
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
  
  setSmoothPanning(enabled) {
    document.body.style.setProperty("--transform-transition", enabled ? "0.2s" : "none");
  }

  initCordova() {
    const script = document.createElement("script");
    script.src = "cordova/cordova.js";
    document.head.appendChild(script);
    document.addEventListener("deviceready", () => this.onDeviceReady(), false);
  }

  onDeviceReady() {
    this.deviceReady = true;

    // Request file system permissions if needed
    if (window.requestFileSystem) {
      // Test file system access
      window.requestFileSystem(
        window.PERSISTENT || 1,
        0,
        fs => {
          this.isCordova = true;
          this.isFilePluginAvailable = true;
          window.resolveLocalFileSystemURL(
            cordova.file.externalRootDirectory,
            entry => {
              this.defaultFileBrowserPathUrl = entry.toURL();
            },
            error => {
              console.warn("File system access denied:", error.code);
              this.isFilePluginAvailable = false;
            }
          );
        },
        error => {
          console.warn("File system access denied:", error.code);
          this.isFilePluginAvailable = false;
        }
      );
    }

    // Register back key
    document.addEventListener("backbutton", () => this.onBackButtonDown());
  }

  onBackButtonDown() {
    if (this.popupOpen) {
      this.hidePopup();
    } else if (this.fileBrowser && this.fileBrowser.visible) {
      if (this.isFilePluginAvailable) {
        this.fileBrowser.goUp();
      } else {
        this.fileBrowser.hide();
      }
    } else if (this.colorPickerOpen) {
      this.hideColorPicker();
    } else if (this.menuPanelOverlay.classList.contains("visible")) {
      this.toggleMenu();
    } else if (this.animationPanel.classList.contains("visible")) {
      this.togglePanel("animation");
    } else if (this.layersPanel.classList.contains("visible")) {
      this.togglePanel("layers");
    } else if (this.gridManager.panelVisible) {
      this.gridManager.hide();
    } else if (this.settingsUI.visible) {
      this.settingsUI.hide();
    } else {
      this.exitApp();
    }
  }

  showError(error) {
    this.errorElement.innerHTML = "";
    this.errorElement.style.display = "flex";

    const title = document.createElement("h2");
    title.textContent = "App crash";
    this.errorElement.appendChild(title);

    const messageElement = document.createElement("p");
    messageElement.className = "error-message";
    this.errorElement.appendChild(messageElement);

    messageElement.textContent = error.message || "An unknown error occurred";

    this.loadingElement.style.display = "none";

    const reloadButton = document.createElement("button");
    reloadButton.className = "error-reload";
    reloadButton.textContent = "Reload";
    this.errorElement.appendChild(reloadButton);

    reloadButton.addEventListener("click", () => {
      window.location.reload();
    });
  }
  
  showCollabDialog() {
    if (this.collabManager.isConnected) {
      this.collabManager.sessionOverlay.style.display = 'flex';
      this.collabManager.renderSessionMenu();
    } else {
      this.showCollabConnectDialog();
    }
  }
  
  showCollabConnectDialog() {
    const content = document.createElement('div');
    content.className = 'collab-connect-dialog';
    content.style.cssText = `
      min-width: 300px;
    `;
    
    // Tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
    `;
    
    const createTab = document.createElement('div');
    createTab.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 2px solid var(--primary-color);
      color: var(--primary-color);
    `;
    createTab.textContent = __('Crear Sala||Create Room');
    
    const joinTab = document.createElement('div');
    joinTab.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
    `;
    joinTab.textContent = __('Unirse||Join');
    
    tabs.appendChild(createTab);
    tabs.appendChild(joinTab);
    content.appendChild(tabs);
    
    // Create form
    const createForm = document.createElement('div');
    createForm.style.display = 'block';
    createForm.innerHTML = `
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; color: var(--text-dim); font-size: 12px;">${__('Nombre de sala||Room name')}</label>
        <input type="text" id="collab-room-name" value="${localStorage.getItem('collab_default_room') || 'Mi Sala'}" 
               style="width: 100%; padding: 10px; background-color: var(--bg-color); border: 2px solid var(--border-color); border-radius: 4px; color: var(--text-color);">
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; color: var(--text-dim); font-size: 12px;">${__('Contraseña||Password')}</label>
        <input type="password" id="collab-room-password" value="${localStorage.getItem('collab_default_password') || ''}" 
               style="width: 100%; padding: 10px; background-color: var(--bg-color); border: 2px solid var(--border-color); border-radius: 4px; color: var(--text-color);">
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; color: var(--text-dim); font-size: 12px;">${__('Permisos||Permissions')}</label>
        <select id="collab-permissions" style="width: 100%; padding: 10px; background-color: var(--bg-color); border: 2px solid var(--border-color); border-radius: 4px; color: var(--text-color);">
          <option value="strict">${__('Estricto||Strict')}</option>
          <option value="balanced" selected>${__('Equilibrado||Balanced')}</option>
          <option value="open">${__('Abierto||Open')}</option>
        </select>
      </div>
    `;
    content.appendChild(createForm);
    
    // Join form
    const joinForm = document.createElement('div');
    joinForm.style.display = 'none';
    joinForm.innerHTML = `
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; color: var(--text-dim); font-size: 12px;">${__('ID de sala||Room ID')}</label>
        <input type="text" id="collab-join-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" 
               style="width: 100%; padding: 10px; background-color: var(--bg-color); border: 2px solid var(--border-color); border-radius: 4px; color: var(--text-color);">
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; color: var(--text-dim); font-size: 12px;">${__('Contraseña||Password')}</label>
        <input type="password" id="collab-join-password" 
               style="width: 100%; padding: 10px; background-color: var(--bg-color); border: 2px solid var(--border-color); border-radius: 4px; color: var(--text-color);">
      </div>
    `;
    content.appendChild(joinForm);
    
    // Tab switching
    createTab.addEventListener('click', () => {
      createTab.style.borderBottomColor = 'var(--primary-color)';
      createTab.style.color = 'var(--primary-color)';
      joinTab.style.borderBottomColor = 'transparent';
      joinTab.style.color = 'var(--text-color)';
      createForm.style.display = 'block';
      joinForm.style.display = 'none';
    });
    
    joinTab.addEventListener('click', () => {
      joinTab.style.borderBottomColor = 'var(--primary-color)';
      joinTab.style.color = 'var(--primary-color)';
      createTab.style.borderBottomColor = 'transparent';
      createTab.style.color = 'var(--text-color)';
      joinForm.style.display = 'block';
      createForm.style.display = 'none';
    });
    
    this.showPopup(
      __('Colaboración||Collaboration'),
      content,
      [
        {
          text: __('Cancelar||Cancel'),
          class: 'cancel',
          action: () => this.hidePopup()
        },
        {
          text: __('Conectar||Connect'),
          action: () => {
            if (createForm.style.display !== 'none') {
              // Create session
              const roomName = document.getElementById('collab-room-name').value;
              const password = document.getElementById('collab-room-password').value;
              const permissionsPreset = document.getElementById('collab-permissions').value;
              
              let permissions;
              switch (permissionsPreset) {
                case 'strict':
                  permissions = {
                    undoRedo: 'host',
                    addRemoveFrames: 'host',
                    addRemoveLayers: 'host',
                    draw: 'host',
                    chat: 'everyone'
                  };
                  break;
                case 'open':
                  permissions = {
                    undoRedo: 'everyone',
                    addRemoveFrames: 'everyone',
                    addRemoveLayers: 'everyone',
                    draw: 'everyone',
                    chat: 'everyone'
                  };
                  break;
                default:
                  permissions = {
                    undoRedo: 'host',
                    addRemoveFrames: 'everyone',
                    addRemoveLayers: 'everyone',
                    draw: 'everyone',
                    chat: 'everyone'
                  };
              }
              
              this.collabManager.createSession(roomName, password, permissions);
            } else {
              // Join session
              const sessionId = document.getElementById('collab-join-id').value;
              const password = document.getElementById('collab-join-password').value;
              
              if (!sessionId) {
                this.showToast(__('ID de sala requerido||Room ID required'), 2000);
                return;
              }
              
              // Warn about unsaved changes
              this.showPopup(
                __('Unirse a sala||Join Room'),
                __('¿Unirse a la sala? Los cambios no guardados se perderán||Join room? Unsaved changes will be lost'),
                [
                  {
                    text: __('Cancelar||Cancel'),
                    class: 'cancel',
                    action: () => this.hidePopup()
                  },
                  {
                    text: __('Unirse||Join'),
                    action: () => {
                      this.collabManager.joinSession(sessionId, password);
                      this.hidePopup();
                    }
                  }
                ]
              );
              return;
            }
            this.hidePopup();
          }
        }
      ]
    );
  }

  initUI() {
    this.loadingElement = document.createElement("div");
    this.loadingElement.className = "loading-overlay";
    this.container.appendChild(this.loadingElement);
    
    this.loadingSpinner = document.createElement("div");
    this.loadingSpinner.className = "loading-spinner";
    this.loadingElement.appendChild(this.loadingSpinner);
    
    this.loadingText = document.createElement("div");
    this.loadingText.className = "loading-text";
    this.loadingText.innerHTML = __("Cargando...||Loading...");
    this.loadingElement.appendChild(this.loadingText);

    this.errorElement = document.createElement("div");
    this.errorElement.className = "editor-error";
    this.errorElement.style.display = "none";
    this.container.appendChild(this.errorElement);

    this.editorElement = document.createElement("div");
    this.editorElement.className = "pixel-art-editor";
    this.container.appendChild(this.editorElement);

    // Create canvas container
    this.canvasContainer = document.createElement("div");
    this.canvasContainer.className = "editor-canvas-container";
    this.editorElement.appendChild(this.canvasContainer);
    
    // Create interactive overlay
    this.overlayLayer = document.createElement("div");
    this.overlayLayer.className = "editor-overlay-layer";
    this.editorElement.appendChild(this.overlayLayer);
    
    // Create UI layer
    this.uiLayer = document.createElement("div");
    this.uiLayer.className = "editor-ui";
    this.editorElement.appendChild(this.uiLayer);

    // Top bar
    this.topBar = document.createElement("div");
    this.topBar.className = "ui-top-bar";
    this.uiLayer.appendChild(this.topBar);

    // Menu button
    this.menuButton = this.createButton("menu", "icon-menu", () => this.toggleMenu());
    this.topBar.appendChild(this.menuButton);

    // Color indicator
    this.colorIndicator = document.createElement("div");
    this.colorIndicator.className = "color-indicator";
    this.topBar.appendChild(this.colorIndicator);

    this.colorPrimary = document.createElement("div");
    this.colorPrimary.className = "color-primary";
    this.colorIndicator.appendChild(this.colorPrimary);

    this.colorSecondary = document.createElement("div");
    this.colorSecondary.className = "color-secondary";
    this.colorIndicator.appendChild(this.colorSecondary);

    this.colorSelector = document.createElement("div");
    this.colorSelector.className = "color-selector";
    this.colorIndicator.appendChild(this.colorSelector);

    this.colorIndicator.addEventListener("click", () => this.colorPicker.toggleSelectedColor());

    this.colorPickerButton = this.createButton("color-picker", "icon-palette", () => this.colorPicker.show());
    this.topBar.appendChild(this.colorPickerButton);

    // Bottom bar
    this.bottomBar = document.createElement("div");
    this.bottomBar.className = "ui-bottom-bar";
    this.uiLayer.appendChild(this.bottomBar);

    // Tool selection
    this.toolSelectionContainer = document.createElement("div");
    this.toolSelectionContainer.className = "tool-selection-container";
    this.bottomBar.appendChild(this.toolSelectionContainer);

    // Tool button with dropdown
    this.toolButtonContainer = document.createElement("div");
    this.toolButtonContainer.className = "tool-button-container";
    this.toolSelectionContainer.appendChild(this.toolButtonContainer);

    this.currentToolButton = this.createButton("current-tool", "tool-pencil", () => this.toggleToolDropdown());
    this.toolButtonContainer.appendChild(this.currentToolButton);
    this.currentToolButton.title = __("Herramienta Actual||Current Tool");

    this.toolDropdown = document.createElement("div");
    this.toolDropdown.className = "tool-dropdown";
    this.toolButtonContainer.appendChild(this.toolDropdown);

    // Tool settings button (visible only when tool has settings)
    this.toolSettingsButton = this.createButton("tool-settings", "icon-settings", () => this.showToolSettings());
    this.toolSettingsButton.title = __("Opciones de herramienta||Tool settings");
    this.toolSettingsButton.style.display = "none";
    this.toolSelectionContainer.appendChild(this.toolSettingsButton);

    // Tool settings popup
    this.toolSettingsPopup = document.createElement("div");
    this.toolSettingsPopup.className = "tool-settings-popup";
    this.toolSettingsPopup.style.display = "none";
    this.uiLayer.appendChild(this.toolSettingsPopup);

    // Add close handler
    this.toolSettingsPopup.addEventListener("click", e => e.stopPropagation());

    // Tool switcher
    this.toolSwitcher = this.createButton("switch-tool", "icon-switch-tool", () => this.switchLastTool());
    this.toolSwitcher.title = __("Rotar herramientas (Espacio)||Switch tools (Space)");
    this.toolSelectionContainer.appendChild(this.toolSwitcher);
    
    // Animation panel toggle
    this.animationButton = this.createButton("animation", "icon-animation", () => this.togglePanel("animation"));
    this.animationButton.title = __("(Animación|Animation) (Ctrl + A)");
    this.bottomBar.appendChild(this.animationButton);

    // Layers panel toggle
    this.layersButton = this.createButton("layers", "icon-layers", () => this.togglePanel("layers"));
    this.layersButton.title = __("(Capas|Layers) (Ctrl + L)");
    this.bottomBar.appendChild(this.layersButton);

    // Grids panel toggle
    this.gridsButton = this.createButton("grids", "icon-grids", () => this.gridManager.toggle());
    this.gridsButton.title = __("(Cuadrículas|Grids)");
    this.bottomBar.appendChild(this.gridsButton);

    // Undo/Redo buttons
    this.undoRedoButtons = document.createElement("div");
    this.undoRedoButtons.className = "undo-redo-buttons";
    this.bottomBar.appendChild(this.undoRedoButtons);

    this.undoButton = this.createButton("undo", "icon-undo", () => this.undo());
    this.undoButton.title = __("(Deshacer|Undo) (Ctrl + Z)");
    this.undoRedoButtons.appendChild(this.undoButton);

    this.redoButton = this.createButton("redo", "icon-redo", () => this.redo());
    this.redoButton.title = __("(Rehacer|Redo) (Ctrl + Y)");
    this.undoRedoButtons.appendChild(this.redoButton);

    // Menu panel
    this.menuPanelOverlay = document.createElement("div");
    this.menuPanelOverlay.className = "menu-panel-overlay";
    this.uiLayer.appendChild(this.menuPanelOverlay);
    
    this.menuPanelOverlay.addEventListener("click", () => this.toggleMenu());
    
    this.menuPanel = document.createElement("div");
    this.menuPanel.className = "menu-panel";
    this.menuPanelOverlay.appendChild(this.menuPanel);
    
    this.menuTabs = document.createElement("div");
    this.menuTabs.className = "menu-tabs";
    this.menuPanel.appendChild(this.menuTabs);

    this.menuContent = document.createElement("div");
    this.menuContent.className = "menu-content";
    this.menuPanel.appendChild(this.menuContent);

    // Create menu tabs
    this.createMenuTab("File");
    this.createMenuTab("Edit");
    this.createMenuTab("View");
    this.createMenuTab("Color");
    this.createMenuTab("Help");

    // Animation panel
    this.animationPanel = document.createElement("div");
    this.animationPanel.className = "animation-panel";
    this.uiLayer.appendChild(this.animationPanel);

    // Timeline header with controls
    const timelineHeader = document.createElement("div");
    timelineHeader.className = "timeline-header";
    this.animationPanel.appendChild(timelineHeader);

    // Play/Pause button
    this.playPauseButton = this.createButton("play-pause", "icon-play", () => this.togglePlayback());
    timelineHeader.appendChild(this.playPauseButton);

    // Prev/Next frame buttons
    this.prevFrameButton = this.createButton("prev-frame", "icon-prev", () => this.prevFrame());
    timelineHeader.appendChild(this.prevFrameButton);

    this.nextFrameButton = this.createButton("next-frame", "icon-next", () => this.nextFrame());
    timelineHeader.appendChild(this.nextFrameButton);

    // Add Frame button
    this.addFrameButton = this.createButton("add-frame", "icon-add", () => this.addFrame(this.project.currentFrame));
    timelineHeader.appendChild(this.addFrameButton);
  
    // Duplicate Frame button
    this.duplicateFrameButton = this.createButton("duplicate-frame", "icon-copy", () => this.duplicateFrame());
    timelineHeader.appendChild(this.duplicateFrameButton);

    // FPS control
    const fpsControl = document.createElement("div");
    fpsControl.className = "fps-control";
    timelineHeader.appendChild(fpsControl);

    const fpsLabel = document.createElement("span");
    fpsLabel.textContent = "FPS:";
    fpsControl.appendChild(fpsLabel);

    this.fpsInput = document.createElement("input");
    this.fpsInput.type = "number";
    this.fpsInput.min = "1";
    this.fpsInput.max = "60";
    this.fpsInput.value = parseInt(1000 / this.defaultFrameTime);
    this.fpsInput.addEventListener("keyup", () => {
      const value = this.fpsInput.value;
      if (value && value <= 60) {
        this.fpsInput.style.backgroundColor = "var(--bg-color)";
      } else {
        this.fpsInput.style.backgroundColor =  "#9f0000";
      }
    });
    this.fpsInput.addEventListener("change", () => {
      const value = this.fpsInput.value;
      if (value && value <= 60) {
        this.updateFPS(value);
        this.fpsInput.style.backgroundColor = "var(--bg-color)";
      } else {
        this.fpsInput.style.backgroundColor =  "#9f0000";
      }
    });
    fpsControl.appendChild(this.fpsInput);

    // Close button
    const closeButton = document.createElement("div");
    closeButton.className = "panel-close timeline-close";
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", () => this.togglePanel("animation"));
    timelineHeader.appendChild(closeButton);

    // Timeline content
    this.timelineContent = document.createElement("div");
    this.timelineContent.className = "timeline-content";
    this.animationPanel.appendChild(this.timelineContent);

    // Animation preview
    this.animationPreview = document.createElement("canvas");
    this.animationPreview.className = "animation-preview";
    this.animationPreview.addEventListener("click", () => {
      this.animationPanel.classList.add("visible");
      this.animationButton.classList.add("active");
    });
    this.animationPanel.appendChild(this.animationPreview);

    // Layers panel
    this.layersPanel = document.createElement("div");
    this.layersPanel.className = "layers-panel";
    this.uiLayer.appendChild(this.layersPanel);

    const layersHeader = document.createElement("div");
    layersHeader.className = "panel-header";
    this.layersPanel.appendChild(layersHeader);

    const layersTitle = document.createElement("div");
    layersTitle.className = "panel-title";
    layersTitle.textContent = "Layers";
    layersHeader.appendChild(layersTitle);

    const layersClose = document.createElement("div");
    layersClose.className = "panel-close";
    layersClose.innerHTML = "&times;";
    layersClose.addEventListener("click", () => this.togglePanel("layers"));
    layersHeader.appendChild(layersClose);

    this.layersContainer = document.createElement("div");
    this.layersContainer.className = "layers-container";
    this.layersPanel.appendChild(this.layersContainer);

    const layerActions = document.createElement("div");
    layerActions.className = "layer-actions";
    this.layersPanel.appendChild(layerActions);

    this.addLayerButton = this.createButton("add-layer", "+", () => this.addLayer());
    layerActions.appendChild(this.addLayerButton);

    this.removeLayerButton = this.createButton("remove-layer", "-", () => this.removeLayer());
    layerActions.appendChild(this.removeLayerButton);

    // Notification system
    this.notificationElement = document.createElement("div");
    this.notificationElement.className = "notification";
    this.uiLayer.appendChild(this.notificationElement);
    
    this.operationMessageElement = document.createElement("div");
    this.operationMessageElement.className = "operation-message";
    this.uiLayer.appendChild(this.operationMessageElement);

    // Popup system
    this.popupOverlay = document.createElement("div");
    this.popupOverlay.className = "popup-overlay";
    this.uiLayer.appendChild(this.popupOverlay);

    this.popupContent = document.createElement("div");
    this.popupContent.className = "popup-content";
    this.popupOverlay.appendChild(this.popupContent);

    // Update colors
    this.updateColorIndicator();
  }

  initBrushUI() {
    // Brush size indicator
    this.brushSizeIndicator = document.createElement("div");
    this.brushSizeIndicator.className = "brush-size-indicator";
    this.brushSizeIndicator.style.display = "none";
    this.uiLayer.appendChild(this.brushSizeIndicator);

    // Brush size text
    this.brushSizeText = document.createElement("div");
    this.brushSizeText.className = "brush-size-text";
    this.brushSizeText.textContent = `${__("Brocha||Brush")}: ${this.brushSize}px`;
    this.brushSizeIndicator.appendChild(this.brushSizeText);

    this.brushSizeBar = document.createElement("progress");
    this.brushSizeBar.className = "brush-size-bar";
    this.brushSizeIndicator.appendChild(this.brushSizeBar);

    this.updateBrushSizeIndicator();
  }
  
  initCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "editor-canvas";
    this.canvasContainer.appendChild(this.canvas);

    // Add a wrapper div for proper centering
    this.canvasWrapper = document.createElement("div");
    this.canvasWrapper.className = "canvas-wrapper";
    this.canvasWrapper.style.position = "absolute";
    this.canvasWrapper.style.transformOrigin = "0 0";
    this.canvasContainer.insertBefore(this.canvasWrapper, this.canvas);
    this.canvasWrapper.appendChild(this.canvas);

    // Create canvas resize controls
    this.canvasResizeControls = document.createElement("div");
    this.canvasResizeControls.className = "canvas-resize-controls";
    this.canvasWrapper.appendChild(this.canvasResizeControls);

    this.canvasResizeX = document.createElement("div");
    this.canvasResizeX.className = "canvas-resize-edge vertical";
    this.canvasResizeControls.appendChild(this.canvasResizeX);
    
    this.canvasResizeY = document.createElement("div");
    this.canvasResizeY.className = "canvas-resize-edge";
    this.canvasResizeControls.appendChild(this.canvasResizeY);
    
    this.canvasResizeWidth = document.createElement("div");
    this.canvasResizeWidth.className = "canvas-resize-edge vertical";
    this.canvasResizeControls.appendChild(this.canvasResizeWidth);
    
    this.canvasResizeHeight = document.createElement("div");
    this.canvasResizeHeight.className = "canvas-resize-edge";
    this.canvasResizeControls.appendChild(this.canvasResizeHeight);

    this.ctx = this.getCanvasContext(this.canvas);

    // Initialize transform values
    this.scale = 4;
    this.posX = 0;
    this.posY = 0;
    
    // Initialize debug canvas
    this.debugCanvas = document.getElementById("debug-canvas");
    if (this.debugCanvas) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      this.debugCanvas.width = width;
      this.debugCanvas.height = height
      
      this.debugCtx = this.getCanvasContext(this.debugCanvas);
      
      this.debug = {
        point: (x, y, radius, color) => {
          this.debugCtx.clearRect(0, 0, width, height);
          this.drawBrushCircle(this.debugCtx, x, y, radius || 1, color || "#ffffff");
        },
        text: (x, y, text, color) => {
          this.debugCtx.clearRect(0, 0, width, height);
          this.debugCtx.fillStyle = color;
          this.debugCtx.fillText(text, x, y);
        }
      };
    }
  }
  
  getCanvasContext(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    return context;
  }
  
  getTempCanvas(width, height) {
    this.tempCanvas = this.tempCanvas || document.createElement("canvas");
    this.tempCanvas.width = width || this.project.width;
    this.tempCanvas.height = height || this.project.height;
    this.tempCtx = this.tempCtx || this.getCanvasContext(this.tempCanvas);
    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    return { canvas: this.tempCanvas, ctx: this.tempCtx };
  }

  initEventListeners() {
    // Mouse events
    this.canvasContainer.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvasContainer.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvasContainer.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvasContainer.addEventListener("mouseleave", this.handleMouseUp.bind(this));
    this.canvasContainer.addEventListener("wheel", this.handleMouseWheel.bind(this));

    // Touch events
    this.canvasContainer.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: false });
    this.canvasContainer.addEventListener("touchmove", this.handleTouchMove.bind(this), { passive: false });
    this.canvasContainer.addEventListener("touchend", this.handleTouchEnd.bind(this));

    // Keyboard events
    document.addEventListener("keydown", this.handleKeyDown.bind(this));

    // Window resize
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  initTools() {
    // Pencil
    this.addTool({
      name: "Pencil",
      displayName: __("Lápiz||Pencil"),
      icon: "tool-pencil",
      cursor: "crosshair",
      shortcut: "d",
      onDown: (x, y, remote) => {
        this.isDrawing = true;
        this._previousPencilPosition = { x, y };
        this.historyManager.startBatch("draw", __('Dibujar||Draw'));
        this.drawPixel(x, y);
      },
      onMove: (x, y) => {
        if (this.isDrawing) {
          if (this._previousPencilPosition && this.distance(x, y, this._previousPencilPosition.x, this._previousPencilPosition.y) >= 2) {
            this.startLine(this._previousPencilPosition.x, this._previousPencilPosition.y);
            this.finishLine(x, y);
          } else {
            this.drawPixel(x, y);
          }
          this._previousPencilPosition = { x, y };
        }
      },
      onUp: (x, y) => {
        if (this.isDrawing) {
          this.isDrawing = false;
          this.historyManager.endBatch();
        }
        this._previousPencilPosition = null;
      }
    });
    
    // Eraser
    this.addTool({
      name: "Eraser",
      displayName: __("Borrador||Eraser"),
      icon: "tool-eraser",
      cursor: "crosshair",
      shortcut: "s",
      onDown: (x, y) => {
        this.isDrawing = true;
        this._previousPencilPosition = { x, y };
        this.historyManager.startBatch("draw", __('Borrar||Erase'));
        this.drawPixel(x, y, { color: "transparent" });
      },
      onMove: (x, y) => {
        if (this.isDrawing) {
          if (this._previousPencilPosition && this.distance(x, y, this._previousPencilPosition.x, this._previousPencilPosition.y) >= 2) {
            this.startLine(this._previousPencilPosition.x, this._previousPencilPosition.y, "transparent");
            this.finishLine(x, y);
          } else {
            this.drawPixel(x, y, { color: "transparent" });
          }
          this._previousPencilPosition = { x, y };
        }
      },
      onUp: (x, y) => {
        if (this.isDrawing) {
          this.isDrawing = false;
          this.historyManager.endBatch();
        }
        this._previousPencilPosition = null;
      }
    });
    
    // Line
    this.addTool({
      name: "Line",
      displayName: __("Línea||Line"),
      icon: "tool-line",
      cursor: "crosshair",
      shortcut: "l",
      onDown: (x, y) => {
        this.historyManager.startBatch("draw", __('Línea||Line'));
        this.startLine(x, y);
      },
      onMove: (x, y) => {
        if (this.tempLine) {
          this.previewLine(x, y);
        }
      },
      onUp: (x, y) => {
        if (this.tempLine) {
          this.finishLine(x, y);
          this.saveToHistory();
        }
      }
    });
    
    // Rectangle
    this.addTool({
      name: "Rectangle",
      displayName: __("Rectángulo||Rectangle"),
      icon: "tool-rect",
      cursor: "crosshair",
      shortcut: "r",
      settings: {
        filled: { type: "boolean", default: false },
        perfect: { type: "boolean", default: false }
      },
      onDown: (x, y) => {
        this.historyManager.startBatch("draw", __('Rectángulo||Rectangle'));
        this.startRect(x, y);
      },
      onMove: (x, y) => {
        if (this.tempRect) {
          this.previewRect(x, y);
        }
      },
      onUp: (x, y) => {
        if (this.tempRect) {
          this.finishRect(x, y);
          this.saveToHistory();
        }
      }
    });

    // Ellipse 
    this.addTool({
      name: "Ellipse",
      displayName: __("Elipse||Ellipse"),
      icon: "tool-ellipse",
      cursor: "crosshair",
      shortcut: "e",
      settings: {
        filled: { type: "boolean", default: false },
        perfect: { type: "boolean", default: false }
      },
      onDown: (x, y) => {
        this.historyManager.startBatch("draw", __('Elipse||Ellipse'));
        this.startEllipse(x, y);
      },
      onMove: (x, y) => {
        if (this.tempEllipse) {
          this.previewEllipse(x, y);
        }
      },
      onUp: (x, y) => {
        if (this.tempEllipse) {
          this.finishEllipse(x, y);
          this.saveToHistory();
        }
      }
    });

    // Paint Bucket
    this.addTool({
      name: "Paint Bucket",
      displayName: __("Cubeta||Paint Bucket"),
      icon: "tool-bucket",
      cursor: "crosshair",
      shortcut: "b",
      onDown: (x, y) => {
        this.historyManager.startBatch("draw", __('Rellenar||Bucket fill'));
        this.fillArea(x, y);
        this.saveToHistory();
      }
    });
    
    // Pipette
    this.addTool({
      name: "Pipette",
      displayName: __("Pipeta||Pipette"),
      icon: "tool-pipette",
      cursor: "crosshair",
      shortcut: "a",
      onDown: (x, y) => {
        this.pickColor(x, y);
      }
    });
    
    // Set default tool
    this.setTool("Pencil", true);
    this.lastTool = "Eraser";
  }

  updateBrushSizeIndicator() {
    this.brushSizeText.textContent = __(`(Pincel|Brush): ${this.brushSize}px`);
    this.brushSizeBar.min = 0;
    this.brushSizeBar.max = this.maxBrushSize;
    this.brushSizeBar.value = this.brushSize;
  }
  
  showLoadingScreen(text = "Loading") {
    this.loadingElement.style.display = "flex";
    this.loadingText.innerHTML = text;
  }
  
  hideLoadingScreen() {
    this.loadingElement.style.display = "none";
  }
  
  createButton(id, iconClass, onClick) {
    const button = document.createElement("button");
    button.className = "ui-button";
    button.id = id;

    if (iconClass) {
      const icon = document.createElement("div");
      icon.className = `icon ${iconClass}`;
      button.appendChild(icon);
    }

    if (onClick) {
      button.addEventListener("click", onClick);
    }

    return button;
  }
  
  createMenuTab(name) {
    const displayNames = {
      "File": __("Archivo||File"),
      "Edit": __("Editar||Edit"),
      "View": __("Ver||View"),
      "Color": "Color",
      "Help": __("Ayuda||Help"),
    };
    
    const tab = document.createElement("div");
    tab.className = "menu-tab";
    tab.textContent = displayNames[name] || name;
    tab.name = name;
    tab.addEventListener("click", () => this.showMenuContent(name));
    this.menuTabs.appendChild(tab);

    const content = document.createElement("div");
    content.className = `menu-content-${name.toLowerCase()}`;
    content.style.display = "none";
    this.menuContent.appendChild(content);

    if (name === "File") {
      this.createFileMenu(content);
    } else if (name === "Edit") {
      this.createEditMenu(content);
    } else if (name === "View") {
      this.createViewMenu(content);
    } else if (name === "Color") {
      this.createColorMenu(content);
    } else if (name === "Help") {
      this.createHelpMenu(content);
    }

    // Show first tab by default
    if (this.menuTabs.children.length === 1) {
      tab.classList.add("active");
      content.style.display = "block";
    }
  }

  createFileMenu(container) {
    const section = document.createElement("div");
    section.className = "menu-section";
    container.appendChild(section);

    const newItem = document.createElement("div");
    newItem.className = "menu-item";
    newItem.textContent = __("Nuevo Proyecto||New Project");
    newItem.addEventListener("click", () => this.showNewProjectDialog());
    section.appendChild(newItem);

    const openItem = document.createElement("div");
    openItem.className = "menu-item";
    openItem.textContent = __("Abrir Proyecto...||Open Project...");
    openItem.addEventListener("click", () => this.openFile());
    section.appendChild(openItem);
    
    const openSpritesheetItem = document.createElement("div");
    openSpritesheetItem.className = "menu-item";
    openSpritesheetItem.textContent = __("Abrir Hoja...||Open Spritesheet...");
    openSpritesheetItem.addEventListener("click", () => this.showSpritesheetLoader());
    section.appendChild(openSpritesheetItem);

    const saveItem = document.createElement("div");
    saveItem.className = "menu-item";
    saveItem.textContent = __("Guardar||Save");
    saveItem.addEventListener("click", () => this.saveProject());
    section.appendChild(saveItem);

    const saveAsItem = document.createElement("div");
    saveAsItem.className = "menu-item";
    saveAsItem.textContent = __("Guardar Como...||Save As...");
    saveAsItem.addEventListener("click", () => this.saveAs());
    section.appendChild(saveAsItem);

    const referenceItem = document.createElement("div");
    referenceItem.className = "menu-item";
    referenceItem.textContent = __("Cargar Referencia...||Load Reference...");
    referenceItem.addEventListener("click", () => this.loadReferenceImage());
    section.appendChild(referenceItem);
    
    const collabItem = document.createElement('div');
    collabItem.className = 'menu-item';
    collabItem.innerHTML = `
      <span>${__('Modo Colaborativo||Collab Mode')}</span>
      <span class="collab-status" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 8px;"></span>
    `;
    collabItem.addEventListener('click', () => this.showCollabDialog());
    section.appendChild(collabItem);

    const exportCurrentFrameItem = document.createElement("div");
    exportCurrentFrameItem.className = "menu-item";
    exportCurrentFrameItem.textContent = __("Exportar Frame Actual...||Export Current Frame");
    exportCurrentFrameItem.addEventListener("click", () => this.exportCurrentFrame());
    section.appendChild(exportCurrentFrameItem);

    const exportAnimationItem = document.createElement("div");
    exportAnimationItem.className = "menu-item";
    exportAnimationItem.textContent = __("Exportar Animación||Export Animation");
    exportAnimationItem.addEventListener("click", () => this.exportAnimation());
    section.appendChild(exportAnimationItem);

    const exportMenu = this.menuContent.querySelector(".menu-content-file");
    const timelapseItem = document.createElement("div");
    timelapseItem.className = "menu-item";
    timelapseItem.textContent = __("Exportar Timelapse...||Export Timelapse...");
    timelapseItem.addEventListener("click", () => this.exportTimelapse());
    section.appendChild(timelapseItem);

    const exitItem = document.createElement("div");
    exitItem.className = "menu-item";
    exitItem.textContent = __("Salir de la app||Exit App");
    exitItem.addEventListener("click", () => this.exitApp());
    exitItem.style.display = "none";
    section.appendChild(exitItem);

    document.addEventListener("deviceready", () => (exitItem.style.display = ""));
  }

  createEditMenu(container) {
    const transformSection = document.createElement("div");
    transformSection.className = "menu-section";
    container.appendChild(transformSection);

    const h3 = document.createElement("h3");
    h3.textContent = __("Transformar||Transform");
    transformSection.appendChild(h3);

    const resizeCanvasItem = document.createElement("div");
    resizeCanvasItem.className = "menu-item";
    resizeCanvasItem.textContent = __("Redimensionar Canvas||Resize Canvas");
    resizeCanvasItem.addEventListener("click", () => this.startResizeCanvas());
    transformSection.appendChild(resizeCanvasItem);
    
    const flipHItem = document.createElement("div");
    flipHItem.className = "menu-item";
    flipHItem.textContent = __("Espejo Horizontal||Flip Horizontal");
    flipHItem.addEventListener("click", () => this.flipHorizontal());
    transformSection.appendChild(flipHItem);

    const flipVItem = document.createElement("div");
    flipVItem.className = "menu-item";
    flipVItem.textContent = __("Espejo Vertical||Flip Vertical");
    flipVItem.addEventListener("click", () => this.flipVertical());
    transformSection.appendChild(flipVItem);

    const rotate90Item = document.createElement("div");
    rotate90Item.className = "menu-item";
    rotate90Item.textContent = __("(Rotar|Rotate) 90° CW");
    rotate90Item.addEventListener("click", () => this.rotate(90));
    transformSection.appendChild(rotate90Item);

    const rotate270Item = document.createElement("div");
    rotate270Item.className = "menu-item";
    rotate270Item.textContent = __("(Rotar|Rotate) 90° CCW");
    rotate270Item.addEventListener("click", () => this.rotate(270));
    transformSection.appendChild(rotate270Item);

    const rotate180Item = document.createElement("div");
    rotate180Item.className = "menu-item";
    rotate180Item.textContent = __("(Rotar|Rotate) 180°");
    rotate180Item.addEventListener("click", () => this.rotate(180));
    transformSection.appendChild(rotate180Item);

    // Animation section
    const animationSection = document.createElement("div");
    animationSection.className = "menu-section";
    container.appendChild(animationSection);

    const animationH3 = document.createElement("h3");
    animationH3.textContent = __("Animación||Animation");
    animationSection.appendChild(animationH3);

    const fpsItem = document.createElement("div");
    fpsItem.className = "menu-item";
    fpsItem.textContent = __("Cambiar FPS...||Set FPS...");
    fpsItem.addEventListener("click", () => this.showFPSDialog());
    animationSection.appendChild(fpsItem);

    const frameTimeItem = document.createElement("div");
    frameTimeItem.className = "menu-item";
    frameTimeItem.textContent = __("Cambiar Tiempo del Frame...||Set Frame Time...");
    frameTimeItem.addEventListener("click", () => this.showCurrentFrameTimeDialog());
    animationSection.appendChild(frameTimeItem);
    
    // Settings section
    const settingsSection = document.createElement("div");
    settingsSection.className = "menu-section";
    container.appendChild(settingsSection);
    
    const settingsH3 = document.createElement("h3");
    settingsH3.textContent = __("Ajustes||Settings");
    settingsSection.appendChild(settingsH3);
    
    const settingsItem = document.createElement("div");
    settingsItem.className = "menu-item";
    settingsItem.textContent = __("Configurar||Configure");
    settingsItem.addEventListener("click", () => this.settingsUI.toggle());
    settingsSection.appendChild(settingsItem);
  }

  createViewMenu(container) {
    const viewSection = document.createElement("div");
    viewSection.className = "menu-section";
    container.appendChild(viewSection);
    
    const zoomInItem = document.createElement("div");
    zoomInItem.className = "menu-item";
    zoomInItem.textContent = __("Acercar||Zoom In");
    zoomInItem.addEventListener("click", () => this.zoom(1.2));
    viewSection.appendChild(zoomInItem);

    const zoomOutItem = document.createElement("div");
    zoomOutItem.className = "menu-item";
    zoomOutItem.textContent = __("Alejar||Zoom Out");
    zoomOutItem.addEventListener("click", () => this.zoom(0.8));
    viewSection.appendChild(zoomOutItem);

    const resetZoomItem = document.createElement("div");
    resetZoomItem.className = "menu-item";
    resetZoomItem.textContent = __("Reiniciar zoom||Reset Zoom");
    resetZoomItem.addEventListener("click", () => this.resetZoom());
    viewSection.appendChild(resetZoomItem);

    const togglePreviewItem = document.createElement("div");
    togglePreviewItem.className = "menu-item";
    togglePreviewItem.textContent = __("Alternar vista previa||Toggle Preview");
    togglePreviewItem.addEventListener("click", () => this.togglePreview());
    viewSection.appendChild(togglePreviewItem);
  }

  createColorMenu(container) {
    const colorSection = document.createElement("div");
    colorSection.className = "menu-section";
    container.appendChild(colorSection);

    const h3 = document.createElement("h3");
    h3.textContent = __("Ajustes de Color||Color Adjustments");
    colorSection.appendChild(h3);

    const transparencyItem = document.createElement("div");
    transparencyItem.className = "menu-item";
    transparencyItem.textContent = __("Alternar Transferencia||Toggle Transparency");
    transparencyItem.addEventListener("click", () => this.toggleTransparency());
    colorSection.appendChild(transparencyItem);

    const invertItem = document.createElement("div");
    invertItem.className = "menu-item";
    invertItem.textContent = __("Invertir Colores||Invert Colors");
    invertItem.addEventListener("click", () => this.invertColors());
    colorSection.appendChild(invertItem);

    const grayscaleItem = document.createElement("div");
    grayscaleItem.className = "menu-item";
    grayscaleItem.textContent = __("Escala de Grises||Grayscale");
    grayscaleItem.addEventListener("click", () => this.grayscale());
    colorSection.appendChild(grayscaleItem);
  }

  createHelpMenu(container) {
    const helpSection = document.createElement("div");
    helpSection.className = "menu-section";
    container.appendChild(helpSection);

    const aboutItem = document.createElement("div");
    aboutItem.className = "menu-item";
    aboutItem.textContent = __("Acerca de...||About...");
    aboutItem.addEventListener("click", () => this.showAboutDialog());
    helpSection.appendChild(aboutItem);

    const manualItem = document.createElement("div");
    manualItem.className = "menu-item";
    manualItem.textContent = "Manual";
    manualItem.addEventListener("click", () => this.showManualDialog());
    helpSection.appendChild(manualItem);
  }

  showMenuContent(name) {
    // Hide all content
    const contents = this.menuContent.querySelectorAll('div[class^="menu-content-"]');
    contents.forEach(content => {
      content.style.display = "none";
    });

    // Deactivate all tabs
    const tabs = this.menuTabs.querySelectorAll(".menu-tab");
    tabs.forEach(tab => {
      tab.classList.remove("active");
    });

    // Show selected content
    const content = this.menuContent.querySelector(`.menu-content-${name.toLowerCase()}`);
    if (content) {
      content.style.display = "block";
    }

    // Activate selected tab
    const tab = Array.from(tabs).find(t => t.name === name);
    if (tab) {
      tab.classList.add("active");
    }
  }

  toggleMenu() {
    this.menuPanelOverlay.classList.toggle("visible");
  }

  togglePanel(panel) {
    if (panel === "animation") {
      this.animationPanel.classList.toggle("visible");
      this.animationButton.classList.toggle("active");
      this.layersPanel.classList.remove("visible");
      this.layersButton.classList.remove("active");
      this.adjustTimelinePosition();
      this.gridManager.hide();
      this.menuPanelOverlay.classList.remove("visible");
    } else if (panel === "layers") {
      this.layersPanel.classList.toggle("visible");
      this.layersButton.classList.toggle("active");
      this.animationPanel.classList.remove("visible");
      this.animationButton.classList.remove("active");
      this.menuPanelOverlay.classList.remove("visible");
      this.gridManager.hide();
    }
  }

  togglePreview() {
    this.showMiniView = !this.showMiniView;
    this.animationPreview.classList.toggle("visible");
  }

  shouldBlockInput() {
    // Block touch if some panels are visible
    if (this.menuPanelOverlay.classList.contains("visible")) {
      this.toggleMenu();
      return true;
    } else if (this.layersPanel.classList.contains("visible")) {
      this.togglePanel("layers");
      return true;
    }
     
    // Otherwise don't block
    return false;
  }

  handleMouseDown(e) {
    if (this.shouldBlockInput()) return; // Hide menus if visible

    const pos = this.getCanvasPosition(e.clientX, e.clientY);
    if (!pos) return;

    switch(e.button) {
      case 0: // Left click
        this.isDrawing = true;
        this.startX = pos.x;
        this.startY = pos.y;
    
        if (this.currentTool && this.currentTool.onDown) {
          this.currentTool.onDown(pos.x, pos.y);
        }
        break;
      case 1: // Middle click
        if (this.isDrawing) {
          this.handleMouseUp(e);
        }
        this.startPan(e);
        break;
      case 2: // Right click
        this.onMouseUp(e);
        // TODO: Context menu
        break;
    }
  }

  handleMouseMove(e) {
    const pos = this.getCanvasPosition(e.clientX, e.clientY);
    if (!pos) return;
    
    if (this.isDrawing && this.currentTool && this.currentTool.onMove) {
      this.currentTool.onMove(pos.x, pos.y);
    }
    
    if (this.isPanning) {
      this.pan(e.clientX, e.clientY);
    }

    e.preventDefault();
  }

  handleMouseUp(e) {
    this.isPanning = false;
    
    if (!this.isDrawing) return;

    const pos = this.getCanvasPosition(e.clientX, e.clientY);
    if (pos && this.currentTool && this.currentTool.onUp) {
      this.currentTool.onUp(pos.x, pos.y, this.startX, this.startY);
    }
    
    this.canvas.style.cursor = this.currentTool ? this.currentTool.cursor : "crosshair";

    this.isDrawing = false;
  }
  
  handleMouseWheel(e) {
    if (e && e.deltaY != 0) {
      if (e.deltaY < 0) {
        this.zoom(1.2, e.clientX, e.clientY);
      } else {
        this.zoom(0.8, e.clientX, e.clientY);
      }
      this.cancelDrawing();
    }
  }
  
  handleTouchStart(e) {
    if (this.shouldBlockInput()) return;
    if (this.isColorPicking) {
      e.preventDefault();
      return;
    }
  
    e.preventDefault();
  
    if (e.touches.length === 1) {
      // Single touch - potential drawing
      const touch = e.touches[0];
      const pos = this.getCanvasPosition(touch.clientX, touch.clientY);
      if (!pos) return;
  
      // Store touch start info
      this._touchStartTime = Date.now();
      this._touchStartPos = { x: touch.clientX, y: touch.clientY };
      this._touchStartCanvasPos = { x: pos.x, y: pos.y };
      this._isPotentialTap = true;
      
      // Don't start drawing immediately - wait to see if it's a pan
      this._touchTimer = setTimeout(() => {
        if (!this.isCanvasResizing && !this.isPanning && this._isPotentialTap) {
          this.isDrawing = true;
          this.startX = pos.x;
          this.startY = pos.y;
          this.lastX = pos.x;
          this.lastY = pos.y;
  
          if (this.currentTool && this.currentTool.onDown) {
            this.currentTool.onDown(pos.x, pos.y);
          }
        }
        this._touchTimer = null;
      }, 50);
    } else if (e.touches.length === 2) {
      this.cancelDrawing();
            
      // Two fingers - pan and zoom
      this.isPanning = true;
      this.isDrawing = false;
      
      // Clear any pending drawing timer
      if (this._touchTimer) {
        clearTimeout(this._touchTimer);
        this._touchTimer = null;
      }
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
  
      // Store initial touch positions
      this.touchStart1 = { x: touch1.clientX, y: touch1.clientY };
      this.touchStart2 = { x: touch2.clientX, y: touch2.clientY };
  
      // Calculate initial distance and center
      this.touchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
  
      this.touchCenterX = (touch1.clientX + touch2.clientX) / 2;
      this.touchCenterY = (touch1.clientY + touch2.clientY) / 2;
  
      // Store current transform
      this.touchStartScale = this.scale;
      this.touchStartPosX = this.posX;
      this.touchStartPosY = this.posY;
      this.startPan({ clientX: this.touchCenterX, clientY: this.touchCenterY });
  
      // Get the canvas point under the center using fixed precision
      const canvasPoint = this.getCanvasPosition(this.touchCenterX, this.touchCenterY);
      
      if (canvasPoint) {
        this.touchCenterCanvasX = canvasPoint.x;
        this.touchCenterCanvasY = canvasPoint.y;
      }
    } else if (e.touches.length === 3) {
      // Three fingers - brush size adjustment
      e.preventDefault();
      
      // Get all three touch points
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const touch3 = e.touches[2];
  
      // Calculate the average position of all three touches (center point)
      const centerX = (touch1.clientX + touch2.clientX + touch3.clientX) / 3;
      const centerY = (touch1.clientY + touch2.clientY + touch3.clientY) / 3;
  
      // Calculate distances from center to each touch
      const dist1 = Math.hypot(touch1.clientX - centerX, touch1.clientY - centerY);
      const dist2 = Math.hypot(touch2.clientX - centerX, touch2.clientY - centerY);
      const dist3 = Math.hypot(touch3.clientX - centerX, touch3.clientY - centerY);
  
      // Average the distances to get a stable spread value
      const currentSpread = (dist1 + dist2 + dist3) / 3;
  
      // Store initial values
      this.initialBrushSpread = currentSpread;
      this.initialBrushSize = this.brushSize;
      this.isBrushResizing = true;
      this.brushResizingCenter = { x: centerX, y: centerY };
  
      // Show brush size indicator
      this.brushSizeIndicator.style.display = "block";
      this.updateBrushSizeIndicator();
      
      // Cancel any pending drawing
      if (this._touchTimer) {
        clearTimeout(this._touchTimer);
        this._touchTimer = null;
      }
      this.isDrawing = false;
    }
  }
  
  handleTouchMove(e) {
    e.preventDefault();
  
    if (e.touches.length === 1 && this.isDrawing) {
      // Drawing with single finger
      const touch = e.touches[0];
      
      // Check if this is still a tap (minimal movement)
      if (this._isPotentialTap) {
        const moveDistance = Math.hypot(
          touch.clientX - this._touchStartPos.x,
          touch.clientY - this._touchStartPos.y
        );
        if (moveDistance > 5) {
          this._isPotentialTap = false;
        }
      }
      
      const pos = this.getCanvasPosition(touch.clientX, touch.clientY);
      if (!pos) return;
  
      if (this.currentTool && this.currentTool.onMove) {
        this.currentTool.onMove(pos.x, pos.y);
        this.lastX = pos.x;
        this.lastY = pos.y;
      }
      
    } else if (e.touches.length === 2 && this.isPanning) {
      // Two-finger pan and zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
  
      // Calculate new distance and center
      const newDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
  
      const newCenterX = (touch1.clientX + touch2.clientX) / 2;
      const newCenterY = (touch1.clientY + touch2.clientY) / 2;
  
      // Calculate zoom factor with minimum change threshold to reduce flicker
      if (this.touchDistance > 0 && Math.abs(newDistance - this.touchDistance) > 1) {
        const zoomFactor = newDistance / this.touchDistance;
        
        this.pan(newCenterX, newCenterY, zoomFactor);
      } else {
        this.pan(newCenterX, newCenterY, 1);
      }
    } else if (e.touches.length === 3 && this.isBrushResizing) {
      // Three-finger brush size adjustment
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const touch3 = e.touches[2];
  
      // Calculate current center point
      const centerX = (touch1.clientX + touch2.clientX + touch3.clientX) / 3;
      const centerY = (touch1.clientY + touch2.clientY + touch3.clientY) / 3;
  
      // Calculate current spread (average distance from center)
      const dist1 = Math.hypot(touch1.clientX - centerX, touch1.clientY - centerY);
      const dist2 = Math.hypot(touch2.clientX - centerX, touch2.clientY - centerY);
      const dist3 = Math.hypot(touch3.clientX - centerX, touch3.clientY - centerY);
      const currentSpread = (dist1 + dist2 + dist3) / 3;
  
      // Only update if spread changed significantly to avoid jitter
      if (Math.abs(currentSpread - this.initialBrushSpread) > 0.001) {
        // Calculate scale factor based on spread change
        const scaleFactor = currentSpread / this.initialBrushSpread;
        
        // Calculate new brush size
        let newSize = Math.round(this.initialBrushSize * scaleFactor);
        
        // Constrain to min/max
        newSize = Math.max(this.minBrushSize, Math.min(newSize, this.maxBrushSize));
        
        // Update if changed
        if (newSize !== this.brushSize) {
          this.brushSize = newSize;
          this.updateBrushSizeIndicator();
          localStorage.setItem("brushSize", this.brushSize);
        }
      }
    }
  }
  
  handleTouchEnd(e) {
    e.preventDefault();
  
    // Clear any pending timer
    if (this._touchTimer) {
      clearTimeout(this._touchTimer);
      this._touchTimer = null;
    }
  
    if (e.touches.length === 0) {
      // All touches ended
      if (this.isDrawing) {
        const wasTap = this._isPotentialTap && (Date.now() - this._touchStartTime < 300);
  
        if (this.currentTool && this.currentTool.onUp) {
          this.currentTool.onUp(this.lastX, this.lastY, this.startX, this.startY);
        }
        
        this.canvas.style.cursor = this.currentTool ? this.currentTool.cursor : "crosshair";
      }
  
      // Reset all states
      this.isPanning = false;
      this.isDrawing = false;
      this._isPotentialTap = false;
      this.touchDistance = 0;
  
      // Hide brush size indicator after delay
      if (this.isBrushResizing) {
        setTimeout(() => {
          this.brushSizeIndicator.style.display = "none";
        }, 2000);
      }
      
    } else if (e.touches.length === 1) {
      // One finger remaining - prepare for drawing
      this.touchDistance = 0;
      this._isPotentialTap = true;
      
      // Store new touch start position
      const touch = e.touches[0];
      this._touchStartPos = { x: touch.clientX, y: touch.clientY };
      this._touchStartTime = Date.now();
    } else if (e.touches.length === 2) {
      // Two fingers remaining, prevent zooming and drawing
      
      this.isPanning = false;
      this.isDrawing = false;
    }
  }

  handleTouchCancel(e) {
    if (this.isColorPicking || this.colorPickTimeout) {
      this.cleanupColorPicking();
    }
  }

  handleKeyDown(e) {
    const { ctrlKey, key } = event;
    
    // Handle system keyboard shortcuts
    if (ctrlKey) {
      if (key == "z") {
        this.undo();
        e.preventDefault();
        return;
      } else if (key == "y") {
        this.undo();
        e.preventDefault();
        return;
      } else if (key == "a") {
        this.togglePanel("animation");
        e.preventDefault();
        return;
      } else if (key == "l") {
        this.togglePanel("layers");
        e.preventDefault();
        return;
      } else if (key == " ") {
        this.switchLastTool();
        e.preventDefault();
        return;
      } else if (key == "Escape") {
        this.toggleMenu();
        e.preventDefault();
        return;
      }
    }
    
    // Handle tool keyboard shortcuts
    for (const tool of Object.values(this.tools)) {
      if (tool.shortcut && tool.shortcut == e.key) {
        this.setTool(tool.name);
        return;
      }
    };
  }

  handleResize() {
    this.updateCanvasTransform();
    this.adjustTimelinePosition();
  }

  adjustTimelinePosition() {
    if (!this.animationPanel) return;

    // Ensure timeline stays above bottom bar
    const bottomBarHeight = this.bottomBar.offsetHeight;
    this.animationPanel.style.bottom = `${bottomBarHeight}px`;
  }

  getCanvasPosition(clientX, clientY, ensureBounds = true) {
    if (!this.project) return null;
  
    // Get container position and dimensions
    const rect = this.canvasContainer.getBoundingClientRect();
    
    // Convert to container coordinates (0,0 at container top-left)
    const containerX = clientX - rect.left;
    const containerY = clientY - rect.top;
  
    // Convert to viewport coordinates (0,0 at canvas center)
    const viewportX = containerX - rect.width / 2;
    const viewportY = containerY - rect.height / 2;
  
    // Apply inverse transform to get canvas coordinates
    // First subtract position offset
    const worldX = viewportX - this.posX;
    const worldY = viewportY - this.posY;
  
    // Then divide by scale and add canvas center
    const canvasX = Math.floor(worldX / this.scale + this.project.width / 2);
    const canvasY = Math.floor(worldY / this.scale + this.project.height / 2);
  
    // Check bounds
    if (ensureBounds) {
      if (canvasX < 0 || canvasX >= this.project.width || 
          canvasY < 0 || canvasY >= this.project.height) {
        return null;
      }
    }
  
    return { x: canvasX, y: canvasY };
  }
  
  checkBounds(x, y) {
    return x >= 0 && x < this.project.width && y >= 0 && y < this.project.height;
  }
  
  startPan(e) {
    this.isPanning = true;
    this.canvasContainer.style.cursor = "grab";
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panStartCanvasPoint = this.getCanvasPosition(e.clientX, e.clientY);
    this.panStartScale = this.scale;
  }
  
  pan(clientX, clientY, zoomFactor = 1) {
    if (!this.panStartCanvasPoint) return;
    
    const newScale = this.panStartScale * zoomFactor;
        
    // Clamp scale
    this.scale = Math.max(this.minScale, Math.min(newScale, this.maxScale));
        
    // Get container dimensions
    const rect = this.canvasContainer.getBoundingClientRect();
        
    // Calculate where th point should be in canvas coordinates
    const canvasX = this.panStartCanvasPoint.x;
    const canvasY = this.panStartCanvasPoint.y;
        
    // Calculate where this canvas point should be on screen at new scale
    // Formula: screenX = (canvasX - width/2) * scale + containerWidth/2 + posX
    const targetScreenX = (canvasX - this.project.width / 2) * this.scale + rect.width / 2 + this.panStartCanvasPoint.x;
    const targetScreenY = (canvasY - this.project.height / 2) * this.scale + rect.height / 2 + this.panStartCanvasPoint.y;
        
    // Calculate the offset needed to keep the canvas point under the new center
    const deltaX = clientX - targetScreenX;
    const deltaY = clientY - targetScreenY;
        
    // Update position with rounding to reduce subpixel flicker
    this.posX = Math.round(this.panStartCanvasPoint.x + deltaX);
    this.posY = Math.round(this.panStartCanvasPoint.y + deltaY);
    
    this.updateCanvasTransform();
  }

  zoom(factor, clientX = this.panStartCanvasPoint.x, clientY = this.panStartCanvasPoint.y) {
    const oldScale = this.scale;
    this.scale *= factor;

    // Limit zoom
    this.scale = Math.max(this.minScale, Math.min(this.scale, this.maxScale));

    if (clientX !== undefined && clientY !== undefined) {
      // Get container position
      const rect = this.canvasContainer.getBoundingClientRect();
      const containerX = clientX - rect.left;
      const containerY = clientY - rect.top;

      // Calculate mouse position relative to center
      const mouseX = containerX - this.canvasContainer.clientWidth / 2;
      const mouseY = containerY - this.canvasContainer.clientHeight / 2;

      // Adjust position to zoom toward mouse
      this.posX = mouseX - (mouseX - this.posX) * (this.scale / oldScale);
      this.posY = mouseY - (mouseY - this.posY) * (this.scale / oldScale);
    }

    this.updateCanvasTransform();
  }

  resetZoom() {
    if (!this.project) return;

    // Calculate scale to fit canvas to container
    const containerWidth = this.canvasContainer.clientWidth;
    const containerHeight = this.canvasContainer.clientHeight;

    const scaleX = containerWidth / this.project.width;
    const scaleY = containerHeight / this.project.height;
    this.scale = Math.min(scaleX, scaleY);

    this.scale = Math.min(this.scale, 10);

    // Reset position
    this.posX = 0;
    this.posY = 0;

    this.updateCanvasTransform();
  }

  updateCanvasTransform() {
    if (!this.project) return;

    // Get container dimensions
    const containerWidth = this.canvasContainer.clientWidth;
    const containerHeight = this.canvasContainer.clientHeight;

    // Calculate the canvas center in its own coordinate space
    const center = {
      x: this.project.width / 2,
      y: this.project.height / 2
    };
    
    // Apply the transform to the wrapper
    this.canvasWrapper.style.transform = `
      translate(${this.posX}px, ${this.posY}px)
      translate(${- center.x * this.scale}px, ${- center.y * this.scale}px)
      scale(${this.scale})
    `;
    
    // Reverse the scale on background size so it appears constant
    // Base size is 16px, but we need to divide by scale to counteract the transform
    const baseSize = 32;
    const bgSize = Math.min(4, baseSize / this.scale);
    
    // Update canvas background style
    this.canvas.style.backgroundSize = `${bgSize}px ${bgSize}px`;
  }
  
  // Project management
  newProject(width = this.defaultWidth, height = this.defaultHeight, imageData = null) {
    this.project = this.getNewProjectData(width, height, imageData);

    this.saveLastProjectSize();
    
    this.historyManager.clear();
    
    if (this.usePerProjectFloatingColors) {
      this.colorPicker.removeAllFloatingPaletteColors();
    }

    this.animationPanel.classList.remove("visible");
    this.layersPanel.classList.remove("visible");

    this.resetCanvasSize();
    this.resetZoom();
    this.render();
  }
  
  saveLastProjectSize() {
    localStorage.setItem("lastProjectWidth", this.project.width);
    localStorage.setItem("lastProjectHeight", this.project.height);
  }
  
  getNewProjectData(width, height, img) {
    const project =  {
      width: width,
      height: height,
      frames: [
        {
          layers: [this.createBlankLayer(width, height, __("Capa Base||Default Layer"))]
        }
      ],
      currentFrameTime: 1000 / 12,
      frameTimes: [1000 / 12],
      floatingColors: [],
      currentFrame: 0,
      currentLayer: 0
    };
    
    if (img) {
      const layer = project.frames[0].layers[0];
      layer.ctx.drawImage(img, 0, 0);
    }
    
    return project;
  }

  resetCanvasSize() {
    if (!this.project) return;

    this.canvas.width = this.project.width;
    this.canvas.height = this.project.height;
  }
  
  startResizeCanvas() {
    if (!this.project) return;
    
    this.isCanvasResizing = true;
    
    // Initialize resize state
    this.canvasResizeState = {
      x: 0,
      y: 0,
      width: this.project.width,
      height: this.project.height
    };
    
    // Show controls
    this.showCanvasResizeControls();
    this.enterImmersive();
    
    // Show bottom confirmation
    this.showBottomConfirmation(
      __('Aceptar||Accept'),
      __('Cancelar||Cancel'),
      (accepted) => {
        if (accepted) {
          this.finishResizeCanvas();
        } else {
          this.cancelResizeCanvas();
        }
      }
    );
    
    // Setup event handlers
    this.setupResizeEventHandlers();
  }
  
  setupResizeEventHandlers() {
    if (this.resizeHandlersSetup) return;
    
    // Set cursors
    this.canvasResizeX.style.cursor = 'ew-resize';
    this.canvasResizeY.style.cursor = 'ns-resize';
    this.canvasResizeWidth.style.cursor = 'ew-resize';
    this.canvasResizeHeight.style.cursor = 'ns-resize';
    
    const handleResizeStart = (e, edge) => {
      if (!this.isCanvasResizing) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Get position in canvas coordinates (project space)
      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
      
      const pos = this.getCanvasPosition(clientX, clientY, false);
      if (!pos) return;
      
      this.resizeDragState = {
        active: true,
        edge: edge,
        startCanvasX: pos.x,
        startCanvasY: pos.y,
        startState: { ...this.canvasResizeState }
      };
      
      // Add global handlers
      document.addEventListener('mousemove', this.handleResizeMove);
      document.addEventListener('mouseup', this.handleResizeEnd);
      document.addEventListener('touchmove', this.handleResizeMove, { passive: false });
      document.addEventListener('touchend', this.handleResizeEnd);
      document.addEventListener('touchcancel', this.handleResizeEnd);
    };
    
    const handleResizeMove = (e) => {
      if (!this.resizeDragState?.active) return;
      
      e.preventDefault();
      
      // Get current position in canvas coordinates
      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
      
      const pos = this.getCanvasPosition(clientX, clientY, false);
      if (!pos) return;
      
      const edge = this.resizeDragState.edge;
      const start = this.resizeDragState.startState;
      let needsUpdate = false;
      
      switch(edge) {
        case 'x': // Left edge - only X changes
          {
            const newX = Math.round(pos.x);
            if (newX !== this.canvasResizeState.x) {
              this.canvasResizeState.x = newX;
              this.canvasResizeState.width = start.width + (start.x - newX);
              needsUpdate = true;
            }
            break;
          }
        case 'y': // Top edge - only Y changes
          {
            const newY = Math.round(pos.y);
            if (newY !== this.canvasResizeState.y) {
              this.canvasResizeState.y = newY;
              this.canvasResizeState.height = start.height + (start.y - newY);
              needsUpdate = true;
            }
            break;
          }
        case 'width': // Right edge - only width changes
          {
            const newWidth = Math.round(pos.x - start.x);
            if (newWidth !== this.canvasResizeState.width) {
              this.canvasResizeState.width = Math.max(1, newWidth);
              needsUpdate = true;
            }
            break;
          }
        case 'height': // Bottom edge - only height changes
          {
            const newHeight = Math.round(pos.y - start.y);
            if (newHeight !== this.canvasResizeState.height) {
              this.canvasResizeState.height = Math.max(1, newHeight);
              needsUpdate = true;
            }
            break;
          }
      }
      
      // Ensure width/height don't go negative
      if (this.canvasResizeState.width < 1) this.canvasResizeState.width = 1;
      if (this.canvasResizeState.height < 1) this.canvasResizeState.height = 1;
      
      if (needsUpdate) {
        this.updateCanvasResizeControls();
      }
    };
    
    const handleResizeEnd = () => {
      this.resizeDragState = null;
      document.removeEventListener('mousemove', this.handleResizeMove);
      document.removeEventListener('mouseup', this.handleResizeEnd);
      document.removeEventListener('touchmove', this.handleResizeMove);
      document.removeEventListener('touchend', this.handleResizeEnd);
      document.removeEventListener('touchcancel', this.handleResizeEnd);
    };
    
    // Bind methods
    this.handleResizeMove = handleResizeMove.bind(this);
    this.handleResizeEnd = handleResizeEnd.bind(this);
    
    // Add event listeners
    this.canvasResizeX.addEventListener('mousedown', (e) => handleResizeStart(e, 'x'));
    this.canvasResizeX.addEventListener('touchstart', (e) => handleResizeStart(e, 'x'), { passive: false });
    
    this.canvasResizeY.addEventListener('mousedown', (e) => handleResizeStart(e, 'y'));
    this.canvasResizeY.addEventListener('touchstart', (e) => handleResizeStart(e, 'y'), { passive: false });
    
    this.canvasResizeWidth.addEventListener('mousedown', (e) => handleResizeStart(e, 'width'));
    this.canvasResizeWidth.addEventListener('touchstart', (e) => handleResizeStart(e, 'width'), { passive: false });
    
    this.canvasResizeHeight.addEventListener('mousedown', (e) => handleResizeStart(e, 'height'));
    this.canvasResizeHeight.addEventListener('touchstart', (e) => handleResizeStart(e, 'height'), { passive: false });
    
    this.resizeHandlersSetup = true;
  }  

  showCanvasResizeControls() {
    this.canvasResizeControls.style.display = 'block';
    this.updateCanvasResizeControls();
  }
  
  updateCanvasResizeControls() {
    if (!this.canvasResizeState) return;
    
    const state = this.canvasResizeState;
    
    // Position the container
    this.canvasResizeControls.style.left = `${state.x}px`;
    this.canvasResizeControls.style.top = `${state.y}px`;
    this.canvasResizeControls.style.width = `${state.width}px`;
    this.canvasResizeControls.style.height = `${state.height}px`;
    
    // Position edges
    this.canvasResizeX.style.left = `-1px`;
    this.canvasResizeX.style.height = `${state.height}px`;
    
    this.canvasResizeY.style.top = `-1px`;
    this.canvasResizeY.style.width = `${state.width}px`;
    
    this.canvasResizeWidth.style.left = `${state.width}px`;
    this.canvasResizeWidth.style.height = `${state.height}px`;
    
    this.canvasResizeHeight.style.top = `${state.height}px`;
    this.canvasResizeHeight.style.width = `${state.width}px`;
  }
  
  hideCanvasResizeControls() {
    this.canvasResizeControls.style.display = "none";
  }
  
  finishResizeCanvas() {
    if (!this.canvasResizeState) return;
    
    const state = this.canvasResizeState;
    
    // Handle negative dimensions
    const cropX = state.width < 0 ? state.x + state.width : state.x;
    const cropY = state.height < 0 ? state.y + state.height : state.y;
    const cropWidth = Math.abs(state.width);
    const cropHeight = Math.abs(state.height);
    
    // Start history batch
    this.historyManager.startBatch('resize', __('Redimensionar Canvas||Resize Canvas'));
    
    const oldWidth = this.project.width;
    const oldHeight = this.project.height;
    
    // Store all layers image data before resize
    const framesData = [];
    this.project.frames.forEach(frame => {
      const frameData = {
        layers: []
      };
      frame.layers.forEach(layer => {
        const imageData = layer.ctx.getImageData(0, 0, oldWidth, oldHeight);
        frameData.layers.push({
          imageData: Array.from(imageData.data)
        });
      });
      framesData.push(frameData);
    });
    
    // Perform resize
    this.resizeCanvas(cropX, cropY, cropWidth, cropHeight);
    
    // Record operation with full layer data
    const operation = {
      type: 'resize_canvas',
      description: __('Redimensionar Canvas||Resize Canvas'),
      oldWidth: oldWidth,
      oldHeight: oldHeight,
      newWidth: cropWidth,
      newHeight: cropHeight,
      cropX: cropX,
      cropY: cropY,
      framesData: framesData // Store all layer data for undo
    };
    
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
    
    this.stopResizeCanvas();
  }  
  
  cancelResizeCanvas() {
    this.stopResizeCanvas();
    this.showToast(__('Redimensión cancelada||Resize cancelled'));
  }
  
  stopResizeCanvas() {
    this.isCanvasResizing = false;
    this.canvasResizeState = null;
    this.resizeDragState = null;
    
    this.hideCanvasResizeControls();
    this.hideBottomConfirmation();
    this.exitImmersive();
  }
  
  resizeCanvas(x = 0, y = 0, width = 32, height = 32, silent) {
    if (!this.project) return;
    
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    x = Math.floor(x);
    y = Math.floor(y);
    
    this.project.width = width;
    this.project.height = height;
    this.resetCanvasSize();
    
    this.project.frames.forEach(frame => {
      frame.layers.forEach(layer => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(layer.canvas, -x, -y);
        
        layer.canvas.width = width;
        layer.canvas.height = height;
        layer.ctx.clearRect(0, 0, width, height);
        layer.ctx.drawImage(tempCanvas, 0, 0);
      });
    });
    
    this.updateCanvasTransform();
    this.render();
    
    if (!silent) {
      this.showOperationMessage(__('Canvas redimensionado||Canvas resized'));
    }
  }
  
  enterImmersive() {
    this.topBar.style.display = "none";
    this.bottomBar.style.display = "none";
    this.menuPanelOverlay.style.display = "none";
    this.animationPanel.style.display = "none";
    this.layersPanel.style.display = "none";
    if (this.gridManager) this.gridManager.panel.style.display = "none";
  }
  
  exitImmersive() {
    this.topBar.style.display = "flex";
    this.bottomBar.style.display = "flex";
    this.menuPanelOverlay.style.display = "flex";
    this.animationPanel.style.display = "flex";
    this.layersPanel.style.display = "flex";
    if (this.gridManager) this.gridManager.panel.style.display = "flex";
  }

  showBottomConfirmation(acceptText, cancelText, callback) {
    if (!this.bottomConfirmation) {
      this.bottomConfirmation = document.createElement('div');
      this.bottomConfirmation.className = 'bottom-confirmation';
      
      this.confirmAccept = document.createElement('button');
      this.confirmAccept.className = 'ui-button confirm-accept';
      
      this.confirmCancel = document.createElement('button');
      this.confirmCancel.className = 'ui-button confirm-cancel';
      
      this.bottomConfirmation.appendChild(this.confirmAccept);
      this.bottomConfirmation.appendChild(this.confirmCancel);
      this.uiLayer.appendChild(this.bottomConfirmation);
    }
    
    this.confirmAccept.textContent = acceptText;
    this.confirmCancel.textContent = cancelText;
    this.resizeCallback = callback;
    this.bottomConfirmation.style.display = 'flex';
    
    this.confirmAccept.removeEventListener('click', this.handleResizeAccept);
    this.confirmCancel.removeEventListener('click', this.handleResizeCancel);
    
    this.handleResizeAccept = () => {
      if (this.resizeCallback) this.resizeCallback(true);
      this.hideBottomConfirmation();
    };
    
    this.handleResizeCancel = () => {
      if (this.resizeCallback) this.resizeCallback(false);
      this.hideBottomConfirmation();
    };
    
    this.confirmAccept.addEventListener('click', this.handleResizeAccept);
    this.confirmCancel.addEventListener('click', this.handleResizeCancel);
  }
  
  hideBottomConfirmation() {
    if (this.bottomConfirmation) {
      this.bottomConfirmation.style.display = 'none';
    }
  }

  render() {
    if (!this.project) return;

    const frame = this.project.frames[this.project.currentFrame];
    if (!frame) return;


    // Draw background if not transparent
    if (!this.transparentBackground) {
      this.ctx.fillStyle = this.secondaryColor;
      this.ctx.fillRect(0, 0, this.project.width, this.project.height);
    } else {
      this.ctx.clearRect(0, 0, this.project.width, this.project.height);
    }
    
    // Draw trace reference (bottom layer)
    if (this.referenceManager) {
      this.referenceManager.renderBottom(this.ctx, this.project.width, this.project.height);
    }
  
    // Draw layers
    for (let i = 0; i < frame.layers.length; i++) {
      const layer = frame.layers[i];
      if (layer.visible) {
        this.ctx.drawImage(layer.canvas, 0, 0);
      }
    }
      
    // Draw trace reference (top layer)
    if (this.referenceManager) {
      this.referenceManager.renderTop(this.ctx, this.project.width, this.project.height);
    }
    
    //  UI
    this.updateFramesUI();
    this.updateLayersUI();
    this.updateAnimationPreview();
  }
  
  renderQuick() {
    if (!this.project) return;

    const frame = this.project.frames[this.project.currentFrame];
    if (!frame) return;


    // Draw background if not transparent
    if (!this.transparentBackground) {
      this.ctx.fillStyle = this.secondaryColor;
      this.ctx.fillRect(0, 0, this.project.width, this.project.height);
    } else {
      this.ctx.clearRect(0, 0, this.project.width, this.project.height);
    }
    
    // Draw layers
    for (let i = 0; i < frame.layers.length; i++) {
      const layer = frame.layers[i];
      if (layer.visible) {
        this.ctx.drawImage(layer.canvas, 0, 0);
      }
    }

    //  UI
    this.updateAnimationPreview();
    this.updateFramesUIQuick();
  }

  getProjectSnapshot() {
    if (!this.project) return null;

    // Create a deep clone of the project
    const snapshot = JSON.parse(JSON.stringify(this.project));

    // Clone canvas data for each layer
    for (let f = 0; f < snapshot.frames.length; f++) {
      const frame = snapshot.frames[f];
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];
        
        // Remove useless canvas property
        delete layer.canvas;
        
        const originalLayer = this.project.frames[f].layers[l];

        // Store canvas data as image data
        const ctx = originalLayer.ctx;
        layer.imageData = ctx.getImageData(0, 0, this.project.width, this.project.height);
      }
    }

    return snapshot;
  }

  restoreProjectSnapshot(snapshot) {
    if (!snapshot) return;

    // Restore basic properties
    this.project.currentFrame = snapshot.currentFrame;
    this.project.currentLayer = snapshot.currentLayer;
    this.project.currentFrameTime = snapshot.currentFrameTime;
    this.project.frameTimes = snapshot.frameTimes;
    this.project.width = snapshot.width;
    this.project.height = snapshot.height;

    // Restore canvas data for each layer
    for (let f = 0; f < this.project.frames.length; f++) {
      const frame = this.project.frames[f];
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];
        const snapshotLayer = snapshot.frames[f].layers[l];
        const existingCanvas = snapshotLayer.canvas;

        // Recreate canvas
        if (existingCanvas) {
          layer.canvas = existingCanvas;
        } else {
          layer.canvas = document.createElement("canvas");
        }
        layer.canvas.width = this.project.width;
        layer.canvas.height = this.project.height;

        // Restore image data
        if (snapshotLayer.imageData) {
          layer.ctx.putImageData(snapshotLayer.imageData, 0, 0);
        }
      }
    }

    this.resetCanvasSize();
    this.render();
  }

  saveToHistory() {
    // End any current batch
    this.historyManager.endBatch();
    
    // Update
    this.render();
  }
  
  recordDrawOperation(pixels) {
    const operation = {
      type: 'draw',
      description: 'Draw pixels',
      frameIndex: this.project.currentFrame,
      layerIndex: this.project.currentLayer,
      pixels: pixels
    };
    
    this.historyManager.addChange(operation);
  }
  
  undo() {
    const undid = this.historyManager.undo()

    if (undid) {
      this.render();
      this.showOperationMessage(undid.message);
    }
  }

  redo() {
    const redid = this.historyManager.redo();
    if (redid) {
      this.render();
      this.showOperationMessage(redid.message);
    }
  }
  
  cancelDrawing() {
    if (this.isDrawing) {
      this.historyManager.endBatch();
      this.historyManager.undo();
    }
  }

  // Reference image methods
  loadReferenceImage() {
    this.referenceManager.showReferenceTypeDialog();
  }

  // Drawing Operations
  drawPixel(x, y, options = {}) {
    if (!this.project || x < 0 || y < 0 || x >= this.project.width || y >= this.project.height) return;

    const color = options.color || (this.selectedColor === "primary" ? this.primaryColor : this.secondaryColor);
    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;

    // Should use brush?
    const useBrush = true;

    if (useBrush && this.brushSize > 1) {
      // Use brush for larger sizes
      let pixels = this.drawBrushCircle(ctx, x, y, this.brushSize, color)
      if (pixels && pixels.length) {
        this.recordDrawOperation(pixels.filter(p => p.newColor != p.oldColor));
      }
    } else {
      // Save old pixel color
      const oldColor = this.getPixelColorFromCtx(ctx, x, y);
      
      if (color != oldColor) {
        // Single pixel
        if (color === "transparent") {
          ctx.clearRect(x, y, 1, 1);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
        
        // Add to history
        this.recordDrawOperation([{
          x: x,
          y: y,
          oldColor: oldColor,
          newColor: color
        }]);
      }
    }

    this.render();
  }

  drawBrushCircle(ctx, centerX, centerY, radius, color) {
    if (radius <= 0) return [];

    // Use midpoint circle algorithm for pixel-perfect circles
    return this.midpointEllipse(ctx, centerX, centerY, radius / 2, radius / 2, color, true);
  }

  startLine(x, y, color) {
    this.tempLine = { startX: x, startY: y };
    this.getTempCanvas();
    this.tempColor = color ? color : (this.selectedColor === "primary" ? this.primaryColor : this.secondaryColor);
  }

  previewLine(x, y) {
    if (!this.tempLine || !this.project) return;

    // Clear temp canvas
    this.tempCtx.clearRect(0, 0, this.project.width, this.project.height);

    // Should use brush?
    const useBrush = true; // TODO: Get this setting from tool

    // Draw line preview using Bresenham's algorithm
    this.drawBresenhamLine(this.tempLine.startX, this.tempLine.startY, x, y, this.tempCtx, this.tempColor, useBrush);

    // Combine with main canvas
    this.ctx.clearRect(0, 0, this.project.width, this.project.height);
    this.render();
    this.ctx.drawImage(this.tempCanvas, 0, 0);
  }

  finishLine(x, y, record = true) {
    if (!this.tempLine || !this.project) return;

    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;

    // Should use brush?
    const useBrush = true; // TODO: Get this setting from tool

    // Draw final line
    let pixels = this.drawBresenhamLine(this.tempLine.startX, this.tempLine.startY, x, y, ctx, this.tempColor, useBrush);
    
    // Only saved pixels that really changed
    pixels = pixels.filter(p => p.newColor != p.oldColor);
    
    this.recordDrawOperation(pixels);

    // Clean up
    this.tempLine = null;
    this.tempCanvas = null;
    this.tempCtx = null;

    this.render();
  }

  drawBresenhamLine(x0, y0, x1, y1, ctx, color, useBrush) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let e2;
    
    let linePixels = [];
    let lineStrokePixels = [];

    while (true) {
      if (color === "transparent") {
        if (useBrush && this.brushSize > 1) {
          const radius = this.brushSize / 2;
          lineStrokePixels = [...lineStrokePixels, ...this.midpointEllipse(ctx, x0, y0, radius, radius, "transparent", true)];
        } else {
          const oldColor = this.getPixelColorFromCtx(ctx, x0, y0);
          ctx.clearRect(x0, y0, 1, 1);
          linePixels.push({
            x: x0,
            y: y0,
            newColor: color,
            oldColor
          });
        }
      } else {
        if (useBrush && this.brushSize > 1) {
          const radius = this.brushSize / 2;
          lineStrokePixels = [...lineStrokePixels, ...this.midpointEllipse(ctx, x0, y0, radius, radius, color, true)];
        } else {
          const oldColor = this.getPixelColorFromCtx(ctx, x0, y0);
          ctx.fillStyle = color;
          ctx.fillRect(x0, y0, 1, 1);
          linePixels.push({
            x: x0,
            y: y0,
            newColor: color,
            oldColor
          });
        }
      }

      if (x0 === x1 && y0 === y1) break;
      e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    
    return [...linePixels, ...lineStrokePixels];
  }

  startRect(x, y) {
    this.tempRect = {
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    };
    this.getTempCanvas();
  }

  previewRect(x, y) {
    if (!this.tempRect || !this.project) return;

    // Clear temp canvas
    this.tempCtx.clearRect(0, 0, this.project.width, this.project.height);

    // Calculate rectangle dimensions
    let width = x - this.tempRect.startX;
    let height = y - this.tempRect.startY;

    // Handle perfect rectangle setting
    if (this.currentTool.settings?.perfect?.value) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width < 0 ? -size : size;
      height = height < 0 ? -size : size;
    }

    // Store current position
    this.tempRect.currentX = this.tempRect.startX + width;
    this.tempRect.currentY = this.tempRect.startY + height;

    // Draw rectangle preview using lines
    const color = this.selectedColor === "primary" ? this.primaryColor : this.secondaryColor;
    this.tempCtx.strokeStyle = color;
    this.tempCtx.lineWidth = 1;

    // Should use brush?
    const useBrush = true; // TODO: Get this setting from tool

    if (this.currentTool.settings?.filled?.value) {
      this.tempCtx.fillStyle = color;
      this.tempCtx.fillRect(this.tempRect.startX, this.tempRect.startY, width + 1, height + 1);
    } else {
      // Draw four lines to form a rectangle
      this.drawBresenhamLine(this.tempRect.startX, this.tempRect.startY, this.tempRect.startX + width, this.tempRect.startY, this.tempCtx, color, useBrush);
      this.drawBresenhamLine(this.tempRect.startX + width, this.tempRect.startY, this.tempRect.startX + width, this.tempRect.startY + height, this.tempCtx, color, useBrush);
      this.drawBresenhamLine(this.tempRect.startX + width, this.tempRect.startY + height, this.tempRect.startX, this.tempRect.startY + height, this.tempCtx, color, useBrush);
      this.drawBresenhamLine(this.tempRect.startX, this.tempRect.startY + height, this.tempRect.startX, this.tempRect.startY, this.tempCtx, color, useBrush);
    }

    // Combine with main canvas
    this.ctx.clearRect(0, 0, this.project.width, this.project.height);
    this.render();
    this.ctx.drawImage(this.tempCanvas, 0, 0);
  }

  finishRect(x, y) {
    if (!this.tempRect || !this.project) return;

    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;

    // Calculate rectangle dimensions
    let width = this.tempRect.currentX - this.tempRect.startX ;
    let height = this.tempRect.currentY - this.tempRect.startY;

    // Handle perfect rectangle setting
    if (this.currentTool.settings?.perfect?.value) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width < 0 ? -size : size;
      height = height < 0 ? -size : size;
    }

    // Should use brush?
    const useBrush = true; // TODO: Get this setting from tool

    // Draw final rectangle
    const color = this.selectedColor === "primary" ? this.primaryColor : this.secondaryColor;

    if (this.currentTool.settings?.filled?.value) {
      let pixels = [];
      for (let y = this.tempRect.startY; y <= this.tempRect.startY + height; y++) {
        for (let x = this.tempRect.startX; x <= this.tempRect.startX + width + 1; x++) {
          pixels.push({
            x, y,
            newColor: color,
            oldColor: this.getPixelColorFromCtx(ctx, x, y)
          });
        }
      }
      ctx.fillStyle = color;
      ctx.fillRect(this.tempRect.startX, this.tempRect.startY, width, height);
      this.recordDrawOperation(pixels.filter(p => p.newColor != p.oldColor));
    } else {
      // Draw four lines to form a rectangle
      let pixels = [
        ...this.drawBresenhamLine(this.tempRect.startX, this.tempRect.startY, this.tempRect.startX + width, this.tempRect.startY, ctx, color, useBrush),
        ...this.drawBresenhamLine(this.tempRect.startX + width, this.tempRect.startY, this.tempRect.startX + width, this.tempRect.startY + height, ctx, color, useBrush),
        ...this.drawBresenhamLine(this.tempRect.startX + width, this.tempRect.startY + height, this.tempRect.startX, this.tempRect.startY + height, ctx, color, useBrush),
        ...this.drawBresenhamLine(this.tempRect.startX, this.tempRect.startY + height, this.tempRect.startX, this.tempRect.startY, ctx, color, useBrush)
      ].filter(p => p.newColor != p.oldColor);
      if (pixels.length) {
        this.recordDrawOperation(pixels);
      }
    }

    // Clean up
    this.tempRect = null;
    this.tempCanvas = null;
    this.tempCtx = null;

    this.render();
  }

  startEllipse(x, y) {
    this.tempEllipse = {
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    };
    this.getTempCanvas();
  }

  previewEllipse(x, y) {
    if (!this.tempEllipse || !this.project) return;

    // Clear temp canvas
    this.tempCtx.clearRect(0, 0, this.project.width, this.project.height);

    // Calculate ellipse dimensions - ensure integer values
    let width = Math.floor(x - this.tempEllipse.startX);
    let height = Math.floor(y - this.tempEllipse.startY);

    // Handle perfect ellipse setting
    if (this.currentTool.settings?.perfect?.value) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width < 0 ? -size : size;
      height = height < 0 ? -size : size;
    }

    // Ensure minimum size of 1 pixel
    if (Math.abs(width) < 1) width = width < 0 ? -1 : 1;
    if (Math.abs(height) < 1) height = height < 0 ? -1 : 1;

    // Store current position
    this.tempEllipse.currentX = this.tempEllipse.startX + width;
    this.tempEllipse.currentY = this.tempEllipse.startY + height;

    // Draw ellipse preview
    const color = this.selectedColor === "primary" ? this.primaryColor : this.secondaryColor;

    // Use integer coordinates for preview
    const startX = Math.floor(this.tempEllipse.startX);
    const startY = Math.floor(this.tempEllipse.startY);

    if (this.currentTool.settings?.filled?.value) {
      this.drawFilledEllipse(this.tempCtx, startX, startY, width, height, color);
    } else {
      this.drawEllipse(this.tempCtx, startX, startY, width, height, color);
    }

    // Combine with main canvas
    this.ctx.clearRect(0, 0, this.project.width, this.project.height);
    this.render();
    this.ctx.drawImage(this.tempCanvas, 0, 0);
  }

  finishEllipse(x, y) {
    if (!this.tempEllipse || !this.project) return;

    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;

    // Calculate final dimensions - ensure integer values
    let width = Math.floor(this.tempEllipse.currentX - this.tempEllipse.startX);
    let height = Math.floor(this.tempEllipse.currentY - this.tempEllipse.startY);

    // Handle perfect ellipse setting
    if (this.currentTool.settings?.perfect?.value) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width < 0 ? -size : size;
      height = height < 0 ? -size : size;
    }

    // Ensure minimum size of 1 pixel
    if (Math.abs(width) < 1) width = width < 0 ? -1 : 1;
    if (Math.abs(height) < 1) height = height < 0 ? -1 : 1;

    // Draw final ellipse with integer coordinates
    const color = this.selectedColor === "primary" ? this.primaryColor : this.secondaryColor;
    const startX = Math.floor(this.tempEllipse.startX);
    const startY = Math.floor(this.tempEllipse.startY);

    let pixels = [];

    if (this.currentTool.settings?.filled?.value) {
      pixels = this.drawFilledEllipse(ctx, startX, startY, width, height, color);
    } else {
      pixels = this.drawEllipse(ctx, startX, startY, width, height, color);
    }

    // Only save pixel that really changed
    pixels = pixels.filter(p => p.newColor != p.oldColor);

    if (pixels.length) {
      this.recordDrawOperation(pixels);
    }

    // Clean up
    this.tempEllipse = null;
    this.tempCanvas = null;
    this.tempCtx = null;

    this.render();
  }

  drawEllipse(ctx, x, y, width, height, color) {
    const centerX = Math.floor(x + width / 2);
    const centerY = Math.floor(y + height / 2);
    const radiusX = Math.floor(Math.abs(width / 2));
    const radiusY = Math.floor(Math.abs(height / 2));

    // Should use brush?
    const useBrush = true; // TODO: Get this setting from Tools

    if (useBrush && this.brushSize > 1) {
      return this.midpointEllipseWithBrush(ctx, centerX, centerY, radiusX, radiusY, color, false);
    } else {
      return this.midpointEllipse(ctx, centerX, centerY, radiusX, radiusY, color, false);
    }
  }

  drawFilledEllipse(ctx, x, y, width, height, color) {
    const centerX = Math.floor(x + width / 2);
    const centerY = Math.floor(y + height / 2);
    const radiusX = Math.floor(Math.abs(width / 2));
    const radiusY = Math.floor(Math.abs(height / 2));

    return this.midpointEllipse(ctx, centerX, centerY, radiusX, radiusY, color, true);
  }

  midpointEllipse(ctx, centerX, centerY, radiusX, radiusY, color, filled) {
    if (radiusX <= 0 || radiusY <= 0) return [];

    // Convert to integer coordinates for pixel perfection
    const cx = Math.floor(centerX);
    const cy = Math.floor(centerY);
    const rx = Math.floor(Math.abs(radiusX));
    const ry = Math.floor(Math.abs(radiusY));

    if (rx === 0 || ry === 0) return [];
    
    let pixels = [];

    // Draw pixels function - ensures integer coordinates
    const drawPixel = (x, y) => {
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || px >= ctx.width || py < 0 || py >= ctx.height) return;

      const oldColor = this.getPixelColorFromCtx(ctx, px, py);

      if (oldColor !== color) {
        if (color === "transparent") {
          ctx.clearRect(px, py, 1, 1);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(px, py, 1, 1);
        }
        pixels.push({
          x, y,
          newColor: color,
          oldColor
        });
      }
    };

    // For filled ellipses, use scanline approach
    if (filled) {
      return this.fillEllipseScanline(ctx, cx, cy, rx, ry, color);
    }

    // Outline drawing using integer-only midpoint algorithm
    let x = 0;
    let y = ry;

    // Initial decision parameter for region 1
    let d1 = ry * ry - rx * rx * ry + Math.floor(0.25 * rx * rx);
    let dx = 2 * ry * ry * x;
    let dy = 2 * rx * rx * y;

    // Region 1
    while (dx < dy) {
      // Draw 4 symmetric points
      drawPixel(cx + x, cy + y);
      drawPixel(cx - x, cy + y);
      drawPixel(cx + x, cy - y);
      drawPixel(cx - x, cy - y);

      x++;
      dx += 2 * ry * ry;

      if (d1 < 0) {
        d1 += dx + ry * ry;
      } else {
        y--;
        dy -= 2 * rx * rx;
        d1 += dx - dy + ry * ry;
      }
    }

    // Decision parameter for region 2
    let d2 = ry * ry * ((x + 0.5) * (x + 0.5)) + rx * rx * ((y - 1) * (y - 1)) - rx * rx * ry * ry;

    // Region 2
    while (y >= 0) {
      // Draw 4 symmetric points
      drawPixel(cx + x, cy + y);
      drawPixel(cx - x, cy + y);
      drawPixel(cx + x, cy - y);
      drawPixel(cx - x, cy - y);

      y--;
      dy -= 2 * rx * rx;

      if (d2 > 0) {
        d2 += rx * rx - dy;
      } else {
        x++;
        dx += 2 * ry * ry;
        d2 += dx - dy + rx * rx;
      }
    }
    
    return pixels;
  }
  
  midpointEllipseWithBrush(ctx, centerX, centerY, radiusX, radiusY, color, filled) {
    // TODO: Integrate with midpointEllipse() logic
    if (radiusX <= 0 || radiusY <= 0) return [];

    // Convert to integer coordinates for pixel perfection
    const cx = Math.floor(centerX);
    const cy = Math.floor(centerY);
    const rx = Math.floor(Math.abs(radiusX));
    const ry = Math.floor(Math.abs(radiusY));

    if (rx === 0 || ry === 0) return [];
    
    let pixels = [];

    // Draw pixels function - ensures integer coordinates
    const drawPixel = (x, y) => {
      if (this.brushSize > 1) {
        pixels = [...pixels, ...this.drawBrushCircle(ctx, x, y, this.brushSize, color)];
      } else {
        const oldColor = this.getPixelColorFromCtx(ctx, x, y);
        if (oldColor !== color) {
          if (color === "transparent") {
            ctx.clearRect(x, y, 1, 1);
          } else {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
          pixels.push({
            x, y,
            newColor: color,
            oldColor
          });
        }
      }
    };

    // For filled ellipses, use scanline approach
    if (filled) {
      return this.fillEllipseScanline(ctx, cx, cy, rx, ry, color);
    }

    // Outline drawing using integer-only midpoint algorithm
    let x = 0;
    let y = ry;

    // Initial decision parameter for region 1
    let d1 = ry * ry - rx * rx * ry + Math.floor(0.25 * rx * rx);
    let dx = 2 * ry * ry * x;
    let dy = 2 * rx * rx * y;

    // Region 1
    while (dx < dy) {
      // Draw 4 symmetric points
      drawPixel(cx + x, cy + y);
      drawPixel(cx - x, cy + y);
      drawPixel(cx + x, cy - y);
      drawPixel(cx - x, cy - y);

      x++;
      dx += 2 * ry * ry;

      if (d1 < 0) {
        d1 += dx + ry * ry;
      } else {
        y--;
        dy -= 2 * rx * rx;
        d1 += dx - dy + ry * ry;
      }
    }

    // Decision parameter for region 2
    let d2 = ry * ry * ((x + 0.5) * (x + 0.5)) + rx * rx * ((y - 1) * (y - 1)) - rx * rx * ry * ry;

    // Region 2
    while (y >= 0) {
      // Draw 4 symmetric points
      drawPixel(cx + x, cy + y);
      drawPixel(cx - x, cy + y);
      drawPixel(cx + x, cy - y);
      drawPixel(cx - x, cy - y);

      y--;
      dy -= 2 * rx * rx;

      if (d2 > 0) {
        d2 += rx * rx - dy;
      } else {
        x++;
        dx += 2 * ry * ry;
        d2 += dx - dy + rx * rx;
      }
    }
    
    return pixels;
  }

  fillEllipseScanline(ctx, cx, cy, rx, ry, color) {
    if (rx <= 0 || ry <= 0) return [];

    let pixels = [];

    const drawPixel = (x, y) => {
      if (x < 0 || x >= ctx.width || y < 0 || y >= ctx.height) return;

      const oldColor = this.getPixelColorFromCtx(ctx, x, y);

      if (oldColor !== color) {
        if (color === "transparent") {
          ctx.clearRect(x, y, 1, 1);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
        pixels.push({
          x, y,
          newColor: color,
          oldColor
        });
      }
    };

    // Precompute squared values for efficiency
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    const twoRx2 = 2 * rx2;
    const twoRy2 = 2 * ry2;

    // Region 1: Slope < 1
    let x = 0;
    let y = ry;
    let px = 0;
    let py = twoRx2 * y;

    // Initial decision parameter for region 1
    let d1 = Math.floor(ry2 - rx2 * ry + 0.25 * rx2);

    while (px < py) {
      // Fill horizontal lines for this y level
      for (let i = cx - x; i <= cx + x; i++) {
        drawPixel(i, cy + y);
        drawPixel(i, cy - y);
      }

      x++;
      px += twoRy2;

      if (d1 < 0) {
        d1 += ry2 + px;
      } else {
        y--;
        py -= twoRx2;
        d1 += ry2 + px - py;
      }
    }

    // Region 2: Slope >= 1
    let d2 = Math.floor(ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2);

    while (y >= 0) {
      // Fill horizontal lines for this y level
      for (let i = cx - x; i <= cx + x; i++) {
        drawPixel(i, cy + y);
        drawPixel(i, cy - y);
      }

      y--;
      py -= twoRx2;

      if (d2 > 0) {
        d2 += rx2 - py;
      } else {
        x++;
        px += twoRy2;
        d2 += rx2 - py + px;
      }
    }
    
    return pixels;
  }
  
  fillArea(x, y) {
    if (!this.project || x < 0 || y < 0 || x >= this.project.width || y >= this.project.height) return;

    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;

    // Get target color
    const imageData = ctx.getImageData(x, y, 1, 1);
    const targetColor = Array.from(imageData.data);

    // Get fill color
    const fillColor = this.selectedColor === "primary" ? this.primaryColor : this.secondaryColor;
    const fillRgb = this.colorPicker.hexToRgb(fillColor);

    // If already the same color, return
    if (fillRgb && fillRgb.r === targetColor[0] && fillRgb.g === targetColor[1] && fillRgb.b === targetColor[2] && targetColor[3] === 255) {
      return;
    }

    // Perform flood fill
    let pixels = this.floodFill(ctx, x, y, targetColor, fillRgb);
    
    pixels = pixels.filter(p => p.newColor != p.oldColor);
    
    if (pixels.length) {
      this.recordDrawOperation(pixels);
    }
    
    this.render();
  }

  floodFill(ctx, x, y, targetColor, fillColor) {
    const canvasWidth = this.project.width;
    const canvasHeight = this.project.height;
    const stack = [[x, y]];
    const visited = new Set();
    
    let pixels = [];

    while (stack.length > 0) {
      const [currentX, currentY] = stack.pop();
      const key = `${currentX},${currentY}`;

      if (visited.has(key) || currentX < 0 || currentX >= canvasWidth || currentY < 0 || currentY >= canvasHeight) {
        continue;
      }

      visited.add(key);

      // Get pixel color
      const imageData = ctx.getImageData(currentX, currentY, 1, 1);
      const currentColor = Array.from(imageData.data);

      // Check if pixel matches target color
      if (this.colorsMatch(currentColor, targetColor)) {
        // Fill the pixel
        const oldColor = this.getPixelColorFromCtx(ctx, currentX, currentY);
        if (fillColor) {
          const fillData = new Uint8ClampedArray([fillColor.r, fillColor.g, fillColor.b, 255]);
          ctx.putImageData(new ImageData(fillData, 1, 1), currentX, currentY);
          pixels.push({
            x: currentX,
            y: currentY,
            newColor: `rgba(${fillColor.r}, ${fillColor.g}, ${fillColor.b}, 255)`,
            oldColor
          });
        } else {
          // Transparent fill
          ctx.clearRect(currentX, currentY, 1, 1);
          pixels.push({
            x: currentX,
            y: currentY,
            newColor: "transparent",
            oldColor
          });
        }

        // Add neighbors to stack
        stack.push([currentX + 1, currentY], [currentX - 1, currentY], [currentX, currentY + 1], [currentX, currentY - 1]);
      }
    }
    
    return pixels;
  }

  colorsMatch(color1, color2) {
    return color1[0] === color2[0] && color1[1] === color2[1] && color1[2] === color2[2] && color1[3] === color2[3];
  }

  pickColor(x, y, includeReferenceImage = true, silent = false) {
    if (!this.project || x < 0 || y < 0 || x >= this.project.width || y >= this.project.height) return;

    const frame = this.project.frames[this.project.currentFrame];

    const pickFromCtx = ctx => {
      const imageData = ctx.getImageData(x, y, 1, 1);
      const data = imageData.data;

      if (data[3] > 0) {
        // If pixel is not transparent
        const color = `#${this.componentToHex(data[0])}${this.componentToHex(data[1])}${this.componentToHex(data[2])}`;
        this.setColor(color);
        if (!silent) this.showOperationMessage(`<span style="aspect-ratio: 1/1; width: 1em; height: 1em; background: ${color}">${color}</span>`);
        return true;
      } else {
        return false;
      }
    };
    
    // Check for current layer first
    const layerCtx = this.getCurrentLayerContext();
    if (pickFromCtx(layerCtx)) return;
    
    // Check layers from top to bottom
    for (let l = frame.layers.length - 1; l >= 0; l--) {
      const layer = frame.layers[l];
      if (layer.visible) {
        const ctx = layer.ctx;
        if (pickFromCtx(ctx)) return;
      }
    }

    // Check for reference image
    if (includeReferenceImage && this.referenceManager.traceImage) {
      if (pickFromCtx(this.ctx)) return;
    }
  }

  // Tools management
  addTool(toolDef) {
    if (!toolDef.name) {
      throw new Error("Tool must have a name");
    }

    this.tools[toolDef.name] = {
      name: toolDef.name,
      displayName: toolDef.displayName || toolDef.name,
      icon: toolDef.icon,
      cursor: toolDef.cursor || "default",
      shortcut: toolDef.shortcut || null,
      onDown: toolDef.onDown,
      onMove: toolDef.onMove,
      onUp: toolDef.onUp,
      settings: toolDef.settings || {}
    };

    // Add tool to dropdown
    const toolButton = this.createButton(`tool-${toolDef.name}`, toolDef.icon, () => {
      this.setTool(toolDef.name);
      this.toolDropdown.classList.remove("visible");
    });
    toolButton.title = toolDef.shortcut ? toolDef.displayName + ` (${toolDef.shortcut.toUpperCase()})` : toolDef.displayName;
    this.toolDropdown.appendChild(toolButton);
  }

  setTool(toolName, silent) {
    if (!this.tools[toolName]) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // Store previous tool
    if (this.currentTool && this.currentTool.name !== toolName) {
      this.lastTool = this.currentTool.name;
    }

    this.currentTool = this.tools[toolName];

    // Update current tool button
    const icon = this.currentToolButton.querySelector(".icon");
    if (icon) {
      icon.className = `icon ${this.currentTool.icon}`;
    }

    // Update cursor
    this.canvas.style.cursor = this.currentTool.cursor;

    // Show/hide settings button
    this.toolSettingsButton.style.display = Object.keys(this.currentTool.settings).length > 0 ? "flex" : "none";

    if (!silent) this.showOperationMessage(__(this.currentTool.displayName));

    // Hide any open settings popup
    this.hideToolSettings();
  }

  switchLastTool() {
    if (this.lastTool && this.lastTool !== this.currentTool.name) {
      this.setTool(this.lastTool);
    }
  }

  toggleToolDropdown() {
    this.toolDropdown.classList.toggle("visible");

    // Close dropdown when clicking outside
    if (this.toolDropdown.classList.contains("visible")) {
      const clickHandler = e => {
        if (!this.toolButtonContainer.contains(e.target)) {
          this.toolDropdown.classList.remove("visible");
          document.removeEventListener("click", clickHandler);
        }
      };
      setTimeout(() => {
        document.addEventListener("click", clickHandler);
      }, 0);
    }
  }

  showToolSettings() {
    if (!this.currentTool || Object.keys(this.currentTool.settings).length === 0) return;

    // Clear previous content
    this.toolSettingsPopup.innerHTML = "";

    // Add title
    const title = document.createElement("h3");
    title.textContent = `${this.currentTool.name} Settings`;
    this.toolSettingsPopup.appendChild(title);

    // Add settings controls
    for (const [key, setting] of Object.entries(this.currentTool.settings)) {
      const settingControl = document.createElement("div");
      settingControl.className = "tool-setting";

      const label = document.createElement("label");
      label.textContent = key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase());
      settingControl.appendChild(label);

      if (setting.type === "boolean") {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = setting.value;
        checkbox.addEventListener("change", e => {
          this.currentTool.settings[key].value = e.target.checked;
        });
        settingControl.appendChild(checkbox);
      } else if (setting.type === "number") {
        const input = document.createElement("input");
        input.type = "number";
        input.value = setting.value;
        input.min = setting.min || 0;
        input.max = setting.max || 100;
        input.addEventListener("change", e => {
          this.currentTool.settings[key].value = parseFloat(e.target.value);
        });
        settingControl.appendChild(input);
      } else if (setting.type === "select") {
        const select = document.createElement("select");
        setting.options.forEach(option => {
          const optionElement = document.createElement("option");
          optionElement.value = option.value;
          optionElement.textContent = option.label;
          if (option.value === setting.value) {
            optionElement.selected = true;
          }
          select.appendChild(optionElement);
        });
        select.addEventListener("change", e => {
          this.currentTool.settings[key].value = e.target.value;
        });
        settingControl.appendChild(select);
      }

      this.toolSettingsPopup.appendChild(settingControl);
    }

    // Position near the settings button
    const rect = this.toolSettingsButton.getBoundingClientRect();
    this.toolSettingsPopup.style.position = "absolute";
    this.toolSettingsPopup.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    this.toolSettingsPopup.style.right = `${window.innerWidth - rect.right}px`;
    this.toolSettingsPopup.style.display = "block";

    // Close when clicking outside
    setTimeout(() => {
      const clickHandler = e => {
        if (!this.toolSettingsPopup.contains(e.target)) {
          this.hideToolSettings();
          document.removeEventListener("click", clickHandler);
        }
      };
      document.addEventListener("click", clickHandler);
    }, 0);
  }

  hideToolSettings() {
    this.toolSettingsPopup.style.display = "none";
  }

  // Color management
  toggleSelectedColor() {
    this.selectedColor = this.selectedColor === "primary" ? "secondary" : "primary";
    this.updateColorIndicator();
  }

  updateColorIndicator() {
    this.colorPrimary.style.backgroundColor = this.primaryColor;
    this.colorSecondary.style.backgroundColor = this.secondaryColor;
    
    this.colorSelector.className = "color-selector";
    if (this.selectedColor === "secondary") {
      this.colorSelector.classList.add("secondary");
    }
    
    localStorage.setItem("primaryColor", this.primaryColor);
    localStorage.setItem("secondaryColor", this.secondaryColor);
  }
  
  showColorPicker() {
    this.colorPicker.show();
  }
  
  hideColorPicker() {
    this.colorPicker.hide();
  }
  
  updatePaletteGrid() {
    // Delegate to colorPicker to update its UI
    if (this.colorPicker) {
      this.colorPicker.updatePaletteGrid();
    }
  }
  
  addToRecentColors(hex) {
    this.paletteManager.addToRecent(hex);
  }
  
  updateRecentColorsGrid() {
    if (this.colorPicker) {
      this.colorPicker.updateRecentColorsGrid();
    }
  }
  
  updatePaletteGrid() {
    if (this.colorPicker) {
      this.colorPicker.updatePaletteGrid();
    }
  }
  
  addColorToPalette(color) {
    const currentPalette = this.paletteManager.getCurrentPalette();
    if (currentPalette) {
      this.paletteManager.addColorToPalette(currentPalette.id, color);
      this.updatePaletteGrid();
    }
  }
  
  removeColorFromPalette(index) {
    const currentPalette = this.paletteManager.getCurrentPalette();
    if (currentPalette) {
      this.paletteManager.removeColorFromPalette(currentPalette.id, index);
      this.updatePaletteGrid();
    }
  }
  
  loadPalette() {
    const fileBrowser = this.getFileBrowser({
      title: __("Cargar paleta||Load palette"),
      mode: "open",
      fileTypes: ["pal"],
      onConfirm: async fileInfo => {
        try {
          const fileData = await this.readFile(fileInfo);
          this.parsePalFile(fileData);
          this.updatePaletteGrid();
          this.showToast(__("Paleta cargada||Palette loaded successfully"));
        } catch (error) {
          this.showToast(__(`(Error al cargar paleta|Error loading palette): ${error.message}`), 5000);
        }
      }
    });
    fileBrowser.show();
  }
  
  savePalette() {
    const currentPalette = this.paletteManager.getCurrentPalette();
    if (!currentPalette || currentPalette.colors.length === 0) {
      this.showToast(__("No hay paleta que guardar||No palette to save"), 3000);
      return;
    }
    
    const fileBrowser = this.getFileBrowser({
      title: __("Guardar paleta||Save palette"),
      mode: "saveAs",
      fileTypes: ["pal"],
      defaultType: "pal",
      defaultName: currentPalette.name || "palette",
      onConfirm: async fileInfo => {
        try {
          const palContent = this.generatePalFile();
          await this.saveFile(fileInfo.name, "pal", palContent);
          this.showToast(__("Paleta guardada||Palette saved successfully"));
        } catch (error) {
          this.showToast(__(`(Error al guardar la paleta|Error saving palette): ${error.message}`), 5000);
        }
      }
    });
    fileBrowser.show();
  }
  
  parsePalFile(content) {
    const lines = content.split("\n").map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length < 3 || lines[0] !== "JASC-PAL") {
      throw new Error("Invalid PAL file format - missing JASC-PAL header");
    }
    if (lines[1] !== "0100") {
      throw new Error("Unsupported PAL version - expected 0100");
    }
    
    const colorCount = parseInt(lines[2]);
    if (isNaN(colorCount)) {
      throw new Error("Invalid color count - not a number");
    }
    
    if (lines.length < 3 + colorCount) {
      throw new Error(`File claims to have ${colorCount} colors but only ${lines.length - 3} found`);
    }
    
    const colors = [];
    for (let i = 3; i < 3 + colorCount; i++) {
      const components = lines[i].split(/\s+/).filter(c => c.length > 0);
      if (components.length < 3) {
        throw new Error(`Invalid color at line ${i + 1} - expected 3 components`);
      }
      
      const r = parseInt(components[0]);
      const g = parseInt(components[1]);
      const b = parseInt(components[2]);
      
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        throw new Error(`Invalid RGB values at line ${i + 1}`);
      }
      
      if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        throw new Error(`RGB values out of range (0-255) at line ${i + 1}`);
      }
      
      colors.push(this.colorPicker.rgbToHex(r, g, b));
    }
    
    const name = __("Paleta importada||Imported palette");
    let uniqueName = name;
    let counter = 1;
    while (this.paletteManager.palettes.some(p => p.name === uniqueName)) {
      uniqueName = `${name} ${counter++}`;
    }
    this.paletteManager.addPalette(uniqueName, colors);
  }
  
  generatePalFile() {
    const currentPalette = this.paletteManager.getCurrentPalette();
    const colors = currentPalette.colors.map(hex => {
      const rgb = this.colorPicker.hexToRgb(hex);
      return `${rgb.r} ${rgb.g} ${rgb.b}`;
    });
    return ["JASC-PAL", "0100", colors.length.toString(), ...colors].join("\n");
  }
    
  // UI helpers
  showToast(message, duration = 3000) {
    this.notificationElement.innerHTML = message;
    this.notificationElement.classList.add("visible");

    setTimeout(() => {
      this.notificationElement.classList.remove("visible");
    }, duration);
  }
  
  showOperationMessage(message, duration = 3000) {
    this.operationMessageElement.innerHTML = message;
    this.operationMessageElement.classList.add("visible");

    setTimeout(() => {
      this.operationMessageElement.classList.remove("visible");
    }, duration);
  }

  showPopup(title, content, buttons = [{ text: "OK", action: () => this.hidePopup() }], fullscreen = false) {
    this.popupContent.innerHTML = "";
    
    const titleElement = document.createElement("div");
    titleElement.className = "popup-title";
    titleElement.textContent = title;
    this.popupContent.appendChild(titleElement);

    if (typeof content === "string") {
      const contentElement = document.createElement("div");
      contentElement.innerHTML = content;
      this.popupContent.appendChild(contentElement);
    } else {
      this.popupContent.appendChild(content);
    }

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "popup-buttons";
    this.popupContent.appendChild(buttonsContainer);

    this.popupButtons = [];

    buttons.forEach(button => {
      const btnElement = document.createElement("button");
      btnElement.className = button.class || "confirm";
      btnElement.textContent = button.text;
      btnElement.addEventListener("click", button.action);
      buttonsContainer.appendChild(btnElement);
      this.popupButtons.push(btnElement);
    });
    
    this.popupOverlay.classList.add("visible");
    
    if (fullscreen) {
      this.popupOverlay.classList.add("fullscreen");
    } else {
      this.popupOverlay.classList.remove("fullscreen");
    }

    this.popupOpen = true;
  }

  hidePopup() {
    this.popupOverlay.classList.remove("visible");
    this.popupOpen = false;
  }

  hidePopupButtons() {
    if (this.popupButtons) {
      this.popupButtons.forEach(btnElement => {
        btnElement.style.display = "none";
      });
    }
  }

  // Menu actions
  showNewProjectDialog() {
    const content = document.createElement("div");
    content.innerHTML = `
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px;">Width:</label>
        <input type="number" id="new-width" value="${this.defaultWidth}">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px;">Height:</label>
        <input type="number" id="new-height" value="${this.defaultHeight}">
      </div>
    `;

    this.showPopup(__("Nuevo Proyecto||New Project"), content, [
      {
        text: __("Cancelar||Cancel"),
        class: "cancel",
        action: () => this.hidePopup()
      },
      {
        text: __("Crear||Create"),
        action: () => {
          const width = parseInt(document.getElementById("new-width").value);
          const height = parseInt(document.getElementById("new-height").value);

          if (width > 0 && height > 0) {
            this.newProject(width, height);
            this.hidePopup();
          } else {
            this.showToast(__("Dimensiones inválidas||Invalid dimensions"));
          }
        }
      }
    ]);
  }

  flipHorizontal() {
    if (!this.project) return;
    
    this.historyManager.startBatch("transform", __("Espejo Horizontal||Flip Horizontal"));
  
    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;
  
    // Store old image data
    const oldImageData = ctx.getImageData(0, 0, this.project.width, this.project.height);
  
    // Perform flip
    const imageData = new ImageData(
      new Uint8ClampedArray(Array.from(oldImageData.data)),
      this.project.width,
      this.project.height
    );
    const data = imageData.data;
  
    for (let y = 0; y < this.project.height; y++) {
      for (let x = 0; x < Math.floor(this.project.width / 2); x++) {
        const index1 = (y * this.project.width + x) * 4;
        const index2 = (y * this.project.width + (this.project.width - x - 1)) * 4;
  
        // Swap pixels
        for (let i = 0; i < 4; i++) {
          const temp = data[index1 + i];
          data[index1 + i] = data[index2 + i];
          data[index2 + i] = temp;
        }
      }
    }
  
    ctx.putImageData(imageData, 0, 0);
  
    // Record operation
    const operation = {
      type: 'transform',
      description: __('Espejo Horizontal||Flip Horizontal'),
      frameIndex: this.project.currentFrame,
      layerIndex: this.project.currentLayer,
      transformType: 'flip_horizontal',
      transformData: {
        oldImageData: Array.from(oldImageData.data),
        newImageData: Array.from(ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    this.render();
  }
  
  flipVertical() {
    if (!this.project) return;
  
    this.historyManager.startBatch("transform", __("Girar Horizontal||Flip Vertical"));
  
    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;
  
    // Store old image data
    const oldImageData = ctx.getImageData(0, 0, this.project.width, this.project.height);
  
    // Perform flip
    const imageData = new ImageData(
      new Uint8ClampedArray(Array.from(oldImageData.data)),
      this.project.width,
      this.project.height
    );
    const data = imageData.data;
  
    for (let y = 0; y < Math.floor(this.project.height / 2); y++) {
      for (let x = 0; x < this.project.width; x++) {
        const index1 = (y * this.project.width + x) * 4;
        const index2 = ((this.project.height - y - 1) * this.project.width + x) * 4;
  
        // Swap pixels
        for (let i = 0; i < 4; i++) {
          const temp = data[index1 + i];
          data[index1 + i] = data[index2 + i];
          data[index2 + i] = temp;
        }
      }
    }
  
    ctx.putImageData(imageData, 0, 0);
  
    // Record operation
    const operation = {
      type: 'transform',
      description: __('Girar Horizontal||Flip Vertical'),
      frameIndex: this.project.currentFrame,
      layerIndex: this.project.currentLayer,
      transformType: 'flip_vertical',
      transformData: {
        oldImageData: Array.from(oldImageData.data),
        newImageData: Array.from(ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    this.render();
  }
  
  rotate(degrees = 0) {
    if (!this.project) return;
  
    this.historyManager.startBatch("transform", __(`(Rotar|Rotate) ${degrees}°`));
  
    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;
  
    // Store old image data
    const oldImageData = ctx.getImageData(0, 0, this.project.width, this.project.height);
  
    // Perform rotation
    const imageData = oldImageData;
    const newData = new ImageData(
      degrees === 90 || degrees === 270 ? this.project.height : this.project.width,
      degrees === 90 || degrees === 270 ? this.project.width : this.project.height
    );
  
    for (let y = 0; y < this.project.height; y++) {
      for (let x = 0; x < this.project.width; x++) {
        const srcIndex = (y * this.project.width + x) * 4;
  
        let destX, destY;
  
        if (degrees === 90) {
          destX = this.project.height - y - 1;
          destY = x;
        } else if (degrees === 180) {
          destX = this.project.width - x - 1;
          destY = this.project.height - y - 1;
        } else if (degrees === 270) {
          destX = y;
          destY = this.project.width - x - 1;
        } else {
          return;
        }
  
        const destIndex = (destY * newData.width + destX) * 4;
  
        for (let i = 0; i < 4; i++) {
          newData.data[destIndex + i] = imageData.data[srcIndex + i];
        }
      }
    }
  
    // Resize layer canvas if needed
    if (degrees === 90 || degrees === 270) {
      layer.canvas.width = this.project.height;
      layer.canvas.height = this.project.width;
    }
  
    ctx.putImageData(newData, 0, 0);
  
    // Record operation
    const operation = {
      type: 'transform',
      description: __(`(Rotar|Rotate) ${degrees}°`),
      frameIndex: this.project.currentFrame,
      layerIndex: this.project.currentLayer,
      transformType: `rotate_${degrees}`,
      transformData: {
        oldImageData: Array.from(oldImageData.data),
        newImageData: Array.from(ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height).data),
        oldWidth: this.project.width,
        oldHeight: this.project.height,
        newWidth: layer.canvas.width,
        newHeight: layer.canvas.height
      }
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    // Update project dimensions if rotating 90 or 270 degrees
    if (degrees === 90 || degrees === 270) {
      const temp = this.project.width;
      this.project.width = this.project.height;
      this.project.height = temp;
      this.resetCanvasSize();
    }
  
    this.render();
  }
  
  toggleTransparency() {
    this.transparentBackground = !this.transparentBackground;
    this.render();
  }

  invertColors() {
    if (!this.project) return;
  
    this.historyManager.startBatch("color_adjustment", __("Invertir Colores||Invert Colors"));
  
    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;
  
    // Store old image data
    const oldImageData = ctx.getImageData(0, 0, this.project.width, this.project.height);
  
    // Perform inversion
    const imageData = ctx.getImageData(0, 0, this.project.width, this.project.height);
    const data = imageData.data;
  
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]; // R
      data[i + 1] = 255 - data[i + 1]; // G
      data[i + 2] = 255 - data[i + 2]; // B
    }
  
    ctx.putImageData(imageData, 0, 0);
  
    // Record operation
    const operation = {
      type: 'color_adjustment',
      description: __('Invertir Colores||Invert Colors'),
      frameIndex: this.project.currentFrame,
      layerIndex: this.project.currentLayer,
      adjustmentType: 'invert',
      adjustmentData: {
        oldImageData: Array.from(oldImageData.data),
        newImageData: Array.from(ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    this.render();
  }
  
  grayscale() {
    if (!this.project) return;
  
    this.historyManager.startBatch("color_adjustment", __("Escala de Grises||Grayscale"));
  
    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;
  
    // Store old image data
    const oldImageData = ctx.getImageData(0, 0, this.project.width, this.project.height);
  
    // Perform grayscale
    const imageData = new ImageData(
      new Uint8ClampedArray(Array.from(oldImageData.data)),
      this.project.width,
      this.project.height
    );
    const data = imageData.data;
  
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; // R
      data[i + 1] = avg; // G
      data[i + 2] = avg; // B
    }
  
    ctx.putImageData(imageData, 0, 0);
  
    // Record operation
    const operation = {
      type: 'color_adjustment',
      description: __('Escala de Grises||Grayscale'),
      frameIndex: this.project.currentFrame,
      layerIndex: this.project.currentLayer,
      adjustmentType: 'grayscale',
      adjustmentData: {
        oldImageData: Array.from(oldImageData.data),
        newImageData: Array.from(ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    this.render();
  }
  
  showAboutDialog() {
    this.showPopup(
      __("Acerca de Pixelite||About Pixelite"),
      `
        <div style="text-align: center;">
          <h2 style="margin-top: 0; color: var(--primary-color);">Pixelite</h2>
          <p><strong>${__("Versión||Version")} ${this.version}</strong></p>
          <p>${__("© %Y RETORA. Todos los derechos reservados.||© %Y RETORA. All rights reserved.").replace('%Y', new Date().getFullYear())}</p>
          <p>${__("Creado por||Created by")} <a onclick="openExternalUrl('https://retora.html-5.me')">retora</a>.</p></p>
          <div style="display: flex; justify-content: center; gap: 15px; margin: 20px 0;">
            <a href="https://retora.itch.io/pixelite" target="_blank" style="color: var(--primary-color); text-decoration: none;" onclick="openExternalUrl('https://retora.itch.io/pixelite')">itch.io</a>
            <span>•</span>
            <a href="https://github.com/RetoraDev/pixelite" target="_blank" style="color: var(--primary-color); text-decoration: none;" onclick="openExternalUrl('https://github.com/RetoraDev/pixelite')">GitHub</a>
          </div>
          <p style="font-size: 0.9em; color: var(--text-dim); margin-bottom: 0;">
            ${__("Un editor de pixel art colaborativo con soporte de animación||Collaborative pixel art editor with animation support")}.
          </p>
        </div>
      `,
      [{ text: __("Cerrar||Close"), action: () => this.hidePopup() }]
    );
  }

  showManualDialog() {
    this.showPopup(
      "Manual",
      __(`
        (El manual no está disponible todavía|Manual is not available yet)
      `),
      [{ text: __("Cerrar||Close"), action: () => this.hidePopup() }]
    );
  }
  
  // Animation Frame Management
  addFrame(frameIndex = this.project.currentFrame, time) {
    if (!this.project) return;
  
    const newIndex = frameIndex + 1;
  
    this.historyManager.startBatch("add_layer", __("(Añadir|Add) Frame"));
  
    const newFrame = {
      layers: []
    };
  
    // Copy layers from current frame
    const currentFrame = this.project.frames[frameIndex];
    for (let i = 0; i < currentFrame.layers.length; i++) {
      const layer = currentFrame.layers[i];
      const newLayer = this.createBlankLayer(this.project.width, this.project.height, layer.name);
      newLayer.visible = layer.visible;
      newFrame.layers.push(newLayer);
    }
  
    // Insert after current frame
    this.project.frames.splice(newIndex, 0, newFrame);
    this.project.frameTimes.splice(newIndex, 0, time || this.project.currentFrameTime);
    
    // Switch to the new frame
    this.project.currentFrame = newIndex;
  
    // Record operation
    const operation = {
      type: 'add_frame',
      description: __('(Añadir|Add) Frame'),
      index: frameIndex,
      frameTime: this.project.currentFrameTime,
      layers: currentFrame.layers.map(layer => ({
        name: layer.name,
        visible: layer.visible,
        imageData: Array.from(layer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }))
    };
    
    this.showOperationMessage(__('Nuevo Frame añadido||New Frame added'));
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();

    this.render();
  }
  
  removeFrame(index = this.project.currentFrame, silent) {
    if (!this.project || this.project.frames.length <= 1) return;
    
    this.historyManager.startBatch("remove_layer", __("(Quitar|Add) Frame"));
  
    const removedFrame = this.project.frames[index];
    const removedFrameTime = this.project.frameTimes[index];
  
    this.project.frames.splice(index, 1);
    this.project.frameTimes.splice(index, 1);
    this.project.currentFrame = Math.min(index, this.project.frames.length - 1);
  
    // Record operation
    const operation = {
      type: 'remove_frame',
      description: __('(Quitar|Remove) Frame'),
      index: index,
      frameTime: removedFrameTime,
      layers: removedFrame.layers.map(layer => ({
        name: layer.name,
        visible: layer.visible,
        imageData: Array.from(layer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }))
    };
    
    if (!silent) this.showOperationMessage(__('Frame quitado||Frame removed'));
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    this.render();
  }
  
  duplicateFrame(currentIndex = this.project.currentFrame) {
    if (!this.project) return;
  
    const currentFrame = this.project.frames[currentIndex];
    const newIndex = currentIndex + 1;
  
    this.historyManager.startBatch("duplicate_frame", __("Duplicar Frame||Duplicate Frame"));
  
    // Create new frame with same structure
    const newFrame = {
      layers: []
    };
  
    // Copy each layer from current frame
    for (let i = 0; i < currentFrame.layers.length; i++) {
      const sourceLayer = currentFrame.layers[i];
      
      // Create new blank layer
      const newLayer = this.createBlankLayer(
        this.project.width, 
        this.project.height, 
        `${sourceLayer.name} (${__("copia||copy")})`
      );
      newLayer.visible = sourceLayer.visible;
      
      // Copy canvas content
      newLayer.ctx.drawImage(sourceLayer.canvas, 0, 0);
      
      newFrame.layers.push(newLayer);
    }
  
    // Insert new frame after current
    this.project.frames.splice(newIndex, 0, newFrame);
    
    // Copy frame time
    this.project.frameTimes.splice(newIndex, 0, this.project.frameTimes[currentIndex]);
    
    // Set current frame to the new one
    this.project.currentFrame = newIndex;
  
    // Record operation
    const operation = {
      type: 'duplicate_frame',
      description: __('Duplicar Frame||Duplicate Frame'),
      index: newIndex,
      frameTime: this.project.frameTimes[newIndex],
      layers: newFrame.layers.map(layer => ({
        name: layer.name,
        visible: layer.visible,
        imageData: Array.from(layer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }))
    };
    
    this.showOperationMessage(__('Frame duplicado||Frame duplicated'));
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    // Update UI
    this.updateFramesUI();
    this.render();
  }  
  
  moveFrame(fromIndex, toIndex, silent) {
    if (fromIndex === toIndex) return;
  
    this.historyManager.startBatch("move_frame", __("(Move|Mover) Frame"));
  
    const frame = this.project.frames.splice(fromIndex, 1)[0];
    const frameTime = this.project.frameTimes.splice(fromIndex, 1)[0];
    this.project.frames.splice(toIndex, 0, frame);
    this.project.frameTimes.splice(toIndex, 0, frameTime);
    this.project.currentFrame = toIndex;
  
    // Record operation
    const operation = {
      type: 'move_frame',
      description: __('(Move|Mover) Frame'),
      fromIndex: fromIndex,
      toIndex: toIndex
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
    
    if (!silent) this.showOperationMessage(__("Frame movido||Frame moved"));
  
    this.render();
  }
  
  setFrameTime(frameIndex, time) {
    if (!this.project || frameIndex < 0 || frameIndex >= this.project.frameTimes.length) return;
  
    const oldTime = this.project.frameTimes[frameIndex];
    this.project.frameTimes[frameIndex] = time;
  
    // Record operation
    const operation = {
      type: 'edit_frame',
      description: __('Cambiar Tiempo de Frame||Change Frame Time'),
      frameIndex: frameIndex,
      property: 'time',
      oldValue: oldTime,
      newValue: time
    };
  
    this.historyManager.addChange(operation);
  }

  updateFramesUI() {
    if (!this.project) return;
  
    const frameCount = this.project.frames.length;
    
    // Initialize frame times if needed
    if (this.project.frameTimes.length !== frameCount) {
      this.project.frameTimes = new Array(frameCount).fill(this.project.currentFrameTime);
    }
  
    // Get all current children
    const timelineChildren = Array.from(this.timelineContent.children);
    
    // Find or create add button
    let addButton = timelineChildren.find(child => child.classList.contains('add-button'));
    if (!addButton) {
      addButton = document.createElement("div");
      addButton.className = "timeline-frame add-button";
      addButton.innerHTML = `
        <div class="add-button-icon">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </div>
        <span>${__("Añadir||Add")}</span>
      `;
      addButton.addEventListener("click", () => this.addFrame());
      this.timelineContent.appendChild(addButton);
    }
  
    // Get existing frame elements (excluding add button)
    const existingFrames = timelineChildren.filter(child => !child.classList.contains('add-button'));
    
    // Calculate how many frames we need to add/remove
    const framesToAdd = Math.max(0, frameCount - existingFrames.length);
    const framesToRemove = Math.max(0, existingFrames.length - frameCount);
    
    // Remove excess frames from the end
    for (let i = 0; i < framesToRemove; i++) {
      const lastFrame = existingFrames[existingFrames.length - 1 - i];
      if (lastFrame && lastFrame.parentNode) {
        lastFrame.remove();
      }
    }
    
    // Update existing frames
    for (let i = 0; i < Math.min(frameCount, existingFrames.length); i++) {
      const frame = this.project.frames[i];
      const frameElement = existingFrames[i];
      
      // Update classes
      frameElement.className = `timeline-frame ${i === this.project.currentFrame ? "active" : ""}`;
      frameElement.setAttribute("data-index", i);
      
      // Update thumbnail
      const thumbContainer = frameElement.querySelector(".frame-thumb");
      if (thumbContainer) {
        // Clear old thumbnail
        thumbContainer.innerHTML = "";
        
        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.width = this.project.width;
        thumbCanvas.height = this.project.height;
        thumbCanvas.style.width = "auto";
        thumbCanvas.style.height = "60px";
        thumbCanvas.style.backgroundColor = "#fff";
        thumbCanvas.style.backgroundImage = "var(--transparent-bg)";
        thumbCanvas.style.backgroundSize = "16px 16px";

        const thumbCtx = this.getCanvasContext(thumbCanvas);
  
        // Draw background
        if (!this.transparentBackground) {
          thumbCtx.fillStyle = this.secondaryColor;
          thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        }
  
        // Draw all visible layers
        for (let l = 0; l < frame.layers.length; l++) {
          if (frame.layers[l].visible) {
            thumbCtx.drawImage(frame.layers[l].canvas, 0, 0);
          }
        }
  
        thumbContainer.appendChild(thumbCanvas);
      }
      
      // Update time display
      const timeDisplay = frameElement.querySelector(".frame-time");
      if (timeDisplay) {
        timeDisplay.textContent = `${this.project.frameTimes[i].toFixed(2)}ms`;
      }
      
      // Update frame number
      const frameNumber = frameElement.querySelector(".frame-number");
      if (frameNumber) {
        frameNumber.textContent = i + 1;
      }
    }
    
    // Add new frames if needed
    if (framesToAdd > 0) {
      for (let i = existingFrames.length; i < frameCount; i++) {
        const frame = this.project.frames[i];
        const frameElement = document.createElement("div");
        frameElement.className = `timeline-frame ${i === this.project.currentFrame ? "active" : ""}`;
        frameElement.setAttribute("data-index", i);
        frameElement.draggable = true;
  
        // Frame thumbnail
        const thumbContainer = document.createElement("div");
        thumbContainer.className = "frame-thumb";
        frameElement.appendChild(thumbContainer);
        
        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.width = this.project.width;
        thumbCanvas.height = this.project.height;
        thumbCanvas.style.width = "auto";
        thumbCanvas.style.height = "60px";
        thumbCanvas.style.backgroundColor = "#fff";
        thumbCanvas.style.backgroundImage = "var(--transparent-bg)";
        thumbCanvas.style.backgroundSize = "16px 16px";
        
        const thumbCtx = this.getCanvasContext(thumbCanvas);
  
        // Draw background
        if (!this.transparentBackground) {
          thumbCtx.fillStyle = this.secondaryColor;
          thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        }
  
        // Draw all visible layers
        for (let l = 0; l < frame.layers.length; l++) {
          if (frame.layers[l].visible) {
            thumbCtx.drawImage(frame.layers[l].canvas, 0, 0);
          }
        }
  
        thumbContainer.appendChild(thumbCanvas);
  
        // Frame time display
        const timeDisplay = document.createElement("div");
        timeDisplay.className = "frame-time";
        timeDisplay.textContent = `${this.project.frameTimes[i].toFixed(2)}ms`;
        frameElement.appendChild(timeDisplay);
  
        // Frame number
        const frameNumber = document.createElement("div");
        frameNumber.className = "frame-number";
        frameNumber.textContent = i + 1;
        frameElement.appendChild(frameNumber);
  
        // Event listeners
        frameElement.addEventListener("dragstart", e => {
          e.dataTransfer.setData("text/plain", i.toString());
          frameElement.classList.add("dragging");
        });
  
        frameElement.addEventListener("dragend", () => {
          frameElement.classList.remove("dragging");
        });
  
        frameElement.addEventListener("dragover", e => {
          e.preventDefault();
        });
  
        frameElement.addEventListener("drop", e => {
          e.preventDefault();
          const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
          const toIndex = i;
          if (fromIndex !== toIndex) {
            this.moveFrame(fromIndex, toIndex);
          }
        });
  
        timeDisplay.addEventListener("click", e => {
          this.showFrameTimeDialog(i);
          e.stopPropagation();
        });
  
        frameElement.addEventListener("click", e => {
          this.project.currentFrame = i;
          this.render();
          e.stopPropagation();
        });
  
        this.setupTimelineSwipe(frameElement, i);
  
        // Insert before add button
        this.timelineContent.insertBefore(frameElement, addButton);
      }
    }
  
    this.updateAnimationPreview();
  }
  
  updateFramesUIQuick() {
    if (!this.project) return;
  
    // Update active class on frames
    const frameElements = this.timelineContent.children;
    for (let i = 0; i < frameElements.length - 1; i++) { // -1 for add button
      const frameEl = frameElements[i];
      if (frameEl.classList.contains('timeline-frame')) {
        if (i === this.project.currentFrame) {
          frameEl.classList.add('active');
        } else {
          frameEl.classList.remove('active');
        }
      }
    }
  
    // Update animation preview only
    this.updateAnimationPreview();
  }
  
  // Layer Management
  addLayer() {
    if (!this.project) return;
  
    this.historyManager.startBatch("add_layer", __("Añadir Capa||Add Layer"));
  
    const frame = this.project.frames[this.project.currentFrame];
    const newLayer = this.createBlankLayer(this.project.width, this.project.height, `Layer ${frame.layers.length + 1}`);
    const layerIndex = frame.layers.length;
  
    frame.layers.push(newLayer);
    this.project.currentLayer = layerIndex;
  
    // Record operation
    const operation = {
      type: 'add_layer',
      description: __('Añadir Capa||Add Layer'),
      frameIndex: this.project.currentFrame,
      layerIndex: layerIndex,
      layerData: {
        name: newLayer.name,
        visible: this.registerLayerVisibilityChanges ? newLayer.visible : true,
        imageData: Array.from(newLayer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }
    };
    
    this.showOperationMessage(__("Nueva capa añadida||New layer added"));
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    this.render();
  }
  
  removeLayer() {
    if (!this.project) return;
  
    const frame = this.project.frames[this.project.currentFrame];
    if (frame.layers.length <= 1) return;
  
    this.historyManager.startBatch("remove_layer", __("Quitar capa||Remove Layer"));
  
    const layerIndex = this.project.currentLayer;
    const removedLayer = frame.layers[layerIndex];
  
    frame.layers.splice(layerIndex, 1);
    this.project.currentLayer = Math.min(layerIndex, frame.layers.length - 1);
  
    // Record operation
    const operation = {
      type: 'remove_layer',
      description: __('Quitar capa||Remove Layer'),
      frameIndex: this.project.currentFrame,
      layerIndex: layerIndex,
      layerData: {
        name: removedLayer.name,
        visible: this.registerLayerVisibilityChanges ? removedLayer.visible : true,
        imageData: Array.from(removedLayer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }
    };
    
    this.showOperationMessage(__("Capa quitada||Layer removed"));
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();

    this.render();
  }
  
  setLayerVisibility(frameIndex, layerIndex, visible) {
    if (!this.project || !this.project.frames[frameIndex] || !this.project.frames[frameIndex].layers[layerIndex]) return;
  
    const layer = this.project.frames[frameIndex].layers[layerIndex];
    const oldVisibility = layer.visible;
    layer.visible = visible;
  
    // Record operation
    const operation = {
      type: 'change_layer_visibility',
      description: __('Cambiar visibilidad de la capa||Change Layer Visibility'),
      frameIndex: frameIndex,
      layerIndex: layerIndex,
      visible: visible,
      oldVisible: oldVisibility
    };
  
    // Only save if enabled
    if (this.registerLayerVisibilityChanges) {
      this.historyManager.addChange(operation);
    }
    
    this.render();
  }
  
  moveLayer(frameIndex, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
  
    this.historyManager.startBatch("move_layer", "Move Layer");
  
    const frame = this.project.frames[frameIndex];
    const layer = frame.layers.splice(fromIndex, 1)[0];
    frame.layers.splice(toIndex, 0, layer);
    this.project.currentLayer = toIndex;
  
    // Record operation
    const operation = {
      type: 'move_layer',
      description: 'Move Layer',
      frameIndex: frameIndex,
      fromIndex: fromIndex,
      toIndex: toIndex
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    this.render();
  }
    
  prevLayer() {
    if (!this.project) return;
    const newIndex = Math.max(0, this.project.currentLayer - 1);
    this.project.currentLayer = newIndex;
    this.updateLayersUI();
  }
  
  nextLayer() {
    if (!this.project) return;
    const frame = this.project.frames[this.project.currentFrame];
    const newIndex = Math.min(frame.layers.length - 1, this.project.currentLayer + 1);
    this.project.currentLayer = newIndex;
    this.updateLayersUI();
  }
  
  duplicateLayer() {
    if (!this.project) return;
    
    const frame = this.project.frames[this.project.currentFrame];
    const sourceIndex = this.project.currentLayer;
    const sourceLayer = frame.layers[sourceIndex];
    const newIndex = sourceIndex + 1;
  
    this.historyManager.startBatch("duplicate_layer", __("Duplicar capa||Duplicate Layer"));
  
    // Create new layer with copy of content
    const newLayer = this.createBlankLayer(
      this.project.width, 
      this.project.height, 
      `${sourceLayer.name} (${__("copia||copy")})`
    );
    newLayer.visible = sourceLayer.visible;
    newLayer.ctx.drawImage(sourceLayer.canvas, 0, 0);
  
    // Insert after current
    frame.layers.splice(newIndex, 0, newLayer);
    this.project.currentLayer = newIndex;
  
    // Record operation
    const operation = {
      type: 'duplicate_layer',
      description: __('Duplicar capa||Duplicate Layer'),
      frameIndex: this.project.currentFrame,
      layerIndex: newIndex,
      layerData: {
        name: newLayer.name,
        visible: newLayer.visible,
        imageData: Array.from(newLayer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
      }
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
  
    this.showOperationMessage(__('Capa duplicada||Layer duplicated'));
    this.updateLayersUI();
    this.render();
  }

  renameLayer(name, index) {
    if (!this.project) return;
    
    this.historyManager.startBatch("rename_layer", __("Renombrar capa||Rename Layer"));
    
    const layerIndex = typeof index != "undefined" ? index : this.currentLayer;
    let previousName;
    let newName = name;
    
    // Rename the layer in all frames
    this.project.frames.forEach(frame => {
      const layer = frame.layers[layerIndex];
      
      if (!previousName) previousName = layer.name;
      
      layer.name = newName || layer.name;
    });
    
    // Record operation
    const operation = {
      type: 'rename_layer',
      description: __('Renombrar capa||Rename Layer'),
      layerIndex,
      previousName,
      newName
    };

    this.historyManager.addChange(operation);
    this.historyManager.endBatch();

    this.showOperationMessage(__("Nombre editado||Name edited"));
  }
  
  mergeLayerUp(layerIndex = this.project.currentLayer) {
    if (!this.project) return;
    
    const frame = this.project.frames[this.project.currentFrame];
    if (layerIndex >= frame.layers.length - 1) return; // Already top layer
  
    const sourceIndex = layerIndex;
    const targetIndex = layerIndex + 1;
    
    this.historyManager.startBatch("merge_layers", __("Combinar capas||Merge Layers"));
  
    // Store data before merge
    const sourceLayer = frame.layers[sourceIndex];
    const targetLayer = frame.layers[targetIndex];
    
    const sourceData = {
      name: sourceLayer.name,
      visible: sourceLayer.visible,
      imageData: Array.from(sourceLayer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
    };
    
    const targetData = {
      name: targetLayer.name,
      visible: targetLayer.visible,
      imageData: Array.from(targetLayer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
    };
  
    // Perform merge
    targetLayer.ctx.drawImage(sourceLayer.canvas, 0, 0);
    frame.layers.splice(sourceIndex, 1);
    this.project.currentLayer = targetIndex - 1;
  
    // Record operation
    const operation = {
      type: 'merge_layers',
      description: __('Combinar capas||Merge Layers'),
      frameIndex: this.project.currentFrame,
      sourceIndex: sourceIndex,
      targetIndex: targetIndex,
      sourceData: sourceData,
      targetData: targetData
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
    
    this.showOperationMessage(__('Capas combinadas||Layers merged'));
    this.updateLayersUI();
    this.render();
  }  
  
  mergeLayerDown(layerIndex = this.project.currentLayer) {
    if (!this.project) return;
    
    const frame = this.project.frames[this.project.currentFrame];
    if (layerIndex <= 0) return; // Already bottom layer
  
    const sourceIndex = layerIndex;
    const targetIndex = layerIndex - 1;
    
    this.historyManager.startBatch("merge_layers", __("Combinar capas||Merge Layers"));
  
    // Store data before merge
    const sourceLayer = frame.layers[sourceIndex];
    const targetLayer = frame.layers[targetIndex];
    
    const sourceData = {
      name: sourceLayer.name,
      visible: sourceLayer.visible,
      imageData: Array.from(sourceLayer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
    };
    
    const targetData = {
      name: targetLayer.name,
      visible: targetLayer.visible,
      imageData: Array.from(targetLayer.ctx.getImageData(0, 0, this.project.width, this.project.height).data)
    };
  
    // Perform merge
    targetLayer.ctx.drawImage(sourceLayer.canvas, 0, 0);
    frame.layers.splice(sourceIndex, 1);
    this.project.currentLayer = targetIndex;
  
    // Record operation
    const operation = {
      type: 'merge_layers',
      description: __('Combinar capas||Merge Layers'),
      frameIndex: this.project.currentFrame,
      sourceIndex: sourceIndex,
      targetIndex: targetIndex,
      sourceData: sourceData,
      targetData: targetData
    };
  
    this.historyManager.addChange(operation);
    this.historyManager.endBatch();
    
    this.showOperationMessage(__('Capas combinadas||Layers merged'));
    this.updateLayersUI();
    this.render();
  }
      
  createBlankLayer(width, height, name = `Layer ${this.project && this.project.frames.length ? this.project.frames[0].layers.length + 1 : 1}`) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = this.getCanvasContext(canvas);

    return {
      canvas: canvas,
      ctx: ctx,
      visible: true,
      name
    };
  }
  
  updateLayersUI() {
    if (!this.project) return;
    
    const frame = this.project.frames[this.project.currentFrame];
    const layerCount = frame.layers.length;
    
    // Clear the entire container (just like animation panel)
    this.layersContainer.innerHTML = "";
    
    // Create header with controls (like timeline header)
    const header = document.createElement("div");
    header.className = "layers-header";
    
    // Previous layer button
    const prevLayerBtn = document.createElement("button");
    prevLayerBtn.className = "ui-button";
    prevLayerBtn.innerHTML = '<div class="icon icon-prev"></div>';
    prevLayerBtn.title = __("Capa anterior||Previous Layer");
    prevLayerBtn.addEventListener("click", () => this.prevLayer());
    header.appendChild(prevLayerBtn);
    
    // Next layer button
    const nextLayerBtn = document.createElement("button");
    nextLayerBtn.className = "ui-button";
    nextLayerBtn.innerHTML = '<div class="icon icon-next"></div>';
    nextLayerBtn.title = __("Capa siguiente||Next Layer");
    nextLayerBtn.addEventListener("click", () => this.nextLayer());
    header.appendChild(nextLayerBtn);
    
    // Add layer button
    const addLayerBtn = document.createElement("button");
    addLayerBtn.className = "ui-button";
    addLayerBtn.innerHTML = '<div class="icon icon-add"></div>';
    addLayerBtn.title = __("Añadir capa||Add Layer");
    addLayerBtn.addEventListener("click", () => this.addLayer());
    header.appendChild(addLayerBtn);
    
    // Duplicate layer button
    const duplicateLayerBtn = document.createElement("button");
    duplicateLayerBtn.className = "ui-button";
    duplicateLayerBtn.innerHTML = '<div class="icon icon-copy"></div>';
    duplicateLayerBtn.title = __("Duplicar capa||Duplicate Layer");
    duplicateLayerBtn.addEventListener("click", () => this.duplicateLayer());
    header.appendChild(duplicateLayerBtn);
    
    // Merge with top button
    const mergeTopBtn = document.createElement("button");
    mergeTopBtn.className = "ui-button";
    mergeTopBtn.innerHTML = '<div class="icon icon-merge-up"></div>';
    mergeTopBtn.title = __("Combinar con superior||Merge with Top");
    mergeTopBtn.addEventListener("click", () => this.mergeLayerUp());
    header.appendChild(mergeTopBtn);
    
    // Merge with bottom button
    const mergeBottomBtn = document.createElement("button");
    mergeBottomBtn.className = "ui-button";
    mergeBottomBtn.innerHTML = '<div class="icon icon-merge-down"></div>';
    mergeBottomBtn.title = __("Combinar con inferior||Merge with Bottom");
    mergeBottomBtn.addEventListener("click", () => this.mergeLayerDown());
    header.appendChild(mergeBottomBtn);
    
    this.layersContainer.appendChild(header);
    
    // Create layers in reverse order (top layer first in UI)
    for (let i = layerCount - 1; i >= 0; i--) {
      const layer = frame.layers[i];
      const layerElement = document.createElement("div");
      layerElement.className = "layer-item";
      if (i === this.project.currentLayer) {
        layerElement.classList.add('active');
      }
      layerElement.setAttribute("data-index", i);
      layerElement.draggable = true;
  
      // Thumbnail container
      const thumbContainer = document.createElement("div");
      thumbContainer.className = "layer-thumb";
      layerElement.appendChild(thumbContainer);
  
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = this.project.width;
      thumbCanvas.height = this.project.height;
      thumbCanvas.style.width = "auto";
      thumbCanvas.style.height = "44px";
      thumbCanvas.style.backgroundColor = "#fff";
      thumbCanvas.style.backgroundImage = "var(--transparent-bg)";
      thumbCanvas.style.backgroundSize = "16px 16px";
      
      const thumbCtx = this.getCanvasContext(thumbCanvas);
      
      // Draw background
      if (!this.transparentBackground) {
        thumbCtx.fillStyle = this.secondaryColor;
        thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
      }
      
      // Draw layer content
      if (layer.canvas) {
        thumbCtx.drawImage(layer.canvas, 0, 0);
      }
      
      thumbContainer.appendChild(thumbCanvas);
  
      // Layer name
      const layerName = document.createElement("input");
      layerName.className = "layer-name";
      layerName.value = layer.name;
      layerElement.appendChild(layerName);
  
      // Layer actions
      const layerActions = document.createElement("div");
      layerActions.className = "layer-actions";
  
      // Move up button - disabled if at top
      const moveUpBtn = document.createElement("button");
      moveUpBtn.className = "ui-button layer-action";
      moveUpBtn.innerHTML = '<div class="icon icon-up"></div>';
      moveUpBtn.title = __("Subir||Move Up");
      if (i >= layerCount - 1) {
        moveUpBtn.disabled = true;
        moveUpBtn.classList.add("disabled");
      } else {
        moveUpBtn.addEventListener("click", e => {
          e.stopPropagation();
          this.moveLayer(this.project.currentFrame, i, i + 1);
        });
      }
      layerActions.appendChild(moveUpBtn);
  
      // Move down button - disabled if at bottom
      const moveDownBtn = document.createElement("button");
      moveDownBtn.className = "ui-button layer-action";
      moveDownBtn.innerHTML = '<div class="icon icon-down"></div>';
      moveDownBtn.title = __("Bajar||Move Down");
      if (i <= 0) {
        moveDownBtn.disabled = true;
        moveDownBtn.classList.add("disabled");
      } else {
        moveDownBtn.addEventListener("click", e => {
          e.stopPropagation();
          this.moveLayer(this.project.currentFrame, i, i - 1);
        });
      }
      layerActions.appendChild(moveDownBtn);
  
      // Visibility toggle
      const visibilityBtn = document.createElement("button");
      visibilityBtn.className = "ui-button layer-action";
      visibilityBtn.innerHTML = layer.visible ? 
        '<div class="icon icon-visible"></div>' : 
        '<div class="icon icon-hidden"></div>';
      visibilityBtn.title = __("Visibilidad||Toggle Visibility");
      visibilityBtn.addEventListener("click", e => {
        e.stopPropagation();
        this.setLayerVisibility(this.project.currentFrame, i, !layer.visible);
      });
      layerActions.appendChild(visibilityBtn);
  
      // Merge up button - disabled if at top
      const mergeUpBtn = document.createElement("button");
      mergeUpBtn.className = "ui-button layer-action";
      mergeUpBtn.innerHTML = '<div class="icon icon-merge-up"></div>';
      mergeUpBtn.title = __("Combinar arriba||Merge Up");
      if (i >= layerCount - 1) {
        mergeUpBtn.disabled = true;
        mergeUpBtn.classList.add("disabled");
      } else {
        mergeUpBtn.addEventListener("click", e => {
          e.stopPropagation();
          this.mergeLayerUp(i);
        });
      }
      layerActions.appendChild(mergeUpBtn);
  
      // Merge down button - disabled if at bottom
      const mergeDownBtn = document.createElement("button");
      mergeDownBtn.className = "ui-button layer-action";
      mergeDownBtn.innerHTML = '<div class="icon icon-merge-down"></div>';
      mergeDownBtn.title = __("Combinar abajo||Merge Down");
      if (i <= 0) {
        mergeDownBtn.disabled = true;
        mergeDownBtn.classList.add("disabled");
      } else {
        mergeDownBtn.addEventListener("click", e => {
          e.stopPropagation();
          this.mergeLayerDown(i);
        });
      }
      layerActions.appendChild(mergeDownBtn);
  
      // Remove button - always enabled if more than one layer
      const removeBtn = document.createElement("button");
      removeBtn.className = "ui-button layer-action";
      removeBtn.innerHTML = '<div class="icon icon-close"></div>';
      removeBtn.title = __("Eliminar||Remove");
      if (layerCount <= 1) {
        removeBtn.disabled = true;
        removeBtn.classList.add("disabled");
      } else {
        removeBtn.addEventListener("click", e => {
          e.stopPropagation();
          this.removeLayer(i);
        });
      }
      layerActions.appendChild(removeBtn);
  
      layerElement.appendChild(layerActions);
  
      // Drag and drop events
      layerElement.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", i.toString());
        layerElement.classList.add("dragging");
      });
  
      layerElement.addEventListener("dragend", () => {
        layerElement.classList.remove("dragging");
      });
  
      layerElement.addEventListener("dragover", e => {
        e.preventDefault();
      });
  
      layerElement.addEventListener("drop", e => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
        const toIndex = i;
        if (fromIndex !== toIndex) {
          this.moveLayer(this.project.currentFrame, fromIndex, toIndex);
        }
      });
  
      layerElement.addEventListener("click", () => {
        if (this.project.currentLayer != i) {
          this.project.currentLayer = i;
          this.updateLayersUI();
        }
      });
      
      layerName.addEventListener("change", () => {
        this.renameLayer(layerName.value, i);
        layerName.blur();
      });
  
      this.layersContainer.appendChild(layerElement);
    }
  }  
  
  showButtonToast(message, button, undoCallback) {
    const toast = document.createElement("div");
    toast.className = "toast-with-button";
      toast.innerHTML = `
      <span>${message || ''}</span>
      <button class="toast-button">${button || __("Deshacer||Undo")}</button>
    `;

    this.editorElement.appendChild(toast);

    // Add event listener
    toast.querySelector(".toast-button").addEventListener("click", () => {
      undoCallback();
      toast.remove();
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }

  setupTimelineSwipe(element, index) {
    let startY;
    let isSwiping = false;

    element.addEventListener("touchstart", e => {
      startY = e.touches[0].clientY;
      isSwiping = true;
    });

    element.addEventListener("touchmove", e => {
      if (!isSwiping) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      // Vertical swipe up (delete)
      if (deltaY < -30) {
        e.preventDefault();
        element.style.transform = `translateY(${deltaY}px)`;
        element.style.opacity = `${1 - Math.abs(deltaY) / 100}`;
      }
    });

    element.addEventListener("touchend", e => {
      if (!isSwiping) return;

      const currentY = e.changedTouches[0].clientY;
      const deltaY = currentY - startY;

      if (deltaY < -60) {
        // Swipe threshold reached - delete frame
        this.removeFrame(index);
      }

      // Reset transform
      element.style.transform = "";
      element.style.opacity = "";
      isSwiping = false;
    });
  }

  showFrameTimeDialog(frameIndex) {
    const content = document.createElement("div");
    content.innerHTML = `
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px;">${__("Tiempo del Frame||Frame Time")} (ms):</label>
      <input type="number" id="frame-time-value" value="${this.project.frameTimes[frameIndex]}" min="1" max="5000" style="width: 100%; padding: 5px;">
    </div>
  `;

    this.showPopup(__("Cambiar Tiempo del Frame||Set Frame Time"), content, [
      {
        text: __("Cancelar||Cancel"),
        class: "cancel",
        action: () => this.hidePopup()
      },
      {
        text: __("Aplicar||Apply"),
        action: () => {
          const time = parseInt(document.getElementById("frame-time-value").value);
          if (time >= 1 && time <= 5000) {
            this.setFrameTime(frameIndex, time);
            this.updateFramesUI();
            this.hidePopup();
          }
        }
      }
    ]);
  }

  updateFPS(input) {
    let fps = parseInt(input || this.fpsInput.value);
    if (fps >= 1 && fps <= 60) {
      const oldFPS = 1000 / this.project.currentFrameTime;
      const oldFrameTimes = this.project.frameTimes;
      this.project.currentFrameTime = 1000 / fps;
  
      // Update all frame times
      this.project.frameTimes = this.project.frameTimes.map(() => this.project.currentFrameTime);
  
      // Record operation
      const operation = {
        type: 'change_animation_fps',
        description: __('Cambiar FPS||Change FPS'),
        oldFPS: oldFPS,
        newFPS: fps,
        oldFrameTimes: oldFrameTimes,
        newFrameTimes: this.project.frameTimes
      };
  
      this.historyManager.addChange(operation);
  
      this.updateFramesUI();
  
      // Restart animation if playing
      if (this.isPlaying) {
        this.stopAnimation();
        this.startAnimation();
      }
    }
  }
  
  togglePlayback() {
    if (this.isPlaying) {
      this.stopAnimation();
    } else {
      this.startAnimation();
    }
  }

  startAnimation() {
    if (this.project.frames.length <= 1) return;

    this.isPlaying = true;
    this.playPauseButton.querySelector(".icon").className = "icon icon-pause";

    let currentFrame = this.project.currentFrame;
    let startTime = Date.now();
    let accumulatedTime = 0;

    this.animationInterval = setInterval(() => {
      const now = Date.now();
      const delta = now - startTime - accumulatedTime;
      accumulatedTime += delta;

      // Calculate which frame to show based on accumulated time
      let timeSum = 0;
      let nextFrame = currentFrame;

      for (let i = 0; i < this.project.frameTimes.length; i++) {
        timeSum += this.project.frameTimes[i];
        if (accumulatedTime < timeSum) {
          nextFrame = i;
          break;
        }
      }

      // Loop around if we've passed the end
      if (accumulatedTime >= timeSum) {
        accumulatedTime = 0;
        nextFrame = 0;
        startTime = Date.now();
      }

      if (nextFrame !== currentFrame) {
        currentFrame = nextFrame;
        if (!this.showMiniView) {
          this.project.currentFrame = currentFrame;
          this.renderQuick();
        } else if (!this.isDrawing) {
          this.updateAnimationPreview(currentFrame);
        }        
      }
    }, 16); // ~60fps update rate
  }

  stopAnimation() {
    this.isPlaying = false;
    if (this.playPauseButton) {
      this.playPauseButton.querySelector(".icon").className = "icon icon-play";
    }

    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  prevFrame() {
    if (this.project.frames.length <= 1) return;

    this.project.currentFrame = (this.project.currentFrame - 1 + this.project.frames.length) % this.project.frames.length;
    this.render();
  }

  nextFrame() {
    if (this.project.frames.length <= 1) return;

    this.project.currentFrame = (this.project.currentFrame + 1) % this.project.frames.length;
    this.render();
  }

  updateAnimationPreview(currentFrame = this.project.currentFrame) {
    if (!this.project || !this.animationPreview) return;

    const frame = this.project.frames[currentFrame];
    this.animationPreview.width = this.project.width;
    this.animationPreview.height = this.project.height;

    const ctx = this.getCanvasContext(this.animationPreview);
    ctx.clearRect(0, 0, this.animationPreview.width, this.animationPreview.height);

    // Draw background
    if (!this.transparentBackground) {
      ctx.fillStyle = this.secondaryColor;
      ctx.fillRect(0, 0, this.animationPreview.width, this.animationPreview.height);
    }

    // Draw all visible layers
    for (let l = 0; l < frame.layers.length; l++) {
      if (frame.layers[l].visible) {
        ctx.drawImage(frame.layers[l].canvas, 0, 0, this.project.width, this.project.height, 0, 0, this.animationPreview.width, this.animationPreview.height);
      }
    }
  }

  hasTransparency(canvas) {
    const ctx = this.getCanvasContext(canvas);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  }

  showFPSDialog() {
    const content = document.createElement("div");
    content.innerHTML = `
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px;">${__("Frames Por Segundo||Frames Per Second")}:</label>
      <input type="number" id="fps-value" value="${parseInt(1000 / this.project.currentFrameTime)}" min="1" max="60" style="width: 100%; padding: 5px;">
    </div>
  `;

    this.showPopup(__("Cambiar FPS||Set Animation FPS"), content, [
      {
        text: __("Cancelar||Cancel"),
        class: "cancel",
        action: () => this.hidePopup()
      },
      {
        text: __("Aplicar||Apply"),
        action: () => {
          const fps = parseInt(document.getElementById("fps-value").value);
          if (fps >= 1 && fps <= 60) {
            this.fpsInput.value = fps;
            this.updateFPS(fps);
            this.hidePopup();
          }
        }
      }
    ]);
  }

  showCurrentFrameTimeDialog() {
    this.showFrameTimeDialog(this.project.currentFrame);
  }

  // Initialize file handling
  initFileHandling() {
    this.isCordova = typeof window.cordova !== "undefined";
    this.isFilePluginAvailable = this.isCordova && typeof window.File !== "undefined";
    this.lastSavedPath = null;
  }

  // Main file operations
  openFile() {
    const fileBrowser = this.getFileBrowser({
      mode: "open",
      fileTypes: ["pxl", "psd", "png", "jpg", "jpeg", "pal"],
      onConfirm: async fileInfo => {
        try {
          const fileData = await this.readFile(fileInfo);

          if (fileInfo.type === "pxl") {
            this.loadProject(fileData);
          } else if (fileInfo.type === "psd") {
            await this.importPSD(fileData, fileInfo.name);
          } else if (fileInfo.type === "pal") {
            this.parsePalFile(fileData);
            this.updatePaletteGrid();
            this.showToast(__(`(Paleta|Palette) ${fileInfo.name} (cargada|loaded)`));
          } else {
            this.importImage(fileData, fileInfo.name);
          }

          this.showToast(__(`(Archivo|File) ${fileInfo.name} (abierto|opened)`));
          this.menuPanelOverlay.classList.remove("visible");
        } catch (error) {
          this.showToast(__(`(Error al abrir el archivo|Error opening file): ${error.message}`), 5000);
          console.error(error);
        }
      },
      onError: error => {
        this.showToast(__(`(Error de archivo|File error): ${error.message}`), 5000);
      }
    });

    fileBrowser.show();
  }

  saveProject(quickSave) {
    if (!this.project) return;

    if (this.lastSavedPath) {
      this.saveFile(this.lastSavedPath, "pxl", this.getProjectData());
    } else if (!quickSave) {
      this.saveAs();
    }
  }

  saveAs() {
    const fileBrowser = this.getFileBrowser({
      mode: "saveAs",
      fileTypes: ["pxl", "psd", "png"],
      defaultType: "pxl",
      defaultName: this.project.name || "untitled",
      onConfirm: async fileInfo => {
        try {
          this.lastSavedPath = fileInfo.name;

          if (fileInfo.type === "pxl") {
            await this.saveFile(fileInfo.name, "pxl", this.getProjectData());
          } else if (fileInfo.type === "psd") {
            const psdBlob = await this.exportAsPSD();
            await this.saveFile(fileInfo.name, "psd", psdBlob);
          } else {
            const dataURL = this.canvas.toDataURL("image/png");
            await this.saveFile(fileInfo.name, "png", dataURL);
          }
          
          this.showToast(__(`(Archivo guardado como|File saved as) ${fileInfo.name}`));
        } catch (error) {
          this.showToast(__(`(Error al guardar el archivo|Error saving file): ${error.message}`), 5000);
          console.error(error);
        }
      }
    });

    fileBrowser.show();
  }

  exportCurrentFrame() {
    if (!this.project) return;

    const fileBrowser = this.getFileBrowser({
      title: "Export frame",
      mode: "saveAs",
      fileTypes: ["png"],
      defaultType: "png",
      defaultName: `frame_${this.project.currentFrame + 1}`,
      onConfirm: async fileInfo => {
        try {
          const frame = this.project.frames[this.project.currentFrame];
          const canvas = this.renderFrameToCanvas(frame);
          const dataURL = canvas.toDataURL("image/png");

          await this.saveFile(fileInfo.name, "png", dataURL);
          this.showToast(__(`Frame (exportado como|exported as) ${fileInfo.name}`));
        } catch (error) {
          this.showToast(__(`(Error exportando el frame|Error exporting frame): ${error.message}`), 5000);
          console.error(error);
        }
      }
    });

    fileBrowser.show();
  }

  exportAnimation() {
    if (!this.project || this.project.frames.length <= 1) {
      this.showToast("Project has only one frame", 3000);
      return;
    }

    const fileBrowser = this.getFileBrowser({
      title: "Export animation sheet",
      mode: "saveAs",
      fileTypes: ["png"],
      defaultType: "png",
      defaultName: `animation_${this.project.name || Date.now()}`,
      onConfirm: async fileInfo => {
        try {
          const spriteSheet = this.createSpriteSheet();
          const dataURL = spriteSheet.toDataURL("image/png");

          await this.saveFile(fileInfo.name, "png", dataURL);
          this.showToast(__(`(Animación exportada como|Animation exported as) ${fileInfo.name}`));
        } catch (error) {
          this.showToast(__(`(Error exportando animación|Error exporting animation): ${error.message}`), 5000);
          console.error(error);
        }
      }
    });

    fileBrowser.show();
  }
  
  showSpritesheetLoader() {
    if (!this.spritesheetLoader) {
      this.spritesheetLoader = new SpritesheetLoader(this);
    }
    this.spritesheetLoader.show();
  }

  async readFile(fileInfo) {
    if (fileInfo.entry) {
      // Cordova file entry
      return this.readCordovaFile(fileInfo.entry);
    } else if (fileInfo.file) {
      // Browser file object
      return this.readBrowserFile(fileInfo.file);
    }
    throw new Error("Unsupported file source");
  }

  async readCordovaFile(fileEntry) {
    return new Promise((resolve, reject) => {
      fileEntry.file(
        file => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Failed to read file"));

          if (file.name.endsWith(".pxl") || file.name.endsWith(".anim") || file.name.endsWith(".pal") || file.name.endsWith(".txt")) {
            reader.readAsText(file);
          } else {
            reader.readAsDataURL(file);
          }
        },
        error => {
          reject(new Error(`Could not read file: ${error.code}`));
        }
      );
    });
  }

  async readBrowserFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file"));

      if (file.name.endsWith(".pxl") || file.name.endsWith(".anim") || file.name.endsWith(".pal") || file.name.endsWith(".txt")) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  }

  async saveFile(filename, type, data) {
    if (this.isCordova && this.isFilePluginAvailable) {
      try {
        await this.saveWithCordova(filename, type, data);
      } catch (error) {
        console.error("Cordova save failed, falling back to browser:", error);
        this.saveWithBrowser(filename, type, data);
      }
    } else {
      this.saveWithBrowser(filename, type, data);
    }
  }

  async saveWithCordova(filename, type, data) {
    return new Promise((resolve, reject) => {
      // Check if Cordova is available
      if (!window.requestFileSystem) {
        window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
      }

      if (!window.requestFileSystem) {
        reject(new Error("File system API not available"));
        return;
      }

      // Use PERSISTENT storage (same as your working code)
      window.requestFileSystem(
        window.PERSISTENT || 1, // Use 1 if PERSISTENT is undefined
        5 * 1024 * 1024, // 5MB
        fileSystem => {
          // Create or get the file
          fileSystem.root.getFile(
            this.fileBrowser.workingDirectory + filename,
            { create: true, exclusive: false },
            entry => {
              entry.createWriter(
                writer => {
                  writer.onwriteend = () => {
                    this.lastSavedPath = filename;
                    resolve();
                  };
                  writer.onerror = error => {
                    reject(new Error(`File write error: ${error.code}`));
                  };

                  let blob;
                  if (type === "pxl") {
                    blob = new Blob([data], { type: "application/json" });
                  } else {
                    blob = this.dataURLtoBlob(data);
                  }

                  writer.write(blob);
                },
                error => {
                  reject(new Error(`Could not create file writer: ${error.code}`));
                }
              );
            },
            error => {
              reject(new Error(`Could not create file: ${error.code}`));
            }
          );
        },
        error => {
          reject(new Error(`Could not access file system: ${error.code}`));
        }
      );
    });
  }

  async saveWithBrowser(filename, type, data) {
    try {
      let blob;

      if (data instanceof Blob) {
        // If it's already a Blob, use it directly
        blob = data;
      } else if (type === "pxl") {
        blob = new Blob([data], { type: "application/json" });
      } else if (type === "pal") {
        blob = new Blob([data], { type: "text/plain" });
      } else {
        // Assume it's a data URL for images
        blob = this.dataURLtoBlob(data);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error("Browser save failed:", error);
      this.showToast(__("Error al guardar||Failed to save file"), 3000);
    }
  }

  async exportAsPSD() {
    if (!this.project) return;
  
    try {
      // Build PSD structure from current frame
      const frame = this.project.frames[this.project.currentFrame];
      
      // Create PSD data structure
      const psdData = {
        width: this.project.width,
        height: this.project.height,
        children: []
      };
  
      // Add all layers (PSD layers are ordered from bottom to top)
      for (let i = 0; i < frame.layers.length; i++) {
        const layer = frame.layers[i];
        
        // Create a new canvas with the exact content (including transparency)
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = this.project.width;
        layerCanvas.height = this.project.height;
        const ctx = layerCanvas.getContext('2d');
        ctx.drawImage(layer.canvas, 0, 0);
        
        psdData.children.push({
          name: layer.name,
          canvas: layerCanvas,
          visible: layer.visible,
          opacity: 255, // Full opacity (PSD uses 0-255)
          blendMode: 'normal'
        });
      }
  
      // Write PSD data to ArrayBuffer
      const arrayBuffer = agPsd.writePsd(psdData);
      return new Blob([arrayBuffer], { type: 'application/octet-stream' });
      
    } catch (error) {
      console.error('Error exporting PSD:', error);
      throw new Error('Failed to export PSD');
    }
  }

  // Timelapse export methods
  async exportTimelapse() {
    if (!this.project || !this.historyManager.history.length) {
      this.showToast(__("No hay suficiente historia para exportar el proceso||Not enough history to export a timelapse"));
      return;
    }

    // Show configuration dialog
    const content = document.createElement("div");
    content.innerHTML = `
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px;">FPS:</label>
        <input type="number" id="timelapse-fps" value="${this.timelapseFPS}" min="1" max="60" style="width: 100%; padding: 5px;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px;">${__("Escala||Scale")}:</label>
        <input type="number" id="timelapse-scale" value="4" min="1" max="10" style="width: 100%; padding: 5px;">
      </div>
      <img style="display:none;image-rendering:pixelated;width:100%;height:auto;background-color:#fff;border:1px solid #000" class="timelapse-preview">
      <div class="timelapse-progress" style="display: none;">
        <div style="text-align: center; margin-bottom: 5px;">${__("Generando||Generating")} timelapse...</div>
        <progress value="0" max="100" style="width: 100%;"></progress>
        <div class="progress-text" style="text-align: center; margin-top: 5px;">0%</div>
      </div>
    `;

    const progressSection = content.querySelector(".timelapse-progress");
    const progressBar = content.querySelector("progress");
    const progressText = content.querySelector(".progress-text");

    this.showPopup(__("Exportar Timelapse||Export Timelapse"), content, [
      {
        text: __("Cancelar||Cancel"),
        class: "cancel",
        action: () => this.hidePopup()
      },
      {
        text: __("Generar||Generate"),
        action: async () => {
          const fps = parseInt(document.getElementById("timelapse-fps").value) || 30;
          const scale = parseInt(document.getElementById("timelapse-scale").value) || 4;

          // Show progress UI
          content.querySelector("div:first-child").style.display = "none";
          content.querySelector("div:nth-child(2)").style.display = "none";
          progressSection.style.display = "block";
          
          this.hidePopupButtons();

          try {
            const videoBlob = await this.generateTimelapse(fps, scale, (progress, previewImageData) => {
              progressBar.value = progress;
              progressText.textContent = `${progress}%`;
              const preview = content.querySelector(".timelapse-preview");
              if (preview && previewImageData) {
                preview.style.display = "flex";
                preview.src = previewImageData;
              }
            });

            // Now show file browser to save the video
            this.hidePopup();
            this.saveTimelapseWithBrowser(videoBlob);
          } catch (error) {
            this.showToast(__(`(Error generando proceso|Error generating timelapse): ${error.message}`), 5000);
            throw error;
          }
        }
      }
    ]);
  }

  async generateTimelapse(fps, scale, progressCallback) {
    return this.historyManager.generateTimelapse(fps, scale, progressCallback);
  }

  saveTimelapseWithBrowser(videoBlob) {
    const fileBrowser = this.getFileBrowser({
      mode: "saveAs",
      fileTypes: ["webm"],
      defaultType: "webm",
      defaultName: `timelapse_${this.project.name || "artwork"}_${this.formatDate(new Date())}`,
      onConfirm: async fileInfo => {
        try {
          await this.saveFile(fileInfo.name, "webm", videoBlob);
          this.showToast(__("Timelapse exportado||Timelapse saved successfully"));
        } catch (error) {
          this.showToast(__(`(Error guardando proceso|Error saving timelapse): ${error.message}`), 5000);
        }
      }
    });

    fileBrowser.show();
  }

  getFileBrowser(options = {}) {
    if (!this.fileBrowser) {
      this.fileBrowser = new FileBrowser({
        container: this.container,
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
        onError: options.onError,
        title: options.title || null,
        fileTypes: options.fileTypes || ["pxl", "png"],
        mode: options.mode || "open",
        defaultType: options.defaultType || "pxl",
        defaultName: options.defaultName || "untitled"
      });
      this.fileBrowser.currentPath = this.defaultFileBrowserPathUrl;
    } else {
      // Update options and refresh UI
      this.fileBrowser.updateOptions({
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
        onError: options.onError,
        title: options.title || null,
        fileTypes: options.fileTypes || ["pxl", "png"],
        mode: options.mode || "open",
        defaultType: options.defaultType || "pxl",
        defaultName: options.defaultName || "untitled"
      });
    }

    return this.fileBrowser;
  }

  // Project methods
  loadProject(projectData) {
    // Handle both string and object input
    if (typeof projectData === "string") {
      try {
        projectData = JSON.parse(projectData)
      } catch (error) {
        throw new Error("Invalid project file format: Not valid JSON");
      }
    }
    
    // Validate project
    if (!projectData || !projectData.width || !projectData.height) {
      throw new Error("Invalid project file format: Missing width or height");
    }

    // Create new project structure
    this.project = {
      width: projectData.width,
      height: projectData.height,
      frames: [],
      floatingColors: projectData.floatingColors || 0,
      currentFrame: projectData.currentFrame || 0,
      currentLayer: projectData.currentLayer || 0,
      name: projectData.name || "untitled",
    };

    // Load frame times or set defaults
    this.project.frameTimes = projectData.frameTimes || new Array(projectData.frames.length).fill(1000 / (projectData.fps || 12));

    this.project.currentFrameTime = projectData.animation ? projectData.currentFrameTime : 1000 / 12;

    // Load background settings
    if (projectData.backgroundColor) {
      this.transparentBackground = projectData.backgroundColor === "transparent";
      if (!this.transparentBackground) {
        this.secondaryColor = projectData.backgroundColor;
        this.updateColorIndicator();
      }
    }

    // Load frames
    if (!projectData.frames || !Array.isArray(projectData.frames)) {
      throw new Error("Invalid project file format: Missing or invalid frames array");
    }

    for (let f = 0; f < projectData.frames.length; f++) {
      const frameData = projectData.frames[f];
      const frame = {
        layers: []
      };

      // Ensure layers array exists
      if (!frameData.layers || !Array.isArray(frameData.layers)) {
        console.warn(`Frame ${f} has invalid layers array, creating default layer`);
        frameData.layers = [
          {
            name: `Layer 1`,
            visible: true,
            imageData: null
          }
        ];
      }

      for (let l = 0; l < frameData.layers.length; l++) {
        const layerData = frameData.layers[l];
        const layer = this.createBlankLayer(this.project.width, this.project.height);

        // Set layer properties with defaults
        layer.name = layerData.name || `Layer ${l + 1}`;
        layer.visible = layerData.visible !== undefined ? layerData.visible : true;

        // Restore image data if available
        if (layerData.imageData && Array.isArray(layerData.imageData)) {
          try {
            const ctx = layer.ctx;
            const imageData = new ImageData(new Uint8ClampedArray(layerData.imageData), this.project.width, this.project.height);
            ctx.putImageData(imageData, 0, 0);
          } catch (error) {
            console.error(`Error loading image data for frame ${f}, layer ${l}:`, error);
            // Continue with blank layer
          }
        }

        frame.layers.push(layer);
      }

      this.project.frames.push(frame);
    }

    // Load history if available
    if (projectData.history) {
      this.historyManager.deserialize(projectData.history);
    } else {
      // Create initial history entry for legacy projects
      this.historyManager.clear();
    }
    
    // Load floating colors
    if (projectData.floatingColors && this.usePerProjectFloatingColors) {
      this.colorPicker.removeAllFloatingPaletteColors();
      this.colorPicker.loadFloatingColors(JSON.parse(projectData.floatingColors));
    }

    // Initialize project
    this.resetCanvasSize();
    this.resetZoom();

    // Update UI
    this.render();
  }

  recreateProjectCanvases() {
    for (let f = 0; f < this.project.frames.length; f++) {
      const frame = this.project.frames[f];
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];

        // Recreate canvas
        layer.canvas = document.createElement("canvas");
        layer.canvas.width = this.project.width;
        layer.canvas.height = this.project.height;

        // Restore image data if available
        if (layer.imageData) {
          this.drawImageToCanvas(layer.canvas, layer.imageData);
        }
      }
    }
  }

  drawImageToCanvas(canvas, imageData) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const ctx = this.getCanvasContext(canvas);
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.src = imageData;
    });
  }

  importImage(imageData, name = "Imported Image") {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        // Create a new project sized to image dimensions
        this.newProject(img.width, img.height, img);

        // Update UI and render
        this.render();

        resolve();
      };
      img.src = imageData;
    });
  }
  
  async importPSD(fileData, fileName) {
    return new Promise((resolve, reject) => {
      try {
        // Convert file data to ArrayBuffer if it's a string
        let buffer;
        if (typeof fileData === 'string') {
          // Handle base64 or data URL
          if (fileData.starsWith('data:')) {
            // Convert data URL to ArrayBuffer
            const base64 = fileData.split(',')[1];
            const binary = atob(base64);
            buffer = new ArrayBuffer(binary.length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < binary.length; i++) {
              view[i] = binary.charCodeAt(i);
            }
          } else {
            // Assume it's binary data as string
            buffer = new ArrayBuffer(fileData.length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < fileData.length; i++) {
              view[i] = fileData.charCodeAt(i);
            }
          }
        } else if (fileData instanceof ArrayBuffer) {
          buffer = fileData;
        } else if (fileData instanceof Blob) {
          // Handle blob by reading it
          const reader = new FileReader();
          reader.onload = (e) => {
            this.importPSDFromBuffer(e.target.result, fileName).then(resolve).catch(reject);
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(fileData);
          return;
        } else {
          reject(new Error('Unsupported file format'));
          return;
        }
  
        // Parse the PSD
        const psd = agPsd.readPsd(buffer);
        
        // Create new project with PSD dimensions
        this.newProject(psd.width, psd.height);
        
        // Clear existing layers (newProject creates one default layer)
        const frame = this.project.frames[0];
        frame.layers = [];
        
        // Import PSD layers (they come in bottom-to-top order)
        if (psd.children && psd.children.length > 0) {
          for (let i = 0; i < psd.children.length; i++) {
            const psdLayer = psd.children[i];
            
            // Create new layer
            const layer = this.createBlankLayer(
              psd.width, 
              psd.height, 
              psdLayer.name || `Layer ${i + 1}`
            );
            
            // Set visibility
            layer.visible = psdLayer.visible !== false;
            
            // If the layer has canvas data, draw it
            if (psdLayer.canvas) {
              layer.ctx.drawImage(psdLayer.canvas, 0, 0);
            } else if (psdLayer.imageData) {
              // Some PSD libraries provide imageData
              const imageData = new ImageData(
                new Uint8ClampedArray(psdLayer.imageData),
                psd.width,
                psd.height
              );
              layer.ctx.putImageData(imageData, 0, 0);
            }
            
            frame.layers.push(layer);
          }
        } else {
          // If no layers found, create a merged layer from the PSD
          console.warn('PSD has no layer structure, creating merged layer');
          const layer = this.createBlankLayer(psd.width, psd.height, 'Merged');
          
          // Try to get the merged image data
          if (psd.canvas) {
            layer.ctx.drawImage(psd.canvas, 0, 0);
          }
          
          frame.layers.push(layer);
        }
        
        // Set current layer to top layer
        this.project.currentLayer = frame.layers.length - 1;
        
        // Update UI
        this.updateLayersUI();
        this.updateFramesUI();
        this.render();
        
        this.showToast(__(`PSD importado: ${fileName}||PSD imported: ${fileName}`));
        resolve();
        
      } catch (error) {
        console.error('Error importing PSD:', error);
        reject(new Error('Failed to import PSD file'));
      }
    });
  }
  
  async importPSDFromBuffer(buffer, fileName) {
    try {
      const psd = agPsd.readPsd(buffer);
      
      // Create new project with PSD dimensions
      this.newProject(psd.width, psd.height);
      
      // Clear existing layers
      const frame = this.project.frames[0];
      frame.layers = [];
      
      // Import PSD layers
      if (psd.children && psd.children.length > 0) {
        for (let i = 0; i < psd.children.length; i++) {
          const psdLayer = psd.children[i];
          
          const layer = this.createBlankLayer(
            psd.width, 
            psd.height, 
            psdLayer.name || `Layer ${i + 1}`
          );
          
          layer.visible = psdLayer.visible !== false;
          
          if (psdLayer.canvas) {
            layer.ctx.drawImage(psdLayer.canvas, 0, 0);
          }
          
          frame.layers.push(layer);
        }
      }
      
      this.project.currentLayer = frame.layers.length - 1;
      this.updateLayersUI();
      this.updateFramesUI();
      this.render();
      
      this.showToast(__(`PSD importado: ${fileName}||PSD imported: ${fileName}`));
      
    } catch (error) {
      console.error('Error importing PSD from buffer:', error);
      throw error;
    }
  }

  getProjectData() {
    const projectData = {
      version: this.version,
      width: this.project.width,
      height: this.project.height,
      frames: [],
      floatingColors: this.getFloatingColorsData(),
      currentFrameTime: this.project.currentFrameTime,
      frameTimes: this.project.frameTimes,
      backgroundColor: this.transparentBackground ? "transparent" : this.secondaryColor,
      createdAt: new Date().toISOString(),
      history: this.historyManager.serialize(),
      currentFrame: this.project.currentFrame,
      currentLayer: this.project.currentLayer
    };

    // Convert frames to serializable format
    for (let f = 0; f < this.project.frames.length; f++) {
      const frame = this.project.frames[f];
      const serializedFrame = {
        layers: []
      };

      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];
        const ctx = layer.ctx;
        const imageData = ctx.getImageData(0, 0, this.project.width, this.project.height);

        serializedFrame.layers.push({
          name: layer.name || `Layer ${l + 1}`,
          visible: layer.visible !== undefined ? layer.visible : true,
          imageData: Array.from(imageData.data)
        });
      }

      projectData.frames.push(serializedFrame);
    }
    
    return JSON.stringify(projectData);
  }
  
  compressJSON(json) {
    const str = JSON.stringify(json);
    let compressed = "";
    let count = 1;
    let prevChar = str[0];
  
    // Run-length encoding with special handling for common JSON patterns
    for (let i = 1; i <= str.length; i++) {
      const currentChar = str[i];
  
      if (currentChar === prevChar && count < 255) {
        count++;
      } else {
        // Encode runs of 4+ characters for better compression
        if (count > 3) {
          compressed += `\x01${String.fromCharCode(count)}${prevChar}`;
        } else {
          compressed += prevChar.repeat(count);
        }
        count = 1;
        prevChar = currentChar;
      }
    }
  
    // Dictionary compression for common JSON strings
    const dict = {
      '{"': "\x02",
      '"}': "\x03",
      '":': "\x04",
      ',"': "\x05",
      ',"_': "\x06",
      "true": "\x07",
      "false": "\x08",
      "null": "\x09",
      "[]": "\x0A",
      "{}": "\x0B"
    };
  
    Object.entries(dict).forEach(([key, value]) => {
      compressed = compressed.split(key).join(value);
    });
  
    return compressed;
  }
  
  decompressJSON(compressed) {
    let decompressed = compressed;
  
    // Reverse dictionar lookup
    const dict = {
      "\x02": '{"',
      "\x03": '"}',
      "\x04": '":',
      "\x05": ',"',
      "\x06": ',"_',
      "\x07": "true",
      "\x08": "false",
      "\x09": "null",
      "\x0A": "[]",
      "\x0B": "{}"
    };
  
    Object.entries(dict).forEach(([key, value]) => {
      decompressed = decompressed.split(key).join(value);
    });
  
    // Handle run-length decoding
    let result = "";
    let i = 0;
  
    while (i < decompressed.length) {
      if (decompressed[i] === "\x01" && i + 2 < decompressed.length) {
        const count = decompressed.charCodeAt(i + 1);
        const char = decompressed[i + 2];
        result += char.repeat(count);
        i += 3;
      } else {
        result += decompressed[i];
        i++;
      }
    }
  
    return JSON.parse(result);
  }

  serializeSnapshot(snapshot) {
    if (!snapshot) return null;

    const serialized = {
      frames: [],
      currentFrame: snapshot.currentFrame,
      currentLayer: snapshot.currentLayer
    };

    for (let f = 0; f < snapshot.frames.length; f++) {
      const frame = snapshot.frames[f];
      const serializedFrame = {
        layers: []
      };

      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];

        serializedFrame.layers.push({
          name: layer.name,
          visible: layer.visible,
          imageData: layer.imageData ? Array.from(layer.imageData.data) : null
        });
      }

      serialized.frames.push(serializedFrame);
    }

    return serialized;
  }

  deserializeSnapshot(serialized) {
    if (!serialized) return null;

    const snapshot = {
      frames: [],
      currentFrame: serialized.currentFrame,
      currentLayer: serialized.currentLayer
    };

    for (let f = 0; f < serialized.frames.length; f++) {
      const frameData = serialized.frames[f];
      const frame = {
        layers: []
      };

      for (let l = 0; l < frameData.layers.length; l++) {
        const layerData = frameData.layers[l];

        const imageData = layerData.imageData ? new ImageData(new Uint8ClampedArray(layerData.imageData), this.project.width, this.project.height) : null;

        const canvas = document.createElement("canvas");
        canvas.width = this.project.width;
        canvas.height = this.project.height;
        this.drawImageToCanvas(canvas, imageData);

        const layer = {
          name: layerData.name,
          visible: layerData.visible,
          imageData: imageData,
          canvas: canvas,
          ctx: this.getCanvasContext(canvas)
        };

        frame.layers.push(layer);
      }

      snapshot.frames.push(frame);
    }

    return snapshot;
  }

  renderFrameToCanvas(frame) {
    const canvas = document.createElement("canvas");
    canvas.width = this.project.width;
    canvas.height = this.project.height;
    const ctx = this.getCanvasContext(canvas);
    
    // Draw all visible layers
    for (let l = 0; l < frame.layers.length; l++) {
      const layer = frame.layers[l];
      if (layer.visible) {
        ctx.drawImage(layer.canvas, 0, 0);
      }
    }

    return canvas;
  }

  createSpriteSheet() {
    const frameCount = this.project.frames.length;
    const cols = Math.ceil(Math.sqrt(frameCount));
    const rows = Math.ceil(frameCount / cols);

    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = cols * this.project.width;
    spriteCanvas.height = rows * this.project.height;
    const spriteCtx = this.getCanvasContext(spriteCanvas);

    // Draw all frames
    for (let f = 0; f < frameCount; f++) {
      const col = f % cols;
      const row = Math.floor(f / cols);
      const frame = this.project.frames[f];

      // Draw all visible layers
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];
        if (layer.visible) {
          spriteCtx.drawImage(layer.canvas, col * this.project.width, row * this.project.height);
        }
      }
    }

    return spriteCanvas;
  }

  // Utilities
  dataURLtoBlob(dataURL) {
    try {
      // Handle both regular data URLs and blob data URLs
      if (dataURL instanceof Blob) {
        return dataURL;
      }

      const parts = dataURL.split(",");
      const mime = parts[0].match(/:(.*?);/)[1];
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);

      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      return new Blob([ab], { type: mime });
    } catch (error) {
      console.error("Error converting data URL to blob:", error);
      throw new Error("Invalid data URL format");
    }
  }

  distance(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;

    return Math.sqrt(dx * dx + dy * dy);
  }

  getCurrentLayerContext() {
    if (!this.project) return null;
    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    return layer.ctx;
  }

  getPixelColor(x, y) {
    if (!this.project || x < 0 || y < 0 || x >= this.project.width || y >= this.project.height) {
      return null;
    }

    const frame = this.project.frames[this.project.currentFrame];
    const layer = frame.layers[this.project.currentLayer];
    const ctx = layer.ctx;

    return this.getPixelColorFromCtx(ctx, x, y);
  }
  
  getPixelColorFromCtx(ctx, x, y) {
    const imageData = ctx.getImageData(x, y, 1, 1);
    return imageData.data[3] === 0 ? 'transparent' : `#${this.componentToHex(imageData.data[0])}${this.componentToHex(imageData.data[1])}${this.componentToHex(imageData.data[2])}`;
  }

  componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }

  setColor(color) {
    if (this.selectedColor === "primary") {
      this.primaryColor = color;
    } else {
      this.secondaryColor = color;
    }
    this.updateColorIndicator();
  }

  formatDate(date) {
    const pad = n => n.toString().padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }
  
  getColor() {
    return this.selectedColor == 'primary' ? this.primaryColor : this.secondaryColor;
  }

  exitApp() {
    this.showPopup(__("Cerrar App||Exit App"), __("¿Estás seguro de que quieres irte ahora? Cualquier cambio no guardado se perderá para siempre.||Are you sure you want to leave now? Any unsaved changes will be lost forever."), [
      { text: "No", class: "cancel", action: () => this.hidePopup() },
      { text: __("Sí||Yes"), action: () => navigator.app.exitApp() }
    ]);
  }
}

