import { ref, watch } from 'vue';
import { useSocket } from './useSocket';
import type { RoomState, ServerMessage } from '../../shared/types';

// Global state to persist across component mounts if needed
const gameState = ref<RoomState>({
    status: 'LOBBY',
    players: [],
    roomId: null
});

export function useGame() {
    const { socket, lastMessage, setRoomId, isConnected } = useSocket();

    // Watch for incoming messages
    watch(lastMessage, (newMsg) => {
        if (!newMsg) return;

        try {
            const parsed: ServerMessage = JSON.parse(newMsg);

            if (parsed.type === 'UPDATE_STATE') {
                gameState.value = parsed.payload;
            }
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    });

    const joinGame = async (name: string, roomId: string) => {
        // 1. Connect to the specific room
        setRoomId(roomId);

        // 2. Wait for connection to open
        // Simple polling for now, could be improved with a Promise wrapper or watch
        const waitForConnection = () => {
            return new Promise<void>((resolve) => {
                if (isConnected.value) {
                    resolve();
                    return;
                }
                const unwatch = watch(isConnected, (connected) => {
                    if (connected) {
                        unwatch();
                        resolve();
                    }
                });
            });
        };

        await waitForConnection();

        // 3. Send JOIN message
        if (!socket.value) return;

        const message = {
            type: 'JOIN',
            payload: { name, roomId }
        };

        socket.value.send(JSON.stringify(message));
    };

    const startGame = () => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({ type: 'START_GAME' }));
    };

    const stopRound = () => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({ type: 'STOP_ROUND' }));
    };

    return {
        gameState,
        joinGame,
        startGame,
        stopRound
    };
}
