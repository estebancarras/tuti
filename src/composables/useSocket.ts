import { ref, onMounted, onUnmounted } from 'vue';
import PartySocket from "partysocket";

const PARTYKIT_HOST = import.meta.env.DEV ? "localhost:1999" : "tutifruti-phoenix.partykit.dev";

export function useSocket() {
    const socket = ref<PartySocket | null>(null);
    const isConnected = ref(false);
    const lastMessage = ref<string>('');

    const connect = (roomId: string = 'lobby') => {
        if (socket.value) return;

        socket.value = new PartySocket({
            host: PARTYKIT_HOST,
            room: roomId,
        });

        socket.value.addEventListener('open', () => {
            isConnected.value = true;
            console.log('Connected to PartyKit!');
        });

        socket.value.addEventListener('close', () => {
            isConnected.value = false;
            console.log('Disconnected from PartyKit');
        });

        socket.value.addEventListener('message', (event: MessageEvent) => {
            lastMessage.value = event.data as string;
            console.log('Received:', event.data);
        });
    };

    onMounted(() => {
        connect();
    });

    onUnmounted(() => {
        if (socket.value) {
            socket.value.close();
        }
    });

    return {
        socket,
        isConnected,
        lastMessage
    };
}
