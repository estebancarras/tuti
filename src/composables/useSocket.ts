import { ref } from 'vue';
import PartySocket from "partysocket";

const PARTYKIT_HOST = import.meta.env.DEV
    ? "localhost:1999"
    : (typeof window !== 'undefined' ? window.location.host : "tutifruti-phoenix.partykit.dev");

// Global state (Singleton pattern) to ensure App.vue and useGame.ts share the connection
const socket = ref<PartySocket | null>(null);
const isConnected = ref(false);
const lastMessage = ref<string>('');

export function useSocket() {
    const setRoomId = (roomId: string | null, params: Record<string, string> = {}) => {
        // 1. Close existing connection if any
        if (socket.value) {
            console.log('🔌 Switching rooms... Closing old connection.');
            socket.value.close();
            socket.value = null;
            isConnected.value = false;
        }

        if (!roomId) return;

        // Build Query String
        // Build Query String
        // const searchParams = new URLSearchParams(params);
        // const queryString = searchParams.toString();
        // const querySuffix = queryString ? `?${queryString}` : ''; // Unused, PartySocket handles this via 'query' option

        // 2. Create new connection
        console.log(`🔌 Connecting to room: ${roomId} on host: ${PARTYKIT_HOST} with params:`, params);

        if (import.meta.env.DEV) {
            // Mock Server Connection (Native WebSocket)
            // Ensure we append params correctly. Mock server expects roomId in query param too.
            const mockParams = new URLSearchParams(params);
            mockParams.set("roomId", roomId);
            const ws = new WebSocket(`ws://${PARTYKIT_HOST}?${mockParams.toString()}`);

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
                query: params // PartySocket handles query params natively
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
