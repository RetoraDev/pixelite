// RulerTool.js
class RulerTool {
  constructor(editor) {
    this.editor = editor;
    
    this.isActive = false;
    this.startPoint = null;
    this.currentPoint = null;
    
    this.canvas = null;
    this.ctx = null;
    this.label = null;
    
    this.HD_SCALE = 16;
    
    this.init();
  }
  
  init() {
    this.createCanvas();
  }
  
  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.imageRendering = 'pixelated';
    
    this.editor.canvasWrapper.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    this.label = document.createElement('div');
    this.label.className = 'ruler-label';
    this.label.style.display = 'none';
    this.editor.uiLayer.appendChild(this.label);
  }
  
  updateCanvasSize() {
    if (!this.editor.project) return;
    
    const width = this.editor.project.width;
    const height = this.editor.project.height;
    
    this.canvas.width = width * this.HD_SCALE;
    this.canvas.height = height * this.HD_SCALE;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }
  
  onDown(x, y) {
    if (!this.editor.project) return;
    
    this.isActive = true;
    this.startPoint = { x: x * this.HD_SCALE, y: y * this.HD_SCALE };
    this.currentPoint = { x: x * this.HD_SCALE, y: y * this.HD_SCALE };
    
    this.updateCanvasSize();
    this.updateRuler();
    this.updateLabel(x, y);
  }
  
  onMove(x, y) {
    if (!this.isActive) return;
    
    this.currentPoint = { x: x * this.HD_SCALE, y: y * this.HD_SCALE };
    this.updateRuler();
    this.updateLabel(x, y);
  }
  
  onUp(x, y) {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.label.style.display = 'none';
  }
  
  updateRuler() {
    if (!this.startPoint || !this.currentPoint) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    
    const primaryColor = this.editor.primaryColor;
    this.ctx.strokeStyle = primaryColor;
    this.ctx.fillStyle = primaryColor;
    
    const zoom = this.editor.scale;
    
    // Base visual sizes at zoom=1
    const BASE_VISUAL_THICKNESS = 2;
    const BASE_VISUAL_ARROW = 12;
    const BASE_VISUAL_TIP = 6;
    
    // Apply zoom compensation
    let visualThickness = BASE_VISUAL_THICKNESS / zoom;
    let visualArrowSize = BASE_VISUAL_ARROW / zoom;
    let visualTipSize = BASE_VISUAL_TIP / zoom;
    
    // Apply minimum limits (never get too small)
    const MIN_VISUAL_THICKNESS = 1;
    const MIN_VISUAL_ARROW = 4;
    const MIN_VISUAL_TIP = 2;
    
    visualThickness = Math.max(MIN_VISUAL_THICKNESS, visualThickness);
    visualArrowSize = Math.max(MIN_VISUAL_ARROW, visualArrowSize);
    visualTipSize = Math.max(MIN_VISUAL_TIP, visualTipSize);
    
    // Convert to HD canvas pixels
    const lineThickness = visualThickness * this.HD_SCALE;
    const arrowSize = visualArrowSize * this.HD_SCALE;
    const arrowTipSize = visualTipSize * this.HD_SCALE;
    
    this.ctx.lineWidth = Math.max(1, lineThickness);
    
    const dx = this.currentPoint.x - this.startPoint.x;
    const dy = this.currentPoint.y - this.startPoint.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    
    const startX = this.startPoint.x;
    const startY = this.startPoint.y;
    const currentX = this.currentPoint.x;
    const currentY = this.currentPoint.y;
    
    // Horizontal line
    if (absDx > 0) {
      const isRight = dx > 0;
      
      let lineEndX = currentX;
      if (isRight) {
        lineEndX = currentX - arrowSize;
      } else {
        lineEndX = currentX + arrowSize;
      }
      
      const lineX = Math.min(startX, lineEndX);
      const lineWidth = Math.abs(lineEndX - startX);
      
      if (lineWidth > 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(lineX, startY);
        this.ctx.lineTo(lineX + lineWidth, startY);
        this.ctx.stroke();
      }
      
      const arrowX = currentX;
      
      this.ctx.beginPath();
      if (isRight) {
        this.ctx.moveTo(arrowX, startY);
        this.ctx.lineTo(arrowX - arrowSize, startY - arrowTipSize);
        this.ctx.lineTo(arrowX - arrowSize, startY + arrowTipSize);
      } else {
        this.ctx.moveTo(arrowX, startY);
        this.ctx.lineTo(arrowX + arrowSize, startY - arrowTipSize);
        this.ctx.lineTo(arrowX + arrowSize, startY + arrowTipSize);
      }
      this.ctx.fill();
    }
    
    // Vertical line
    if (absDy > 0) {
      const isDown = dy > 0;
      
      let lineEndY = currentY;
      if (isDown) {
        lineEndY = currentY - arrowSize;
      } else {
        lineEndY = currentY + arrowSize;
      }
      
      const lineY = Math.min(startY, lineEndY);
      const lineHeight = Math.abs(lineEndY - startY);
      
      if (lineHeight > 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(startX, lineY);
        this.ctx.lineTo(startX, lineY + lineHeight);
        this.ctx.stroke();
      }
      
      const arrowY = currentY;
      
      this.ctx.beginPath();
      if (isDown) {
        this.ctx.moveTo(startX, arrowY);
        this.ctx.lineTo(startX - arrowTipSize, arrowY - arrowSize);
        this.ctx.lineTo(startX + arrowTipSize, arrowY - arrowSize);
      } else {
        this.ctx.moveTo(startX, arrowY);
        this.ctx.lineTo(startX - arrowTipSize, arrowY + arrowSize);
        this.ctx.lineTo(startX + arrowTipSize, arrowY + arrowSize);
      }
      this.ctx.fill();
    }
    
    this.ctx.restore();
  }
  
  updateLabel(x, y) {
    if (!this.startPoint) {
      this.label.style.display = 'none';
      return;
    }
    
    const startX = this.startPoint.x / this.HD_SCALE;
    const startY = this.startPoint.y / this.HD_SCALE;
    const dx = Math.abs(x - startX);
    const dy = Math.abs(y - startY);
    
    const screenPos = this.editor.canvasToScreen(x, y);
    if (!screenPos) return;
    
    const labelWidth = 80;
    const labelHeight = 28;
    const offset = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const topBarHeight = 40;
    const bottomBarHeight = 50;
    
    const screenX = Math.round(screenPos.x);
    const screenY = Math.round(screenPos.y);
    
    const positions = [
      { x: screenX - labelWidth - offset, y: screenY - labelHeight - offset },
      { x: screenX + offset, y: screenY - labelHeight - offset },
      { x: screenX - labelWidth - offset, y: screenY + offset },
      { x: screenX + offset, y: screenY + offset }
    ];
    
    let labelX, labelY;
    for (const pos of positions) {
      const fitsHorizontally = pos.x >= offset && pos.x + labelWidth <= viewportWidth - offset;
      const fitsVertically = pos.y >= topBarHeight && pos.y + labelHeight <= viewportHeight - bottomBarHeight;
      if (fitsHorizontally && fitsVertically) {
        labelX = pos.x;
        labelY = pos.y;
        break;
      }
    }
    
    if (labelX === undefined) {
      labelX = offset;
      labelY = topBarHeight + offset;
    }
    
    this.label.style.left = `${labelX}px`;
    this.label.style.top = `${labelY}px`;
    this.label.textContent = `${Math.round(dx)} × ${Math.round(dy)} px`;
    this.label.style.display = 'block';
  }
  
  updateCanvasTransform() {
    // Canvas inherits transform from canvasWrapper automatically
  }
  
  cancel() {
    this.isActive = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.label.style.display = 'none';
  }
}