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

  getDefaultPalette() {
    return {
      id: 'default_' + Date.now(),
      name: __('Sistema||System'),
      colors: [
        "#000000", "#7c7c7c", "#bcbcbc", "#fcfcfc",
        "#a80020", "#e40058", "#f85898", "#f8a4c0",
        "#940084", "#d800cc", "#f878f8", "#f8b8f8",
        "#4428bc", "#6844fc", "#9878f8", "#d8b8f8",
        "#0000bc", "#0000fc", "#6888fc", "#b8b8f8",
        "#0058f8", "#0078f8", "#3cbcfc", "#a4e4fc",
        "#004058", "#008888", "#00e8d8", "#00fcfc",
        "#007800", "#00a800", "#00b800", "#b8f8d8",
        "#006800", "#00a844", "#58f898", "#b8f8b8",
        "#005800", "#58d854", "#b8f818", "#d8f878",
        "#503000", "#ac7c00", "#f8b800", "#fce0a8",
        "#a81000", "#fca044", "#f8d878", "#f0d0b0",
        "#881400", "#f83800", "#e45c10", "#f87858"
      ]
    };
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
        this.palettes = [this.getDefaultPalette()];
      }
      this.currentPaletteId = this.palettes[0]?.id || null;
      this.savePalettes();
    } catch (e) {
      console.warn("Failed to load palettes:", e);
      this.palettes = [this.getDefaultPalette()];
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
              const paletteData = await this.importFromLospec(slug);
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
        const item = document.createElement("div");
        item.className = `palette-manager-item ${palette.id === this.currentPaletteId ? 'active' : ''}`;
        
        const preview = document.createElement("div");
        preview.className = "palette-manager-preview";
        palette.colors.slice(0, 6).forEach(color => {
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
        
        const exportBtn = document.createElement("button");
        exportBtn.className = "ui-button palette-manager-btn";
        exportBtn.innerHTML = '<div class="icon icon-download"></div>';
        exportBtn.title = __("Exportar||Export");
        exportBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.exportPaletteToFile(palette.id);
        });
        actions.appendChild(exportBtn);
        
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
                  action: () => this.editor.hidePopup()
                },
                {
                  text: __("Eliminar||Delete"),
                  action: () => {
                    this.removePalette(palette.id);
                    renderList();
                    this.editor.colorPicker?.updatePaletteGrid();
                    this.editor.hidePopup();
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
    importBtn.innerHTML = "JSON";
    importBtn.addEventListener("click", () => {
      this.showImportJsonDialog();
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
  
  exportPaletteToFile(paletteId) {
    const palette = this.palettes.find(p => p.id === paletteId);
    if (!palette) return;
    
    const jsonData = JSON.stringify({
      name: palette.name,
      colors: palette.colors,
      exportedAt: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `${palette.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.editor.showToast(__(`Paleta "${palette.name}" exportada||Palette "${palette.name}" exported`));
  }

  showImportJsonDialog() {
    const fileBrowser = this.editor.getFileBrowser({
      title: __("Importar paleta JSON||Import JSON palette"),
      mode: "open",
      fileTypes: ["json"],
      onConfirm: async (fileInfo) => {
        try {
          const fileData = await this.editor.readFile(fileInfo);
          const data = JSON.parse(fileData);
          
          if (!data.name || !data.colors || !Array.isArray(data.colors)) {
            throw new Error(__('Formato inválido||Invalid format'));
          }
          
          const existing = this.palettes.find(p => p.name === data.name);
          if (existing) {
            const newName = `${data.name} (${__('copia||copy')})`;
            this.addPalette(newName, data.colors);
            this.editor.showToast(__(`Paleta importada como "${newName}"||Palette imported as "${newName}"`));
          } else {
            this.addPalette(data.name, data.colors);
            this.editor.showToast(__(`Paleta "${data.name}" importada||Palette "${data.name}" imported`));
          }
          
          this.editor.colorPicker?.updatePaletteGrid();
          this.editor.hidePopup();
        } catch (error) {
          this.editor.showToast(error.message, 3000);
        }
      }
    });
    fileBrowser.show();
  }
}