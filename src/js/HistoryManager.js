// Undo History Manager 
class HistoryManager {
  constructor(editor) {
    this.editor = editor;
    this.history = [];
    this.historyIndex = 0;
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
  endBatch(forced = false) {
    if (this.currentBatch && this.currentBatch.operations.length > 0) {
      if (forced) {
        // Forced batch end means user canceled the current operation
        // We need to silently undo every single change
        this.applyHistoryEntry(this.currentBatch, true); // true for undo mode
        this.currentBatch = null;
      } else {
        this.addToHistory(this.currentBatch);
      }
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
      message: __(`(Deshacer|Undo) '${entry.description}'`)
    };
  }
  
  redo() {
    if (this.historyIndex >= this.history.length - 1) return null;
    
    this.historyIndex++;
    const entry = this.history[this.historyIndex];
    this.applyHistoryEntry(entry, false);
    
    return {
      entry,
      message: __(`(Rehacer|Redo) '${entry.description}'`)
    };
  }

  // Apply a history entry (undo or redo)
  applyHistoryEntry(entry, isUndo, project) {
    const operations = isUndo ? [...entry.operations].reverse() : entry.operations;
    
    if (!project) project = this.editor.project;
    
    operations.forEach(operation => {
      switch (operation.type) {
        case 'draw':
          this.applyDrawOperation(project, operation, isUndo);
          break;
        case 'add_frame':
          this.applyAddFrameOperation(project, operation, isUndo);
          break;
        case 'remove_frame':
          this.applyRemoveFrameOperation(project, operation, isUndo);
          break;
        case 'duplicate_frame':
          this.applyDuplicateFrameOperation(project, operation, isUndo);
          break;
        case 'edit_frame':
          this.applyEditFrameOperation(project, operation, isUndo);
          break;
        case 'move_frame':
          this.applyMoveFrameOperation(project, operation, isUndo);
          break;
        case 'change_animation_fps':
          this.applyChangeFPSOperation(project, operation, isUndo);
          break;
        case 'add_layer':
          this.applyAddLayerOperation(project, operation, isUndo);
          break;
        case 'remove_layer':
          this.applyRemoveLayerOperation(project, operation, isUndo);
          break;
        case 'duplicate_layer':
          this.applyDuplicateLayerOperation(project, operation, isUndo);
          break;
        case 'rename_layer':
          this.applyRenameLayerOperation(project, operation, isUndo);
          break;
        case 'merge_layers':
          this.applyMergeLayersOperation(project, operation, isUndo);
          break;
        case 'change_layer_visibility':
          this.applyLayerVisibilityOperation(project, operation, isUndo);
          break;
        case 'move_layer':
          this.applyMoveLayerOperation(project, operation, isUndo);
          break;
        case 'transform':
          this.applyTransformOperation(project, operation, isUndo);
          break;
        case 'color_adjustment':
          this.applyColorAdjustmentOperation(project, operation, isUndo);
          break;
        case 'resize_canvas':
          this.applyResizeCanvasOperation(project, operation, isUndo);
          break;
        case 'toggle_transparency':
          this.applyToggleTransparencyOperation(project, operation, isUndo);
          break;
      }
    });
    
    // Update UI after applying operations
    this.editor.updateFramesUI();
    this.editor.updateLayersUI();
    this.editor.render();
  }

  // Specific operation handlers
  applyDrawOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, pixels } = operation;
    const frame = project.frames[frameIndex];
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

