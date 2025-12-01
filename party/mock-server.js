import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 1999 });

console.log('🎉 Mock PartyKit Server running on ws://localhost:1999');

wss.on('connection', (ws) => {
    console.log('✅ Client connected');

    // Send welcome message
    ws.send('WELCOME');

    ws.on('message', (message) => {
        console.log('📨 Received:', message.toString());
        // Echo back for now
        ws.send(`Echo: ${message}`);
    });

    ws.on('close', () => {
        console.log('❌ Client disconnected');
    });
});
