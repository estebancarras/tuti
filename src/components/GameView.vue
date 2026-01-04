<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useGame } from '../composables/useGame';
import { useSound } from '../composables/useSound';

import { useSmartReview } from '../composables/useSmartReview';

const { gameState, stopRound, submitAnswers, debouncedUpdateAnswers, shouldSubmit, toggleVote, confirmVotes, myUserId, amIHost, startGame, leaveGame } = useGame();
const { playClick, playJoin, playTick, playAlarm, playSuccess } = useSound();

const answers = ref<Record<string, string>>({});
const hasConfirmed = ref(false);

// Countdown timer
const timeRemaining = ref<number | null>(null);
let timerInterval: NodeJS.Timeout | null = null;

const updateTimer = () => {
    const now = Date.now();
    let targetTime: number | null = null;

    if (gameState.value.status === 'PLAYING' && gameState.value.timers.roundEndsAt) {
        targetTime = gameState.value.timers.roundEndsAt;
    } else if (gameState.value.status === 'REVIEW' && gameState.value.timers.votingEndsAt) {
        targetTime = gameState.value.timers.votingEndsAt;
    } else if (gameState.value.status === 'RESULTS' && gameState.value.timers.resultsEndsAt) {
        targetTime = gameState.value.timers.resultsEndsAt;
    }

    if (targetTime) {
        const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));
        timeRemaining.value = remaining;
        
        // Tick Sound
        if (remaining <= 10 && remaining > 0) {
            playTick();
        }
    } else {
        timeRemaining.value = null;
    }
};

// Watch for timer changes and update every second
watch(() => [gameState.value.status, gameState.value.timers], () => {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    updateTimer();

    if (gameState.value.status === 'PLAYING' || gameState.value.status === 'REVIEW' || gameState.value.status === 'RESULTS') {
        timerInterval = setInterval(updateTimer, 1000);
    }
}, { immediate: true, deep: true });

onUnmounted(() => {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
});

const timerColor = computed(() => {
    if (timeRemaining.value === null) return 'text-gray-400';
    if (timeRemaining.value <= 10) return 'text-red-500 animate-pulse';
    return 'text-white';
});

// Anti-Troll Logic
const canStopRound = computed(() => {
    // Must have a non-empty answer for EVERY category in the current list
    return gameState.value.categories.every(cat => {
        const val = answers.value[cat];
        return val && val.trim().length > 0;
    });
});


const validationCooldown = ref(false);

const handleStop = () => {
    if (validationCooldown.value) return; // Throttle spam

    if (!canStopRound.value) {
        // Validation Failed: Show subtle feedback
        addToast("⚠️ Completa todas las categorías para parar", 'join', 'stop-warning'); 
        
        // Activate cooldown
        validationCooldown.value = true;
        setTimeout(() => {
            validationCooldown.value = false;
        }, 800); // 800ms throttle for interactions

        // Play error/blocked sound if available (optional)
        return;
    }
    stopRound(answers.value);
    playAlarm();
};

// Carousel Logic for Review Phase
const activeCategoryIndex = ref(0);
const currentCategory = computed(() => {
    return gameState.value.categories[activeCategoryIndex.value] || '';
});

const { getPlayerStatus } = useSmartReview(gameState, currentCategory);

// Helper for UI
const getReviewItem = (playerId: string) => getPlayerStatus(playerId);

const nextCategory = () => {
    if (activeCategoryIndex.value < gameState.value.categories.length - 1) {
        activeCategoryIndex.value++;
    }
};

const prevCategory = () => {
    if (activeCategoryIndex.value > 0) {
        activeCategoryIndex.value--;
    }
};

const handleConfirmVotes = () => {
    confirmVotes();
    hasConfirmed.value = true;
    playClick();
};

// Check if we need to auto-submit answers (transition from PLAYING to REVIEW by someone else)
watch(shouldSubmit, (needsSubmit) => {
    if (needsSubmit) {
        submitAnswers(answers.value);
    }
});

