const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Store active sessions
const sessions = new Map();
const publicSessions = new Map();

class Session {
  constructor(id, name, password, hostId, hostName, hostColor) {
    this.id = id;
    this.name = name;
    this.password = password;
    this.hostId = hostId;
    this.created = Date.now();
    this.members = new Map();
    this.projectData = null;
    this.isPublic = !password;
    
    // Add host as first member
    this.members.set(hostId, {
      id: hostId,
      name: hostName,
      color: hostColor,
      isHost: true,
      joined: Date.now()
    });
  }

  addMember(memberId, name, color) {
    this.members.set(memberId, {
      id: memberId,
      name: name,
      color: color,
      isHost: false,
      joined: Date.now()
    });
  }

  removeMember(memberId) {
    return this.members.delete(memberId);
  }

  getMember(memberId) {
    return this.members.get(memberId);
  }

  getAllMembers() {
    return Array.from(this.members.values());
  }

  isHost(memberId) {
    const member = this.members.get(memberId);
    return member ? member.isHost : false;
  }
}

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  ws.id = uuidv4();
  ws.sessionId = null;
  ws.memberId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, message);
    } catch (error) {
      console.error('Error handling message:', error);
      sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleMessage(ws, message) {
  if (message.type != "ping") console.log('Received message type:', message.type);
  
  switch (message.type) {
    case 'create_session':
      handleCreateSession(ws, message);
      break;
    case 'join_session':
      handleJoinSession(ws, message);
      break;
    case 'leave_session':
      handleLeaveSession(ws);
      break;
    case 'get_public_sessions':
      handleGetPublicSessions(ws);
      break;
    case 'trace_complete':
      handleTraceComplete(ws, message);
      break;
    case 'cursor_update':
      handleCursorUpdate(ws, message);
      break;
    case 'name_update':
      handleNameUpdate(ws, message);
      break;
    case 'color_update':
      handleColorUpdate(ws, message);
      break;
    case 'chat_message':
      handleChatMessage(ws, message);
      break;
    case 'full_state':
      handleFullState(ws, message);
      break;
    case 'kick_member':
      handleKickMember(ws, message);
      break;
    case 'ping':
      handlePing(ws, message);
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

function handleCreateSession(ws, message) {
  const { sessionName, password, userName, userColor } = message;
  const sessionId = uuidv4();
  const hostId = ws.id;

  console.log(`Creating session: ${sessionName} for user ${userName}`);

  const session = new Session(
    sessionId,
    sessionName,
    password,
    hostId,
    userName,
    userColor
  );

  sessions.set(sessionId, session);
  
  // Add to public sessions if no password
  if (!password) {
    publicSessions.set(sessionId, {
      id: sessionId,
      name: sessionName,
      memberCount: 1,
      hasPassword: false
    });
  }

  ws.sessionId = sessionId;
  ws.memberId = hostId;

  send(ws, {
    type: 'session_created',
    sessionId: sessionId,
    sessionName: sessionName,
    memberId: hostId,
    members: session.getAllMembers()
  });
}

function handleJoinSession(ws, message) {
  const { sessionId, password, userName, userColor } = message;
  const session = sessions.get(sessionId);

  if (!session) {
    return sendError(ws, 'Session not found');
  }

  if (session.password && session.password !== password) {
    return sendError(ws, 'Invalid password');
  }

  const memberId = ws.id;
  session.addMember(memberId, userName, userColor);

  ws.sessionId = sessionId;
  ws.memberId = memberId;

  // Update public session info
  if (publicSessions.has(sessionId)) {
    publicSessions.set(sessionId, {
      id: sessionId,
      name: session.name,
      memberCount: session.members.size,
      hasPassword: !!session.password
    });
  }

  console.log(`User ${userName} joined session ${session.name}`);

  // Send session info to joining member with project state
  send(ws, {
    type: 'session_joined',
    sessionId: sessionId,
    sessionName: session.name,
    memberId: memberId,
    members: session.getAllMembers(),
    isHost: false,
    projectData: session.projectData // Send current project state
  });

  // Notify existing members about new member
  broadcastToSession(sessionId, {
    type: 'member_joined',
    member: session.getMember(memberId)
  }, [memberId]);
}

function handleLeaveSession(ws) {
  if (!ws.sessionId || !ws.memberId) return;

  const session = sessions.get(ws.sessionId);
  if (!session) return;

  const wasHost = session.isHost(ws.memberId);
  const member = session.getMember(ws.memberId);
  
  session.removeMember(ws.memberId);

  // Update public session info
  if (publicSessions.has(ws.sessionId)) {
    if (session.members.size > 0) {
      publicSessions.set(ws.sessionId, {
        id: ws.sessionId,
        name: session.name,
        memberCount: session.members.size,
        hasPassword: !!session.password
      });
    } else {
      publicSessions.delete(ws.sessionId);
    }
  }

  console.log(`User ${member?.name || 'Unknown'} left session`);

  // Notify other members that someone left
  broadcastToSession(ws.sessionId, {
    type: 'member_left',
    memberId: ws.memberId,
    memberName: member ? member.name : 'Unknown'
  }, [ws.memberId]);

  // If host left, end session for everyone
  if (wasHost) {
    console.log(`Host left, ending session ${session.name}`);
    broadcastToSession(ws.sessionId, {
      type: 'session_ended',
      reason: 'Host ended the session'
    });
    
    sessions.delete(ws.sessionId);
    publicSessions.delete(ws.sessionId);
  } else if (session.members.size === 0) {
    // If no members left, clean up
    sessions.delete(ws.sessionId);
    publicSessions.delete(ws.sessionId);
  }

  ws.sessionId = null;
  ws.memberId = null;
}

function handleGetPublicSessions(ws) {
  send(ws, {
    type: 'public_sessions',
    sessions: Array.from(publicSessions.values())
  });
}

function handleTraceComplete(ws, message) {
  if (!ws.sessionId || !ws.memberId) {
    console.log('Trace complete ignored: no session or member');
    return;
  }

  const session = sessions.get(ws.sessionId);
  if (!session) {
    console.log('Trace complete ignored: session not found');
    return;
  }

  const member = session.getMember(ws.memberId);
  const points = message.data?.points?.length || 0;
  console.log(`Trace completed by ${member?.name || 'Unknown'} with ${points} points`);

  // Broadcast the completed trace to all other members
  const recipients = broadcastToSession(ws.sessionId, {
    type: 'trace_complete',
    memberId: ws.memberId,
    data: message.data
  }, [ws.memberId]);
  
  console.log(`Trace broadcast to ${recipients} other clients`);
}

function handleCursorUpdate(ws, message) {
  if (!ws.sessionId || !ws.memberId) return;

  const session = sessions.get(ws.sessionId);
  if (!session) return;

  // Broadcast cursor position to all other members
  broadcastToSession(ws.sessionId, {
    type: 'cursor_update',
    memberId: ws.memberId,
    x: message.x,
    y: message.y,
    active: message.active
  }, [ws.memberId]);
}

function handleNameUpdate(ws, message) {
  if (!ws.sessionId || !ws.memberId) return;

  const session = sessions.get(ws.sessionId);
  if (!session) return;

  // Broadcast to all other members
  broadcastToSession(ws.sessionId, {
    type: 'name_update',
    memberId: ws.memberId,
    oldName: message.oldName,
    newName: message.newName
  }, [ws.memberId]);
}

function handleColorUpdate(ws, message) {
  if (!ws.sessionId || !ws.memberId) return;

  const session = sessions.get(ws.sessionId);
  if (!session) return;

  // Broadcast to all other members
  broadcastToSession(ws.sessionId, {
    type: 'color_update',
    memberId: ws.memberId,
    oldColor: message.oldColor,
    newColor: message.newColor
  }, [ws.memberId]);
}

function handleChatMessage(ws, message) {
  if (!ws.sessionId || !ws.memberId) return;

  const session = sessions.get(ws.sessionId);
  if (!session) return;

  const member = session.getMember(ws.memberId);
  
  broadcastToSession(ws.sessionId, {
    type: 'chat_message',
    memberName: member ? member.name : 'Unknown',
    memberColor: member ? member.color : 'gray',
    message: message.message,
    timestamp: Date.now()
  });
}

function handleFullState(ws, message) {
  if (!ws.sessionId || !ws.memberId) return;

  const session = sessions.get(ws.sessionId);
  if (!session) return;

  // Only host can send full state updates
  if (!session.isHost(ws.memberId)) return;

  console.log(`Full state update from host ${ws.memberId}`);

  // Store project data
  session.projectData = message.state;
  
  const toMemberId = message.toMemberId || null;

  // Broadcast full state to all other members
  const recipients = broadcastToSession(ws.sessionId, {
    type: 'full_state',
    memberId: ws.memberId,
    state: message.state
  }, toMemberId ? [ws.memberId, ...wss.clients.filter(client => client.memberId !== toMemberId)] : [ws.memberId]);
  
  console.log(`Full state broadcast to ${recipients} clients`);
}

function handleKickMember(ws, message) {
  if (!ws.sessionId || !ws.memberId) return;

  const session = sessions.get(ws.sessionId);
  if (!session) return;

  // Only host can kick members
  if (!session.isHost(ws.memberId)) return;

  const targetMemberId = message.memberId;
  if (targetMemberId === ws.memberId) return; // Can't kick yourself

  const member = session.getMember(targetMemberId);
  if (!member) return;

  console.log(`Host kicking member ${member.name}`);

  // Remove member from session
  session.removeMember(targetMemberId);

  // Find their websocket and disconnect them
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && 
        client.memberId === targetMemberId) {
      send(client, {
        type: 'you_were_kicked'
      });
      setTimeout(() => client.close(), 100);
    }
  });

  // Notify remaining members
  broadcastToSession(ws.sessionId, {
    type: 'member_kicked',
    memberId: targetMemberId,
    memberName: member.name
  });
}

