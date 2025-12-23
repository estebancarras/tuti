<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useGame } from '../composables/useGame';

const { gameState, stopRound, submitAnswers, debouncedUpdateAnswers, shouldSubmit, toggleVote, confirmVotes, myUserId, amIHost, startGame } = useGame();

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

const handleStop = () => {
    stopRound(answers.value);
};

// Carousel Logic for Review Phase
const activeCategoryIndex = ref(0);
const currentCategory = computed(() => {
    return gameState.value.categories[activeCategoryIndex.value] || '';
});

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
</script>

<template>
    <div class="h-full flex flex-col w-full max-w-7xl mx-auto">
        <!-- HEADER (HUD) - Fixed -->
        <div class="flex-none flex items-center justify-between bg-black/30 backdrop-blur-md rounded-2xl p-3 border border-white/10 mb-4 shadow-lg shrink-0">
            <!-- Left: Round & Letter -->
            <div class="flex items-center gap-4">
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
             <div class="flex flex-col items-center">
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

            <div class="w-10"></div> <!-- Spacer -->
        </div>

        <!-- BODY (Scrollable Content) -->
        <div class="flex-1 overflow-y-auto min-h-0 relative rounded-2xl bg-black/20 border border-white/5 backdrop-blur-sm scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            <div class="p-4">
                
                <!-- === PLAYING STATE === -->
                <div v-if="gameState.status === 'PLAYING'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div 
                        v-for="category in gameState.categories" 
                        :key="category"
                        class="bg-black/30 backdrop-blur-sm p-3 rounded-xl border border-white/10 hover:border-purple-500/50 transition-colors group focus-within:ring-2 focus-within:ring-purple-500/50"
                    >
                        <label class="block text-purple-200 text-xs font-bold mb-1.5 uppercase tracking-wide group-hover:text-purple-100 truncate">
                            {{ category }}
                        </label>
                        <div class="relative">
                            <input 
                                :value="answers[category]"
                                @input="handleInput(category, $event)"
                                type="text"
                                :placeholder="`${gameState.currentLetter}...`"
                                class="w-full bg-white/5 border rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:bg-black/50 transition-all font-medium text-lg border-white/10"
                                autocomplete="off"
                            >
                        </div>
                    </div>
                </div>

                <!-- === REVIEW STATE (VOTING MOCKUP) === -->
                <div v-else-if="gameState.status === 'REVIEW'" class="flex flex-col items-center bg-[#491B8F] rounded-2xl p-4 min-h-full">
                    
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
                            <div v-for="player in gameState.players" :key="player.id" class="grid grid-cols-[1.5fr_1.5fr_auto] px-4 py-3 items-center bg-[#6D28D9]/40 hover:bg-[#6D28D9]/60 transition-colors">
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

                                <div class="text-white font-bold text-base truncate px-2">
                                     {{ gameState.answers[player.id]?.[currentCategory] || '-' }}
                                </div>

                                <div class="flex justify-end">
                                    <div v-if="player.id === myUserId" class="w-12 h-6 bg-gray-600 rounded-full p-1 opacity-50 cursor-not-allowed flex items-center">
                                        <div class="w-4 h-4 bg-white rounded-full shadow-md ml-auto"></div>
                                    </div>
                                    <button 
                                        v-else 
                                        @click="toggleVote(player.id, currentCategory)"
                                        class="w-12 h-6 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none flex items-center"
                                        :class="gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) ? 'bg-gray-400' : 'bg-green-500'"
                                    >
                                        <div 
                                            class="w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300"
                                            :class="gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) ? 'translate-x-0' : 'translate-x-6'"
                                        ></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
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

        <!-- FOOTER (Actions) - Fixed at bottom -->
        <div class="flex-none p-4 flex justify-center bg-black/20 backdrop-blur-sm border-t border-white/5 z-20">
             <!-- PLAYING ACTION -->
             <button 
                v-if="gameState.status === 'PLAYING'"
                @click="handleStop"
                class="w-full max-w-md px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-black text-2xl rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.5)] active:scale-95 flex items-center justify-center gap-3"
            >
                ⚠️ ¡BASTA!
            </button>

            <!-- REVIEW ACTION -->
            <div v-else-if="gameState.status === 'REVIEW'" class="w-full max-w-lg"> 
                <button 
                    v-if="activeCategoryIndex < gameState.categories.length - 1"
                    @click="nextCategory"
                    class="w-full py-3 bg-white text-[#491B8F] font-bold rounded-xl shadow-lg active:scale-95 transition-all text-lg"
                >
                    Siguiente Categoría
                </button>
                <button 
                    v-else
                    @click="handleConfirmVotes"
                    class="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-lg"
                    :disabled="hasConfirmed"
                >
                    {{ hasConfirmed ? 'Esperando...' : 'Confirmar Votos ✅' }}
                </button>
            </div>

            <!-- RESULTS ACTION -->
            <div v-else-if="gameState.status === 'RESULTS'" class="w-full text-center">
                <button 
                    v-if="amIHost"
                    @click="startGame"
                    class="w-full max-w-md px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xl rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
                >
                    Siguiente Ronda ➡️
                </button>
                <div v-else class="text-white/50 text-sm">
                    Esperando al anfitrión...
                </div>
            </div>
        </div>
    </div>
</template>

