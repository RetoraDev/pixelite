// Collaboration Manager
class CollabManager {
  constructor(editor) {
    this.editor = editor;
    this.ws = null;
    this.host = 'localhost';
    this.port = 8080;
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
      addRemoveFrames: 'everyone',
      addRemoveLayers: 'everyone',
      draw: 'everyone',
      chat: 'everyone'
    };
    
    // Visible cursors tracking
    this.cursors = new Map();
    this.cursorContainer = null;
    
    // Current trace being drawn
    this.currentTrace = null;
    this.tracePoints = [];
    
    // Chat
    this.chatMessages = [];
    
    // Throttle cursor updates
    this.lastCursorSend = 0;
    this.CURSOR_THROTTLE = 50;
    
    // Initialize
    this.initUI();
  }

  getColorHex(colorName) {
    const colors = {
      red: '#ff4444',
      blue: '#4444ff',
      green: '#44ff44',
      yellow: '#ffff44',
      orange: '#ff8844',
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
      <span class="ping-dot" style="width: 8px; height: 8px; border-radius: 50%; background-color: #44ff44;"></span>
      <span class="ping-value" style="color: var(--text-color);">0ms</span>
    `;
    this.editor.uiLayer.appendChild(this.pingIndicator);

    // Session overlay
    this.createSessionOverlay();
  }

  createSessionOverlay() {
    this.sessionOverlay = document.createElement('div');
    this.sessionOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--bg-color);
      z-index: 10000;
      display: none;
      flex-direction: column;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      height: 50px;
      background-color: var(--ui-color);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    `;
    
    const title = document.createElement('h2');
    title.style.cssText = `font-size: 18px; color: var(--text-color);`;
    title.textContent = __('Sesión Colaborativa||Collaborative Session');
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      width: 32px;
      height: 32px;
      background: transparent;
      border: none;
      color: var(--text-color);
      font-size: 24px;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.addEventListener('click', () => {
      this.sessionOverlay.style.display = 'none';
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Content
    this.sessionContent = document.createElement('div');
    this.sessionContent.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    `;
    
    this.sessionOverlay.appendChild(header);
    this.sessionOverlay.appendChild(this.sessionContent);
    document.body.appendChild(this.sessionOverlay);
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
        self.editor.showNotification(__('No tienes permiso para deshacer'), 1000);
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
        self.editor.showNotification(__('No tienes permiso para rehacer'), 1000);
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
      // Store original tool methods
      const tool = tools[toolName];
      const originalOnDown = tool.onDown;
      const originalOnMove = tool.onMove;
      const originalOnUp = tool.onUp;
      
      tool.originalOnDown = originalOnDown;
      tool.originalOnMove = originalOnMove;
      tool.originalOnUp = originalOnUp;
      
      tool.onDown = function(x, y) {
        // Start new trace
        if (self.isConnected && self.canPerformAction('draw')) {
          self.currentTrace = {
            tool: toolName,
            brushSize: self.editor.brushSize,
            color: self.editor.getColor(),
            points: [{ x, y }],
            frame: self.editor.project.currentFrame,
            layer: self.editor.project.currentLayer
          };
          self.tracePoints = [{ x, y }];
        }
        
        if (originalOnDown) {
          originalOnDown.call(self.editor, x, y);
        }
      };
      
      tool.onMove = function(x, y) {
        // Add to current trace
        if (self.isConnected && self.canPerformAction('draw') && self.currentTrace) {
          self.currentTrace.points.push({ x, y });
          
          // Send cursor update (throttled)
          self.sendCursorUpdate(x, y, true);
        }
        
        if (originalOnMove) {
          originalOnMove.call(self.editor, x, y);
        }
      };
      
      tool.onUp = function(x, y, startX, startY) {
        // Complete the trace and send it
        if (self.isConnected && self.canPerformAction('draw') && self.currentTrace) {
          // Add final point if different
          const lastPoint = self.currentTrace.points[self.currentTrace.points.length - 1];
          if (lastPoint.x !== x || lastPoint.y !== y) {
            self.currentTrace.points.push({ x, y });
          }
          
          self.sendTraceComplete(self.currentTrace);
          self.currentTrace = null;
          self.sendCursorUpdate(0, 0, false);
        }
        
        if (originalOnUp) {
          originalOnUp.call(self.editor, x, y, startX, startY);
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
    
    this.showConnectingOverlay(__('Conectando...||Connecting...'));
    
    this.ws = new WebSocket(`ws://${this.host}:${this.port}`);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.hideConnectingOverlay();
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
      this.hideConnectingOverlay();
      this.editor.showNotification(__('Error de conexión||Connection error'), 3000);
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
      case 'full_state':
        this.handleFullState(message);
        break;
      case 'session_ended':
        this.handleSessionEnded(message.reason);
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
    
    this.hookEditorMethods();
    
    this.editor.showNotification(__('Sesión creada||Session created'), 2000);
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
    
    this.hookEditorMethods();
    
    this.editor.showNotification(__('Conectado a la sesión||Connected to the session'), 2000);
  }

  handleMemberJoined(member) {
    if (member.id === this.memberId) return;
    this.members.set(member.id, member);
    this.editor.showNotification(`${this.wrapMemberName(member)} ${__('se unió||joined')}`, 2000);
    if (this.isHost) {
      this.sendFullState(member.id);
    }
    this.renderSessionMenu();
  }

  handleMemberLeft(memberId, memberName) {
    const member = this.members.get(memberId);
    if (member) {
      this.members.delete(memberId);
      this.removeUserCursor(memberId);
      this.editor.showNotification(`${this.wrapMemberName(member, member.name || memberName)} ${__('salió||left')}`, 2000);
      this.renderSessionMenu();
    }
  }

  handleMemberKicked(memberId, memberName) {
    const member = this.members.get(memberId);
    if (member) {
      this.members.delete(memberId);
      this.removeUserCursor(memberId);
      this.editor.showNotification(`${member.name || memberName} ${__('fue expulsado')}`, 3000);
      this.renderSessionMenu();
    }
  }

  handleYouWereKicked() {
    this.manualDisconnect = false;
    this.disconnect();
    this.editor.showNotification(__('Has sido expulsado de la sesión'), 4000);
  }

  handleTraceComplete(message) {
    const { memberId, data } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    // Show name tag at the last point
    const lastPoint = data.points[data.points.length - 1];
    this.showCursor(memberId, member.name, member.color, lastPoint.x, lastPoint.y);
    
    // Apply the trace using the editor's drawing methods
    this.applyTrace(data);
  }

  applyTrace(trace) {
    const { tool, brushSize, color, points, frame, layer } = trace;
    
    const frameObj = this.editor.project?.frames[frame];
    if (!frameObj) return;
    
    const layerObj = frameObj.layers[layer];
    if (!layerObj) return;
    
    const ctx = layerObj.ctx;
    
    // Store original brush size and color
    const originalBrushSize = this.editor.brushSize;
    const originalSelectedColor = this.editor.selectedColor;
    const originalPrimaryColor = this.editor.primaryColor;
    
    // Temporarily set for drawing
    this.editor.brushSize = brushSize;
    this.editor.selectedColor = 'primary';
    this.editor.primaryColor = color;
    
    // Get the tool
    const toolObj = this.editor.tools[tool];
    if (!toolObj) return;
    
    // Draw the trace using the tool's methods
    if (points.length === 1) {
      // Simulate pointer down
      if (toolObj.originalOnDown) {
        toolObj.originalOnDown.call(this.editor, points[0].x, points[0].y);
      }
      
      // Single click, release pointer
      if (toolObj.originalOnUp) {
        toolObj.originalOnUp.call(this.editor, points[0].x, points[0].y);
      }
    } else {
      // Simulate pointer down
      if (toolObj.originalOnDown) {
        toolObj.originalOnDown.call(this.editor, points[0].x, points[0].y);
      }
      
      // Draw the stroke
      for (let i = 1; i < points.length; i++) {
        if (toolObj.originalOnMove) {
          toolObj.originalOnMove.call(this.editor, points[i].x, points[i].y);
        }
      }
      
      // Release pointer
      if (toolObj.originalOnUp) {
        toolObj.originalOnUp.call(this.editor, points[points.length - 1].x, points[points.length - 1].y);
      }
    }
    
    // Restore original values
    this.editor.brushSize = originalBrushSize;
    this.editor.selectedColor = originalSelectedColor;
    this.editor.primaryColor = originalPrimaryColor;
    
    this.editor.render();
  }

  handleRemoteCursor(message) {
    const { memberId, x, y, active } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    if (active) {
      this.showCursor(memberId, member.name, member.color, x, y);
    } else {
      this.hideCursor(memberId);
    }
  }
  
  handleNameUpdate(message) {
    const { memberId, oldName, newName } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    member.name = newName;
    
    this.editor.showNotification(`${this.wrapMemberName(member, oldName)}</span> ${__("(ha cambiado su nombre a|has changed name to)")} ${this.wrapMemberName(member, newName)}`);
  }
  
  handleColorUpdate(message) {
    const { memberId, oldColor, newColor } = message;
    const member = this.members.get(memberId);
    
    if (!member || memberId === this.memberId) return;
    
    member.color = newColor;
    
    this.editor.showNotification(`${this.wrapMemberName(member)}</span> ${__("(ha cambiado su color|has changed color)")}`);
  }

  handleChatMessage(message) {
    this.chatMessages.push(message);
    this.addMessageHtml(message);
    if (!this.chatVisible) {
      this.chatButton.classList.add('new-message');
    }
    this.scrollMessagesToBottom();
  }

  handleFullState(message) {
    if (message.memberId === this.memberId) return;
    this.applyFullState(message.state);
    this.editor.showNotification(__('Proyecto sincronizado||Project synchronized'), 1000);
  }

  handleSessionEnded(reason) {
    this.disconnect(false);
    this.editor.showNotification(reason || __('La sesión ha terminado'), 3000);
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
    
    this.restoreEditorMethods();
    
    if (!this.manualDisconnect) {
      this.editor.showNotification(__('Desconectado'), 2000);
    }
  }

  sendTraceComplete(trace) {
    this.sendMessage({
      type: 'trace_complete',
      data: trace
    });
  }

  sendCursorUpdate(x, y, active) {
    const now = Date.now();
    if (now - this.lastCursorSend < this.CURSOR_THROTTLE) return;
    this.lastCursorSend = now;
    
    this.sendMessage({
      type: 'cursor_update',
      x: Math.round(x),
      y: Math.round(y),
      active: active
    });
  }

  sendChatMessage(text) {
    this.sendMessage({
      type: 'chat_message',
      message: text
    });
  }

  sendFullState(toMemberId) {
    if (!this.isHost || !this.isConnected) return;
    
    const state = this.getFullState();
    this.sendMessage({
      type: 'full_state',
      state: state,
      toMemberId: toMemberId || null
    });
  }

  getFullState() {
    const state = {
      width: this.editor.project.width,
      height: this.editor.project.height,
      frames: [],
      currentFrame: this.editor.project.currentFrame,
      currentLayer: this.editor.project.currentLayer
    };
    
    for (let f = 0; f < this.editor.project.frames.length; f++) {
      const frame = this.editor.project.frames[f];
      const frameData = { layers: [] };
      
      for (let l = 0; l < frame.layers.length; l++) {
        const layer = frame.layers[l];
        const imageData = layer.ctx.getImageData(0, 0, state.width, state.height);
        
        frameData.layers.push({
          name: layer.name,
          visible: layer.visible,
          imageData: Array.from(imageData.data)
        });
      }
      
      state.frames.push(frameData);
    }
    
    return state;
  }

  applyFullState(state) {
    const project = {
      width: state.width,
      height: state.height,
      frames: [],
      currentFrame: state.currentFrame,
      currentLayer: state.currentLayer
    };
    
    for (let f = 0; f < state.frames.length; f++) {
      const frameData = state.frames[f];
      const frame = { layers: [] };
      
      for (let l = 0; l < frameData.layers.length; l++) {
        const layerData = frameData.layers[l];
        const canvas = document.createElement('canvas');
        canvas.width = state.width;
        canvas.height = state.height;
        const ctx = canvas.getContext('2d');
        
        if (layerData.imageData) {
          const imageData = new ImageData(
            new Uint8ClampedArray(layerData.imageData),
            state.width,
            state.height
          );
          ctx.putImageData(imageData, 0, 0);
        }
        
        frame.layers.push({
          canvas: canvas,
          ctx: ctx,
          name: layerData.name,
          visible: layerData.visible
        });
      }
      
      project.frames.push(frame);
    }
    
    this.editor.project = project;
    this.editor.resizeCanvas();
    this.editor.render();
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
          userColor: this.memberColor
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
          userColor: this.memberColor
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
      cursor.style.cssText = `
        position: absolute;
        transform: translate(-5px, -5px);
        pointer-events: none;
        z-index: 15;
        transition: all 0.05s ease;
      `;
      
      cursor.innerHTML = `
        <div style="width: 16px; height: 16px; border: 2px solid; border-radius: 2px; transform: rotate(45deg);"></div>
        <div style="position: absolute; top: -20px; left: 0; color: white; font-size: 10px; padding: 2px 4px; border-radius: 3px; white-space: nowrap;"></div>
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
    infoCard.style.cssText = `
      background-color: var(--ui-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    `;
    
    infoCard.innerHTML = `
      <div style="margin-bottom: 12px;">
        <span style="color: var(--text-dim);">${__('Sala||Room')}:</span>
        <span style="color: var(--text-color); font-weight: bold; margin-left: 8px;">${this.sessionName || __('Sala sin nombre||Unnamed room')}</span>
      </div>
      <div style="margin-bottom: 12px;">
        <span style="color: var(--text-dim);">${__('Miembros||Members')}:</span>
        <span style="color: var(--text-color); font-weight: bold; margin-left: 8px;">${this.members.size}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: var(--text-dim);">${__('ID||ID')}:</span>
        <span style="color: var(--text-color); font-family: monospace; background: var(--bg-color); padding: 4px 8px; border-radius: 4px; flex: 1; font-size: 12px;">${this.sessionId || 'Unknown'}</span>
        <button id="copyIdBtn" style="background: var(--ui-highlight); border: none; border-radius: 4px; color: var(--text-color); padding: 4px 8px; cursor: pointer;">
          ${__('Copiar||Copy')}
        </button>
      </div>
    `;
    
    const copyBtn = infoCard.querySelector('#copyIdBtn');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this.sessionId);
      this.editor.showNotification(__('ID copiado||ID copied'), 1000);
    });
    
    this.sessionContent.appendChild(infoCard);
    
    // Members list
    const membersSection = document.createElement('div');
    membersSection.style.cssText = `
      background-color: var(--ui-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    `;
    
    membersSection.innerHTML = `<h3 style="margin: 0 0 12px 0;">${__('Miembros||Members')}</h3>`;
    
    const membersList = document.createElement('div');
    membersList.style.cssText = `display: flex; flex-direction: column; gap: 8px;`;
    
    this.members.forEach(member => {
      const memberItem = document.createElement('div');
      memberItem.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        background-color: ${member.id === this.memberId ? 'var(--primary-color)' : 'var(--bg-color)'};
        border-radius: 6px;
        color: ${member.id === this.memberId ? 'white' : 'var(--text-color)'};
      `;
      
      const nameSpan = document.createElement('span');
      nameSpan.style.cssText = `font-weight: bold; display: flex; align-items: center; gap: 8px;`;
      nameSpan.style.color = member.id === this.memberId ? 'white' : this.getColorHex(member.color);
      
      const nameText = document.createElement('span');
      nameText.textContent = member.name;
      nameSpan.appendChild(nameText);
      
      if (member.isHost) {
        const hostBadge = document.createElement('span');
        hostBadge.style.cssText = `
          background-color: gold;
          color: black;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 3px;
        `;
        hostBadge.textContent = 'HOST';
        nameSpan.appendChild(hostBadge);
      }
      
      if (member.id === this.memberId) {
        const youBadge = document.createElement('span');
        youBadge.style.cssText = `
          background-color: rgba(255,255,255,0.3);
          color: white;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 3px;
        `;
        youBadge.textContent = __('TÚ||YOU');
        nameSpan.appendChild(youBadge);
      }
      
      memberItem.appendChild(nameSpan);
      
      // Kick button for host
      if (this.isHost && member.id !== this.memberId) {
        const kickBtn = document.createElement('button');
        kickBtn.textContent = __('Expulsar||Kick');
        kickBtn.style.cssText = `
          background-color: #ff4444;
          border: none;
          border-radius: 4px;
          color: white;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          transition: filter 0.2s;
        `;
        kickBtn.addEventListener('mouseenter', () => {
          kickBtn.style.filter = 'brightness(1.2)';
        });
        kickBtn.addEventListener('mouseleave', () => {
          kickBtn.style.filter = 'none';
        });
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
    disconnectBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background-color: ${this.isHost ? '#ff4444' : 'var(--ui-highlight)'};
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: filter 0.2s;
    `;
    disconnectBtn.textContent = this.isHost ? __('Terminar sesión||End Session') : __('Desconectar||Disconnect');
    disconnectBtn.addEventListener('mouseenter', () => {
      disconnectBtn.style.filter = 'brightness(1.2)';
    });
    disconnectBtn.addEventListener('mouseleave', () => {
      disconnectBtn.style.filter = 'none';
    });
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
            text: __('Sí||Yes'),
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
      `${__('¿Expulsar a||Kick')} ${member.name}?`,
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
    msgEl.style.cssText = `font-size: 12px; margin-bottom: 4px; word-break: break-word;`;
    msgEl.innerHTML = `
      <span style="color: ${this.getColorHex(msg.memberColor)}; font-weight: bold;">${this.escapeHtml(msg.memberName || 'Unknown')}:</span>
      <span style="color: var(--text-color);"> ${this.escapeHtml(msg.message)}</span>
    `;
    this.chatMessagesDiv.appendChild(msgEl);
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

  showConnectingOverlay(message) {
    this.connectingOverlay = document.createElement('div');
    this.connectingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 10001;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `;
    
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      border: 4px solid rgba(255,255,255,0.1);
      border-top: 4px solid var(--primary-color);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    `;
    
    const text = document.createElement('div');
    text.style.cssText = `color: white; font-size: 16px;`;
    text.textContent = message;
    
    if (!document.querySelector('#spin-keyframes')) {
      const style = document.createElement('style');
      style.id = 'spin-keyframes';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    this.connectingOverlay.appendChild(spinner);
    this.connectingOverlay.appendChild(text);
    document.body.appendChild(this.connectingOverlay);
  }

  hideConnectingOverlay() {
    if (this.connectingOverlay) {
      this.connectingOverlay.remove();
      this.connectingOverlay = null;
    }
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