// Reset local state on new round
watch(() => gameState.value.status, (newStatus) => {
    if (newStatus === 'PLAYING') {
        answers.value = {};
        hasConfirmed.value = false;
    }
});

const handleInput = (category: string, event: Event) => {
    const input = event.target as HTMLInputElement;
    let val = input.value;

    // Strict Blocking: enforce start char
    if (gameState.value.currentLetter && val.length > 0) {
        const firstChar = val.charAt(0).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const targetChar = gameState.value.currentLetter.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (firstChar !== targetChar) {
            // Block input
            val = ""; 
            input.value = ""; // Force clear UI
            // Visual feedback
            input.classList.add('bg-red-500/20', 'animate-pulse');
            setTimeout(() => input.classList.remove('bg-red-500/20', 'animate-pulse'), 500);
        }
    }

    answers.value[category] = val;
    
    // Auto-save to server (Debounced)
    debouncedUpdateAnswers(answers.value);
};

// --- Live Presence & Stop Alert Logic ---
const showStopAlert = ref(false);
const stopperPlayer = computed(() => {
    if (!gameState.value.stoppedBy) return null;
    return gameState.value.players.find(p => p.id === gameState.value.stoppedBy);
});

// Watch for transition to REVIEW to trigger alert
watch(() => gameState.value.status, (newStatus, oldStatus) => {
    if (newStatus === 'REVIEW' && oldStatus === 'PLAYING') {
        showStopAlert.value = true;
        playAlarm();
        // Hide after 3 seconds
        setTimeout(() => {
            showStopAlert.value = false;
        }, 3000);
    } else if (newStatus === 'RESULTS') {
        playSuccess();
    } else if (newStatus !== 'REVIEW') {
        showStopAlert.value = false;
    }
});

const rivalsActivity = computed(() => {
    const totalCategories = gameState.value.categories.length;
    
    return gameState.value.players
        .filter(p => p.id !== myUserId.value && p.isConnected)
        .map(p => {
            const pAnswers = gameState.value.answers[p.id] || {};
            // Count non-empty answers
            const filledCount = Object.values(pAnswers).filter(val => val && val.trim().length > 0).length;
            
            return {
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                filledCount,
                totalCategories,
                isFinished: filledCount === totalCategories,
                isActive: filledCount > 0 && filledCount < totalCategories
            };
        });
});

// --- Hydration ---
const hydrateLocalState = () => {
    if (!myUserId.value) return;
    const myServerAnswers = gameState.value.answers[myUserId.value];
    if (myServerAnswers) {
        console.log('💧 Hydrating local state with server answers');
        // Merge with existing to avoid overwriting current typing if any
        answers.value = { ...answers.value, ...myServerAnswers };
    }
};

watch(() => gameState.value.roomId, (newRoomId) => {
    if (newRoomId) {
        hydrateLocalState();
    }
}, { immediate: true });

// --- Navigation & Modal ---
const showExitModal = ref(false);

const handleExit = () => {
    // If modal is open, this confirms exit. If not, it just opens it.
    // Button in UI will use specific handler logic or inline sets.
    // Here we implement the actual exit action.
    leaveGame();
    showExitModal.value = false;
};

// --- Connection Sounds ---
watch(() => gameState.value.players.length, (newCount, oldCount) => {
    if (newCount > oldCount && gameState.value.status !== 'LOBBY') {
        // We already have lobby sounds, but if someone joins mid-game (reconnect) or generally
        // Actually GameView is only active during GAME. 
        // Note: players array might change on connect/disconnect.
        // Let's rely on the Toast logic to trigger sound? 
        // Or simpler: just watcher here.
        playJoin();
    }
});

// --- Toasts (Session Notifications) ---
interface Toast {
    id: number;
    text: string;
    type: 'join' | 'leave';
    groupId?: string;
}
const sessionToasts = ref<Toast[]>([]);

