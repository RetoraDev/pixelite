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

    document.body.appendChild(this.overlay);

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
    if (this.restartWarningShown) return;
    
    this.restartWarningShown = true;
    
    const warning = document.createElement('div');
    warning.className = 'settings-restart-warning';
    
    const message = document.createElement('span');
    message.textContent = __('Algunos cambios requieren reiniciar||Some changes require restart');
    
    const restartBtn = document.createElement('button');
    restartBtn.className = 'settings-btn small';
    restartBtn.textContent = __('Reiniciar||Restart');
    restartBtn.addEventListener('click', () => {
      if (this.editor) {
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
      } else {
        window.location.reload();
      }
    });
    
    warning.appendChild(message);
    warning.appendChild(restartBtn);
    this.container.appendChild(warning);
    
    setTimeout(() => {
      if (warning.parentNode) {
        warning.remove();
        this.restartWarningShown = false;
      }
    }, 5000);
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