// Collaboration Manager
class CollabManager {
  constructor(editor) {
    this.editor = editor;
    this.ws = null;
    this.host = HOST;
    this.sessionId = null;
    this.sessionName = '';
    this.memberId = null;
    this.memberName = this.editor.collabMemberName;
    this.memberColor = this.editor.collabMemberColor;
    this.isHost = false;
    this.isConnected = false;
    this.manualDisconnect = false;
    this.chatVisible = false;
    
    // Members tracking
    this.members = new Map();
    
    // Permissions
    this.permissions = {
      undoRedo: 'host',
      addRemoveFrames: 'host',
      addRemoveLayers: 'host',
      draw: 'everyone',
      chat: 'everyone'
    };
    
    // Temporary canvas
    this.tempCanvas = document.createElement('canvas');
    
    // Visible cursors tracking
    this.cursors = new Map();
    this.cursorContainer = null;
    
    // Current trace being drawn
    this.currentTrace = null;
    
    // Chat
    this.chatMessages = [];
    
    // Throttle cursor updates
    this.lastCursorSend = 0;
    this.CURSOR_THROTTLE = 100;
    
    // Initialize
    this.initUI();
  }

  getColorHex(colorName) {
    const colors = {
      red: '#ff4444',
      blue: '#4444ff',
      green: '#44ff44',
      yellow: '#ffff44',
      orange: '#ff5722',
      purple: '#aa44ff',
      pink: '#ff44aa',
      cyan: '#44ffff',
      brown: '#8b4513',
      gray: '#888888',
      lime: '#aaff44',
      indigo: '#4b0082'
    };
    return colors[colorName] || '#ffffff';
  }
  
  wrapMemberName(member, displayName) {
    return `<span style="color:${this.getColorHex(member.color)}">${displayName || member.name}</span>`;
  }

