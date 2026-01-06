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

// --- DYNAMIC DENSITY ENGINE (Project Immersive Cockpit) ---
// Calculates grid and input sizes based on category count
const gridConfig = computed(() => {
    const count = gameState.value.categories.length;

    // MODE FOCUS (1-3)
    if (count <= 3) {
        return {
            container: "max-w-xl mx-auto pt-10",
            grid: "grid-cols-1 gap-6",
            inputHeight: "h-20 text-3xl placeholder:text-white/20",
            label: "text-sm text-indigo-300 mb-2"
        };
    }
    // MODE BOARD (4-8) - Most common
    else if (count <= 8) {
        return {
            container: "max-w-5xl mx-auto",
            // Mobile: 1 col, Desktop: 2 cols
            grid: "grid-cols-1 md:grid-cols-2 gap-4",
            inputHeight: "h-14 text-xl",
            label: "text-xs text-indigo-300/80 mb-1"
        };
    }
    // MODE DATA (9+) - High Density
    else {
        return {
            container: "w-full max-w-7xl mx-auto",
            // Mobile: 2 cols, Tablet: 3, Desktop: 4
            grid: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3",
            inputHeight: "h-11 text-base",
            label: "text-[10px] uppercase tracking-wider opacity-60"
        };
    }
});

</script>

