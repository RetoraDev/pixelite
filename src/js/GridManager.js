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
      this.editor.canvasContainer.appendChild(this.overlay);
    }
  }

  initUI() {
    // Grid panel (double height of animation panel)
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
      name: __('Cuadrícula||Grid') + ' ' + (this.grids.length + 1),
      size: 8,
      color: '#ff0000',
      opacity: 0.3,
      enabled: true,
      type: 'square'
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

    this.grids.forEach(grid => {
      const item = document.createElement('div');
      item.className = 'grid-item';
      item.dataset.id = grid.id;

      // Preview
      const preview = document.createElement('div');
      preview.className = 'grid-preview';
      preview.style.backgroundColor = grid.color + Math.floor(grid.opacity * 255).toString(16).padStart(2, '0');
      
      // Info
      const info = document.createElement('div');
      info.className = 'grid-info';
      
      const nameRow = document.createElement('div');
      nameRow.className = 'grid-name-row';
      
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'grid-name-input';
      nameInput.value = grid.name;
      nameInput.addEventListener('change', () => {
        this.updateGrid(grid.id, { name: nameInput.value });
      });
      
      const enabledToggle = document.createElement('label');
      enabledToggle.className = 'grid-toggle';
      
      const enabledCheck = document.createElement('input');
      enabledCheck.type = 'checkbox';
      enabledCheck.checked = grid.enabled;
      enabledCheck.addEventListener('change', () => {
        this.updateGrid(grid.id, { enabled: enabledCheck.checked });
      });
      
      const toggleSlider = document.createElement('span');
      toggleSlider.className = 'grid-toggle-slider';
      
      enabledToggle.appendChild(enabledCheck);
      enabledToggle.appendChild(toggleSlider);
      
      nameRow.appendChild(nameInput);
      nameRow.appendChild(enabledToggle);
      
      // Controls
      const controls = document.createElement('div');
      controls.className = 'grid-controls';

      // Size control with number input
      const sizeControl = document.createElement('div');
      sizeControl.className = 'grid-control';
      
      const sizeLabel = document.createElement('span');
      sizeLabel.className = 'grid-control-label';
      sizeLabel.textContent = __('Tamaño||Size') + ':';
      
      const sizeInput = document.createElement('input');
      sizeInput.type = 'number';
      sizeInput.className = 'grid-number-input';
      sizeInput.min = 1;
      sizeInput.max = 128;
      sizeInput.step = 1;
      sizeInput.value = grid.size;
      sizeInput.addEventListener('change', () => {
        let value = parseInt(sizeInput.value);
        if (isNaN(value)) value = grid.size;
        value = Math.max(1, Math.min(128, value));
        sizeInput.value = value;
        this.updateGrid(grid.id, { size: value });
      });
      
      const sizeUnit = document.createElement('span');
      sizeUnit.className = 'grid-unit';
      sizeUnit.textContent = 'px';
      
      sizeControl.appendChild(sizeLabel);
      sizeControl.appendChild(sizeInput);
      sizeControl.appendChild(sizeUnit);

      // Color control
      const colorControl = document.createElement('div');
      colorControl.className = 'grid-control';
      
      const colorLabel = document.createElement('span');
      colorLabel.className = 'grid-control-label';
      colorLabel.textContent = __('Color||Color') + ':';
      
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'grid-color-input';
      colorInput.value = grid.color;
      colorInput.addEventListener('change', () => {
        this.updateGrid(grid.id, { color: colorInput.value });
      });
      
      colorControl.appendChild(colorLabel);
      colorControl.appendChild(colorInput);

      // Opacity control with number input
      const opacityControl = document.createElement('div');
      opacityControl.className = 'grid-control';
      
      const opacityLabel = document.createElement('span');
      opacityLabel.className = 'grid-control-label';
      opacityLabel.textContent = __('Opacidad||Opacity') + ':';
      
      const opacityInput = document.createElement('input');
      opacityInput.type = 'number';
      opacityInput.className = 'grid-number-input';
      opacityInput.min = 0;
      opacityInput.max = 100;
      opacityInput.step = 1;
      opacityInput.value = Math.round(grid.opacity * 100);
      opacityInput.addEventListener('change', () => {
        let value = parseInt(opacityInput.value);
        if (isNaN(value)) value = Math.round(grid.opacity * 100);
        value = Math.max(0, Math.min(100, value));
        opacityInput.value = value;
        this.updateGrid(grid.id, { opacity: value / 100 });
      });
      
      const opacityUnit = document.createElement('span');
      opacityUnit.className = 'grid-unit';
      opacityUnit.textContent = '%';
      
      opacityControl.appendChild(opacityLabel);
      opacityControl.appendChild(opacityInput);
      opacityControl.appendChild(opacityUnit);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'grid-remove-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = __('Eliminar||Remove');
      removeBtn.addEventListener('click', () => this.removeGrid(grid.id));

      controls.appendChild(sizeControl);
      controls.appendChild(colorControl);
      controls.appendChild(opacityControl);
      
      info.appendChild(nameRow);
      info.appendChild(controls);
      
      item.appendChild(preview);
      item.appendChild(info);
      item.appendChild(removeBtn);
      
      this.listContainer.appendChild(item);
    });
  }

  renderGrids() {
    // Clear overlay
    this.overlay.innerHTML = '';

    // Get canvas transform
    const rect = this.editor.canvasContainer.getBoundingClientRect();
    const left = rect.width / 2 + this.editor.posX - (this.editor.project.width / 2) * this.editor.scale;
    const top = rect.height / 2 + this.editor.posY - (this.editor.project.height / 2) * this.editor.scale;
    const width = this.editor.project.width * this.editor.scale;
    const height = this.editor.project.height * this.editor.scale;

    // Set overlay position and size
    Object.assign(this.overlay.style, {
      position: 'absolute',
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
      height: height + 'px',
      pointerEvents: 'none',
      zIndex: '5'
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

      // Calculate scaled grid size
      const scaledSize = Math.max(1, grid.size * this.editor.scale);

      Object.assign(gridLayer.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundImage: `${verticalGradient}, ${horizontalGradient}`,
        backgroundSize: `${scaledSize}px ${scaledSize}px`,
        backgroundPosition: '0 0',
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
    if (this.editor.animationPanel) this.editor.animationPanel.classList.remove('visible');
    if (this.editor.layersPanel) this.editor.layersPanel.classList.remove('visible');
    if (this.editor.animationButton) this.editor.animationButton.classList.remove('active');
    if (this.editor.layersButton) this.editor.layersButton.classList.remove('active');
    
    this.panel.classList.add('visible');
    this.panelVisible = true;
    this.renderList();
    this.renderGrids();
  }

  hide() {
    this.panel.classList.remove('visible');
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