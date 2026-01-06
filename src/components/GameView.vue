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

</script>

<template>
    <div class="h-[100dvh] w-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden relative">
        
        <!-- === CONNECTION STATUS (Floating, minimal) === -->
         <div v-if="!gameState.players.find(p => p.id === myUserId)?.isConnected" class="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
            ⚠️ Desconectado
        </div>

        <!-- === A. HEADER (Fixed & Compact) === -->
        <div class="flex-none bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-3 flex justify-between items-center z-20 h-16 shadow-lg">
            
            <!-- Left: Round -->
            <div class="flex flex-col">
                <span class="text-[10px] font-mono text-slate-400 uppercase tracking-widest leading-none mb-0.5">Ronda</span>
                <span class="text-xl font-black text-white leading-none">
                    {{ gameState.roundsPlayed + 1 }}<span class="text-sm text-slate-500 font-medium">/{{ gameState.config?.totalRounds || 5 }}</span>
                </span>
            </div>

            <!-- Center: The Letter -->
            <div class="relative group">
                <div class="absolute inset-0 bg-indigo-500 rounded-lg blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <div class="relative bg-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg border border-indigo-400/30">
                    <span class="text-2xl font-black text-white drop-shadow-md">{{ gameState.currentLetter }}</span>
                </div>
            </div>

            <!-- Right: Timer -->
            <div class="flex flex-col items-end w-[60px]">
                 <span v-if="timeRemaining !== null" 
                      class="font-mono text-2xl font-bold leading-none tabular-nums"
                      :class="timerColor"
                 >
                    {{ timeRemaining }}
                </span>
                <span v-else class="text-xs font-bold text-slate-600">--</span>
                <span class="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Segundos</span>
            </div>
        </div>

        <!-- === B. BODY (Scrollable Area) === -->
        <div class="flex-1 overflow-y-auto p-4 pb-32 scroll-smooth">
            <div class="w-full max-w-2xl mx-auto">
                
                <!-- PLAYING STATE: Inputs Grid -->
                <div v-if="gameState.status === 'PLAYING'" class="flex flex-col gap-4">
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

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div 
                        v-for="category in gameState.categories" 
                        :key="category"
                        class="group bg-slate-800 border border-slate-700 rounded-lg p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-200 relative"
                        :class="{'border-indigo-500/50 bg-slate-800/80': answers[category]?.trim().length > 0}"
                    >
                         <label class="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5 truncate">{{ category }}</label>
                         <input 
                            :value="answers[category]"
                            @input="handleInput(category, $event)"
                            @focus="handleInputFocus"
                            @keydown.enter.prevent
                            type="text"
                            autocomplete="off"
                            class="w-full bg-transparent text-lg font-medium outline-none text-white placeholder-slate-600 font-sans"
                            :placeholder="gameState.currentLetter + '...'"
                        >
                        <!-- Validation Icon (Client side logic check) -->
                         <div v-if="answers[category]?.trim().length > 0" class="absolute top-2 right-2 text-indigo-400 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                    </div>
                </div>

                </div>

                <!-- REVIEW / RESULTS STATE: Read-Only Grid -->
                <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <!-- 
                        Note: Existing Review logic was Carousel based. 
                        The prompt asks to "Reuse Grid" for Results. 
                        But for Review Phase, the existing Carousel is actually quite good for detailed voting.
                        However, the prompt says "En la fase de RESULTS o VOTING: Reutiliza el mismo Grid denso."
                        Let's adapt the REVIEW phase to show MINE vs OTHERS or just Summary?
                        Actually, detailed voting usually requires focus per category.
                        Let's stick to the prompt: "Reutiliza el mismo Grid denso. Reemplaza el <input> por un <div> de solo lectura."
                        Wait, for VOTING we need to see OTHER players' answers.
                        The grid above shows MY answers.
                        If I show a Grid in Voting, I can see MY status, but how do I vote others?
                        The "Compact Cockpit" might imply a summary view for me, and maybe a modal for voting?
                        OR, sticking to the "Interactive Carousel" for Voting is better UX than a static grid if we need to vote.
                        Let's keep the Carousel for 'REVIEW' (Active Voting) but styled to match the new aesthetic,
                        AND use the Grid for 'RESULTS' or 'REVIEW' overview?
                        Actually, the Prompt "3. C. Layout de Categorias... 5. Adaptación del Modo 1 vs 1... En RESULTS o VOTING... Reutiliza el Grid".
                        In 1vs1, voting is automated, so a Grid showing the results is perfect.
                        In Multiplayer, we still need manual voting.
                        Let's implement the Grid for 'RESULTS' and 'REVIEW' (Overview), but maybe keep the Carousel for the actual voting action if needed?
                        Let's try to follow the prompt strictly:
                        "Reutiliza el mismo Grid denso... Reemplaza input por div"
                        This implies showing MY answers with their status.
                        BUT where do I vote for others?
                        Maybe the voting UI happens in the FOOTER or a Modal?
                        "C. FOOTER ... Voting/Result Actions".
                        Okay, let's keep the Carousel for Voting inside the body if it's manual voting,
                        OR if it's 1v1 (Automated), just show the Grid with statuses.
                        Let's preserve the Carousel for Manual Voting (Review) to ensure functionality,
                        but style it to fit the new theme.
                        For RESULTS, use the Grid.
                    -->

                    <!-- REVIEW CAROUSEL (Manual Voting / 1v1 Watch) -->
                    <div v-if="gameState.status === 'REVIEW'" class="flex flex-col gap-4 relative">
                        
                         <!-- STOP ALERT OVERLAY -->
                        <div v-if="showStopAlert && stopperPlayer" class="absolute inset-0 z-50 flex items-center justify-center bg-red-600/90 backdrop-blur-md rounded-2xl animate-in fade-in zoom-in duration-300 pointer-events-none sticky top-10 h-64">
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

                        <!-- We reuse the logic from before but restyled -->
                         <div class="bg-slate-800/50 rounded-xl p-4 border border-white/5 flex flex-col items-center text-center">
                            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Votando Categoría</h3>
                            <h2 class="text-2xl font-black text-indigo-400 mb-4">{{ currentCategory }}</h2>
                            
                            <!-- Navigation -->
                            <div class="flex items-center gap-4 mb-6">
                                <button @click="prevCategory" :disabled="activeCategoryIndex === 0" class="p-2 bg-slate-700 rounded-full disabled:opacity-30 hover:bg-slate-600 transition-colors">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span class="font-mono text-sm text-slate-500">{{ activeCategoryIndex + 1 }}/{{ gameState.categories.length }}</span>
                                <button @click="nextCategory" :disabled="activeCategoryIndex === gameState.categories.length - 1" class="p-2 bg-slate-700 rounded-full disabled:opacity-30 hover:bg-slate-600 transition-colors">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>

                            <!-- Players List for Voting -->
                            <div class="w-full space-y-2">
                                <div v-for="player in gameState.players" :key="player.id" 
                                    class="flex items-center justify-between bg-slate-900 border border-slate-700 p-3 rounded-lg"
                                    :class="{
                                        'border-green-500/50 bg-green-500/5': getReviewItem(player.id).state === 'VALID',
                                        'border-red-500/50 bg-red-500/5': getReviewItem(player.id).state === 'REJECTED',
                                        'border-yellow-500/50 bg-yellow-500/5': getReviewItem(player.id).state === 'DUPLICATE'
                                    }"
                                >
                                    <div class="flex items-center gap-3 overflow-hidden">
                                        <div class="text-xl">{{ player.avatar || '👤' }}</div>
                                        <div class="flex flex-col items-start overflow-hidden">
                                            <span class="text-xs font-bold text-slate-400 truncate max-w-[80px]">{{ player.name }}</span>
                                            <span class="font-bold text-white truncate text-sm">{{ getReviewItem(player.id).answer || '-' }}</span>
                                        </div>
                                    </div>

                                    <!-- Action/Status -->
                                    <div class="flex items-center gap-2">
                                        <!-- Score Badge -->
                                        <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                            {{ getReviewItem(player.id).score }}
                                        </span>
                                        
                                        <!-- Vote Button -->
                                        <button 
                                            v-if="player.id !== myUserId && gameState.players.length > 2"
                                            @click="toggleVote(player.id, currentCategory)"
                                            class="w-8 h-8 rounded-full flex items-center justify-center border transition-all"
                                            :class="gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) 
                                                ? 'bg-red-500 border-red-500 text-white' 
                                                : 'bg-transparent border-slate-600 text-slate-500 hover:border-red-400 hover:text-red-400'"
                                        >
                                            👎
                                        </button>
                                        <div v-else-if="gameState.players.length === 2" class="text-lg">
                                            <!-- AI / 1v1 Indicator -->
                                            <span v-if="getReviewItem(player.id).state === 'REJECTED'">❌</span>
                                            <span v-else-if="getReviewItem(player.id).state === 'VALID'">✅</span>
                                             <span v-else>🤖</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                         </div>
                    </div>

                    <!-- RESULTS: Dense Grid of MY answers with visual status -->
                    <div v-if="gameState.status === 'RESULTS'" class="flex flex-col gap-6">
                        <!-- Scoreboard Summary -->
                        <div class="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <h2 class="text-lg font-black text-white mb-3 text-center">Ranking de Ronda</h2>
                            <div class="space-y-2">
                                <div v-for="player in [...gameState.players].sort((a,b) => b.score - a.score)" :key="player.id" class="flex items-center justify-between p-2 rounded bg-slate-900/50">
                                    <div class="flex items-center gap-2">
                                        <span>{{ player.avatar }}</span>
                                        <span class="font-bold text-sm" :class="player.id === myUserId ? 'text-indigo-400' : 'text-slate-300'">{{ player.name }}</span>
                                    </div>
                                    <span class="font-mono font-bold text-yellow-400">{{ player.score }} pts</span>
                                </div>
                            </div>
                        </div>

                         <!-- My Answers Grid -->
                         <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Mis Respuestas</h3>
                         <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div 
                                v-for="category in gameState.categories" 
                                :key="category"
                                class="bg-slate-800 border-l-4 rounded-r-lg p-2 flex flex-col"
                                :class="{
                                    'border-l-green-500': answers[category] && !gameState.votes[myUserId]?.[category]?.length, 
                                    'border-l-red-500': gameState.votes[myUserId]?.[category]?.length,
                                    'border-l-slate-600': !answers[category]
                                }"
                            >
                                <span class="text-[10px] uppercase font-bold text-slate-400 mb-0.5">{{ category }}</span>
                                <span class="text-lg font-medium text-white truncate">{{ answers[category] || '-' }}</span>
                            </div>
                         </div>
                    </div>

                </div>

            </div>
        </div>

        <!-- === C. FOOTER (Sticky Actions) === -->
        <div class="flex-none p-4 w-full bg-slate-900/95 backdrop-blur border-t border-slate-800 z-30">
            <div class="w-full max-w-md mx-auto">
                
                <!-- PLAYING: STOP Button -->
                <button 
                    v-if="gameState.status === 'PLAYING'"
                    @click="handleStop"
                    class="w-full bg-red-600 text-white font-black text-xl py-3 rounded-xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg hover:bg-red-500 flex items-center justify-center gap-2 group"
                    :class="{'opacity-50 grayscale cursor-not-allowed': !canStopRound && !validationCooldown, 'animate-shake': validationCooldown}"
                >
                    <span class="text-2xl group-hover:rotate-12 transition-transform">✋</span>
                    STOP
                </button>

                <!-- REVIEW: Confirm Button -->
                <button 
                    v-if="gameState.status === 'REVIEW'"
                    @click="handleConfirmVotes"
                    class="w-full bg-green-600 text-white font-black text-xl py-3 rounded-xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg hover:bg-green-500 disabled:opacity-50 disabled:border-b-4 disabled:active:translate-y-0"
                    :disabled="hasConfirmed"
                >
                    {{ hasConfirmed ? 'Esperando...' : 'Confirmar Votos ✅' }}
                </button>

                 <!-- RESULTS: Next Round Button -->
                <button 
                    v-if="gameState.status === 'RESULTS' && amIHost"
                    @click="startGame"
                    class="w-full bg-indigo-600 text-white font-black text-xl py-3 rounded-xl border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg hover:bg-indigo-500"
                >
                    Siguiente Ronda ➡️
                </button>
                <div v-else-if="gameState.status === 'RESULTS'" class="text-center text-slate-500 text-sm font-bold animate-pulse">
                    Esperando al Host...
                </div>

            </div>
        </div>
        
        <!-- === EXIT MODAL === -->
         <div v-if="showExitModal" class="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div class="bg-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-white/10">
                <h3 class="text-2xl font-black text-white mb-2">¿Abandonar?</h3>
                <p class="text-slate-300 mb-6 font-medium text-sm">El progreso se perderá.</p>
                <div class="flex gap-3">
                    <button @click="showExitModal = false" class="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all">
                        Seguir
                    </button>
                    <button @click="handleExit" class="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all">
                        Salir
                    </button>
                </div>
            </div>
        </div>

        <!-- === TOASTS === -->
        <div class="absolute top-16 right-4 flex flex-col items-end gap-2 pointer-events-none z-50">
            <TransitionGroup name="toast">
                <div 
                    v-for="toast in sessionToasts" 
                    :key="toast.id" 
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-lg border text-xs font-bold pointer-events-auto select-none backdrop-blur-md"
                    :class="toast.type === 'stop-warning' ? 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30' : 'bg-slate-800/90 text-white border-white/10'"
                >
                    <span>{{ toast.text }}</span>
                </div>
            </TransitionGroup>
        </div>

    </div>
</template>

