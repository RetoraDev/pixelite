class SelectionManager {
  constructor(editor) {
    this.editor = editor;
    
    this.hasSelection = false;
    this.rect = null;
    
    this.isSelecting = false;
    this.selectStart = null;
    
    this.isTransforming = false;
    this.transformRect = null;
    this.transformStartRect = null;
    this.transformImageData = null;
    this.transformOriginalImageData = null;
    this.transformCurrentImageData = null;       // Current scaled image
    this.transformCurrentWidth = 0;
    this.transformCurrentHeight = 0;
    this.transformOriginalFullImageData = null;  // Complete canvas original
    
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.dragStartRect = null;
    this.dragStartPoint = null;
    
    this.selectionDiv = null;
    this.toolbar = null;
    this.clipboardPanel = null;
    
    this.useBackgroundColor = false;
    this.backgroundColor = null;
    
    this.clipboard = [];
    this.clipboardMaxSize = 20;
    
    this.init();
  }
  
  init() {
    this.createSelectionRect();
    this.createToolbar();
    this.createClipboardPanel();
    this.loadClipboard();
  }
  
  createSelectionRect() {
    this.selectionDiv = document.createElement('div');
    this.selectionDiv.className = 'selection-rect';
    
    const bg = document.createElement('div');
    bg.className = 'selection-rect-bg';
    this.selectionDiv.appendChild(bg);
    
    const bottomBorder = document.createElement('div');
    bottomBorder.className = 'border-bottom';
    this.selectionDiv.appendChild(bottomBorder);
    
    const leftBorder = document.createElement('div');
    leftBorder.className = 'border-left';
    this.selectionDiv.appendChild(leftBorder);
    
    // Handles invisibles - solo área de click, sin estilo visual
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handles.forEach(handle => {
      const div = document.createElement('div');
      div.className = `selection-handle selection-handle-${handle}`;
      div.addEventListener('mousedown', (e) => this.onHandleDown(e, handle));
      div.addEventListener('touchstart', (e) => this.onHandleDown(e, handle), { passive: false });
      this.selectionDiv.appendChild(div);
    });
    
    this.selectionDiv.addEventListener('mousedown', (e) => this.onRectDown(e));
    this.selectionDiv.addEventListener('touchstart', (e) => this.onRectDown(e), { passive: false });
    
    this.editor.canvasWrapper.appendChild(this.selectionDiv);
  }  
  
  createToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'selection-toolbar';
    
    const buttons = [
      { id: 'sel-move', icon: 'icon-transform', action: () => this.startTransform(), title: __('Mover||Move') },
      { id: 'sel-cut', icon: 'icon-cut', action: () => this.cut(), title: __('Cortar||Cut') },
      { id: 'sel-copy', icon: 'icon-copy', action: () => this.copy(), title: __('Copiar||Copy') },
      { id: 'sel-paste', icon: 'icon-paste', action: () => this.showClipboard(), title: __('Pegar||Paste') },
      { id: 'sel-delete', icon: 'icon-clear', action: () => this.delete(), title: __('Borrar||Delete') },
      { id: 'sel-clear', icon: 'icon-unselect', action: () => this.clear(), title: __('Limpiar||Clear') }
    ];
    
    buttons.forEach(btn => {
      const button = this.editor.createButton(btn.id, btn.icon, btn.action);
      button.title = btn.title;
      this.toolbar.appendChild(button);
    });
    
    this.editor.uiLayer.appendChild(this.toolbar);
  }
  
  createClipboardPanel() {
    this.clipboardPanel = document.createElement('div');
    this.clipboardPanel.className = 'clipboard-panel';
    
    const header = document.createElement('div');
    header.className = 'clipboard-header';
    header.innerHTML = `
      <span class="clipboard-title">${__('Portapapeles||Clipboard')}</span>
      <button class="clipboard-close">✕</button>
    `;
    
    this.clipboardList = document.createElement('div');
    this.clipboardList.className = 'clipboard-list';
    
    this.clipboardPanel.appendChild(header);
    this.clipboardPanel.appendChild(this.clipboardList);
    this.editor.uiLayer.appendChild(this.clipboardPanel);
    
    header.querySelector('.clipboard-close').addEventListener('click', () => this.hideClipboard());
  }
  
  onDown(x, y) {
    if (!this.editor.project || this.isTransforming) return;
    
    // Clamp to project bounds
    const maxX = this.editor.project.width - 1;
    const maxY = this.editor.project.height - 1;
    const clampedX = Math.max(0, Math.min(x, maxX));
    const clampedY = Math.max(0, Math.min(y, maxY));
    
    this.isSelecting = true;
    this.selectStart = { x: clampedX, y: clampedY };
  }
  
  onMove(x, y) {
    if (!this.isSelecting || this.isTransforming) return;
    
    const maxX = this.editor.project.width - 1;
    const maxY = this.editor.project.height - 1;
    const clampedX = Math.max(0, Math.min(x, maxX));
    const clampedY = Math.max(0, Math.min(y, maxY));
    
    const left = Math.min(this.selectStart.x, clampedX);
    const right = Math.max(this.selectStart.x, clampedX);
    const top = Math.min(this.selectStart.y, clampedY);
    const bottom = Math.max(this.selectStart.y, clampedY);
    
    this.rect = { 
      x: left, 
      y: top, 
      width: right - left, 
      height: bottom - top 
    };
    this.hasSelection = true;
    
    this.updateRectDisplay();
  }
  
  onUp(x, y, startX, startY) {
    if (!this.isSelecting) return;
    this.isSelecting = false;
    
    if (this.rect && (this.rect.width < 1 || this.rect.height < 1)) {
      this.clear();
    } else if (this.rect) {
      // Ensure final rect is within bounds
      const maxX = this.editor.project.width - 1;
      const maxY = this.editor.project.height - 1;
      this.rect.x = Math.max(0, Math.min(this.rect.x, maxX));
      this.rect.y = Math.max(0, Math.min(this.rect.y, maxY));
      this.rect.width = Math.min(this.rect.width, maxX - this.rect.x);
      this.rect.height = Math.min(this.rect.height, maxY - this.rect.y);
      this.updateRectDisplay();
    }
    
    this.updateToolbarVisibility();
  }
  
  clear() {
    this.rect = null;
    this.hasSelection = false;
    this.selectionDiv.style.display = 'none';
    this.updateToolbarVisibility();
  }
  
  delete() {
    if (!this.hasSelection || !this.rect) return;
    
    this.editor.historyManager.startBatch('delete_selection', __('Borrar selección||Delete selection'));
    
    const frame = this.editor.project.frames[this.editor.project.currentFrame];
    const layer = frame.layers[this.editor.project.currentLayer];
    const ctx = layer.ctx;
    const width = this.editor.project.width;
    const height = this.editor.project.height;
    const pixels = [];
    const bgColor = !this.editor.transparentBackground ? this.editor.secondaryColor : null;
    
    for (let y = this.rect.y; y < this.rect.y + this.rect.height; y++) {
      for (let x = this.rect.x; x < this.rect.x + this.rect.width; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const oldColor = this.editor.getPixelColor(x, y);
          
          if (bgColor) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(x, y, 1, 1);
            pixels.push({ x, y, oldColor, newColor: bgColor });
          } else {
            ctx.clearRect(x, y, 1, 1);
            pixels.push({ x, y, oldColor, newColor: 'transparent' });
          }
        }
      }
    }
    
    this.editor.recordDrawOperation(pixels);
    this.clear();
    this.editor.historyManager.endBatch();
    this.editor.render();
  }
  
  copy() {
    if (!this.hasSelection || !this.rect) return;
    
    const frame = this.editor.project.frames[this.editor.project.currentFrame];
    const layer = frame.layers[this.editor.project.currentLayer];
    const ctx = layer.ctx;
    
    const canvas = document.createElement('canvas');
    canvas.width = this.rect.width;
    canvas.height = this.rect.height;
    const tempCtx = canvas.getContext('2d');
    
    tempCtx.drawImage(
      ctx.canvas,
      this.rect.x, this.rect.y, this.rect.width, this.rect.height,
      0, 0, this.rect.width, this.rect.height
    );
    
    const item = {
      id: Date.now(),
      name: `${__('Selección||Selection')} ${new Date().toLocaleTimeString()}`,
      width: this.rect.width,
      height: this.rect.height,
      imageData: canvas.toDataURL()
    };
    
    this.clipboard.unshift(item);
    if (this.clipboard.length > this.clipboardMaxSize) this.clipboard.pop();
    this.saveClipboard();
    
    this.editor.showToast(__('Copiado||Copied'), 1500);
  }
  
  cut() {
    this.copy();
    this.delete();
  }
  
  paste() {
    if (this.clipboard.length === 0) return;
    this.pasteFromItem(this.clipboard[0]);
  }
  
  pasteFromItem(item) {
    if (!item) return;
    
    this.editor.historyManager.startBatch('paste', __('Pegar||Paste'));
    
    const img = new Image();
    img.onload = () => {
      const frame = this.editor.project.frames[this.editor.project.currentFrame];
      const layer = frame.layers[this.editor.project.currentLayer];
      const ctx = layer.ctx;
      const width = this.editor.project.width;
      const height = this.editor.project.height;
      const pixels = [];
      
      const x = Math.floor((width - img.width) / 2);
      const y = Math.floor((height - img.height) / 2);
      
      for (let py = y; py < y + img.height; py++) {
        for (let px = x; px < x + img.width; px++) {
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const oldColor = this.editor.getPixelColor(px, py);
            pixels.push({ x: px, y: py, oldColor, newColor: null });
          }
        }
      }
      
      ctx.drawImage(img, x, y);
      
      for (let p of pixels) {
        p.newColor = this.editor.getPixelColor(p.x, p.y);
      }
      
      this.editor.recordDrawOperation(pixels.filter(p => p.oldColor !== p.newColor));
      
      this.rect = { x, y, width: img.width, height: img.height };
      this.hasSelection = true;
      this.updateRectDisplay();
      this.updateToolbarVisibility();
      
      this.editor.historyManager.endBatch();
      this.editor.render();
    };
    img.src = item.imageData;
  }
  
  startTransform() {
    if (!this.hasSelection || !this.rect) return;
    
    this.isTransforming = true;
    this.transformRect = { ...this.rect };
    this.transformStartRect = { ...this.rect };
    
    const frame = this.editor.project.frames[this.editor.project.currentFrame];
    const layer = frame.layers[this.editor.project.currentLayer];
    const ctx = layer.ctx;
    const width = this.editor.project.width;
    const height = this.editor.project.height;
    
    // IMPORTANTE: Guardar el estado original ANTES de cualquier modificación
    this.transformOriginalFullImageData = ctx.getImageData(0, 0, width, height);
    
    // Save original selected image (for preview scaling)
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = this.rect.width;
    originalCanvas.height = this.rect.height;
    const originalCtx = originalCanvas.getContext('2d');
    originalCtx.imageSmoothingEnabled = false;
    originalCtx.drawImage(
      ctx.canvas,
      this.rect.x, this.rect.y, this.rect.width, this.rect.height,
      0, 0, this.rect.width, this.rect.height
    );
    this.transformOriginalImageData = originalCanvas;
    this.transformCurrentImageData = originalCanvas;
    
    this.useBackgroundColor = !this.editor.transparentBackground;
    this.backgroundColor = this.editor.secondaryColor;
    
    // Limpiar el área original para el preview (esto modifica el canvas)
    if (this.useBackgroundColor) {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(
        this.transformStartRect.x,
        this.transformStartRect.y,
        this.transformStartRect.width,
        this.transformStartRect.height
      );
    } else {
      ctx.clearRect(
        this.transformStartRect.x,
        this.transformStartRect.y,
        this.transformStartRect.width,
        this.transformStartRect.height
      );
    }
    
    this.showHandles(true);
    this.updateRectDisplay();
    
    this.editor.enterImmersive();
    this.toolbar.style.display = 'none';
    
    this.editor.showBottomConfirmation(
      __('Aceptar||Accept'),
      __('Cancelar||Cancel'),
      (accepted) => {
        if (accepted) {
          this.applyTransform();
        } else {
          this.cancelTransform();
        }
      }
    );
    
    this.updateTransformPreview();
  }  
  
  showHandles(show) {
    const handles = this.selectionDiv.querySelectorAll('.selection-handle');
    handles.forEach(handle => {
      handle.style.display = show ? 'block' : 'none';
    });
  }
  
  updateRectDisplay() {
    const r = this.transformRect || this.rect;
    if (!r) return;
    
    this.selectionDiv.style.left = `${r.x}px`;
    this.selectionDiv.style.top = `${r.y}px`;
    this.selectionDiv.style.width = `${r.width}px`;
    this.selectionDiv.style.height = `${r.height}px`;
    this.selectionDiv.style.display = 'block';
    
    this.updateHandleScales();
  }
  
  updateTransformPreview() {
    if (!this.isTransforming) return;
    
    const frame = this.editor.project.frames[this.editor.project.currentFrame];
    const layer = frame.layers[this.editor.project.currentLayer];
    const ctx = layer.ctx;
    const width = this.editor.project.width;
    const height = this.editor.project.height;
    
    // Get temporary canvas
    const { canvas: tempCanvas, ctx: tempCtx } = this.editor.getTempCanvas();
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.clearRect(0, 0, width, height);
    
    // Step 1: Start with the original complete image from ImageData
    if (this.transformOriginalFullImageData) {
      tempCtx.putImageData(this.transformOriginalFullImageData, 0, 0);
    }
    
    // Step 2: Clear the original area
    if (this.useBackgroundColor) {
      tempCtx.fillStyle = this.backgroundColor;
      tempCtx.fillRect(
        this.transformStartRect.x,
        this.transformStartRect.y,
        this.transformStartRect.width,
        this.transformStartRect.height
      );
    } else {
      tempCtx.clearRect(
        this.transformStartRect.x,
        this.transformStartRect.y,
        this.transformStartRect.width,
        this.transformStartRect.height
      );
    }
    
    // Step 3: Scale the image to current size
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = this.transformRect.width;
    scaledCanvas.height = this.transformRect.height;
    const scaledCtx = scaledCanvas.getContext('2d');
    scaledCtx.imageSmoothingEnabled = false;
    scaledCtx.drawImage(
      this.transformOriginalImageData,
      0, 0, this.transformOriginalImageData.width, this.transformOriginalImageData.height,
      0, 0, this.transformRect.width, this.transformRect.height
    );
    
    // Save the scaled image for apply
    this.transformCurrentImageData = scaledCanvas;
    this.transformCurrentWidth = this.transformRect.width;
    this.transformCurrentHeight = this.transformRect.height;
    
    // Draw at new position
    tempCtx.drawImage(scaledCanvas, this.transformRect.x, this.transformRect.y);
    
    // Step 4: Composite to main canvas
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tempCanvas, 0, 0);
    
    this.editor.renderQuick();
  }  
  
  onRectDown(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.isTransforming) return;
    
    this.isDragging = true;
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    const pos = this.editor.getCanvasPosition(clientX, clientY);
    if (!pos) return;
    
    this.dragStartPoint = { x: pos.x, y: pos.y };
    this.dragStartRect = { ...this.transformRect };
    
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
    document.addEventListener('touchmove', this.onDragMove, { passive: false });
    document.addEventListener('touchend', this.onDragEnd);
  }
  
  onDragMove = (e) => {
    if (!this.isDragging) return;
    e.preventDefault();
    
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    const pos = this.editor.getCanvasPosition(clientX, clientY);
    if (!pos) return;
    
    const deltaX = pos.x - this.dragStartPoint.x;
    const deltaY = pos.y - this.dragStartPoint.y;
    
    this.transformRect = {
      x: this.dragStartRect.x + deltaX,
      y: this.dragStartRect.y + deltaY,
      width: this.dragStartRect.width,
      height: this.dragStartRect.height
    };
    
    this.updateRectDisplay();
    this.updateTransformPreview();
  };
  
  onDragEnd = () => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    document.removeEventListener('touchmove', this.onDragMove);
    document.removeEventListener('touchend', this.onDragEnd);
  };
  
  onHandleDown(e, handle) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.isTransforming) return;
    
    this.isResizing = true;
    this.resizeHandle = handle;
    
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    const pos = this.editor.getCanvasPosition(clientX, clientY);
    if (!pos) return;
    
    this.dragStartPoint = { x: pos.x, y: pos.y };
    this.dragStartRect = { ...this.transformRect };
    
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
    document.addEventListener('touchmove', this.onResizeMove, { passive: false });
    document.addEventListener('touchend', this.onResizeEnd);
  }
  
  onResizeMove = (e) => {
    if (!this.isResizing) return;
    e.preventDefault();
    
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    const pos = this.editor.getCanvasPosition(clientX, clientY);
    if (!pos) return;
    
    const deltaX = pos.x - this.dragStartPoint.x;
    const deltaY = pos.y - this.dragStartPoint.y;
    
    let newRect = { ...this.dragStartRect };
    
    switch (this.resizeHandle) {
      case 'nw':
        newRect.x = this.dragStartRect.x + deltaX;
        newRect.y = this.dragStartRect.y + deltaY;
        newRect.width = this.dragStartRect.width - deltaX;
        newRect.height = this.dragStartRect.height - deltaY;
        break;
      case 'n':
        newRect.y = this.dragStartRect.y + deltaY;
        newRect.height = this.dragStartRect.height - deltaY;
        break;
      case 'ne':
        newRect.y = this.dragStartRect.y + deltaY;
        newRect.width = this.dragStartRect.width + deltaX;
        newRect.height = this.dragStartRect.height - deltaY;
        break;
      case 'e':
        newRect.width = this.dragStartRect.width + deltaX;
        break;
      case 'se':
        newRect.width = this.dragStartRect.width + deltaX;
        newRect.height = this.dragStartRect.height + deltaY;
        break;
      case 's':
        newRect.height = this.dragStartRect.height + deltaY;
        break;
      case 'sw':
        newRect.x = this.dragStartRect.x + deltaX;
        newRect.width = this.dragStartRect.width - deltaX;
        newRect.height = this.dragStartRect.height + deltaY;
        break;
      case 'w':
        newRect.x = this.dragStartRect.x + deltaX;
        newRect.width = this.dragStartRect.width - deltaX;
        break;
    }
    
    if (newRect.width < 1) newRect.width = 1;
    if (newRect.height < 1) newRect.height = 1;
    if (newRect.x < 0) { newRect.width += newRect.x; newRect.x = 0; }
    if (newRect.y < 0) { newRect.height += newRect.y; newRect.y = 0; }
    if (newRect.x + newRect.width > this.editor.project.width) {
      newRect.width = this.editor.project.width - newRect.x;
    }
    if (newRect.y + newRect.height > this.editor.project.height) {
      newRect.height = this.editor.project.height - newRect.y;
    }
    
    if (newRect.width > 0 && newRect.height > 0) {
      this.transformRect = newRect;
      this.updateRectDisplay();
      this.updateTransformPreview();
    }
  };
  
  onResizeEnd = () => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
    document.removeEventListener('touchmove', this.onResizeMove);
    document.removeEventListener('touchend', this.onResizeEnd);
  };
  
  applyTransform() {
    const frame = this.editor.project.frames[this.editor.project.currentFrame];
    const layer = frame.layers[this.editor.project.currentLayer];
    const ctx = layer.ctx;
    const width = this.editor.project.width;
    const height = this.editor.project.height;
    
    // Usar el estado original guardado en startTransform
    const oldImageData = this.transformOriginalFullImageData;
    
    // Aplicar la transformación al canvas
    // Primero restaurar el estado original
    ctx.putImageData(oldImageData, 0, 0);
    
    // Luego limpiar el área original
    if (this.useBackgroundColor) {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(
        this.transformStartRect.x,
        this.transformStartRect.y,
        this.transformStartRect.width,
        this.transformStartRect.height
      );
    } else {
      ctx.clearRect(
        this.transformStartRect.x,
        this.transformStartRect.y,
        this.transformStartRect.width,
        this.transformStartRect.height
      );
    }
    
    // Dibujar la imagen en la nueva posición
    if (this.transformCurrentImageData) {
      ctx.drawImage(
        this.transformCurrentImageData,
        this.transformRect.x,
        this.transformRect.y
      );
    }
    
    // Obtener el nuevo estado
    const newImageData = ctx.getImageData(0, 0, width, height);
    
    // Registrar la operación
    const operation = {
      type: 'transform',
      description: __('Mover selección||Move selection'),
      frameIndex: this.editor.project.currentFrame,
      layerIndex: this.editor.project.currentLayer,
      transformType: 'move_resize',
      transformData: {
        oldImageData: Array.from(oldImageData.data),
        newImageData: Array.from(newImageData.data),
        oldWidth: width,
        oldHeight: height
      }
    };
    
    this.editor.historyManager.addChange(operation);
    
    this.rect = { ...this.transformRect };
    this.hasSelection = true;
    this.finishTransform();
    this.editor.render();
  }  
  
  cancelTransform() {
    const frame = this.editor.project.frames[this.editor.project.currentFrame];
    const layer = frame.layers[this.editor.project.currentLayer];
    const ctx = layer.ctx;
    
    if (this.transformOriginalFullImageData) {
      ctx.putImageData(this.transformOriginalFullImageData, 0, 0);
    }
    
    this.finishTransform();
    this.editor.render();
  }
  
  finishTransform() {
    this.isTransforming = false;
    this.transformImageData = null;
    this.transformOriginalImageData = null;
    this.transformOriginalAreaData = null;
    this.transformRect = null;
    this.transformStartRect = null;
    
    this.showHandles(false);
    this.updateRectDisplay();
    this.editor.exitImmersive();
    this.editor.hideBottomConfirmation();
    this.updateToolbarVisibility();
  }  

  updateHandleScales() {}

  showClipboard() {
    this.renderClipboardList();
    this.clipboardPanel.classList.add('visible');
  }
  
  hideClipboard() {
    this.clipboardPanel.classList.remove('visible');
  }
  
  renderClipboardList() {
    this.clipboardList.innerHTML = '';
    
    if (this.clipboard.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'clipboard-empty';
      empty.textContent = __('Vacío||Empty');
      this.clipboardList.appendChild(empty);
      return;
    }
    
    this.clipboard.forEach(item => {
      const div = document.createElement('div');
      div.className = 'clipboard-item';
      
      const thumb = document.createElement('img');
      thumb.className = 'clipboard-thumb';
      thumb.src = item.imageData;
      
      const info = document.createElement('div');
      info.className = 'clipboard-info';
      info.innerHTML = `
        <div class="clipboard-name">${this.escapeHtml(item.name)}</div>
        <div class="clipboard-size">${item.width}×${item.height}</div>
      `;
      
      const del = document.createElement('button');
      del.className = 'clipboard-delete';
      del.innerHTML = '✕';
      del.onclick = (e) => {
        e.stopPropagation();
        const idx = this.clipboard.findIndex(i => i.id === item.id);
        if (idx !== -1) this.clipboard.splice(idx, 1);
        this.saveClipboard();
        this.renderClipboardList();
      };
      
      div.onclick = () => {
        this.pasteFromItem(item);
        this.hideClipboard();
      };
      
      div.appendChild(thumb);
      div.appendChild(info);
      div.appendChild(del);
      this.clipboardList.appendChild(div);
    });
  }
  
  updateToolbarVisibility() {
    this.toolbar.style.display = this.hasSelection ? 'flex' : 'none';
  }
  
  saveClipboard() {
    try {
      localStorage.setItem('pixelite_clipboard', JSON.stringify(this.clipboard));
    } catch(e) {}
  }
  
  loadClipboard() {
    try {
      const saved = localStorage.getItem('pixelite_clipboard');
      if (saved) this.clipboard = JSON.parse(saved);
    } catch(e) {}
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  destroy() {
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  }
}