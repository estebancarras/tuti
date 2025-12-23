import { ref, watch, computed } from 'vue';
import { useSocket } from './useSocket';
import { debounce } from '../utils/timing';
import type { RoomState, ServerMessage } from '../../shared/types';

// Global state to persist across component mounts if needed
const gameState = ref<RoomState>({
    status: 'LOBBY',
    players: [],
    roomId: null,
    currentLetter: null,
    categories: [],
    answers: {},
    answerStatuses: {},
    roundsPlayed: 0,
    votes: {},
    whoFinishedVoting: [],
    roundScores: {},
    config: {
        roundDuration: 60,
        votingDuration: 45,
        categoriesCount: 5,
        totalRounds: 5
    },
    timers: {
        roundEndsAt: null,
        votingEndsAt: null,
        resultsEndsAt: null
    }
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

    // Persistence Constants
    const STORAGE_KEY_USER_ID = 'tuti-user-id';
    const STORAGE_KEY_USER_NAME = 'tuti-user-name';

    // 1. User ID Persistence
    const getStoredUserId = () => localStorage.getItem(STORAGE_KEY_USER_ID);
    const myUserId = ref<string>(getStoredUserId() || crypto.randomUUID());

    // Ensure it's saved if we generated a new one or if it was missing
    if (!getStoredUserId()) {
        localStorage.setItem(STORAGE_KEY_USER_ID, myUserId.value);
    }

    // 2. User Name Persistence
    const myUserName = ref<string>(localStorage.getItem(STORAGE_KEY_USER_NAME) || '');

    // Watch and save name changes
    watch(myUserName, (newName) => {
        localStorage.setItem(STORAGE_KEY_USER_NAME, newName);
    });

    // Computed: Check if current user is host
    const amIHost = computed(() => {
        const me = gameState.value.players.find(p => p.id === myUserId.value);
        return me?.isHost || false;
    });

    const joinGame = async (name: string, roomId: string, avatar: string) => {
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

        const userId = myUserId.value; // Use the reactive myUserId

        const message = {
            type: 'JOIN',
            payload: { name, roomId, userId, avatar }
        };

        socket.value.send(JSON.stringify(message));
    };

    const startGame = () => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({ type: 'START_GAME' }));
    };

    const submitAnswers = (answers: Record<string, string>) => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({
            type: 'SUBMIT_ANSWERS',
            payload: { answers }
        }));
    };

    const stopRound = (answers: Record<string, string>) => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({
            type: 'STOP_ROUND',
            payload: { answers }
        }));
    };

    // Continuous Sync (Debounced)
    const updateAnswers = (answers: Record<string, string>) => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({
            type: 'UPDATE_ANSWERS',
            payload: { answers }
        }));
    };

    const debouncedUpdateAnswers = debounce(updateAnswers, 500);

    // Watch for state changes to REVIEW to trigger submitting answers if we haven't already
    // Note: The UI component should handle calling 'submitAnswers' when it detects the state change 
    // to grab the current values from the inputs. 
    // However, defining the transport method here is key.

    // We expose a helper to check if we need to submit
    const shouldSubmit = () => gameState.value.status === 'REVIEW';

    const toggleVote = (targetUserId: string, category: string) => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({
            type: 'TOGGLE_VOTE',
            payload: { targetUserId, category }
        }));
    };

    const confirmVotes = () => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({
            type: 'CONFIRM_VOTES'
        }));
    };

    const updateConfig = (config: Partial<{ roundDuration: number; votingDuration: number; categoriesCount: number }>) => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({
            type: 'UPDATE_CONFIG',
            payload: config
        }));
    };

    const resetGame = () => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({
            type: 'RESTART_GAME'
        }));
    };

    const kickPlayer = (targetUserId: string) => {
        if (!socket.value) return;
        socket.value.send(JSON.stringify({
            type: 'KICK_PLAYER',
            payload: { targetUserId }
        }));
    };

    return {
        gameState,
        joinGame,
        startGame,
        stopRound,
        submitAnswers,
        debouncedUpdateAnswers,
        shouldSubmit,
        toggleVote,
        confirmVotes,
        updateConfig,
        resetGame,
        kickPlayer,
        myUserId,
        myUserName,
        amIHost
    };
}