  initUI() {
    // Create cursor container
    this.cursorContainer = document.createElement('div');
    this.cursorContainer.className = 'collab-cursor-container';
    this.editor.uiLayer.appendChild(this.cursorContainer);
    
    // Create Chat button
    this.chatButton = document.createElement('button');
    this.chatButton.className = 'collab-chat-button';
    this.chatButton.textContent = "Chat";
    this.chatButton.addEventListener("click", () => this.openChat());
    this.editor.animationPanel.appendChild(this.chatButton);

    // Create chat container
    this.chatContainer = document.createElement('div');
    this.chatContainer.className = 'collab-chat-container';
    
    // Chat messages area
    this.chatMessagesDiv = document.createElement('div');
    this.chatMessagesDiv.className = 'collab-chat-messages';
    this.chatContainer.appendChild(this.chatMessagesDiv);
    
    // Close button
    const closeButton = document.createElement("div");
    closeButton.className = "panel-close collab-chat-close";
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", () => this.closeChat());
    this.chatContainer.appendChild(closeButton);
    
    // Chat input
    const chatInputDiv = document.createElement('div');
    chatInputDiv.className = 'collab-chat-input-container';
    
    this.chatInput = document.createElement('input');
    this.chatInput.type = 'text';
    this.chatInput.placeholder = __('Escribe un mensaje...||Type a message...');
    this.chatInput.className = 'collab-chat-input';
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.chatInput.value.trim()) {
        this.sendChatMessage(this.chatInput.value.trim());
        this.chatInput.value = '';
      }
    });
    
    const sendBtn = document.createElement('button');
    sendBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
    sendBtn.className = 'collab-chat-send';
    sendBtn.addEventListener('click', () => {
      if (this.chatInput.value.trim()) {
        this.sendChatMessage(this.chatInput.value.trim());
        this.chatInput.value = '';
      }
    });
    
    chatInputDiv.appendChild(this.chatInput);
    chatInputDiv.appendChild(sendBtn);
    this.chatContainer.appendChild(chatInputDiv);
    
    this.editor.animationPanel.appendChild(this.chatContainer);

    // Ping indicator
    this.pingIndicator = document.createElement('div');
    this.pingIndicator.className = 'collab-ping-indicator';
    this.pingIndicator.innerHTML = `
      <span class="ping-dot" style="background-color: #44ff44;"></span>
      <span class="ping-value">---</span>
    `;
    this.editor.uiLayer.appendChild(this.pingIndicator);

    // Session overlay
    this.createSessionOverlay();
  }

  createSessionOverlay() {
    this.sessionOverlay = document.createElement('div');
    this.sessionOverlay.className = "collab-session-overlay";
    
    // Header
    const header = document.createElement('div');
    header.className = "collab-session-header";
    
    const title = document.createElement('h2');
    title.className = "collab-session-title";
    title.textContent = __('Sesión Colaborativa||Collaborative Session');
    
    const closeBtn = document.createElement('button');
    closeBtn.className = "collab-close-btn";
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      this.sessionOverlay.style.display = 'none';
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Content
    this.sessionContent = document.createElement('div');
    this.sessionContent.className = "collab-session-content";
    
    this.sessionOverlay.appendChild(header);
    this.sessionOverlay.appendChild(this.sessionContent);
    this.editor.uiLayer.appendChild(this.sessionOverlay);
  }

  hookEditorMethods() {
    const self = this;
    
    // Store original methods
    const originalAddFrame = this.editor.addFrame;
    const originalRemoveFrame = this.editor.removeFrame;
    const originalMoveFrame = this.editor.moveFrame;
    const originalAddLayer = this.editor.addLayer;
    const originalRemoveLayer = this.editor.removeLayer;
    const originalMoveLayer = this.editor.moveLayer;
    const originalSetLayerVisibility = this.editor.setLayerVisibility;
    const originalUndo = this.editor.undo;
    const originalRedo = this.editor.redo;
    
    this.editor._originalAddFrame = originalAddFrame;
    this.editor._originalRemoveFrame = originalRemoveFrame;
    this.editor._originalMoveFrame = originalMoveFrame;
    this.editor._originalAddLayer = originalAddLayer;
    this.editor._originalRemoveLayer = originalRemoveLayer;
    this.editor._originalMoveLayer = originalMoveLayer;
    this.editor._originalSetLayerVisibility = originalSetLayerVisibility;
    this.editor._originalUndo = originalUndo;
    this.editor._originalRedo = originalRedo;
    
    // Hook into drawing by intercepting tool methods
    this.hookToolMethods();
    
    // Hook into frame methods
    this.editor.addFrame = function(...args) {
      const result = originalAddFrame.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveFrames')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.removeFrame = function(...args) {
      const result = originalRemoveFrame.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveFrames')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.moveFrame = function(...args) {
      const result = originalMoveFrame.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveFrames')) {
        self.sendFullState();
      }
      return result;
    };
    
    // Hook into layer methods
    this.editor.addLayer = function(...args) {
      const result = originalAddLayer.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveLayers')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.removeLayer = function(...args) {
      const result = originalRemoveLayer.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveLayers')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.moveLayer = function(...args) {
      const result = originalMoveLayer.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveLayers')) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.setLayerVisibility = function(...args) {
      const result = originalSetLayerVisibility.call(this, ...args);
      if (self.isConnected && self.canPerformAction('addRemoveLayers')) {
        self.sendFullState();
      }
      return result;
    };
    
    // Hook into undo/redo
    this.editor.undo = function() {
      if (self.isConnected && !self.isHost && !self.canPerformAction('undoRedo')) {
        self.editor.showToast(__('No tienes permiso para deshacer'), 1000);
        return;
      }
      const result = originalUndo.call(this);
      if (self.isConnected && self.isHost) {
        self.sendFullState();
      }
      return result;
    };
    
    this.editor.redo = function() {
      if (self.isConnected && !self.isHost && !self.canPerformAction('undoRedo')) {
        self.editor.showToast(__('No tienes permiso para rehacer'), 1000);
        return;
      }
      const result = originalRedo.call(this);
      if (self.isConnected && self.isHost) {
        self.sendFullState();
      }
      return result;
    };
  }

  hookToolMethods() {
    const self = this;
    
    const tools = this.editor.tools;
    
    Object.keys(tools).forEach(toolName => {
      const tool = tools[toolName];
      
      // Store original tool methods
      const originalOnDown = tool.onDown;
      const originalOnMove = tool.onMove;
      const originalOnUp = tool.onUp;
      
      tool.originalOnDown = originalOnDown;
      tool.originalOnMove = originalOnMove;
      tool.originalOnUp = originalOnUp;
      
      if (tool.dontBroadcast) return;
      
      tool.onDown = function(x, y) {
        // Start new trace
        if (self.isConnected && self.canPerformAction('draw')) {
          self.currentTrace = {
            type: 'prerendered',
            pixels: [],
            frame: self.editor.project.currentFrame,
            layer: self.editor.project.currentLayer
          };
        }
        
        if (originalOnDown) {
          const pixels = originalOnDown.call(self.editor, x, y);
          
          if (pixels) self.currentTrace.pixels = [...self.currentTrace.pixels, ...pixels];
          self.sendCursorUpdate(x, y, true);
        }
      };
      
      tool.onMove = function(x, y) {
        // Add to current trace
        if (originalOnMove) {
          const pixels = originalOnMove.call(self.editor, x, y);
          
          if (pixels) self.currentTrace.pixels = [...self.currentTrace.pixels, ...pixels];
        }
        
        // Send cursor update (throttled)
        if (self.isConnected && self.canPerformAction('draw') && self.currentTrace) {
          self.sendCursorUpdate(x, y, true);
        }
      };
      
      tool.onUp = function(x, y, startX, startY) {
        // Complete the trace and send it
        if (originalOnUp) {
          const pixels = originalOnUp.call(self.editor, x, y, startX, startY);
          
          if (pixels) self.currentTrace.pixels = [...self.currentTrace.pixels, ...pixels];
        }
        
        if (self.isConnected && self.canPerformAction('draw') && self.currentTrace) {
          self.sendTraceComplete(self.currentTrace);
          self.currentTrace = null;
          self.sendCursorUpdate(0, 0, false);
        }
      };
    });
  }
  
  restoreEditorMethods() {
    this.editor.addFrame = this.editor._originalAddFrame;
    this.editor.removeFrame = this.editor._originalRemoveFrame;
    this.editor.moveFrame = this.editor._originalMoveFrame;
    this.editor.addLayer = this.editor._originalAddLayer;
    this.editor.removeLayer = this.editor._originalRemoveLayer;
    this.editor.moveLayer = this.editor._originalMoveLayer;
    this.editor.setLayerVisibility = this.editor._originalSetLayerVisibility;
    this.editor.undo = this.editor._originalUndo;
    this.editor.redo = this.editor._originalRedo;
    
    const tools = this.editor.tools;
    
    Object.keys(tools).forEach(toolName => {
      const tool = tools[toolName];

      tool.onDown = tool.originalOnDown;
      tool.onMove = tool.originalOnMove;
      tool.onUp = tool.originalOnUp;
    });
  }
  
  updateMemberName(newName) {
    this.sendMessage({
      type: 'name_update',
      oldName: this.memberName,
      newName: newName
    });
    
    this.memberName = newName;
  }
  
  updateMemberColor(newColor) {
    this.sendMessage({
      type: 'color_update',
      oldColor: this.memberColor,
      newColor: newColor
    });
    
    this.memberColor = newColor;
  }

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    
    this.editor.showLoadingScreen(__('Conectando...||Connecting...'));
    
    this.ws = new WebSocket(this.host);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.editor.hideLoadingScreen();
      this.manualDisconnect = false;
      this.startPingInterval();
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.handleDisconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.editor.hideLoadingScreen();
      this.editor.showToast(__('Error de conexión||Connection error'), 3000);
    };
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'session_created':
        this.handleSessionCreated(message);
        break;
      case 'session_joined':
        this.handleSessionJoined(message);
        break;
      case 'member_joined':
        this.handleMemberJoined(message.member);
        break;
      case 'member_left':
        this.handleMemberLeft(message.memberId, message.memberName);
        break;
      case 'member_kicked':
        this.handleMemberKicked(message.memberId, message.memberName);
        break;
      case 'you_were_kicked':
        this.handleYouWereKicked();
        break;
      case 'trace_complete':
        this.handleTraceComplete(message);
        break;
      case 'cursor_update':
        this.handleRemoteCursor(message);
        break;
      case 'name_update':
        this.handleNameUpdate(message);
        break;
      case 'color_update':
        this.handleColorUpdate(message);
        break;
      case 'chat_message':
        this.handleChatMessage(message);
        break;
      case 'canvas_crop':
        this.handleCanvasCrop(message);
        break;
      case 'canvas_resize':
        this.handleCanvasResize(message);
        break;
      case 'full_state':
        this.handleFullState(message);
        break;
      case 'session_ended':
        this.handleSessionEnded(message.reason);
        break;
      case 'error':
        this.handleError(message.error);
        break;
      case 'pong':
        this.handlePong(message.timestamp);
        break;
    }
  }

  handleSessionCreated(message) {
    this.sessionId = message.sessionId;
    this.sessionName = message.sessionName;
    this.memberId = message.memberId;
    this.isHost = true;
    this.isConnected = true;
    
    this.clearChatMessages();
    
    this.members.clear();
    this.members.set(this.memberId, {
      id: this.memberId,
      name: this.memberName,
      color: this.memberColor,
      isHost: true
    });
    
    this.chatButton.style.display = 'flex';
    this.pingIndicator.style.display = 'flex';
    this.sendFullState();
    this.renderSessionMenu();
    this.sessionOverlay.style.display = 'flex';
    
    document.querySelector('.collab-status').classList.add('connected');
    
    this.hookEditorMethods();
    
    this.editor.showToast(__('Sesión creada||Session created'), 2000);
  }

  handleSessionJoined(message) {
    this.sessionId = message.sessionId;
    this.sessionName = message.sessionName;
    this.memberId = message.memberId;
    this.isHost = message.isHost;
    this.isConnected = true;
    
    this.members.clear();
    message.members.forEach(member => {
      this.members.set(member.id, member);
    });
    
    this.clearChatMessages();
    
    // Load project state if available
    if (message.projectData) {
      this.applyFullState(message.projectData);
    }
    
    this.chatButton.style.display = 'flex';
    this.pingIndicator.style.display = 'flex';
    this.renderSessionMenu();
    this.sessionOverlay.style.display = 'flex';
    
    document.querySelector('.collab-status').classList.add('connected');
    
    this.hookEditorMethods();
    
    this.editor.resetZoom();
    
    this.editor.showToast(__('Conectado a la sesión||Connected to the session'), 2000);
  }

  handleMemberJoined(member) {
    if (member.id === this.memberId) return;
    this.members.set(member.id, member);
    this.editor.showToast(`${this.wrapMemberName(member)} ${__('se unió||joined')}`, 2000);
    if (this.isHost) {
      setTimeout( () => this.sendFullState(member.id) );
    }
    this.renderSessionMenu();
  }

  handleMemberLeft(memberId, memberName) {
    const member = this.members.get(memberId);
    if (member) {
      this.members.delete(memberId);
      this.removeUserCursor(memberId);
      this.editor.showToast(`${this.wrapMemberName(member, member.name || memberName)} ${__('salió||left')}`, 2000);
      this.renderSessionMenu();
    }
  }

  handleMemberKicked(memberId, memberName) {
    const member = this.members.get(memberId);
    if (member) {
      this.members.delete(memberId);
      this.removeUserCursor(memberId);
      this.editor.showToast(`${member.name || memberName} ${__('fue expulsado')}`, 3000);
      this.renderSessionMenu();
    }
  }

  handleYouWereKicked() {
    this.manualDisconnect = false;
    this.disconnect();
    this.editor.showToast(__('Has sido expulsado de la sesión'), 4000);
  }

  handleTraceComplete(message) {
    const { memberId, data } = message;
    const { p, f, l } = data;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    // Deserializar píxeles
    const pixels = this.editor.historyManager.deserializePixels(p);
    
    if (!pixels || !pixels.length) return;
    
    // Aplicar el trazo
    this.applyTrace({ pixels, frame: f, layer: l });
  }
  
  handleError(error) {
    switch (error) {
      case 'version_incompatible':
        this.editor.showPopup(
          __("Versión incompatible||Version incompatible"),
          `
            <p>${__(`Tu versión de la app ya no es compatible con el modo colaborativo.||Your version of the app doesn't longer suppor collab mode`)}
            <p>${__('Si te conectas ahora de seguro algo se romperá.||If you connect now for sure something will break.')}
            <p>${__('Por favor actualiza la app antes de usar esta función. Serán solo unos kilobytes.||Please update the app before using this feature. It will only be a few kilobytes.')}
          `,
          [
            { text: __("Volver||Dimiss"), action: () => this.editor.hidePopup() },
            { text: __("Actualizar||Update"), action: () => openExternalUrl("https://github.com/RetoraDev/pixelite") }
          ]
        );
        break;
      case 'session_not_found':
        this.editor.showPopup(
          '',
          __('Sesión no encontrada||Session not found'),
        );
        break;
      case 'invalid_password':
        this.editor.showPopup(
          '',
          __('Contraseña incorrecta||Incorrect password'),
        );
      case 'invalid_message_format':
        this.addSystemMessage(__('El formato del mensaje es inválido||Invalid message format'), 'red');
        break;
      default:
        this.addSystemMessage('Unknown Server Error: ' + error.toUpperCase());
        break;
    }
  }

  applyTrace(trace) {
    const { pixels, frame, layer } = trace;
    
    const frameObj = this.editor.project?.frames[frame];
    if (!frameObj) return;
    
    const layerObj = frameObj.layers[layer];
    if (!layerObj) return;
    
    this.editor.drawPixels(layerObj.ctx, pixels);
    this.editor.recordDrawOperation(pixels);
  }
  
  handleRemoteCursor(message) {
    const { x, y, frameIndex, layerIndex, active } = this.deserializeCursor(message.c);
    const pixels = this.editor.historyManager.deserializePixels(message.p);
    const memberId = message.memberId;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    if (active) {
      this.showCursor(memberId, member.name, member.color, x, y);
    } else {
      this.hideCursor(memberId);
    }
    
    if (pixels && pixels.length) {
      this.drawTracePreview(pixels, frameIndex, layerIndex || 0);
    }
  }
  
  drawTracePreview(pixels, frameIndex, layerIndex) {
    if (frameIndex != this.editor.project.currentFrame) return;
    
    // Get temporary canvas
    const { canvas, ctx } = this.editor.getTempCanvas(this.editor.project.width, this.editor.project.height);
    
    // Draw trace preview
    this.editor.drawPixels(ctx, pixels);

    // Combine with main canvas
    this.editor.renderQuick(true, {
      layerIndex: layerIndex,
      pixels: pixels.filter(p => p.newColor == 'transparent') // exclude transparent pixels to reflect eraser tool
    });
    
    this.editor.ctx.drawImage(canvas, 0, 0);
  }
  
  handleNameUpdate(message) {
    const { memberId, oldName, newName } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    member.name = newName;
    
    this.editor.showToast(`${this.wrapMemberName(member, oldName)}</span> ${__("(ha cambiado su nombre a|has changed name to)")} ${this.wrapMemberName(member, newName)}`);
  }
  
  handleColorUpdate(message) {
    const { memberId, oldColor, newColor } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    member.color = newColor;
    
    this.editor.showToast(`${this.wrapMemberName(member)}</span> ${__("(ha cambiado su color|has changed color)")}`);
  }

  handleChatMessage(message) {
    this.chatMessages.push(message);
    this.addMessageHtml(message);
    if (!this.chatVisible) {
      this.chatButton.classList.add('new-message');
    }
    this.scrollMessagesToBottom();
  }
  
  handleCanvasResize(message) {
    this.editor.resizeCanvas(message.width, message.height);
  }
  
  handleCanvasCrop(message) {
    this.editor.cropCanvas(message.x, message.y, message.width, message.height);
  }

  handleFullState(message) {
    if (message.memberId === this.memberId) return;
    this.applyFullState(message.state);
    this.editor.showOperationMessage(__('Proyecto sincronizado||Project synchronized'), 1000);
    if (message.reason) {
      const member = this.members.get(message.memberId);
          
      switch(message.reason) {
        case 'new_project':
          this.editor.showToast(`${this.wrapMemberName(member)} ${__('comenzó un proyecto nuevo||started a new project')}`, 2000);
          break;    
        case 'load_project':
          this.editor.showToast(`${this.wrapMemberName(member)} ${__('cargó un archivo||loaded a file')}`, 2000);
          break;    
      }
    }
  }

  handleSessionEnded(reason) {
    this.disconnect(false);
    this.editor.showToast(reason || __('La sesión ha terminado'), 3000);
  }

  handlePong(timestamp) {
    const ping = Date.now() - timestamp;
    this.updatePingIndicator(ping);
  }

  handleDisconnect() {
    this.isConnected = false;
    this.stopPingInterval();
    this.cleanupDisconnect();
  }

  cleanupDisconnect() {
    this.isConnected = false;
    this.sessionId = null;
    this.sessionName = '';
    this.isHost = false;
    this.members.clear();
    this.removeAllCursors();
    this.currentTrace = null;
    this.chatButton.style.display = 'none';
    this.chatContainer.style.display = 'none';
    this.pingIndicator.style.display = 'none';
    this.sessionOverlay.style.display = 'none';
        
    document.querySelector('.collab-status').classList.remove('connected');
    
    this.restoreEditorMethods();
    
    if (!this.manualDisconnect) {
      this.editor.showToast(__('Desconectado'), 2000);
    }
  }

  sendTraceComplete(trace) {
    const serializedPixels = this.editor.historyManager.serializePixels(trace.pixels);
  
    this.sendMessage({
      type: 'trace_complete',
      data: {
        p: serializedPixels,       // 'p' para pixels
        f: trace.frame,            // 'f' para frame
        l: trace.layer             // 'l' para layer
      }
    });
  }

  sendCursorUpdate(x, y, active) {
    const now = Date.now();
    if (now - this.lastCursorSend < this.CURSOR_THROTTLE) return;
    this.lastCursorSend = now;
    
    this.sendMessage({
      type: 'cursor_update',
      c: this.serializeCursor(x, y, this.editor.currentFrame, this.editor.currentLayer, active),
      p: this.currentTrace && this.currentTrace.pixels ? this.editor.historyManager.serializePixels(this.currentTrace.pixels) : []
    });
  }
  
  serializeCursor(x, y, frameIndex, layerIndex, active) {
    x = Math.min(65535, Math.max(0, x));
    y = Math.min(65535, Math.max(0, y));
    frameIndex = Math.min(255, Math.max(0, frameIndex));
    layerIndex = Math.min(255, Math.max(0, layerIndex));
    
    const coords = (x << 16) | y;
    const meta = (frameIndex << 9) | (layerIndex << 1) | (active ? 1 : 0);
    
    return `${coords.toString(36)}:${meta.toString(36)}`;
  }
  
  deserializeCursor(encoded) {
    const [coordsStr, metaStr] = encoded.split(':');
    
    if (!coordsStr || !metaStr) {
      return { x: 0, y: 0, frameIndex: 0, layerIndex: 0, active: false };
    }
    
    const coords = parseInt(coordsStr, 36);
    const meta = parseInt(metaStr, 36);
    
    if (isNaN(coords) || isNaN(meta)) {
      return { x: 0, y: 0, frameIndex: 0, layerIndex: 0, active: false };
    }
    
    return {
      x: (coords >> 16) & 0xFFFF,
      y: coords & 0xFFFF,
      frameIndex: (meta >> 9) & 0xFF,
      layerIndex: (meta >> 1) & 0xFF,
      active: (meta & 1) === 1
    };
  }
  
  sendChatMessage(text) {
    this.sendMessage({
      type: 'chat_message',
      message: text
    });
  }

  async sendFullState(toMemberId, reason) {
    if (!this.isHost || !this.isConnected) return;
    
    const state = await this.getFullState();
    this.sendMessage({
      type: 'full_state',
      reason: reason || null,
      state: state,
      toMemberId: toMemberId || null
    });
  }
  
  sendCropMessage(x, y, width, height) {
    this.sendMessage({
      type: 'canvas_crop',
      x, y, width, height
    });
  }
  
  sendResizeMessage(width, height) {
    this.sendMessage({
      type: 'canvas_resize',
      width, height
    });
  }
  
  async getFullState() {
    const state = {
      width: this.editor.project.width,
      height: this.editor.project.height,
      frames: [],
      frameTimes: this.editor.project.frameTimes,
      currentFrame: this.editor.project.currentFrame,
      currentLayer: this.editor.project.currentLayer,
      backgroundColor: this.editor.project.backgroundColor,
      transparentBackground: this.editor.transparentBackground
    };
    
    for (let f = 0; f < this.editor.project.frames.length; f++) {
      const frame = this.editor.project.frames[f];
      const frameData = { layers: [] };
      
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];

        frameData.layers.push(
          await this.editor.compressData(layer, 'layer')
        );
      }
      
      state.frames.push(await this.editor.compressData(frameData, 'frame'));
    }

    return state;
  }

  async applyFullState(state) {
    // Si no hay proyecto, crear uno nuevo
    if (!this.editor.project) {
      this.editor.newProject(state.width, state.height);
    }
    
    const project = this.editor.project;
    
    // Actualizar dimensiones si cambiaron
    if (project.width !== state.width || project.height !== state.height) {
      project.width = state.width;
      project.height = state.height;
      this.editor.resetCanvasSize();
      this.editor.resetZoom();
      this.editor.updateCanvasTransform();
    }
    
    // Actualizar propiedades básicas
    project.frameTimes = state.frameTimes;
    project.currentFrameTime = state.frameTimes?.[0] || 1000 / 12;
    project.currentFrame = Math.min(state.currentFrame, project.frames.length - 1);
    project.currentLayer = state.currentLayer;
    this.editor.transparentBackground = state.transparentBackground ?? true;
    
    // Ajustar número de frames
    const targetFrameCount = state.frames.length;
    const currentFrameCount = project.frames.length;
    
    if (currentFrameCount > targetFrameCount) {
      // Eliminar frames sobrantes
      project.frames.splice(targetFrameCount, currentFrameCount - targetFrameCount);
      project.frameTimes.splice(targetFrameCount, currentFrameCount - targetFrameCount);
    }
    
    // Procesar cada frame
    for (let f = 0; f < targetFrameCount; f++) {
      const frameData = await this.editor.decompressData(state.frames[f], 'frame');
      
      // Crear frame si no existe
      if (!project.frames[f]) {
        project.frames[f] = { layers: [] };
        project.frameTimes[f] = project.currentFrameTime;
      }
      
      const frame = project.frames[f];
      const targetLayerCount = frameData.layers.length;
      const currentLayerCount = frame.layers.length;
      
      // Ajustar número de capas
      if (currentLayerCount > targetLayerCount) {
        // Quitar capas sobrantes
        frame.layers.splice(targetLayerCount, currentLayerCount - targetLayerCount);
      }
      
      // Procesar cada capa
      for (let l = 0; l < targetLayerCount; l++) {
        const layerData = await this.editor.decompressData(frameData.layers[l], 'layer');
        
        // Crear capa si no existe
        if (!frame.layers[l]) {
          frame.layers[l] = this.editor.createBlankLayer(project.width, project.height, layerData.name || `Layer ${l + 1}`);
        }
        
        const layer = frame.layers[l];
        
        // Actualizar propiedades de la capa
        layer.name = layerData.name || layer.name;
        layer.visible = layerData.visible !== undefined ? layerData.visible : true;
        
        // Restaurar imagen si hay datos PNG
        if (layerData.imageData) {
          try {
            // layerData.imageData viene de decompressData (es un ImageData)
            // pero necesitamos asegurar que tenga las dimensiones correctas
            const imageData = layerData.imageData;
            
            // Si las dimensiones no coinciden, redimensionar
            if (imageData.width !== project.width || imageData.height !== project.height) {
              const { canvas: tempCanvas, ctx: tempCtx } = this.getTempCanvas(width, height);
              const img = new Image();
              
              await new Promise((resolve) => {
                img.onload = resolve;
                const canvas = this.tempCanvas();
                canvas.width = imageData.width;
                canvas.height = imageData.height;
                canvas.getContext('2d').putImageData(imageData, 0, 0);
                img.src = canvas.toDataURL();
              });
              tempCtx.drawImage(img, 0, 0, project.width, project.height);
              const resizedData = tempCtx.getImageData(0, 0, project.width, project.height);
              layer.ctx.putImageData(resizedData, 0, 0);
            } else {
              layer.ctx.putImageData(imageData, 0, 0);
            }
          } catch (error) {
            console.error(`Error restoring layer ${l} in frame ${f}:`, error);
          }
        }
      }
      
      // Ajustar capas restantes (si las hay)
      if (frame.layers.length > targetLayerCount) {
        frame.layers.length = targetLayerCount;
      }
    }
    
    // Asegurar que currentLayer sea válido
    const currentFrame = project.frames[project.currentFrame];
    if (currentFrame && project.currentLayer >= currentFrame.layers.length) {
      project.currentLayer = Math.max(0, currentFrame.layers.length - 1);
    }
    
    this.editor.project = project;
    
    // Actualizar UI y renderizar
    this.editor.render();
    this.editor.showOperationMessage(__('Proyecto sincronizado||Project synchronized'), 1000);
  }

  createSession(sessionName, password) {
    this.memberName = this.editor.collabMemberName;
    this.memberColor = this.editor.collabMemberColor;
    
    this.connectWebSocket();
    
    const checkConnection = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        clearInterval(checkConnection);
        this.sendMessage({
          type: 'create_session',
          sessionName: sessionName,
          password: password || undefined,
          userName: this.memberName,
          userColor: this.memberColor,
          clientVersion: this.editor.version
        });
      }
    }, 100);
  }

  joinSession(sessionId, password) {
    this.memberName = this.editor.collabMemberName;
    this.memberColor = this.editor.collabMemberColor;
    
    this.connectWebSocket();
    
    const checkConnection = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        clearInterval(checkConnection);
        this.sendMessage({
          type: 'join_session',
          sessionId: sessionId,
          password: password || undefined,
          userName: this.memberName,
          userColor: this.memberColor,
          clientVersion: this.editor.version
        });
      }
    }, 100);
  }

  disconnect(manualDisconnect = true) {
    this.manualDisconnect = manualDisconnect;
    if (this.ws) {
      this.sendMessage({ type: 'leave_session' });
      this.ws.close();
    }
    this.cleanupDisconnect();
  }

  kickMember(memberId) {
    if (!this.isHost) return;
    
    this.sendMessage({
      type: 'kick_member',
      memberId: memberId
    });
  }

  showCursor(memberId, name, color, canvasX, canvasY) {
    const screenPos = this.canvasToScreen(canvasX, canvasY);
    if (!screenPos) return;
    
    let cursor = this.cursors.get(memberId);
    
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.className = "collab-cursor-item";
      
      cursor.innerHTML = `
        <div class="collab-cursor-ping"></div>
        <div class="collab-cursor-name"></div>
      `;
      
      this.cursorContainer.appendChild(cursor);
      this.cursors.set(memberId, cursor);
    }
    
    cursor.style.left = `${screenPos.x}px`;
    cursor.style.top = `${screenPos.y}px`;
    cursor.querySelector('div:first-child').style.borderColor = this.getColorHex(color);
    cursor.querySelector('div:last-child').textContent = name;
    cursor.querySelector('div:last-child').style.backgroundColor = this.getColorHex(color);
    cursor.style.opacity = '1';
    
    cursor.isVisible = true;
    cursor.lastUpdate = Date.now();
    
    if (!cursor._interval) {
      cursor._interval = setInterval(() => {
        if (cursor.isVisible && Date.now() - cursor.lastUpdate >= 2000) {
          this.hideCursor(memberId);
        }
      }, 200);
    }
  }

  hideCursor(memberId) {
    const cursor = this.cursors.get(memberId);
    if (cursor) {
      cursor.style.opacity = '0';
      cursor.lastUpdate = Date.now();
      cursor.isVisible = false;
    }
  }

  removeUserCursor(memberId) {
    const cursor = this.cursors.get(memberId);
    if (cursor) {
      cursor.remove();
      clearInterval(cursor._interval);
      this.cursors.delete(memberId);
    }
  }

  removeAllCursors() {
    this.cursors.forEach(cursor => cursor.remove());
    this.cursors.clear();
  }
  
  openChat() {
    this.chatButton.style.display = 'none';
    this.chatButton.classList.remove('new-message');
    this.chatContainer.style.display = 'flex';
    this.chatVisible = true;
  }
  
  closeChat() {
    this.chatButton.style.display = 'block';
    this.chatContainer.style.display = 'none';
    this.chatVisible = false;
  }

  canvasToScreen(canvasX, canvasY) {
    if (!this.editor.project) return null;
    
    const rect = this.editor.canvasContainer.getBoundingClientRect();
    
    const screenX = rect.left + rect.width / 2 + 
                   (canvasX - this.editor.project.width / 2) * this.editor.scale + 
                   this.editor.posX;
    const screenY = rect.top + rect.height / 2 + 
                   (canvasY - this.editor.project.height / 2) * this.editor.scale + 
                   this.editor.posY;
    
    return { x: screenX, y: screenY };
  }
  
  renderSessionMenu() {
    this.sessionContent.innerHTML = '';
    
    // Session info
    const infoCard = document.createElement('div');
    infoCard.className = "collab-info-card";
    
    infoCard.innerHTML = `
      <div class="collab-info-item">
        <span class="collab-info-label">${__('Sala||Room')}:</span>
        <span class="collab-info-value">${this.sessionName || __('Sala sin nombre||Unnamed room')}</span>
      </div>
      <div class="collab-info-item">
        <span class="collab-info-label">${__('Miembros||Members')}:</span>
        <span class="collab-info-value">${this.members.size}</span>
      </div>
      <div class="collab-info-item">
        <span style="collab-info-label">${__('ID||ID')}:</span>
        <span class="collab-info-value token">${this.sessionId || 'Unknown'}</span>
        <button id="copyIdBtn" class="collab-copy-btn">
          ${__('Copiar||Copy')}
        </button>
      </div>
    `;
    
    const copyBtn = infoCard.querySelector('#copyIdBtn');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this.sessionId);
      this.editor.showToast(__('ID copiado||ID copied'), 1000);
    });
    
    this.sessionContent.appendChild(infoCard);
    
    // Members list
    const membersSection = document.createElement('div');
    membersSection.className = "collab-members-section";
    
    membersSection.innerHTML = `<h3>${__('Miembros||Members')}</h3>`;
    
    const membersList = document.createElement('div');
    membersList.className = "collab-members-list";
    
    this.members.forEach(member => {
      const memberItem = document.createElement('div');
      memberItem.className = member.id === this.memberId ? "collab-member-item current-user" : "collab-member-item";
      
      const nameSpan = document.createElement('span');
      nameSpan.className = "collab-member-name";
      nameSpan.style.color = member.id === this.memberId ? 'white' : this.getColorHex(member.color);
      
      const nameText = document.createElement('span');
      nameText.textContent = member.name;
      nameSpan.appendChild(nameText);
      
      if (member.isHost) {
        const hostBadge = document.createElement('span');
        hostBadge.className = "collab-host-badge";
        hostBadge.textContent = 'HOST';
        nameSpan.appendChild(hostBadge);
      }
      
      if (member.id === this.memberId) {
        const youBadge = document.createElement('span');
        youBadge.className = "collab-you-badge";
        youBadge.textContent = __('TÚ||YOU');
        nameSpan.appendChild(youBadge);
      }
      
      memberItem.appendChild(nameSpan);
      
      // Kick button for host
      if (this.isHost && member.id !== this.memberId) {
        const kickBtn = document.createElement('button');
        kickBtn.textContent = __('Expulsar||Kick');
        kickBtn.className = "collab-kick-button";
        kickBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirmKickMember(member);
        });
        memberItem.appendChild(kickBtn);
      }
      
      membersList.appendChild(memberItem);
    });
    
    membersSection.appendChild(membersList);
    this.sessionContent.appendChild(membersSection);
    
    // Disconnect button
    const disconnectBtn = document.createElement('button');
    disconnectBtn.className = this.isHost ? "collab-disconnect-btn danger" : "collab-disconnect-btn";
    disconnectBtn.textContent = this.isHost ? __('Terminar sesión||End Session') : __('Desconectar||Disconnect');
    disconnectBtn.addEventListener('click', () => {
      this.editor.showPopup(
        this.isHost ? __('Terminar sesión||End Session') : __('Desconectar||Disconnect'),
        this.isHost ? __('¿Terminar la sesión para todos?||End session for everyone?') : __('¿Desconectarse de la sesión?||Disconnect from session?'),
        [
          {
            text: __('Cancelar||Cancel'),
            class: 'cancel',
            action: () => this.editor.hidePopup()
          },
          {
            text: __('Proceder||Proceed'),
            action: () => {
              this.disconnect();
              this.sessionOverlay.style.display = 'none';
              this.editor.hidePopup();
            }
          }
        ]
      );
    });
    
    this.sessionContent.appendChild(disconnectBtn);
  }

  confirmKickMember(member) {
    this.editor.showPopup(
      __('Expulsar miembro||Kick member'),
      `${__('¿Expulsar a||Kick')} ${this.wrapMemberName(member)}?`,
      [
        {
          text: __('Cancelar||Cancel'),
          class: 'cancel',
          action: () => this.editor.hidePopup()
        },
        {
          text: __('Expulsar||Kick'),
          action: () => {
            this.kickMember(member.id);
            this.editor.hidePopup();
          }
        }
      ]
    );
  }
  
  clearChatMessages() {
    this.chatMessages = [];
    this.renderChatMessages();
  }

  renderChatMessages() {
    this.chatMessagesDiv.innerHTML = '';
    this.chatMessages.forEach(msg => this.addMessageHtml(msg));
    this.scrollMessagesToBottom();
  }
  
  addMessageHtml(msg) {
    const msgEl = document.createElement('div');
    msgEl.className = "collab-chat-message";
    msgEl.innerHTML = `
      <span class="collab-chat-name" style="color: ${this.getColorHex(msg.memberColor)};">${this.escapeHtml(msg.memberName || 'Unknown')}:</span>
      <span class="collab-chat-text"> ${this.escapeHtml(msg.message)}</span>
    `;
    this.chatMessagesDiv.appendChild(msgEl);
  }
  
  addSystemMessage(text, color = 'auto') {
    const msgEl = document.createElement('div');
    msgEl.className = "collab-chat-message";
    msgEl.innerHTML = `
      <span class="collab-chat-text" style="color: ${color}">${this.escapeHtml(text)}</span>
    `;
    this.chatMessagesDiv.appendChild(msgEl);
    this.scrollMessagesToBottom();
  }
  
  scrollMessagesToBottom() {
    this.chatMessagesDiv.scrollTop = this.chatMessagesDiv.scrollHeight;
  }

  updatePingIndicator(ping) {
    const dot = this.pingIndicator.querySelector('.ping-dot');
    const value = this.pingIndicator.querySelector('.ping-value');
    
    let color = '#44ff44';
    if (ping > 100) color = '#ffff44';
    if (ping > 200) color = '#ff8844';
    if (ping > 300) color = '#ff4444';
    
    if (dot) dot.style.backgroundColor = color;
    if (value) value.textContent = `${ping}ms`;
  }

  startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.sendMessage({ type: 'ping', timestamp: Date.now() });
    }, 5000);
  }

  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  requestOperation(operation) {
    // TODO: Clients request operations in the project to host
    
    // By now just notify it's not possible
    this.editor.showToast(__('Solo el host puede hacer eso||Only host can do that'));
  }

  canPerformAction(action) {
    if (!this.isConnected) return true;
    if (this.isHost) return true;
    return this.permissions && this.permissions[action] === 'everyone';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