function handlePing(ws, message) {
  send(ws, {
    type: 'pong',
    timestamp: message.timestamp
  });
}

function handleDisconnect(ws) {
  if (ws.sessionId && ws.memberId) {
    console.log(`WebSocket disconnected for member ${ws.memberId}`);
    handleLeaveSession(ws);
  }
}

function broadcastToSession(sessionId, message, excludeMemberIds = []) {
  const session = sessions.get(sessionId);
  if (!session) {
    console.log(`Session ${sessionId} not found for broadcast`);
    return 0;
  }

  let sentCount = 0;
  const excludeSet = new Set(excludeMemberIds);
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && 
        client.sessionId === sessionId) {
      
      if (excludeSet.has(client.memberId)) {
        return;
      }
      
      send(client, message);
      sentCount++;
    }
  });
  
  if (sentCount > 0) {
    console.log(`Broadcast ${message.type} to ${sentCount} clients`);
  }
  
  return sentCount;
}

function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws, error) {
  send(ws, { type: 'error', error });
}

// REST endpoints
app.get('/api/sessions', (req, res) => {
  res.json(Array.from(publicSessions.values()));
});

app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    id: session.id,
    name: session.name,
    memberCount: session.members.size,
    hasPassword: !!session.password
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Collaboration server running on port ${PORT}`);
});