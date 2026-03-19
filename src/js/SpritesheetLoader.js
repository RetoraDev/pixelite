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
    this.editor.frameTimes.push(this.editor.currentFrameTime);
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