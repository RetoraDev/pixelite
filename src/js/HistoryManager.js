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
        case 'crop_canvas':
          this.applyCropCanvasOperation(project, operation, isUndo);
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
    if (project == this.editor.project) {
      this.editor.render();
    }
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
    const frame = project.frames[frameIndex];
    
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
  
  applyCropCanvasOperation(project, operation, isUndo) {
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

  applyResizeCanvasOperation(project, operation, isUndo) {
    const { oldWidth, oldHeight, newWidth, newHeight, framesData, newFramesData } = operation;
    
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
      const frameData = framesData[fIndex];
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
          this.editor.resizeCanvas(newHeight, newWidth);
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
  
  applyToggleTransparencyOperation(project, operation, isUndo) {
    // Determinar si estamos restaurando o eliminando transparencia
    let shouldRestoreTransparency = operation.transparent;
    
    if (isUndo) shouldRestoreTransparency = !shouldRestoreTransparency;
    
    const targetProject = project || this.editor.project;
    const secondaryColor = this.editor.secondaryColor;
    const rgb = this.editor.hexToRgb(secondaryColor);
    let totalPixelsModified = 0;
    
    for (let f = 0; f < targetProject.frames.length; f++) {
      const frame = targetProject.frames[f];
      
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];
        const imageData = layer.ctx.getImageData(0, 0, targetProject.width, targetProject.height);
        const data = imageData.data;
        
        if (shouldRestoreTransparency) {
          // Modo RESTORE: Píxeles del color secundario → transparentes
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] === rgb.r && 
                data[i + 1] === rgb.g && 
                data[i + 2] === rgb.b && 
                data[i + 3] === 255) {
              data[i + 3] = 0;
              totalPixelsModified++;
            }
          }
        } else {
          // Modo REMOVE: Píxeles transparentes → color secundario opaco
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) {
              data[i] = rgb.r;
              data[i + 1] = rgb.g;
              data[i + 2] = rgb.b;
              data[i + 3] = 255;
              totalPixelsModified++;
            }
          }
        }
        
        layer.ctx.putImageData(imageData, 0, 0);
      }
    }
    
    // Actualizar el estado en el editor principal
    if (project === this.editor.project) {
      this.editor.transparentBackground = shouldRestoreTransparency;
      this.editor.render();
      
      // Mostrar notificación
      if (totalPixelsModified > 0) {
        const action = shouldRestoreTransparency ? 'restaurada' : 'eliminada';
        console.log(`Transparencia ${action}: ${totalPixelsModified} píxeles modificados`);
      }
    }
  }  
  
  supportsTimelapseEncoding() {
    return typeof VideoEncoder !== 'undefined' &&
           typeof VideoFrame !== 'undefined' &&
           typeof WebMMuxer !== 'undefined' &&
           typeof WebMMuxer.Muxer === 'function';
  }

  cancelTimelapse() {
    this._timelapseCancelled = true;
  }

  // Generate a timelapse video by replaying history.
  // Frames are rendered and VP9-encoded as fast as the machine allows (no
  // real-time capture involved), then muxed into a WebM container. Because
  // each frame carries its own timestamp, timing is independent of how long
  // rendering or encoding actually takes, so frames are never dropped or
  // duplicated. Resolves to a Blob, or null if the user cancelled.
  async generateTimelapse(fps, scale, progressCallback) {
    if (!this.supportsTimelapseEncoding()) {
      throw new Error(__("Este navegador no soporta la exportación de timelapse||This browser does not support timelapse export"));
    }

    this._timelapseCancelled = false;

    const srcWidth = this.editor.project.width;
    const srcHeight = this.editor.project.height;

    // Video encoders expect even dimensions
    const encWidth = (srcWidth * scale) + ((srcWidth * scale) % 2);
    const encHeight = (srcHeight * scale) + ((srcHeight * scale) % 2);

    const totalSteps = this.history.length;
    const frameDurationUs = Math.max(1, Math.round(1000000 / fps));
    const keyFrameInterval = Math.max(1, Math.round(fps * 2));

    // Temporary project to replay history into
    const tempProject = this.editor.getNewProjectData(srcWidth, srcHeight);

    // Reusable render + layer-compositing canvases
    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = encWidth;
    renderCanvas.height = encHeight;
    const renderCtx = this.editor.getCanvasContext(renderCanvas);

    const layerCanvas = document.createElement("canvas");
    layerCanvas.width = srcWidth;
    layerCanvas.height = srcHeight;
    const layerCtx = this.editor.getCanvasContext(layerCanvas);

    // Set up muxer + VP9 encoder
    const muxer = new WebMMuxer.Muxer({
      target: new WebMMuxer.ArrayBufferTarget(),
      video: {
        codec: "V_VP9",
        width: encWidth,
        height: encHeight,
        frameRate: fps
      }
    });

    let encoderError = null;
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
      error: (error) => { encoderError = error; }
    });

    encoder.configure({
      codec: "vp09.00.10.08",
      width: encWidth,
      height: encHeight,
      bitrate: 8000000,
      framerate: fps
    });

    try {
      for (let i = 0; i < totalSteps; i++) {
        if (this._timelapseCancelled) break;
        if (encoderError) throw encoderError;

        // Apply the next history entry to the temporary project
        this.applyHistoryEntry(this.history[i], false, tempProject);

        // Composite the current frame's visible layers
        if (this.editor.transparentBackground) {
          renderCtx.clearRect(0, 0, encWidth, encHeight);
        } else {
          renderCtx.fillStyle = this.editor.secondaryColor || "#ffffff";
          renderCtx.fillRect(0, 0, encWidth, encHeight);
        }

        const frame = tempProject.frames[tempProject.currentFrame || 0];
        if (frame) {
          for (let l = 0; l < frame.layers.length; l++) {
            const layer = frame.layers[l];
            if (!layer.visible) continue;

            layerCtx.clearRect(0, 0, srcWidth, srcHeight);
            if (layer.imageData) {
              layerCtx.putImageData(
                new ImageData(new Uint8ClampedArray(layer.imageData), srcWidth, srcHeight),
                0, 0
              );
            } else if (layer.canvas) {
              layerCtx.drawImage(layer.canvas, 0, 0);
            }

            renderCtx.imageSmoothingEnabled = false;
            renderCtx.drawImage(layerCanvas, 0, 0, srcWidth, srcHeight, 0, 0, encWidth, encHeight);
          }
        }

        // Encode the frame with an explicit timestamp
        const videoFrame = new VideoFrame(renderCanvas, {
          timestamp: Math.round(i * frameDurationUs),
          duration: frameDurationUs
        });
        encoder.encode(videoFrame, { keyFrame: i % keyFrameInterval === 0 });
        videoFrame.close();

        // Throttle if the encoder queue grows too large
        while (encoder.encodeQueueSize > 8 && !this._timelapseCancelled && !encoderError) {
          await new Promise(resolve => setTimeout(resolve, 4));
        }

        if (progressCallback) {
          progressCallback(Math.floor(((i + 1) / totalSteps) * 100), renderCanvas);
        }

        // Yield to the event loop so the UI can repaint and cancels register
        if (i % 4 === 3) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      if (this._timelapseCancelled) {
        this._timelapseCancelled = false;
        return null;
      }

      if (encoderError) throw encoderError;

      // Flush remaining frames and finalize the container
      await encoder.flush();
      muxer.finalize();

      return new Blob([muxer.target.buffer], { type: "video/webm" });
    } finally {
      try {
        if (encoder.state !== "closed") encoder.close();
      } catch (e) {
        // Ignore double-close
      }
    }
  }

  // Serialize history for saving
  serialize() {
    return JSON.stringify({
      history: structuredClone(this.history).map(entry => {
        entry.operations = entry.operations.map(operation => {
          if (operation.pixels) {
            operation.pixels = this.serializePixels(operation.pixels);
          }
          return operation;
        })
        return entry;
      }),
      historyIndex: this.historyIndex
    });
  }
  
  serializePixels(pixels, excludeOldColor = false) {
    if (!pixels || pixels.length === 0) return '';
    
    const parts = [];
    let lastX = 0, lastY = 0;
    
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      
      // Delta encoding
      let dx = p.x - lastX;
      let dy = p.y - lastY;
      lastX = p.x;
      lastY = p.y;
      
      // Convert colors to base36
      const newColor = this.colorToInt(p.newColor).toString(36);
      
      if (!excludeOldColor && p.oldColor) {
        const oldColor = this.colorToInt(p.oldColor).toString(36);
        parts.push(`${dx},${dy},${newColor},${oldColor}`);
      } else {
        parts.push(`${dx},${dy},${newColor}`);
      }
    }
    
    return parts.join(';');
  }

  // Deserialize history from loaded data
  deserialize(data) {
    try {
      const parsed = JSON.parse(data);
      this.history = parsed.history || [];
      this.history = this.history.map(entry => {
        entry.operations = entry.operations.map(operation => {
          if (typeof operation.pixels == 'string') {
            operation.pixels = this.deserializePixels(operation.pixels);
          }
          return operation;
        })
        return entry;
      }),
      this.historyIndex = parsed.historyIndex || -1;
      return true;
    } catch (error) {
      console.error('Error deserializing history:', error);
      return false;
    }
  }

  deserializePixels(pixelsStr) {
    if (!pixelsStr) return [];
    
    const result = [];
    let lastX = 0, lastY = 0;
    
    const parts = pixelsStr.split(';');
    for (const part of parts) {
      const split = part.split(',');
      if (split.length < 3) continue;
      
      const dx = parseInt(split[0], 10);
      const dy = parseInt(split[1], 10);
      const newColor = this.intToColor(parseInt(split[2], 36));
      
      const x = lastX + dx;
      const y = lastY + dy;
      lastX = x;
      lastY = y;
      
      const pixel = { x, y, newColor };
      
      if (split[3] !== undefined) {
        pixel.oldColor = this.intToColor(parseInt(split[3], 36));
      }
      
      result.push(pixel);
    }
    
    return result;
  }
  
  colorToInt(color) {
    return this.editor.colorPicker.hexToInt(color);
  }
  
  intToColor(int) {
    return this.editor.colorPicker.intToHex(int);
  }
  
  // Clear history
  clear() {
    this.history = [];
    this.historyIndex = -1;
    this.currentBatch = null;
  }
}