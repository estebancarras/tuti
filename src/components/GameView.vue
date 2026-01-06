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
        addToast("⚠️ Completa todas las categorías para parar", 'stop-warning', 'stop-validation'); 
        
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
    type: 'join' | 'leave' | 'stop-warning';
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

const addToast = (text: string, type: 'join' | 'leave' | 'stop-warning', uniqueGroupId?: string) => {
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

// --- SMART BOARD ENGINE (Responsive Logic) ---
const boardConfig = computed(() => {
    const count = gameState.value.categories.length;

    if (count <= 5) {
        // MODE FOCUS: Single column, focused, taller inputs
        return {
            containerMaxWidth: "max-w-md",
            gridCols: "grid-cols-1",
            inputSize: "py-3 px-3 text-2xl h-14",
            labelSize: "text-sm"
        };
    } else {
        // MODE DENSE: Two columns, compact
        return {
            containerMaxWidth: "max-w-4xl",
            gridCols: "grid-cols-2",
            inputSize: "py-2 px-3 text-lg h-12",
            labelSize: "text-xs"
        };
    }
});

</script>

<template>
    <div class="h-[100dvh] w-full flex flex-col bg-gradient-to-b from-slate-900 to-indigo-950 text-slate-100 overflow-hidden font-sans">
        
        <!-- === CONNECTION STATUS (Floating) === -->
         <div v-if="!gameState.players.find(p => p.id === myUserId)?.isConnected" class="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg animate-pulse pointer-events-none">
            ⚠️ Conexión Perdida
        </div>

        <!-- === A. HEADER (Fixed HUD) === -->
        <div class="flex-none h-16 bg-slate-900/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-40 relative">
            
            <!-- Left: Round info -->
            <div class="flex flex-col">
                <span class="text-[10px] uppercase font-bold text-indigo-300 tracking-widest">Ronda</span>
                <span class="text-xl font-black text-white leading-none">
                    {{ gameState.roundsPlayed + 1 }}<span class="text-xs text-white/40 ml-0.5">/{{ gameState.config?.totalRounds || 5 }}</span>
                </span>
            </div>

            <!-- Center: THE BADGE (Current Letter) -->
            <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div class="relative group">
                    <div class="absolute inset-0 bg-indigo-500 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <div class="relative bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border border-indigo-400/50 transform transition-transform group-hover:scale-105">
                        <span class="text-3xl font-black text-white drop-shadow-md">{{ gameState.currentLetter }}</span>
                    </div>
                </div>
            </div>

            <!-- Right: Timer -->
            <div class="flex flex-col items-end w-[60px]">
                <span v-if="timeRemaining !== null" 
                      class="font-mono text-xl font-bold leading-none tabular-nums"
                      :class="timerColor"
                 >
                    {{ timeRemaining }}
                </span>
                <span v-else class="text-xl font-bold text-white/20">--</span>
            </div>
        </div>

        <!-- === B. MAIN STAGE (The Board) === -->
        <div class="flex-1 overflow-y-auto flex items-center justify-center p-4 relative w-full scroll-smooth">
            
            <div class="w-full transition-all duration-500 ease-out" :class="boardConfig.containerMaxWidth">
                
                <!-- THE SMART BOARD -->
                <div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative">
                    
                    <!-- Board Header / Decoration -->
                    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-50"></div>

                    <!-- Rivals HUD (Integrated into Board Top) -->
                     <div v-if="gameState.status === 'PLAYING' && rivalsActivity.length > 0" class="bg-black/20 border-b border-white/5 px-4 py-2 flex items-center justify-center gap-3 overflow-x-auto scrollbar-hide">
                         <div v-for="rival in rivalsActivity" :key="rival.id" 
                              class="flex items-center gap-2 opacity-80"
                              :title="rival.name"
                        >
                            <div class="relative">
                                <span class="text-lg">{{ rival.avatar || '👤' }}</span>
                                <div v-if="rival.isFinished" class="absolute -bottom-1 -right-1 bg-green-500 w-2.5 h-2.5 rounded-full border border-black"></div>
                            </div>
                            <!-- Tiny Progress Bar -->
                            <div class="w-8 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                                <div class="h-full bg-green-400 transition-all duration-300" :style="{ width: `${(rival.filledCount / rival.totalCategories) * 100}%` }"></div>
                            </div>
                         </div>
                     </div>

                    <!-- Content Area -->
                    <div class="p-4 md:p-6">
                        
                        <!-- PLAYING: Inputs Grid -->
                        <div v-if="gameState.status === 'PLAYING'" class="grid gap-4" :class="boardConfig.gridCols">
                            <div v-for="category in gameState.categories" :key="category" class="group">
                                <label class="block font-bold text-indigo-200 mb-1.5 transition-colors group-focus-within:text-white truncate"
                                       :class="boardConfig.labelSize"
                                >
                                    {{ category }}
                                </label>
                                <div class="relative">
                                    <input 
                                        :value="answers[category]"
                                        @input="handleInput(category, $event)"
                                        @focus="handleInputFocus"
                                        @keydown.enter.prevent
                                        type="text"
                                        autocomplete="off"
                                        class="w-full bg-black/20 border border-white/5 text-white rounded-lg focus:bg-black/30 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-white/10"
                                        :class="boardConfig.inputSize"
                                        :placeholder="gameState.currentLetter + '...'"
                                    >
                                    <!-- Status Dot -->
                                    <div v-if="answers[category]?.trim().length > 0" class="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] pointer-events-none"></div>
                                </div>
                            </div>
                        </div>

                        <!-- REVIEW/RESULTS: View Mode -->
                        <div v-else class="flex flex-col gap-6">
                            
                            <!-- Stop Alert (Inside Board context for cleanliness) -->
                            <div v-if="showStopAlert && stopperPlayer" class="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top duration-300">
                                <div class="text-4xl animate-bounce">{{ stopperPlayer.avatar || '🛑' }}</div>
                                <div>
                                    <h3 class="font-black text-red-100 text-xl uppercase italic">¡BASTA!</h3>
                                    <p class="text-red-200/60 text-xs font-bold uppercase tracking-wider">Detenido por {{ stopperPlayer.name }}</p>
                                </div>
                            </div>

                            <!-- REVIEW -->
                            <div v-if="gameState.status === 'REVIEW'" class="text-center">
                                 <h3 class="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4">Revisión en Progreso</h3>
                                 <div class="bg-black/20 rounded-xl p-6 border border-white/5">
                                    <h2 class="text-2xl font-black text-white mb-6">{{ currentCategory }}</h2>
                                    
                                     <!-- Player List (Vertical Stack) -->
                                    <div class="space-y-2">
                                        <div v-for="player in gameState.players" :key="player.id" 
                                             class="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                                        >
                                            <div class="flex items-center gap-3 overflow-hidden">
                                                <span class="text-xl">{{ player.avatar || '👤' }}</span>
                                                <div class="text-left overflow-hidden">
                                                    <div class="text-[10px] font-bold text-white/30 uppercase">{{ player.name }}</div>
                                                    <div class="font-medium text-white truncate group-hover:text-indigo-200 transition-colors"
                                                         :class="{'line-through opacity-50': getReviewItem(player.id).state === 'REJECTED'}"
                                                    >
                                                        {{ getReviewItem(player.id).answer || '-' }}
                                                    </div>
                                                </div>
                                            </div>

                                             <!-- Vote Toggle -->
                                            <button 
                                                v-if="player.id !== myUserId && gameState.players.length > 2"
                                                @click="toggleVote(player.id, currentCategory)"
                                                class="px-3 py-1.5 rounded-md border text-xs font-bold transition-all"
                                                :class="gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) 
                                                    ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' 
                                                    : 'bg-transparent border-white/10 text-white/40 hover:text-white hover:border-white/30'"
                                            >
                                                {{ gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) ? '👎 Rechazado' : 'Aceptar' }}
                                            </button>
                                            <!-- Status Icon (1v1 / AI) -->
                                            <div v-else class="text-lg">
                                                <span v-if="getReviewItem(player.id).state === 'VALID'">✅</span>
                                                <span v-else-if="getReviewItem(player.id).state === 'REJECTED'">❌</span>
                                                <span v-else-if="getReviewItem(player.id).state === 'DUPLICATE'">⚠️</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Nav -->
                                    <div class="flex justify-center gap-4 mt-6 pt-4 border-t border-white/5">
                                        <button @click="prevCategory" :disabled="activeCategoryIndex === 0" class="p-2 bg-white/5 rounded-full disabled:opacity-20 hover:bg-white/10 transition-colors">⬅️</button>
                                        <span class="font-mono text-sm self-center text-white/50">{{ activeCategoryIndex + 1 }} / {{ gameState.categories.length }}</span>
                                        <button @click="nextCategory" :disabled="activeCategoryIndex === gameState.categories.length - 1" class="p-2 bg-white/5 rounded-full disabled:opacity-20 hover:bg-white/10 transition-colors">➡️</button>
                                    </div>
                                 </div>
                            </div>

                            <!-- RESULTS -->
                            <div v-if="gameState.status === 'RESULTS'">
                                <!-- Ranking List -->
                                <div class="mb-6">
                                    <h3 class="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2 px-1">Posiciones</h3>
                                    <div class="space-y-1">
                                        <div v-for="(player, idx) in [...gameState.players].sort((a,b) => b.score - a.score)" :key="player.id"
                                             class="flex items-center justify-between p-2 rounded bg-black/20"
                                        >
                                            <div class="flex items-center gap-3">
                                                <span class="font-mono text-white/30 text-xs w-4">{{ idx + 1 }}</span>
                                                <span>{{ player.avatar }}</span>
                                                <span class="font-bold text-sm text-white">{{ player.name }}</span>
                                            </div>
                                            <span class="font-black text-indigo-400">{{ player.score }} pts</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- My Grid -->
                                 <h3 class="text-xs font-bold text-white/30 uppercase tracking-widest mb-2 px-1">Tu Tablero</h3>
                                <div class="grid grid-cols-2 gap-2">
                                     <div v-for="category in gameState.categories" :key="category" 
                                          class="bg-black/20 border border-white/5 rounded p-2"
                                          :class="{
                                              'border-l-2 border-l-green-500': answers[category] && getPlayerStatus(myUserId).state === 'VALID',
                                              'border-l-2 border-l-red-500': getPlayerStatus(myUserId).state === 'REJECTED'
                                          }"
                                     >
                                        <div class="text-[9px] uppercase font-bold text-white/30 mb-0.5 truncate">{{ category }}</div>
                                        <div class="text-sm font-medium text-white truncate">{{ answers[category] || '-' }}</div>
                                     </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        </div>

        <!-- === C. FOOTER (Action Zone) === -->
        <div class="flex-none p-4 pb-6 pt-12 -mt-8 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent z-30 pointer-events-none flex justify-center">
            
            <div class="w-full max-w-md pointer-events-auto">
                <!-- STOP -->
                <button 
                    v-if="gameState.status === 'PLAYING'"
                    @click="handleStop"
                    class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl py-4 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    :class="{'opacity-50 saturate-0 cursor-not-allowed': !canStopRound && !validationCooldown, 'animate-shake': validationCooldown}"
                >
                    <span class="text-2xl">✋</span>
                    BASTA
                </button>

                 <!-- CONFIRM -->
                <button 
                    v-if="gameState.status === 'REVIEW'"
                    @click="handleConfirmVotes"
                    class="w-full bg-green-600 hover:bg-green-500 text-white font-black text-lg py-4 rounded-xl shadow-lg transition-all active:scale-[0.98]"
                    :disabled="hasConfirmed"
                >
                    {{ hasConfirmed ? 'Enviado ✅' : 'Confirmar Votos' }}
                </button>

                 <!-- NEXT -->
                <button 
                    v-if="gameState.status === 'RESULTS' && amIHost"
                    @click="startGame"
                    class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-4 rounded-xl shadow-lg transition-all active:scale-[0.98]"
                >
                    Siguiente Ronda ➡️
                </button>
                 <div v-else-if="gameState.status === 'RESULTS'" class="text-center text-white/40 text-sm font-bold animate-pulse py-4">
                    Esperando al anfitrión...
                </div>
            </div>

        </div>

        <!-- TOASTS (Top Right) -->
        <div class="fixed top-20 right-4 z-[60] flex flex-col items-end gap-2 pointer-events-none">
            <TransitionGroup name="toast">
                <div v-for="toast in sessionToasts" :key="toast.id" 
                     class="px-4 py-2 rounded-lg backdrop-blur-md border text-xs font-bold shadow-xl pointer-events-auto"
                     :class="toast.type === 'stop-warning' ? 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30' : 'bg-slate-900/80 text-white border-white/10'"
                >
                    {{ toast.text }}
                </div>
            </TransitionGroup>
        </div>

        <!-- EXIT MODAL -->
        <div v-if="showExitModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
             <div class="bg-slate-800 border border-white/10 rounded-2xl p-6 shadow-2xl max-w-xs w-full text-center">
                 <h3 class="text-white font-black text-xl mb-4">¿Salir de la partida?</h3>
                 <div class="flex gap-3">
                     <button @click="showExitModal = false" class="flex-1 py-2 rounded-lg bg-white/5 text-white font-bold hover:bg-white/10">Cancelar</button>
                     <button @click="handleExit" class="flex-1 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500">Salir</button>
                 </div>
             </div>
        </div>

    </div>
</template>