watch(() => gameState.value.players, (newPlayers, oldPlayers) => {
    if (!oldPlayers || oldPlayers.length === 0) return;

    // Detect Joins
    const joined = newPlayers.filter(np => !oldPlayers.some(op => op.id === np.id));
    // Detect Leaves (connected -> disconnected) OR removed
    // We only care about connection status changes or disappearances for toasts usually
    // But GameEngine keeps disconnected players. So check 'isConnected'
    
    // Check for status changes in existing players
    newPlayers.forEach(np => {
        const op = oldPlayers.find(p => p.id === np.id);
        if (op && np.id !== myUserId.value) {
            if (np.isConnected && !op.isConnected) {
                // Reconnected
                addToast(`${np.avatar || '👤'} ${np.name} volvió.`, 'join');
            } else if (!np.isConnected && op.isConnected) {
                // Disconnected
                addToast(`${np.avatar || '👤'} ${np.name} salió.`, 'leave');
            }
        }
    });

    // New players (first join)
    joined.forEach(p => {
        if (p.id !== myUserId.value) {
             addToast(`${p.avatar || '👤'} ${p.name} entró.`, 'join');
        }
    });

}, { deep: true });

// Host Notification
watch(amIHost, (isHost, wasHost) => {
    if (isHost && !wasHost) {
        addToast("👑 ¡Ahora eres el Anfitrión!", 'join');
    }
});

const addToast = (text: string, type: 'join' | 'leave', uniqueGroupId?: string) => {
    // Deduplication logic
    if (uniqueGroupId) {
        const existing = sessionToasts.value.find(t => t.groupId === uniqueGroupId);
        if (existing) {
            // Reset timer relative to now? Or just ignore? 
            // Re-adding it to the end might be better visual feedback (pulse) but we want to avoid stacking.
            // Let's just ignore if it's already there to prevent spam, or update timestamp to keep it longer?
            // "Si el mensaje ya está visible: No debe volver a crearse. O debe reiniciarse su timer."
            // Simple approach: Do nothing if exists. It will clear eventually.
            // Better approach: Remove old one and add new one so it stays longer?
            // Let's just return to avoid visual jumpiness, wait for it to expire.
            return;
        }
    }

    const id = Date.now();
    sessionToasts.value.push({ id, text, type, groupId: uniqueGroupId });
    setTimeout(() => {
        sessionToasts.value = sessionToasts.value.filter(t => t.id !== id);
    }, 3000);
};

// Mobile Keyboard Fix (Scroll into view)
const handleInputFocus = (event: Event) => {
    const target = event.target as HTMLElement;
    setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
};

</script>