<template>
    <div class="h-[100dvh] w-full bg-gradient-to-b from-indigo-950 via-slate-900 to-black overflow-hidden relative">
        
        <!-- === LAYER 0: BACKGROUND & WATERMARK (Z-0) === -->
        <div class="fixed inset-0 z-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
            <!-- Giant Letter Watermark -->
            <div v-if="gameState.currentLetter" 
                 class="text-[40vh] font-black text-white/5 leading-none transform rotate-12 blur-sm"
            >
                {{ gameState.currentLetter }}
            </div>
        </div>

        <!-- === LAYER 1: INTERFACE (Z-10) === -->
        <div class="relative z-10 w-full h-full flex flex-col">
            
            <!-- Connection Status -->
            <div v-if="!gameState.players.find(p => p.id === myUserId)?.isConnected" class="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
                ⚠️ Desconectado
            </div>

            <!-- Header (Floating Glass) -->
            <div class="flex-none h-16 flex justify-between items-center px-4 bg-black/20 backdrop-blur-md border-b border-white/5 shadow-sm">
                <!-- Round -->
                <div class="flex flex-col">
                    <span class="text-[10px] font-mono text-indigo-300 uppercase tracking-widest leading-none mb-0.5">Ronda</span>
                    <span class="text-xl font-black text-white leading-none">
                        {{ gameState.roundsPlayed + 1 }}<span class="text-sm text-white/30 font-medium">/{{ gameState.config?.totalRounds || 5 }}</span>
                    </span>
                </div>

                <!-- Small Current Letter Display (Functional) -->
                <div class="flex flex-col items-center">
                    <span class="text-xs text-indigo-300 font-bold uppercase tracking-widest leading-none mb-1">Letra</span>
                    <div class="w-8 h-8 rounded bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-white font-black text-lg shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                        {{ gameState.currentLetter }}
                    </div>
                </div>

                <!-- Timer -->
                <div class="flex flex-col items-end w-[60px]">
                    <span v-if="timeRemaining !== null" 
                        class="font-mono text-2xl font-bold leading-none tabular-nums"
                        :class="timerColor"
                    >
                        {{ timeRemaining }}
                    </span>
                    <span v-else class="text-xs font-bold text-white/40">--</span>
                    <span class="text-[9px] uppercase font-bold text-white/30 tracking-wider">Segundos</span>
                </div>
            </div>

            <!-- Main Body (Scrollable) -->
            <div class="flex-1 overflow-y-auto px-4 pt-6 pb-32 scroll-smooth">
                
                <!-- PLAYING STATE -->
                <div v-if="gameState.status === 'PLAYING'" class="flex flex-col gap-6 w-full" :class="gridConfig.container">
                    
                    <!-- Rivals HUD (Floating Horizontal) -->
                    <div v-if="rivalsActivity.length > 0" class="w-full flex justify-center mb-2">
                         <div class="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide max-w-full px-2">
                            <div 
                                v-for="rival in rivalsActivity" 
                                :key="rival.id"
                                class="flex items-center gap-2 bg-black/30 backdrop-blur px-3 py-1.5 rounded-full border transition-all duration-300 min-w-max"
                                :class="[
                                    rival.isFinished ? 'border-green-500/50 bg-green-500/10' : 
                                    rival.isActive ? 'border-purple-500/50' : 'border-white/5 opacity-60'
                                ]"
                            >
                                <div class="relative">
                                    <span class="text-lg" :class="{ 'animate-pulse': rival.isActive }">{{ rival.avatar || '👤' }}</span>
                                    <div v-if="rival.isFinished" class="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-2.5 h-2.5 border border-black shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                </div>
                                <div class="flex flex-col leading-none">
                                    <span class="text-[9px] uppercase font-bold text-white/50 max-w-[60px] truncate">{{ rival.name }}</span>
                                    <span class="font-mono text-xs font-bold" :class="rival.isFinished ? 'text-green-400' : 'text-white/80'">
                                        {{ rival.filledCount }}<span class="text-white/20">/{{ rival.totalCategories }}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Dynamic Input Grid -->
                    <div class="grid w-full" :class="gridConfig.grid">
                         <div 
                            v-for="category in gameState.categories" 
                            :key="category"
                            class="group relative flex flex-col"
                         >
                            <label class="font-bold tracking-wide uppercase truncate transition-colors duration-300"
                                   :class="[gridConfig.label, answers[category]?.trim().length > 0 ? 'text-indigo-200' : '']"
                            >
                                {{ category }}
                            </label>
                            
                            <div class="relative w-full">
                                <input 
                                    :value="answers[category]"
                                    @input="handleInput(category, $event)"
                                    @focus="handleInputFocus"
                                    @keydown.enter.prevent
                                    type="text"
                                    autocomplete="off"
                                    class="w-full bg-white/5 border border-white/5 rounded-xl px-4 font-medium text-white outline-none transition-all duration-300 backdrop-blur-sm focus:bg-white/10 focus:border-indigo-500/50 focus:shadow-[0_0_30px_rgba(99,102,241,0.15)] placeholder-white/10 font-sans"
                                    :class="[gridConfig.inputHeight]"
                                    :placeholder="gameState.currentLetter + '...'"
                                >
                                <!-- Validation Dot -->
                                <div v-if="answers[category]?.trim().length > 0" 
                                     class="absolute top-1/2 -translate-y-1/2 right-4 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.6)] animate-in fade-in zoom-in duration-300 pointer-events-none"
                                ></div>
                            </div>
                         </div>
                    </div>

                </div>

                <!-- REVIEW / RESULTS STATE -->
                <div v-else class="w-full max-w-5xl mx-auto flex flex-col gap-6">
                    
                    <!-- Review Carousel (Center Stage) -->
                     <div v-if="gameState.status === 'REVIEW'" class="relative flex flex-col">
                        
                         <!-- STOP ALERT (Overlay Style) -->
                        <div v-if="showStopAlert && stopperPlayer" class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none h-64 sticky top-10">
                             <div class="relative bg-red-600/90 backdrop-blur-xl p-8 rounded-3xl shadow-[0_0_60px_rgba(220,38,38,0.5)] text-center animate-in zoom-in duration-300 border border-white/20">
                                <div class="text-8xl mb-2 filter drop-shadow-md animate-bounce">{{ stopperPlayer?.avatar || '🛑' }}</div>
                                <h2 class="text-5xl font-black text-white uppercase tracking-tighter drop-shadow-lg italic transform -skew-x-6">¡BASTA!</h2>
                                <p class="text-white/80 font-bold mt-2 uppercase tracking-widest text-xs">Detenido por {{ stopperPlayer?.name }}</p>
                             </div>
                        </div>

                        <!-- Card Content -->
                        <div class="bg-indigo-900/20 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl">
                             <div class="p-6 text-center border-b border-white/5 bg-black/20">
                                 <h3 class="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2">Revisión</h3>
                                 <h2 class="text-3xl font-black text-white drop-shadow-md">{{ currentCategory }}</h2>
                             </div>

                             <!-- Nav -->
                             <div class="flex items-center justify-between px-4 py-2 bg-white/5">
                                <button @click="prevCategory" :disabled="activeCategoryIndex === 0" class="p-2 text-white/50 hover:text-white disabled:opacity-20 transition-colors">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span class="font-mono text-xs text-white/30">{{ activeCategoryIndex + 1 }} / {{ gameState.categories.length }}</span>
                                <button @click="nextCategory" :disabled="activeCategoryIndex === gameState.categories.length - 1" class="p-2 text-white/50 hover:text-white disabled:opacity-20 transition-colors">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                             </div>

                             <!-- List -->
                             <div class="divide-y divide-white/5">
                                <div v-for="player in gameState.players" :key="player.id" class="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                                     <div class="flex items-center gap-4 overflow-hidden">
                                         <div class="text-2xl filter drop-shadow">{{ player.avatar || '👤' }}</div>
                                         <div class="flex flex-col overflow-hidden">
                                             <span class="text-[10px] font-bold text-white/40 uppercase tracking-wider">{{ player.name }}</span>
                                             <span class="text-lg font-bold text-white truncate" :class="{'line-through text-white/30 decoration-red-500/50': getReviewItem(player.id).state === 'REJECTED'}">
                                                {{ getReviewItem(player.id).answer || '-' }}
                                             </span>
                                         </div>
                                     </div>

                                     <!-- Vote Action -->
                                     <div class="flex items-center gap-3">
                                         <!-- Status Badge -->
                                        <div class="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider"
                                             :class="{
                                                 'bg-green-500/20 text-green-300 border border-green-500/30': getReviewItem(player.id).state === 'VALID',
                                                 'bg-red-500/20 text-red-300 border border-red-500/30': getReviewItem(player.id).state === 'REJECTED',
                                                 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30': getReviewItem(player.id).state === 'DUPLICATE'
                                             }"
                                        >
                                            {{ getReviewItem(player.id).state === 'VALID' ? `+${getReviewItem(player.id).score}` : '0' }}
                                        </div>

                                        <!-- Interactive Vote -->
                                        <button 
                                            v-if="player.id !== myUserId && gameState.players.length > 2"
                                            @click="toggleVote(player.id, currentCategory)"
                                            class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 border"
                                            :class="gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) 
                                                ? 'bg-red-500 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] scale-110' 
                                                : 'bg-white/5 border-white/10 text-white/20 hover:text-red-400 hover:border-red-500/50'"
                                        >
                                            👎
                                        </button>
                                     </div>
                                </div>
                             </div>
                        </div>
                     </div>

                     <!-- Results Grid -->
                     <div v-if="gameState.status === 'RESULTS'" class="flex flex-col gap-6">
                        <!-- Ranking -->
                        <div class="grid grid-cols-1 gap-2">
                             <div v-for="(player, idx) in [...gameState.players].sort((a,b) => b.score - a.score)" :key="player.id" 
                                  class="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm relative overflow-hidden"
                             >
                                <div class="relative z-10 flex items-center gap-3">
                                    <span class="font-black text-white/20 text-xl w-6">{{ idx + 1 }}</span>
                                    <span class="text-2xl">{{ player.avatar }}</span>
                                    <span class="font-bold text-white">{{ player.name }}</span>
                                </div>
                                <span class="relative z-10 font-black text-indigo-300 text-xl">{{ player.score }} pts</span>
                                <div v-if="idx === 0" class="absolute inset-0 bg-yellow-500/10 z-0"></div>
                             </div>
                        </div>

                        <!-- My Summary Grid (Reusing Logic but Readonly) -->
                        <div>
                             <h3 class="text-xs font-bold text-white/40 mb-3 uppercase tracking-widest pl-1">Resumen Ronda</h3>
                             <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div v-for="category in gameState.categories" :key="category" 
                                     class="p-3 rounded-xl border bg-black/20"
                                     :class="{
                                         'border-green-500/30': answers[category] && !gameState.votes[myUserId]?.[category]?.length,
                                         'border-red-500/30': gameState.votes[myUserId]?.[category]?.length,
                                         'border-white/5': !answers[category]
                                     }"
                                >
                                    <span class="block text-[9px] font-bold text-white/40 uppercase mb-1">{{ category }}</span>
                                    <span class="block text-white font-medium truncate">{{ answers[category] || '-' }}</span>
                                </div>
                             </div>
                        </div>
                     </div>
                </div>
            </div>

            <!-- Footer (Levitating) -->
            <div class="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-50 px-4">
                 
                 <!-- ACTION: STOP -->
                 <button 
                    v-if="gameState.status === 'PLAYING'"
                    @click="handleStop"
                    class="pointer-events-auto w-full max-w-md bg-gradient-to-r from-rose-600 to-pink-600 text-white font-black text-xl py-4 rounded-2xl shadow-[0_0_40px_rgba(225,29,72,0.4)] border border-white/20 flex items-center justify-center gap-3 transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    :class="{'opacity-50 grayscale cursor-not-allowed': !canStopRound && !validationCooldown, 'animate-shake': validationCooldown}"
                 >
                    <span class="text-2xl drop-shadow-md">✋</span>
                    <span class="tracking-widest drop-shadow-md">BASTA</span>
                 </button>

                 <!-- ACTION: CONFIRM VOTES -->
                 <button
                    v-if="gameState.status === 'REVIEW'"
                    @click="handleConfirmVotes"
                    class="pointer-events-auto w-full max-w-md bg-emerald-600 text-white font-black text-lg py-4 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.3)] border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all"
                    :disabled="hasConfirmed"
                 >
                    {{ hasConfirmed ? 'Votos Enviados ✅' : 'Confirmar Votos' }}
                 </button>

                 <!-- ACTION: NEXT ROUND -->
                 <div v-if="gameState.status === 'RESULTS'" class="pointer-events-auto w-full max-w-md">
                    <button 
                        v-if="amIHost"
                        @click="startGame"
                        class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl py-4 rounded-2xl shadow-lg transition-all"
                    >
                        Siguiente Ronda ➡️
                    </button>
                    <div v-else class="text-center">
                        <span class="inline-block px-4 py-2 rounded-full bg-black/40 backdrop-blur border border-white/10 text-white/60 text-xs font-bold animate-pulse">
                            Esperando al Host...
                        </span>
                    </div>
                 </div>
            </div>

             <!-- Exit Modal -->
            <div v-if="showExitModal" class="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
                <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full mx-6 text-center shadow-2xl">
                    <h3 class="text-2xl font-black text-white mb-2">¿Salir?</h3>
                    <div class="flex gap-3 justify-center mt-6">
                        <button @click="showExitModal = false" class="px-6 py-3 rounded-xl font-bold bg-white/10 text-white hover:bg-white/20">Cancelar</button>
                        <button @click="handleExit" class="px-6 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-500 shadow-lg">Salir</button>
                    </div>
                </div>
            </div>

            <!-- Toast Container -->
            <div class="absolute top-20 right-4 flex flex-col items-end gap-2 pointer-events-none z-[60]">
                 <TransitionGroup name="toast">
                    <div v-for="toast in sessionToasts" :key="toast.id" 
                         class="pointer-events-auto px-4 py-2 rounded-xl backdrop-blur-xl border shadow-xl flex items-center gap-3"
                         :class="toast.type === 'stop-warning' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200' : 'bg-slate-800/80 border-white/10 text-white'"
                    >
                        <span class="text-lg">{{ toast.type === 'join' ? '👋' : (toast.type === 'leave' ? '🚪' : '⚠️') }}</span>
                        <span class="font-bold text-xs">{{ toast.text }}</span>
                    </div>
                </TransitionGroup>
            </div>

        </div>
    </div>
</template>