  applyAddFrameOperation(project, operation, isUndo) {
    if (isUndo) {
      // Remove the frame that was added
      project.frames.splice(operation.index, 1);
      project.frameTimes.splice(operation.index, 1);
      project.currentFrame = Math.min(operation.index, project.frames.length - 1);
    } else {
      // Add the frame back
      const newFrame = {
        layers: operation.layers.map(layerData => {
          const layer = this.editor.createBlankLayer(project.width, project.height, layerData.name);
          layer.visible = layerData.visible;
          
          // Restore layer content if available
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
      project.frameTimes.splice(operation.index, 0, operation.frameTime);
      project.currentFrame = operation.index;
    }
  }

  applyRemoveFrameOperation(project, operation, isUndo) {
    this.applyAddFrameOperation(project, operation, !isUndo);
  }
  
  applyDuplicateFrameOperation(project, operation, isUndo) {
    if (isUndo) {
      // Remove the duplicated frame
      project.frames.splice(operation.index, 1);
      project.frameTimes.splice(operation.index, 1);
      project.currentFrame = Math.min(operation.index, this.editor.project.frames.length - 1);
    } else {
      // Restore the duplicated frame
      const newFrame = {
        layers: operation.layers.map(layerData => {
          const layer = this.editor.createBlankLayer(project.width, project.height, layerData.name);
          layer.visible = layerData.visible;
          
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
      project.frameTimes.splice(operation.index, 0, operation.frameTime);
      project.currentFrame = operation.index;
    }
  }

  applyEditFrameOperation(project, operation, isUndo) {
    const { frameIndex, property, oldValue, newValue } = operation;
    
    if (property === 'time') {
      project.frameTimes[frameIndex] = isUndo ? oldValue : newValue;
    }
  }

  applyMoveFrameOperation(project, operation, isUndo) {
    const { fromIndex, toIndex } = operation;
    
    if (isUndo) {
      // Move back to original position
      const frame = project.frames.splice(toIndex, 1)[0];
      const frameTime = project.frameTimes.splice(toIndex, 1)[0];
      project.frames.splice(fromIndex, 0, frame);
      project.frameTimes.splice(fromIndex, 0, frameTime);
    } else {
      // Move to new position again
      const frame = project.frames.splice(fromIndex, 1)[0];
      const frameTime = project.frameTimes.splice(fromIndex, 1)[0];
      project.frames.splice(toIndex, 0, frame);
      project.frameTimes.splice(toIndex, 0, frameTime);
    }
  }

  applyChangeFPSOperation(project, operation, isUndo) {
    project.frameTimes = isUndo ? operation.oldFrameTimes : operation.newFrameTimes;
    
    const fps = isUndo ? operation.oldFPS : operation.newFPS;
    
    project.currentFrameTime = 1000 / operation.newFPS;
    
    this.editor.fpsInput.value = fps;
  }

  applyAddLayerOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = project.frames[frameIndex];
    
    if (isUndo) {
      // Remove the added layer
      frame.layers.splice(layerIndex, 1);
      project.currentLayer = Math.min(layerIndex, frame.layers.length - 1);
    } else {
      // Add the layer back
      const layer = this.editor.createBlankLayer(project.width, project.height, layerData.name);
      layer.visible = layerData.visible;
      
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

      project.currentLayer = layerIndex;
    }
  }

  applyRemoveLayerOperation(project, operation, isUndo) {
    // Apply 'Add Layer' operation in reverse
    this.applyAddLayerOperation(project, operation, !isUndo);
  }
  
  applyDuplicateLayerOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, layerData } = operation;
    const frame = this.editor.project.frames[frameIndex];
    
    if (isUndo) {
      // Remove the duplicated layer
      frame.layers.splice(layerIndex, 1);
      this.editor.project.currentLayer = Math.min(layerIndex, frame.layers.length - 1);
    } else {
      // Restore the duplicated layer
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
      this.editor.project.currentLayer = layerIndex;
    }
  }
  
  applyRenameLayerOperation(project, operation, isUndo) {
    const { layerIndex, previousName, newName } = operation;
    
    // Rename the layer in all frames
    project.frames.forEach(frame => {
      const layer = frame.layers[layerIndex];
      
      layer.name = isUndo ? previousName : newName;
    });
  }
  
  applyMergeLayersOperation(project, operation, isUndo) {
    const { frameIndex, sourceIndex, targetIndex, sourceData, targetData } = operation;
    const frame = projectframes[frameIndex];
    
    if (isUndo) {
      // Restore both layers to their original state
      const sourceLayer = this.editor.createBlankLayer(project.width, project.height, sourceData.name);
      sourceLayer.visible = sourceData.visible;
      
      const sourceImageData = new ImageData(
        new Uint8ClampedArray(sourceData.imageData),
        project.width,
        project.height
      );
      sourceLayer.ctx.putImageData(sourceImageData, 0, 0);
      
      const targetLayer = frame.layers[targetIndex];
      targetLayer.ctx.clearRect(0, 0, project.width, project.height);
      
      const targetImageData = new ImageData(
        new Uint8ClampedArray(targetData.imageData),
        project.width,
        project.height
      );
      targetLayer.ctx.putImageData(targetImageData, 0, 0);
      
      // Reinsert source layer at original position
      frame.layers.splice(sourceIndex, 0, sourceLayer);
      
      // Adjust current layer if needed
      if (sourceIndex <= project.currentLayer) {
        project.currentLayer++;
      }
      
    } else {
      // Perform merge again
      const sourceLayer = frame.layers[sourceIndex];
      const targetLayer = frame.layers[targetIndex];
      
      targetLayer.ctx.drawImage(sourceLayer.canvas, 0, 0);
      frame.layers.splice(sourceIndex, 1);
      
      if (sourceIndex < project.currentLayer) {
        project.currentLayer--;
      } else if (sourceIndex === project.currentLayer) {
        project.currentLayer = targetIndex;
      }
    }
  }

  applyLayerVisibilityOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, visible } = operation;
    const frame = project.frames[frameIndex];
    frame.layers[layerIndex].visible = isUndo ? !visible : visible;
  }

  applyMoveLayerOperation(project, operation, isUndo) {
    const { frameIndex, fromIndex, toIndex } = operation;
    const frame = project.frames[frameIndex];
    
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

  applyTransformOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, transformType, transformData } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    const ctx = layer.ctx;
    
    // We'll store the entire image data for transformations
    // This is still more efficient than full project snapshots
    // But we can optimize this in the future
    
    ctx.clearRect(0, 0, project.width, project.height);
    
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? transformData.oldImageData : transformData.newImageData),
      project.width,
      project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
  }

  applyColorAdjustmentOperation(project, operation, isUndo) {
    const { frameIndex, layerIndex, adjustmentType, adjustmentData } = operation;
    const frame = project.frames[frameIndex];
    const layer = frame.layers[layerIndex];
    const ctx = layer.ctx;
    
    // Similar to transform, store the image data for color adjustments
    const imageData = new ImageData(
      new Uint8ClampedArray(isUndo ? adjustmentData.oldImageData : adjustmentData.newImageData),
      project.width,
      project.height
    );
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  applyResizeCanvasOperation(project, operation, isUndo) {
    const { oldWidth, oldHeight, newWidth, newHeight, cropX, cropY, framesData } = operation;
    
    // Store current frame/layer indices
    const currentFrame = project.currentFrame;
    const currentLayer = project.currentLayer;
    
    // Determine which dimensions to use
    const targetWidth = isUndo ? oldWidth : newWidth;
    const targetHeight = isUndo ? oldHeight : newHeight;
    
    // Resize project dimensions first
    project.width = targetWidth;
    project.height = targetHeight;
    this.editor.resetCanvasSize();
    
    // Restore/transform each layer
    project.frames.forEach((frame, fIndex) => {
      // Make sure we have data for this frame
      const frameData = framesData && framesData[fIndex];
      if (!frameData) return;
      
      frame.layers.forEach((layer, lIndex) => {
        const layerData = frameData.layers && frameData.layers[lIndex];
        if (!layerData) return;
        
        // Ensure we have valid image data array
        const expectedLength = 4 * oldWidth * oldHeight;
        let imageDataArray = layerData.imageData;
        
        // If the array length doesn't match, create a blank array of correct size
        if (!imageDataArray || imageDataArray.length !== expectedLength) {
          imageDataArray = new Array(expectedLength).fill(0);
        }
        
        if (isUndo) {
          // Undo: restore original size and content
          const imageData = new ImageData(
            new Uint8ClampedArray(imageDataArray),
            oldWidth,
            oldHeight
          );
          
          // Create temp canvas with original size
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = oldWidth;
          tempCanvas.height = oldHeight;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.putImageData(imageData, 0, 0);
          
          // Resize layer canvas to original size
          layer.canvas.width = oldWidth;
          layer.canvas.height = oldHeight;
          
          // Draw back to resized canvas
          layer.ctx.clearRect(0, 0, oldWidth, oldHeight);
          layer.ctx.drawImage(tempCanvas, 0, 0);
        } else {
          // Redo: crop to new size
          const imageData = new ImageData(
            new Uint8ClampedArray(imageDataArray),
            oldWidth,
            oldHeight
          );
          
          // Create temp canvas with original content
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = oldWidth;
          tempCanvas.height = oldHeight;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.putImageData(imageData, 0, 0);
          
          // Resize layer canvas to new size
          layer.canvas.width = newWidth;
          layer.canvas.height = newHeight;
          
          // Draw cropped area
          layer.ctx.clearRect(0, 0, newWidth, newHeight);
          layer.ctx.drawImage(tempCanvas, -cropX, -cropY);
        }
      });
    });
    
    // Restore frame/layer indices
    project.currentFrame = Math.min(currentFrame, project.frames.length - 1);
    project.currentLayer = Math.min(currentLayer, 
      project.frames[project.currentFrame].layers.length - 1);
    
    // Update transform and render
    this.editor.updateCanvasTransform();
    this.editor.render();
  }
  
  applyToggleTransparencyOperation(_, operation, isUndo) {
    // TODO: Make transparente background work per project
    let transparent = operation.transparent;
    
    if (isUndo) transparent = !transparent;
    
    if (transparent) {
      this.editor.removeTransparentColor();
    } else {
      this.editor.restoreTransparentColor();
    }
    
    // Toggle transparency and render
    this.editor.transparentBackground = transparent;
    this.editor.render();
  }
  
  // Generate timelapse by replaying history
  async generateTimelapse(fps, scale, progressCallback) {
    // Create a temporary project to replay history
    const tempProject = this.editor.getNewProjectData(this.editor.project.width, this.editor.project.height);
    const tempFrameTimes = [...this.editor.project.frameTimes];
    
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

  // Project-specific operation handlers (similar to the main ones but for a target project) used to generate timelapse
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
          const ctx = this.editor.getCanvasContext(canvas);
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
          const ctx = this.editor.getCanvasContext(canvas);
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
      const ctx = this.editor.getCanvasContext(canvas);
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
      const ctx = this.editor.getCanvasContext(canvas);
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