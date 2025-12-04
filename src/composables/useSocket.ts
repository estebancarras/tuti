import { ref } from 'vue';
import PartySocket from "partysocket";

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || (import.meta.env.DEV ? "localhost:1999" : "tutifruti-phoenix.partykit.dev");

// Global state (Singleton pattern) to ensure App.vue and useGame.ts share the connection
const socket = ref<PartySocket | null>(null);
const isConnected = ref(false);
const lastMessage = ref<string>('');

export function useSocket() {
    const setRoomId = (roomId: string) => {
        // 1. Close existing connection if any
        if (socket.value) {
            console.log('🔌 Switching rooms... Closing old connection.');
            socket.value.close();
            socket.value = null;
            isConnected.value = false;
        }

        // 2. Create new connection
        console.log(`🔌 Connecting to room: ${roomId} on host: ${PARTYKIT_HOST}`);

        if (import.meta.env.DEV) {
            // Mock Server Connection (Native WebSocket)
            // We pass roomId in query param for mock server to identify it (simulating PartyKit routing)
            const ws = new WebSocket(`ws://${PARTYKIT_HOST}?roomId=${roomId}`);

            ws.addEventListener('open', () => {
                isConnected.value = true;
                console.log('✅ Connected to Mock Server!');
            });

            ws.addEventListener('close', () => {
                isConnected.value = false;
                console.log('❌ Disconnected from Mock Server');
            });

            ws.addEventListener('message', (event) => {
                lastMessage.value = event.data;
                // console.log('Received:', event.data);
            });

            socket.value = ws as any; // Cast for compatibility
        } else {
            // Production PartyKit Connection
            socket.value = new PartySocket({
                host: PARTYKIT_HOST,
                room: roomId,
            });

            socket.value.addEventListener('open', () => {
                isConnected.value = true;
                console.log('✅ Connected to PartyKit Cloud!');
            });

            socket.value.addEventListener('close', () => {
                isConnected.value = false;
                console.log('❌ Disconnected from PartyKit Cloud');
            });

            socket.value.addEventListener('message', (event: MessageEvent) => {
                lastMessage.value = event.data as string;
            });
        }
    };

    return {
        socket,
        isConnected,
        lastMessage,
        setRoomId
    };
}