<template>
    <div class="h-[100dvh] w-full flex flex-col overflow-hidden relative bg-gradient-to-b from-[#2e1065] to-[#4c1d95]">
        <!-- HEADER (HUD) -->
        <div class="flex-none w-full max-w-7xl mx-auto px-4 pt-4 z-10">

        <div class="flex-none grid grid-cols-[1fr_auto_1fr] items-center bg-black/30 backdrop-blur-md rounded-2xl p-3 border border-white/10 mb-4 shadow-lg shrink-0 gap-4">
            <!-- Left: Round & Letter -->
            <div class="flex items-center gap-4 justify-self-start">
                <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-3 text-white text-center shadow-lg border border-white/20 min-w-[80px]">
                    <p class="text-[10px] uppercase font-bold tracking-widest text-indigo-200">Ronda</p>
                    <p class="text-2xl font-black leading-none">{{ gameState.roundsPlayed + 1 }}<span class="text-xs opacity-50">/{{ gameState.config?.totalRounds || 5 }}</span></p>
                </div>
                
                <div class="flex flex-col">
                    <p class="text-xs text-purple-200 uppercase tracking-wider font-bold mb-0.5">Letra Actual</p>
                    <div class="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 drop-shadow-[0_2px_10px_rgba(234,179,8,0.5)] leading-none">
                        {{ gameState.currentLetter }}
                    </div>
                </div>
            </div>

            <!-- Center: Status Actions (Timer) -->
             <div class="flex flex-col items-center justify-self-center">
                 <!-- Timer Display -->
                 <div v-if="timeRemaining !== null" class="text-center">
                     <p :class="['text-4xl md:text-5xl font-black tabular-nums drop-shadow-md leading-none', timerColor]">
                         {{ timeRemaining }}<span class="text-lg font-bold opacity-50">s</span>
                     </p>
                 </div>
                 <p v-if="gameState.status === 'PLAYING'" class="text-gray-400 text-xs mt-1 animate-pulse">¡Corre!</p>
                 <p v-else-if="gameState.status === 'REVIEW'" class="text-yellow-400 text-sm font-bold animate-bounce mt-1">VOTACIÓN</p>
                 <p v-else-if="gameState.status === 'RESULTS'" class="text-green-400 text-sm font-bold mt-1">RESULTADOS</p>
            </div>

            <!-- Right: Exit Button -->
            <div class="justify-self-end">
                <button 
                    @click="showExitModal = true" 
                    class="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white flex items-center justify-center transition-all"
                    title="Salir de la partida"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"></path></svg>
                </button>
            </div>

        </div>
        </div>

        <!-- BODY (Scrollable Content) -->
        <!-- BODY (Scrollable Content) -->
        <div class="flex-1 overflow-y-auto scroll-smooth w-full px-4 py-6">
            <div class="w-full max-w-7xl mx-auto">
                
                <!-- === PLAYING STATE === -->
                <div v-if="gameState.status === 'PLAYING'" class="flex flex-col gap-6">
                    
                    <!-- RIVALS HUD -->
                    <div v-if="rivalsActivity.length > 0" class="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        <div 
                            v-for="rival in rivalsActivity" 
                            :key="rival.id"
                            class="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border transition-all duration-300 min-w-max"
                            :class="[
                                rival.isFinished ? 'border-green-500/50 bg-green-500/10' : 
                                rival.isActive ? 'border-purple-500/50' : 'border-white/10 opacity-60'
                            ]"
                        >
                            <div class="relative">
                                <span class="text-xl" :class="{ 'animate-pulse': rival.isActive }">{{ rival.avatar || '👤' }}</span>
                                <div v-if="rival.isFinished" class="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-3 h-3 border border-black"></div>
                            </div>
                            <div class="flex flex-col leading-none">
                                <span class="text-[10px] uppercase font-bold text-white/50 max-w-[60px] truncate">{{ rival.name }}</span>
                                <span class="font-mono text-sm font-bold" :class="rival.isFinished ? 'text-green-400' : 'text-white'">
                                    {{ rival.filledCount }}<span class="text-white/40 text-[10px]">/{{ rival.totalCategories }}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div 
                            v-for="category in gameState.categories" 
                            :key="category"
                            class="relative group transition-all duration-300 transform hover:-translate-y-1"
                        >
                            <!-- Glow Effect -->
                             <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             
                             <!-- Card -->
                             <div class="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 transition-all duration-300"
                                  :class="{'border-green-400/40 bg-green-500/5 shadow-[0_0_20px_rgba(74,222,128,0.1)]': answers[category]?.trim().length > 0}"
                             >
                                <div class="flex justify-between items-center mb-2">
                                    <label class="text-[10px] uppercase font-black tracking-widest text-indigo-300 pl-1">{{ category }}</label>
                                    <!-- Success Icon -->
                                    <div v-if="answers[category]?.trim().length > 0" class="text-green-400 bg-green-400/10 rounded-full p-1 animate-in fade-in zoom-in duration-300">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                </div>

                                <input 
                                    :value="answers[category]"
                                    @input="handleInput(category, $event)"
                                    @focus="handleInputFocus"
                                    type="text"
                                    autocomplete="off"
                                    class="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-white/15 text-lg font-bold tracking-wide focus:outline-none focus:bg-black/40 focus:border-purple-500/50 transition-all font-mono shadow-inner"
                                    :placeholder="`${gameState.currentLetter}...`"
                                >
                             </div>
                        </div>
                    </div> <!-- End Grid -->
                </div> <!-- End Playing Wrapper -->

                <!-- === REVIEW STATE (VOTING MOCKUP) === -->
                <div v-else-if="gameState.status === 'REVIEW'" class="relative flex flex-col items-center bg-[#491B8F] rounded-2xl p-4 min-h-full">
                    
                    <!-- STOP ALERT OVERLAY -->
                    <div v-if="showStopAlert && stopperPlayer" class="absolute inset-0 z-50 flex items-center justify-center bg-red-600/90 backdrop-blur-md rounded-2xl animate-in fade-in zoom-in duration-300">
                        <div class="text-center p-6 animate-bounce">
                            <div class="text-8xl mb-4 drop-shadow-xl">{{ stopperPlayer?.avatar || '🛑' }}</div>
                            <h2 class="text-4xl font-black text-white uppercase tracking-tighter drop-shadow-md">
                                ¡BASTA!
                            </h2>
                            <p class="text-white/90 text-xl font-bold mt-2 bg-black/20 px-4 py-1 rounded-full inline-block">
                                por {{ stopperPlayer?.name }}
                            </p>
                        </div>
                    </div>

                    <!-- CAROUSEL CONTENT (Hidden behind overlay if active) -->
                    <div class="w-full flex flex-col items-center transition-opacity duration-300 pl-4 pr-4" :class="{ 'opacity-0': showStopAlert }">
                    
                    <!-- Title Section -->
                    <h2 class="text-3xl font-bold text-white mb-1 tracking-tight">Votación</h2>
                    <h3 class="text-xl font-bold text-white mb-6">Categoría: <span class="text-white">{{ currentCategory }}</span></h3>
                    
                    <div class="flex items-center gap-4 mb-4">
                        <button @click="prevCategory" :disabled="activeCategoryIndex === 0" class="text-white/50 hover:text-white disabled:opacity-0 transition-colors p-2">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div class="text-xs text-white/30 font-mono">{{ activeCategoryIndex + 1 }}/{{ gameState.categories.length }}</div>
                        <button @click="nextCategory" :disabled="activeCategoryIndex === gameState.categories.length - 1" class="text-white/50 hover:text-white disabled:opacity-0 transition-colors p-2">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>

                    <!-- Main Container -->
                    <div class="w-full max-w-lg bg-[#7C4DFF]/20 backdrop-blur-sm rounded-2xl overflow-hidden mb-6 shadow-xl border border-white/5">
                        
                        <!-- Table Header -->
                        <div class="grid grid-cols-[1.5fr_1.5fr_auto] px-4 py-3 bg-white/5 border-b border-white/10">
                            <span class="text-white/70 font-bold text-xs tracking-wider uppercase">NOMBRE</span>
                            <span class="text-white/70 font-bold text-xs tracking-wider uppercase">PALABRA</span>
                            <span class="w-12"></span>
                        </div>

                                <!-- Rows -->
                        <div class="divide-y divide-white/10">
                            <div v-for="player in gameState.players" :key="player.id" class="grid grid-cols-[1.5fr_1.5fr_auto] px-4 py-3 items-center transition-colors duration-300"
                                :class="{
                                    'bg-green-500/10 border-l-4 border-l-green-500': getReviewItem(player.id).state === 'VALID',
                                    'bg-yellow-500/10 border-l-4 border-l-yellow-500': getReviewItem(player.id).state === 'DUPLICATE',
                                    'bg-orange-500/10 border-l-4 border-l-orange-500 animate-pulse': getReviewItem(player.id).state === 'CONTESTED',
                                    'bg-red-500/10 border-l-4 border-l-red-500': getReviewItem(player.id).state === 'REJECTED',
                                    'opacity-50': getReviewItem(player.id).state === 'EMPTY'
                                }"
                            >
                                <div class="flex items-center gap-2 overflow-hidden">
                                    <div class="w-10 h-10 rounded-full shrink-0 flex items-center justify-center border border-white/20 shadow-inner"
                                         :class="[
                                             player.id === myUserId ? 'bg-pink-400' : 
                                             player.name.length % 2 === 0 ? 'bg-green-400' : 'bg-orange-400'
                                         ]"
                                    >
                                        <span class="text-white font-bold text-2xl shadow-sm">{{ player.avatar || '👤' }}</span>
                                    </div>
                                    <span class="text-white font-bold text-sm truncate">{{ player.name }}</span>
                                </div>

                                <div class="flex items-center gap-2 px-2 overflow-hidden">
                                    <span class="text-white font-bold text-base truncate"
                                          :class="{'line-through text-white/50Decoration-red-500 decoration-2': getReviewItem(player.id).state === 'REJECTED'}"
                                    >
                                         {{ getReviewItem(player.id).answer || '-' }}
                                    </span>
                                    
                                    <!-- LIVE SCORE BADGE -->
                                    <div class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ml-auto shrink-0"
                                         :class="{
                                             'bg-green-400 text-green-900': getReviewItem(player.id).state === 'VALID',
                                             'bg-yellow-400 text-yellow-900': getReviewItem(player.id).state === 'DUPLICATE',
                                             'bg-orange-400 text-orange-900': getReviewItem(player.id).state === 'CONTESTED',
                                             'bg-red-500 text-white': getReviewItem(player.id).state === 'REJECTED'
                                         }"
                                    >
                                        {{ getReviewItem(player.id).score }}pts
                                    </div>
                                </div>

                                <div class="flex justify-end items-center gap-3">
                                    <!-- VOTE COUNTER (Only show if votes exists) -->
                                    <span v-if="getReviewItem(player.id).voteCount > 0" class="text-xs font-black animate-in fade-in zoom-in mr-2"
                                        :class="getReviewItem(player.id).state === 'REJECTED' ? 'text-red-500' : 'text-orange-400'"
                                    >
                                        {{ getReviewItem(player.id).state === 'REJECTED' ? '🚫' : '⚠️' }} 
                                        {{ getReviewItem(player.id).voteCount }}/{{ getReviewItem(player.id).votesNeeded }}
                                    </span>

                                    <div v-if="player.id === myUserId" class="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center opacity-30 cursor-not-allowed">
                                        🔒
                                    </div>
                                    <!-- 1VS1 READ ONLY MODE -->
                                    <div v-else-if="gameState.players.filter(p => p.isConnected).length === 2" class="w-10 h-10 flex items-center justify-center" title="Validado por IA">
                                        🤖
                                    </div>
                                    <button 
                                        v-else 
                                        @click="toggleVote(player.id, currentCategory)"
                                        class="w-10 h-10 rounded-full transition-all duration-200 flex items-center justify-center hover:scale-110 active:scale-95 shadow-lg border-2"
                                        :class="gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) 
                                            ? 'bg-red-500 border-red-400 text-white shadow-red-500/50' 
                                            : 'bg-white/5 border-white/20 text-white/30 hover:bg-red-500/20 hover:border-red-400/50 hover:text-red-300'"
                                    >
                                        <span class="text-xl">👎</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div> <!-- End of content wrapper -->
                </div>

                <!-- === RESULTS STATE === -->
                <div v-else-if="gameState.status === 'RESULTS'" class="max-w-3xl mx-auto bg-black/40 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-white/10 flex flex-col items-center">
                    <h2 class="text-3xl font-black text-white mb-4 drop-shadow-md">Resultados Ronda {{ gameState.roundsPlayed + 1 }}</h2>
                     <div class="w-full space-y-3">
                         <div v-for="player in gameState.players" :key="player.id" class="bg-white/5 rounded-xl p-3 flex items-center justify-between border border-white/5">
                             <div class="flex items-center gap-3">
                                 <div class="text-2xl font-bold text-yellow-400 w-8 text-center">{{ player.score }}</div>
                                 <div class="w-px h-8 bg-white/10"></div>
                                 <div class="text-2xl">{{ player.avatar || '👤' }}</div>
                                 <span class="text-white font-bold text-lg">{{ player.name }}</span>
                             </div>
                             <span v-if="player.isHost" class="text-xs uppercase bg-purple-500 text-white px-2 py-1 rounded">Host</span>
                         </div>
                     </div>
                </div>
            </div>
        </div>

        <!-- FOOTER / ACTIONS (Static & Solid) -->
        <div class="flex-none w-full p-4 bg-white/5 backdrop-blur-md border-t border-white/10 z-10 flex justify-center">
            
            <!-- PLAYING: BASTA BUTTON -->
            <button 
                v-if="gameState.status === 'PLAYING'"
                @click="handleStop"
                class="pointer-events-auto relative group overflow-hidden bg-gradient-to-r from-pink-600 to-orange-500 text-white font-black text-2xl py-5 px-16 rounded-full shadow-[0_10px_40px_rgba(236,72,153,0.4)] border-4 border-white/10 uppercase tracking-widest transform transition-all duration-500 flex items-center gap-4 hover:scale-105 active:scale-95 hover:shadow-[0_20px_60px_rgba(236,72,153,0.6)] hover:border-white/30 mx-4"
                :class="[
                    canStopRound ? 'animate-pulse ring-4 ring-pink-500/30' : 'opacity-50 grayscale cursor-not-allowed shadow-none transform-none'
                ]"
            >
                <span class="text-3xl filter drop-shadow-md group-hover:rotate-12 transition-transform duration-300">✋</span>
                <span class="drop-shadow-md">¡BASTA!</span>
                
                <!-- Shine Effect -->
                <div v-if="canStopRound" class="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
            </button>

            <!-- REVIEW ACTIONS -->
            <div v-if="gameState.status === 'REVIEW'" class="w-full max-w-lg pointer-events-auto px-4"> 
                <button 
                    v-if="activeCategoryIndex < gameState.categories.length - 1"
                    @click="nextCategory"
                    class="w-full py-4 bg-white text-[#491B8F] font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] active:scale-95 transition-all text-xl"
                >
                    Siguiente Categoría
                </button>
                <button 
                    v-else
                    @click="handleConfirmVotes"
                    class="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl shadow-[0_10px_30px_rgba(34,197,94,0.4)] active:scale-95 transition-all text-xl"
                    :disabled="hasConfirmed"
                >
                    {{ hasConfirmed ? 'Esperando...' : 'Confirmar Votos ✅' }}
                </button>
            </div>

            <!-- RESULTS ACTIONS -->
            <div v-else-if="gameState.status === 'RESULTS'" class="w-full max-w-md pointer-events-auto px-4">
                <button 
                    v-if="amIHost"
                    @click="startGame"
                    class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xl rounded-xl transition-all shadow-[0_10px_30px_rgba(79,70,229,0.4)] active:scale-95 flex items-center justify-center gap-3"
                >
                    Siguiente Ronda ➡️
                </button>
                <div v-else class="text-white/70 font-bold bg-black/40 backdrop-blur-md px-6 py-3 rounded-full text-center border border-white/10">
                    Esperando al anfitrión... ⏳
                </div>
            </div>
        </div>

        <!-- EXIT MODAL -->
        <div v-if="showExitModal" class="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div class="bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-white/10 transform scale-100">
                <h3 class="text-2xl font-black text-white mb-2">¿Abandonar Partida?</h3>
                <p class="text-gray-300 mb-6 font-medium">Perderás tu progreso y otros jugadores podrían verse afectados.</p>
                <div class="flex gap-3">
                    <button @click="showExitModal = false" class="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-bold transition-all">
                        Cancelar
                    </button>
                    <button @click="handleExit" class="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all">
                        Abandonar
                    </button>
                </div>
            </div>
        </div>

        <!-- TOASTS CONTAINER -->
        <div class="absolute top-2 right-16 flex flex-col items-end gap-2 pointer-events-none z-50">
            <TransitionGroup name="toast">
                <div 
                    v-for="toast in sessionToasts" 
                    :key="toast.id" 
                    class="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg border text-xs font-bold pointer-events-auto select-none"
                    :class="toast.type === 'join' ? 'bg-green-500/20 text-green-200 border-green-500/30' : 'bg-red-500/20 text-red-200 border-red-500/30'"
                >
                    <span>{{ toast.type === 'join' ? '➕' : '➖' }}</span>
                    <span>{{ toast.text }}</span>
                </div>
            </TransitionGroup>
        </div>
    </div>
</template>

