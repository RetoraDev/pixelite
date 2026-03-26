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
