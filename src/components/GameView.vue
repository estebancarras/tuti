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
    if (timeRemaining.value === null) return 'text-white/20';
    if (timeRemaining.value <= 10) return 'text-red-500 animate-pulse';
    return 'text-yellow-400';
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
    <div class="h-[100dvh] w-full flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900 via-indigo-950 to-black text-slate-100 overflow-hidden font-sans">
        
        <!-- === CONNECTION STATUS (Floating) === -->
         <div v-if="!gameState.players.find(p => p.id === myUserId)?.isConnected" class="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg animate-pulse pointer-events-none">
            ⚠️ Conexión Perdida
        </div>

        <!-- === A. HEADER (Fixed HUD) === -->
        <div class="flex-none h-16 bg-indigo-950/20 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-40 relative">
            
            <!-- Left: Exit & Round -->
            <div class="flex items-center gap-4">
                <!-- Exit Button -->
                <button @click="showExitModal = true" class="text-white/60 hover:text-white transition-colors p-1" title="Salir">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                    </svg>
                </button>

                <div class="flex flex-col">
                    <span class="text-[10px] uppercase font-bold text-indigo-300 tracking-widest">Ronda</span>
                    <span class="text-xl font-black text-yellow-400 leading-none">
                        {{ gameState.roundsPlayed + 1 }}<span class="text-xs text-white/40 ml-0.5">/{{ gameState.config?.totalRounds || 5 }}</span>
                    </span>
                </div>
            </div>

            <!-- Center: THE BADGE (Current Letter) -->
            <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div class="relative group">
                    <div class="absolute inset-0 bg-fuchsia-500 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <div class="relative bg-gradient-to-br from-indigo-600 to-violet-700 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 transform transition-transform group-hover:scale-105">
                        <span class="text-4xl font-black text-white drop-shadow-md">{{ gameState.currentLetter }}</span>
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
                
                <!-- THE ELECTRIC BOARD -->
                <div class="bg-indigo-900/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)] overflow-hidden relative transition-all">
                    
                    <!-- Board Header / Decoration -->
                    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-fuchsia-500 via-yellow-400 to-fuchsia-500 opacity-70"></div>

                    <!-- Rivals HUD (Numeric Badges) -->
                     <div v-if="gameState.status === 'PLAYING' && rivalsActivity.length > 0" class="bg-black/30 border-b border-white/5 px-4 py-3 flex items-center justify-center gap-4 overflow-x-auto scrollbar-hide">
                         <div v-for="rival in rivalsActivity" :key="rival.id" 
                              class="flex items-center gap-2 opacity-90 transition-opacity"
                              :title="rival.name"
                        >
                            <div class="relative">
                                <span class="text-2xl filter drop-shadow">{{ rival.avatar || '👤' }}</span>
                                <div v-if="rival.isFinished" class="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-black"></div>
                            </div>
                            <!-- Yellow Badge -->
                            <div class="bg-indigo-600/50 px-2 py-0.5 rounded-md border border-white/10 text-yellow-400 font-mono text-xs font-bold shadow-sm">
                                {{ rival.filledCount }}/{{ rival.totalCategories }}
                            </div>
                         </div>
                     </div>

                    <!-- Content Area -->
                    <div class="p-5 md:p-8">
                        
                        <!-- PLAYING: Inputs Grid -->
                        <div v-if="gameState.status === 'PLAYING'" class="grid gap-4" :class="boardConfig.gridCols">
                            <div v-for="category in gameState.categories" :key="category" class="group">
                                <label class="block font-bold text-indigo-200 mb-1.5 transition-colors group-focus-within:text-yellow-400 truncate tracking-wide"
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
                                        class="w-full bg-black/20 border-b-2 border-white/10 text-white rounded-t-lg focus:bg-black/40 focus:border-yellow-400 focus:shadow-[0_4px_15px_-5px_rgba(250,204,21,0.4)] outline-none transition-all placeholder-white/10 font-medium"
                                        :class="boardConfig.inputSize"
                                        :placeholder="gameState.currentLetter + '...'"
                                    >
                                    <!-- Status Dot (Subtle) -->
                                    <div v-if="answers[category]?.trim().length > 0" class="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] pointer-events-none"></div>
                                </div>
                            </div>
                        </div>

                        <!-- REVIEW/RESULTS: View Mode -->
                        <div v-else class="flex flex-col gap-6">
                            
                            <!-- Stop Alert -->
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
                                 <div class="bg-black/20 rounded-2xl p-6 border border-white/5">
                                    <h2 class="text-3xl font-black text-white mb-6 drop-shadow-md">{{ currentCategory }}</h2>
                                    
                                     <!-- Player List -->
                                    <div class="space-y-3">
                                        <div v-for="player in gameState.players" :key="player.id" 
                                             class="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                                        >
                                            <div class="flex items-center gap-3 overflow-hidden">
                                                <span class="text-2xl">{{ player.avatar || '👤' }}</span>
                                                <div class="text-left overflow-hidden">
                                                    <div class="text-[10px] font-bold text-white/30 uppercase">{{ player.name }}</div>
                                                    <div class="font-medium text-lg text-white truncate group-hover:text-yellow-300 transition-colors"
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
                                                class="px-4 py-2 rounded-lg border text-xs font-bold transition-all uppercase tracking-wider"
                                                :class="gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) 
                                                    ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' 
                                                    : 'bg-transparent border-white/10 text-white/40 hover:text-white hover:bg-white/10'"
                                            >
                                                {{ gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) ? '👎 NO' : 'SI' }}
                                            </button>
                                            <div v-else class="text-xl">
                                                <span v-if="getReviewItem(player.id).state === 'VALID'">✅</span>
                                                <span v-else-if="getReviewItem(player.id).state === 'REJECTED'">❌</span>
                                                <span v-else-if="getReviewItem(player.id).state === 'DUPLICATE'">⚠️</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Nav -->
                                    <div class="flex justify-center gap-6 mt-6 pt-4 border-t border-white/5">
                                        <button @click="prevCategory" :disabled="activeCategoryIndex === 0" class="p-3 bg-white/5 rounded-full disabled:opacity-20 hover:bg-white/10 transition-colors">⬅️</button>
                                        <span class="font-mono text-xl self-center text-yellow-400 font-bold">{{ activeCategoryIndex + 1 }} / {{ gameState.categories.length }}</span>
                                        <button @click="nextCategory" :disabled="activeCategoryIndex === gameState.categories.length - 1" class="p-3 bg-white/5 rounded-full disabled:opacity-20 hover:bg-white/10 transition-colors">➡️</button>
                                    </div>
                                 </div>
                            </div>

                            <!-- RESULTS -->
                            <div v-if="gameState.status === 'RESULTS'">
                                <!-- Ranking List -->
                                <div class="mb-6">
                                    <h3 class="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2 px-1">Posiciones Finales</h3>
                                    <div class="space-y-2">
                                        <div v-for="(player, idx) in [...gameState.players].sort((a,b) => b.score - a.score)" :key="player.id"
                                             class="flex items-center justify-between p-4 rounded-2xl bg-black/30 border border-white/5"
                                        >
                                            <div class="flex items-center gap-4">
                                                <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs" :class="idx === 0 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/50'">{{ idx + 1 }}</div>
                                                <span class="text-2xl">{{ player.avatar }}</span>
                                                <span class="font-bold text-lg text-white">{{ player.name }}</span>
                                            </div>
                                            <span class="font-black text-2xl" :class="idx === 0 ? 'text-yellow-400' : 'text-indigo-300'">{{ player.score }}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- My Grid -->
                                 <h3 class="text-xs font-bold text-white/30 uppercase tracking-widest mb-2 px-1">Tu Desempeño</h3>
                                <div class="grid grid-cols-2 gap-2">
                                     <div v-for="category in gameState.categories" :key="category" 
                                          class="bg-black/20 border-b-2 rounded-t-lg p-2"
                                          :class="{
                                              'border-green-500': answers[category] && getPlayerStatus(myUserId, category).state === 'VALID',
                                              'border-red-500': getPlayerStatus(myUserId, category).state === 'REJECTED',
                                              'border-white/10': !answers[category] || getPlayerStatus(myUserId, category).state === 'EMPTY'
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
        <div class="flex-none bg-gradient-to-t from-black via-indigo-950/90 to-transparent p-4 pb-8 pt-12 -mt-8 z-30 pointer-events-none">
            <div class="w-full max-w-4xl mx-auto flex items-center justify-between gap-4 pointer-events-auto">
                
                <!-- My Progress (Left) -->
                 <div class="hidden md:flex flex-col w-20">
                     <span class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Progreso</span>
                     <span class="text-2xl font-mono font-bold text-yellow-400 leading-none">
                         {{ Object.values(answers).filter(v => v?.trim()).length }}<span class="text-base text-white/20">/{{ gameState.categories.length }}</span>
                     </span>
                 </div>

                <!-- STOP BUTTON (Center) -->
                <button 
                    v-if="gameState.status === 'PLAYING'"
                    @click="handleStop"
                    class="flex-1 max-w-sm bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black text-xl py-4 rounded-2xl shadow-[0_0_30px_rgba(236,72,153,0.4)] transition-all active:scale-[0.98] flex items-center justify-center gap-3 border border-white/20"
                    :class="{'opacity-50 saturate-0 cursor-not-allowed': !canStopRound && !validationCooldown, 'animate-shake': validationCooldown}"
                >
                    <span class="text-2xl drop-shadow-md">✋</span>
                    <span class="tracking-widest drop-shadow-md">BASTA</span>
                </button>

                 <!-- CONFIRM -->
                <button 
                    v-if="gameState.status === 'REVIEW'"
                    @click="handleConfirmVotes"
                    class="flex-1 max-w-sm bg-green-600 hover:bg-green-500 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] mx-auto"
                    :disabled="hasConfirmed"
                >
                    {{ hasConfirmed ? 'Enviado ✅' : 'Confirmar Votos' }}
                </button>

                 <!-- NEXT -->
                <button 
                    v-if="gameState.status === 'RESULTS' && amIHost"
                    @click="startGame"
                    class="flex-1 max-w-sm bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] mx-auto"
                >
                    Siguiente Ronda ➡️
                </button>
                 <div v-else-if="gameState.status === 'RESULTS'" class="w-full text-center text-white/40 text-sm font-bold animate-pulse py-4">
                    Esperando al anfitrión...
                </div>

                <!-- Spacer (Right) -->
                 <div class="hidden md:block w-20"></div>
            </div>
        </div>

        <!-- TOASTS (Top Right) -->
        <div class="fixed top-20 right-4 z-[60] flex flex-col items-end gap-2 pointer-events-none">
            <TransitionGroup name="toast">
                <div v-for="toast in sessionToasts" :key="toast.id" 
                     class="px-4 py-3 rounded-xl backdrop-blur-md border text-sm font-bold shadow-xl pointer-events-auto"
                     :class="toast.type === 'stop-warning' ? 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30' : 'bg-slate-900/80 text-white border-white/10'"
                >
                    {{ toast.text }}
                </div>
            </TransitionGroup>
        </div>

        <!-- EXIT MODAL -->
        <div v-if="showExitModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
             <div class="bg-indigo-950 border border-white/10 rounded-3xl p-6 shadow-2xl max-w-xs w-full text-center">
                 <h3 class="text-white font-black text-xl mb-6">¿Salir de la partida?</h3>
                 <div class="flex gap-4">
                     <button @click="showExitModal = false" class="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors">Cancelar</button>
                     <button @click="handleExit" class="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 shadow-lg transition-colors">Salir</button>
                 </div>
             </div>
        </div>

    </div>
</template>

