// Undo History Manager 
class HistoryManager {
  constructor(editor) {
    this.editor = editor;
    this.history = [];
    this.historyIndex = -1;
    this.maxHistoryLength = Infinity;
    this.currentBatch = null;
  }

  // Start a new batch of operations (for grouping multiple changes)
  startBatch(type, description) {
    if (this.currentBatch) {
      this.endBatch();
    }
    this.currentBatch = {
      type: type,
      description: description,
      timestamp: Date.now(),
      operations: []
    };
  }

  // End the current batch and add to history
  endBatch() {
    if (this.currentBatch && this.currentBatch.operations.length > 0) {
      this.addToHistory(this.currentBatch);
    }
    this.currentBatch = null;
  }

  // Add a change to history
  addChange(change) {
    if (this.currentBatch) {
      this.currentBatch.operations.push(change);
    } else {
      this.addToHistory({
        type: change.type,
        description: change.description,
        timestamp: Date.now(),
        operations: [change]
      });
    }
  }

  // Add entry to history
  addToHistory(entry) {
    // Remove any history after current index
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // Add new entry
    this.history.push(entry);
    this.historyIndex++;
    
    // Limit history size
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  // Undo/Redo
  undo() {
    if (this.historyIndex < 0) return null;
    
    const entry = this.history[this.historyIndex];
    this.applyHistoryEntry(entry, true);
    this.historyIndex--;
    
    return {
      entry,
      message: `Undo '${entry.description}'`
    };
  }
  
  redo() {
    if (this.historyIndex >= this.history.length - 1) return null;
    
    this.historyIndex++;
    const entry = this.history[this.historyIndex];
    this.applyHistoryEntry(entry, false);
    
    return {
      entry,
      message: `Redo '${entry.description}'`
    };
  }

  // Apply a history entry (undo or redo)
  applyHistoryEntry(entry, isUndo) {
    const operations = isUndo ? [...entry.operations].reverse() : entry.operations;
    
    operations.forEach(operation => {
      switch (operation.type) {
        case 'draw':
          this.applyDrawOperation(operation, isUndo);
          break;
        case 'add_frame':
          this.applyAddFrameOperation(operation, isUndo);
          break;
        case 'remove_frame':
          this.applyRemoveFrameOperation(operation, isUndo);
          break;
        case 'edit_frame':
          this.applyEditFrameOperation(operation, isUndo);
          break;
        case 'move_frame':
          this.applyMoveFrameOperation(operation, isUndo);
          break;
        case 'change_animation_fps':
          this.applyChangeFPSOperation(operation, isUndo);
          break;
        case 'add_layer':
          this.applyAddLayerOperation(operation, isUndo);
          break;
        case 'remove_layer':
          this.applyRemoveLayerOperation(operation, isUndo);
          break;
        case 'change_layer_visibility':
          this.applyLayerVisibilityOperation(operation, isUndo);
          break;
        case 'move_layer':
          this.applyMoveLayerOperation(operation, isUndo);
          break;
        case 'transform':
          this.applyTransformOperation(operation, isUndo);
          break;
        case 'color_adjustment':
          this.applyColorAdjustmentOperation(operation, isUndo);
          break;
      }
    });
    
    // Update UI after applying operations
    this.editor.updateFramesUI();
    this.editor.updateLayersUI();
    this.editor.render();
  }

  // Specific operation handlers
  applyDrawAction(item) {
    const { data } = item;
    
    const frame = this.editor.project?.frames[data.frame];
    if (!frame) return;
    
    const layer = frame.layers[data.layer];
    if (!layer) return;
    
    const ctx = layer.ctx;
    
    switch (data.type) {
      case 'fillRect':
        ctx.fillStyle = data.color;
        ctx.fillRect(data.x, data.y, data.w, data.h);
        break;
      case 'clearRect':
        ctx.clearRect(data.x, data.y, data.w, data.h);
        break;
    }
  }

  applyDrawOperation(operation, isUndo) {
    const { frameIndex, layerIndex, pixels } = operation;
    const frame = this.editor.project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    const ctx = layer.ctx;
    
    pixels.forEach(pixel => {
      const { x, y, oldColor, newColor } = pixel;
      const colorToApply = isUndo ? oldColor : newColor;
      
      if (colorToApply === 'transparent') {
        ctx.clearRect(x, y, 1, 1);
      } else {
        ctx.fillStyle = colorToApply;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }

  applyAddFrameOperation(operation, isUndo) {
    if (isUndo) {
      // Remove the frame that was added
      this.editor.project.frames.splice(operation.index, 1);
      this.editor.frameTimes.splice(operation.index, 1);
    } else {
      // Add the frame back
      const newFrame = {
        layers: operation.layers.map(layerData => {
          const layer = this.editor.createBlankLayer(
            this.editor.project.width, 
            this.editor.project.height,
            layerData.name
          );
          layer.visible = layerData.visible;
          
          // Restore layer content if available
          if (layerData.imageData) {
            const ctx = layer.ctx;
            const imageData = new ImageData(
              new Uint8ClampedArray(layerData.imageData),
              this.editor.project.width,
              this.editor.project.height
            );
            ctx.putImageData(imageData, 0, 0);
          }
          
          return layer;
        })
      };
      
      this.editor.project.frames.splice(operation.index, 0, newFrame);
      this.editor.frameTimes.splice(operation.index, 0, operation.frameTime);
    }
  }

  applyRemoveFrameOperation(operation, isUndo) {
    if (isUndo) {
      // Restore the removed frame
      const restoredFrame = {
        layers: operation.layers.map(layerData => {
          const layer = this.editor.createBlankLayer(
            this.editor.project.width, 
            this.editor.project.height,
            layerData.name
          );
          layer.visible = layerData.visible;
          
          if (layerData.imageData) {
            const ctx = layer.ctx;
            const imageData = new ImageData(
              new Uint8ClampedArray(layerData.imageData),
              this.editor.project.width,
              this.editor.project.height
            );
            ctx.putImageData(imageData, 0, 0);
          }
          
          return layer;
        })
      };
      
      this.editor.project.frames.splice(operation.index, 0, restoredFrame);
      this.editor.frameTimes.splice(operation.index, 0, operation.frameTime);
    } else {
      // Remove the frame again
      this.editor.project.frames.splice(operation.index, 1);
      this.editor.frameTimes.splice(operation.index, 1);
    }
  }

  applyEditFrameOperation(operation, isUndo) {
    const { frameIndex, property, oldValue, newValue } = operation;
    
    if (property === 'time') {
      this.editor.frameTimes[frameIndex] = isUndo ? oldValue : newValue;
    }
    // Add other frame properties as needed
  }

  applyMoveFrameOperation(operation, isUndo) {
    const { fromIndex, toIndex } = operation;
    
    if (isUndo) {
      // Move back to original position
      const frame = this.editor.project.frames.splice(toIndex, 1)[0];
      const frameTime = this.editor.frameTimes.splice(toIndex, 1)[0];
      this.editor.project.frames.splice(fromIndex, 0, frame);
      this.editor.frameTimes.splice(fromIndex, 0, frameTime);
    } else {
      // Move to new position again
      const frame = this.editor.project.frames.splice(fromIndex, 1)[0];
      const frameTime = this.editor.frameTimes.splice(fromIndex, 1)[0];
      this.editor.project.frames.splice(toIndex, 0, frame);
      this.editor.frameTimes.splice(toIndex, 0, frameTime);
    }
  }

  applyChangeFPSOperation(operation, isUndo) {
    this.editor.animationFPS = isUndo ? operation.oldFPS : operation.newFPS;
    this.editor.currentFrameTime = 1000 / this.editor.animationFPS;
    this.editor.fpsInput.value = this.editor.animationFPS;
  }

  applyAddLayerOperation(operation, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = this.editor.project.frames[frameIndex];
    
    if (isUndo) {
      // Remove the added layer
      frame.layers.splice(layerIndex, 1);
    } else {
      // Add the layer back
      const layer = this.editor.createBlankLayer(
        this.editor.project.width, 
        this.editor.project.height,
        layerData.name
      );
      layer.visible = layerData.visible;
      
      if (layerData.imageData) {
        const ctx = layer.ctx;
        const imageData = new ImageData(
          new Uint8ClampedArray(layerData.imageData),
          this.editor.project.width,
          this.editor.project.height
        );
        ctx.putImageData(imageData, 0, 0);
      }
      
      frame.layers.splice(layerIndex, 0, layer);
    }
  }

  applyRemoveLayerOperation(operation, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = this.editor.project.frames[frameIndex];
    
    if (isUndo) {
      // Restore the removed layer
      const layer = this.editor.createBlankLayer(
        this.editor.project.width, 
        this.editor.project.height,
        layerData.name
      );
      layer.visible = layerData.visible;
      
      if (layerData.imageData) {
        const ctx = layer.ctx;
        const imageData = new ImageData(
          new Uint8ClampedArray(layerData.imageData),
          this.editor.project.width,
          this.editor.project.height
        );
        ctx.putImageData(imageData, 0, 0);
      }
      
      frame.layers.splice(layerIndex, 0, layer);
    } else {
      // Remove the layer again
      frame.layers.splice(layerIndex, 1);
    }
  }

  applyLayerVisibilityOperation(operation, isUndo) {
    const { frameIndex, layerIndex, visible } = operation;
    const frame = this.editor.project.frames[frameIndex];
    frame.layers[layerIndex].visible = isUndo ? !visible : visible;
  }

  applyMoveLayerOperation(operation, isUndo) {
    const { frameIndex, fromIndex, toIndex } = operation;
    const frame = this.editor.project.frames[frameIndex];
    
    if (isUndo) {
      // Move back to original position
      const layer = frame.layers.splice(toIndex, 1)[0];
      frame.layers.splice(fromIndex, 0, layer);
    } else {
      // Move to new position again
      const layer = frame.layers.splice(fromIndex, 1)[0];
      frame.layers.splice(toIndex, 0, layer);
    }
  }

  applyTransformOperation(operation, isUndo) {
    const { frameIndex, layerIndex, transformType, transformData } = operation;
    const frame = this.editor.project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    const ctx = layer.ctx;
    
    // For simplicity, we'll store the entire image data for transformations
    // This is still more efficient than full project snapshots
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? transformData.oldImageData : transformData.newImageData),
      this.editor.project.width,
      this.editor.project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
  }

  applyColorAdjustmentOperation(operation, isUndo) {
    const { frameIndex, layerIndex, adjustmentType, adjustmentData } = operation;
    const frame = this.editor.project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    const ctx = layer.ctx;
    
    // Similar to transform, store the image data for color adjustments
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? adjustmentData.oldImageData : adjustmentData.newImageData),
      this.editor.project.width,
      this.editor.project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
  }

  // Generate timelapse by replaying history
  async generateTimelapse(fps, scale, progressCallback) {
    // Create a temporary project to replay history
    const tempProject = this.editor.getNewProjectData(this.editor.project.width, this.editor.project.height);
    const tempFrameTimes = [...this.editor.frameTimes];
    
    // Get canvas for rendering
    const { canvas: tempCanvas, ctx: tempCtx } = this.editor.getTempCanvas(tempProject.width * scale, tempProject.height * scale);
    
    // Set up media recording
    const stream = tempCanvas.captureStream();
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8000000
    });
    
    const chunks = [];
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
      
      recorder.start();
      
      // Replay history to create timelapse
      this.replayHistoryForTimelapse(
        tempProject, 
        tempFrameTimes, 
        tempCanvas, 
        tempCtx, 
        scale, 
        fps, 
        progressCallback,
        () => {
          setTimeout(() => recorder.stop(), 1000 / fps);
        }
      );
    });
  }

  async replayHistoryForTimelapse(project, frameTimes, canvas, ctx, scale, fps, progressCallback, onComplete) {
    const frameInterval = 1000 / fps;
    let currentHistoryIndex = 0;
    let lastFrameIndex = project.currentFrame || 0;
    
    const renderFrame = async () => {
      if (currentHistoryIndex >= this.history.length) {
        onComplete();
        return;
      }
      
      // Apply next history entry
      const entry = this.history[currentHistoryIndex];
      this.applyHistoryEntryToProject(entry, project, frameTimes, false);
      
      // Check if frame has changed
      const currentFrameIndex = project.currentFrame || 0;
      const frameChanged = currentFrameIndex !== lastFrameIndex;
      lastFrameIndex = currentFrameIndex;
      
      // Always clear the canvas completely for each frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      if (!this.editor.transparentBackground) {
        ctx.fillStyle = this.editor.secondaryColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Create temporary canvas for the frame layers layers
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = project.width;
      layerCanvas.height = project.height;
      const layerCtx = this.editor.getCanvasContext(layerCanvas);
      
      // Draw current frame
      const frame = project.frames[currentFrameIndex];
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];
        if (layer.visible) {
          // Clear the temporary canvas
          layerCtx.clearRect(0, 0, project.width, project.height);
          
          // If we have image data, put it on the canvas
          if (layer.imageData) {
            const imageData = new ImageData(
              new Uint8ClampedArray(layer.imageData),
              project.width,
              project.height
            );
            layerCtx.putImageData(imageData, 0, 0);
          } else if (layer.canvas) {
            // If we have a canvas, draw it
            layerCtx.drawImage(layer.canvas, 0, 0);
          }
          
          // Draw scaled to the main canvas
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            layerCanvas, 
            0, 0, project.width, project.height,
            0, 0, canvas.width, canvas.height
          );
        }
      }
      
      // Update progress
      progressCallback(Math.floor((currentHistoryIndex / this.history.length) * 100), canvas.toDataURL());
      
      currentHistoryIndex++;
      
      // Schedule next frame
      if (currentHistoryIndex < this.history.length) {
        setTimeout(renderFrame, frameInterval);
      } else {
        setTimeout(() => {
          onComplete();
        }, frameInterval);
      }
    };
    
    // Start rendering
    renderFrame();
  }

  applyHistoryEntryToProject(entry, project, frameTimes, isUndo) {
    const operations = isUndo ? [...entry.operations].reverse() : entry.operations;
    
    operations.forEach(operation => {
      switch (operation.type) {
        case 'add_frame':
          this.applyAddFrameToProject(operation, project, frameTimes, isUndo);
          break;
        case 'remove_frame':
          this.applyRemoveFrameToProject(operation, project, frameTimes, isUndo);
          break;
        case 'edit_frame':
          if (operation.property === 'time') {
            frameTimes[operation.frameIndex] = isUndo ? operation.oldValue : operation.newValue;
          }
          break;
        case 'move_frame':
          this.applyMoveFrameToProject(operation, project, frameTimes, isUndo);
          break;
        case 'change_animation_fps':
          // This affects the global FPS, so we might not need to apply it per project
          break;
        case 'add_layer':
          this.applyAddLayerToProject(operation, project, isUndo);
          break;
        case 'remove_layer':
          this.applyRemoveLayerToProject(operation, project, isUndo);
          break;
        case 'change_layer_visibility':
          const frame = project.frames[operation.frameIndex];
          frame.layers[operation.layerIndex].visible = isUndo ? !operation.visible : operation.visible;
          break;
        case 'move_layer':
          this.applyMoveLayerToProject(operation, project, isUndo);
          break;
        // Note: draw, transform, and color_adjustment operations modify canvas content,
        // so we'd need to store image data in the operation for this to work properly
      }
    });
  }

  // Project-specific operation handlers (similar to the main ones but for a target project)
  applyHistoryEntryToProject(entry, project, frameTimes, isUndo) {
    const operations = isUndo ? [...entry.operations].reverse() : entry.operations;
    
    operations.forEach(operation => {
      switch (operation.type) {
        case 'add_frame':
          this.applyAddFrameToProject(operation, project, frameTimes, isUndo);
          break;
        case 'remove_frame':
          this.applyRemoveFrameToProject(operation, project, frameTimes, isUndo);
          break;
        case 'edit_frame':
          if (operation.property === 'time') {
            frameTimes[operation.frameIndex] = isUndo ? operation.oldValue : operation.newValue;
          }
          break;
        case 'move_frame':
          this.applyMoveFrameToProject(operation, project, frameTimes, isUndo);
          break;
        case 'change_animation_fps':
          // This affects the global FPS, so we might not need to apply it per project
          break;
        case 'add_layer':
          this.applyAddLayerToProject(operation, project, isUndo);
          break;
        case 'remove_layer':
          this.applyRemoveLayerToProject(operation, project, isUndo);
          break;
        case 'change_layer_visibility':
          const frame = project.frames[operation.frameIndex];
          if (frame && frame.layers[operation.layerIndex]) {
            frame.layers[operation.layerIndex].visible = isUndo ? !operation.visible : operation.visible;
          }
          break;
        case 'move_layer':
          this.applyMoveLayerToProject(operation, project, isUndo);
          break;
        case 'transform':
          this.applyTransformToProject(operation, project, isUndo);
          break;
        case 'color_adjustment':
          this.applyColorAdjustmentToProject(operation, project, isUndo);
          break;
        case 'draw':
          this.applyDrawToProject(operation, project, isUndo);
          break;
      }
    });
  }

  applyAddFrameToProject(operation, project, frameTimes, isUndo) {
    if (isUndo) {
      project.frames.splice(operation.index, 1);
      frameTimes.splice(operation.index, 1);
    } else {
      const newFrame = {
        layers: operation.layers.map(layerData => {
          const canvas = document.createElement('canvas');
          const ctx = this.getCanvasContext(canvas);
          const layer = {
            canvas: canvas,
            ctx: ctx,
            visible: layerData.visible,
            name: layerData.name
          };
          layer.canvas.width = project.width;
          layer.canvas.height = project.height;
          
          if (layerData.imageData) {
            const ctx = layer.ctx;
            const imageData = new ImageData(
              new Uint8ClampedArray(layerData.imageData),
              project.width,
              project.height
            );
            ctx.putImageData(imageData, 0, 0);
          }
          
          return layer;
        })
      };
      
      project.frames.splice(operation.index, 0, newFrame);
      frameTimes.splice(operation.index, 0, operation.frameTime);
    }
  }

  applyRemoveFrameToProject(operation, project, frameTimes, isUndo) {
    if (isUndo) {
      const restoredFrame = {
        layers: operation.layers.map(layerData => {
          const canvas = document.createElement('canvas');
          const ctx = this.getCanvasContext(canvas);
          const layer = {
            canvas: canvas,
            ctx: ctx,
            visible: layerData.visible,
            name: layerData.name
          };
          layer.canvas.width = project.width;
          layer.canvas.height = project.height;
          
          if (layerData.imageData) {
            const ctx = layer.ctx;
            ctx.putImageData(
              new ImageData(
                new Uint8ClampedArray(layerData.imageData),
                project.width,
                project.height
              ),
              0, 0
            );
          }
          
          return layer;
        })
      };
      
      project.frames.splice(operation.index, 0, restoredFrame);
      frameTimes.splice(operation.index, 0, operation.frameTime);
    } else {
      project.frames.splice(operation.index, 1);
      frameTimes.splice(operation.index, 1);
    }
  }

  applyMoveFrameToProject(operation, project, frameTimes, isUndo) {
    const { fromIndex, toIndex } = operation;
    
    if (isUndo) {
      const frame = project.frames.splice(toIndex, 1)[0];
      const frameTime = frameTimes.splice(toIndex, 1)[0];
      project.frames.splice(fromIndex, 0, frame);
      frameTimes.splice(fromIndex, 0, frameTime);
    } else {
      const frame = project.frames.splice(fromIndex, 1)[0];
      const frameTime = frameTimes.splice(fromIndex, 1)[0];
      project.frames.splice(toIndex, 0, frame);
      frameTimes.splice(toIndex, 0, frameTime);
    }
  }

  applyAddLayerToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = project.frames[frameIndex];
    
    if (isUndo) {
      frame.layers.splice(layerIndex, 1);
    } else {
      const canvas = document.createElement('canvas');
      const ctx = this.getCanvasContext(canvas);
      const layer = {
        canvas: canvas,
        ctx: ctx,
        visible: layerData.visible,
        name: layerData.name
      };
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
      
      if (layerData.imageData) {
        const ctx = layer.ctx;
        const imageData = new ImageData(
          new Uint8ClampedArray(layerData.imageData),
          project.width,
          project.height
        );
        ctx.putImageData(imageData, 0, 0);
      }
      
      frame.layers.splice(layerIndex, 0, layer);
    }
  }

  applyRemoveLayerToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = project.frames[frameIndex];
    
    if (isUndo) {
      const canvas = document.createElement('canvas');
      const ctx = this.getCanvasContext(canvas);
      const layer = {
        canvas: canvas,
        ctx: ctx,
        visible: layerData.visible,
        name: layerData.name
      };
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
      
      if (layerData.imageData) {
        const ctx = layer.ctx;
        ctx.putImageData(
          new ImageData(
            new Uint8ClampedArray(layerData.imageData),
            project.width,
            project.height
          ),
          0, 0
        );
      }
      
      frame.layers.splice(layerIndex, 0, layer);
    } else {
      frame.layers.splice(layerIndex, 1);
    }
  }

  applyMoveLayerToProject(operation, project, isUndo) {
    const { frameIndex, fromIndex, toIndex } = operation;
    const frame = project.frames[frameIndex];
    
    if (isUndo) {
      const layer = frame.layers.splice(toIndex, 1)[0];
      frame.layers.splice(fromIndex, 0, layer);
    } else {
      const layer = frame.layers.splice(fromIndex, 1)[0];
      frame.layers.splice(toIndex, 0, layer);
    }
  }

  applyTransformToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, transformData } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    
    if (!layer.canvas) {
      layer.canvas = document.createElement('canvas');
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
    }
    
    const ctx = layer.ctx;
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? transformData.oldImageData : transformData.newImageData),
      transformData.oldWidth || project.width,
      transformData.oldHeight || project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
    
    // Update dimensions if they changed
    if (transformData.newWidth && transformData.newHeight) {
      layer.canvas.width = isUndo ? transformData.oldWidth : transformData.newWidth;
      layer.canvas.height = isUndo ? transformData.oldHeight : transformData.newHeight;
    }
  }
  
  applyColorAdjustmentToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, adjustmentData } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    
    if (!layer.canvas) {
      layer.canvas = document.createElement('canvas');
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
    }
    
    const ctx = layer.ctx;
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? adjustmentData.oldImageData : adjustmentData.newImageData),
      project.width,
      project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  applyDrawToProject(operation, project, isUndo) {
    const { frameIndex, layerIndex, pixels } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    
    project.currentFrame  = frameIndex;
    project.currentLayer = layerIndex
    
    if (!layer.canvas) {
      layer.canvas = document.createElement('canvas');
      layer.canvas.width = project.width;
      layer.canvas.height = project.height;
    }
    
    const ctx = layer.ctx;
    
    pixels.forEach(pixel => {
      const { x, y, oldColor, newColor } = pixel;
      const colorToApply = isUndo ? oldColor : newColor;
      
      if (colorToApply === 'transparent') {
        ctx.clearRect(x, y, 1, 1);
      } else {
        ctx.fillStyle = colorToApply;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
  
  // Serialize history for saving
  serialize() {
    return JSON.stringify({
      history: this.history,
      historyIndex: this.historyIndex
    });
  }

  // Deserialize history from loaded data
  deserialize(data) {
    try {
      const parsed = JSON.parse(data);
      this.history = parsed.history || [];
      this.historyIndex = parsed.historyIndex || -1;
      return true;
    } catch (error) {
      console.error('Error deserializing history:', error);
      return false;
    }
  }

  // Clear history
  clear() {
    this.history = [];
    this.historyIndex = -1;
    this.currentBatch = null;
  }
}