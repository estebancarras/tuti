import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { URL } from 'url';

const wss = new WebSocketServer({ port: 1999 });

console.log('🎉 Mock PartyKit Server running on ws://localhost:1999');

// Room State Map: roomId -> RoomState
const rooms = new Map();

// Map to track socket -> { roomId, playerId }
const socketMetadata = new Map();

function broadcastToRoom(roomId, message) {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
        const metadata = socketMetadata.get(client);
        if (client.readyState === 1 && metadata && metadata.roomId === roomId) {
            client.send(data);
        }
    });
}

function getOrCreateRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            status: 'LOBBY',
            players: [],
            roomId: roomId
        });
        console.log(`🏠 Created new room: ${roomId}`);
    }
    return rooms.get(roomId);
}

wss.on('connection', (ws, req) => {
    const connectionId = randomUUID();

    // Parse roomId from URL query params (simulating PartyKit routing)
    // URL format: ws://localhost:1999/?roomId=ABCD
    const url = new URL(req.url, 'ws://localhost:1999');
    const roomId = url.searchParams.get('roomId') || 'LOBBY';

    console.log(`✅ Client connected: ${connectionId} to Room: ${roomId}`);

    // Store metadata
    socketMetadata.set(ws, { roomId, playerId: connectionId });

    // Send initial welcome
    ws.send(JSON.stringify({
        type: "SYSTEM",
        payload: `Connected to Mock Server Room: ${roomId}`
    }));

    // Send current state of the room immediately
    const roomState = getOrCreateRoom(roomId);
    ws.send(JSON.stringify({
        type: "UPDATE_STATE",
        payload: roomState
    }));

    ws.on('message', (rawMessage) => {
        try {
            const message = JSON.parse(rawMessage.toString());
            console.log(`📨 Received from ${connectionId} in ${roomId}:`, message);

            if (message.type === 'JOIN') {
                const currentRoom = getOrCreateRoom(roomId);

                const newPlayer = {
                    id: connectionId,
                    name: message.payload.name,
                    score: 0,
                    isHost: currentRoom.players.length === 0 // First player in THIS room is host
                };

                currentRoom.players.push(newPlayer);

                console.log(`👤 Player joined ${roomId}: ${newPlayer.name} (Host: ${newPlayer.isHost})`);

                // Broadcast new state only to this room
                broadcastToRoom(roomId, {
                    type: "UPDATE_STATE",
                    payload: currentRoom
                });
            }

        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        console.log(`❌ Client disconnected: ${connectionId} from ${roomId}`);

        const metadata = socketMetadata.get(ws);
        if (metadata) {
            const currentRoom = rooms.get(metadata.roomId);
            if (currentRoom) {
                // Remove player
                const wasHost = currentRoom.players.find(p => p.id === metadata.playerId)?.isHost;
                currentRoom.players = currentRoom.players.filter(p => p.id !== metadata.playerId);

                // Reassign host if needed
                if (wasHost && currentRoom.players.length > 0) {
                    currentRoom.players[0].isHost = true;
                }

                // Cleanup empty room if needed (optional)
                if (currentRoom.players.length === 0) {
                    rooms.delete(metadata.roomId);
                    console.log(`🗑️ Room ${metadata.roomId} deleted (empty)`);
                } else {
                    // Broadcast update
                    broadcastToRoom(metadata.roomId, {
                        type: "UPDATE_STATE",
                        payload: currentRoom
                    });
                }
            }
            socketMetadata.delete(ws);
        }
    });
});
