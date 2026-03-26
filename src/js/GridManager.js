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