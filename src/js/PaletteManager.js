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