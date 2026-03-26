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