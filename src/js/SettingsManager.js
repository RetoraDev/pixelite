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