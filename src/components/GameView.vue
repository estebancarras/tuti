<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useGame } from '../composables/useGame';

const { gameState, stopRound, submitAnswers, debouncedUpdateAnswers, shouldSubmit, toggleVote, confirmVotes, myUserId } = useGame();

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
    <div class="w-full max-w-6xl mx-auto p-4">
        
        <!-- === HEADER === -->
        <div class="flex items-center justify-between mb-8 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl">
            <!-- Round Info -->
            <div class="flex items-center gap-3">
                <div class="h-10 w-10 rounded-full bg-purple-600 flex items-center justify-center shadow-lg border border-white/20">
                    <span class="text-xl">🏁</span>
                </div>
                <div>
                    <span class="block text-xs uppercase tracking-widest text-purple-300 font-bold">Ronda</span>
                    <span class="text-xl font-black tracking-tight leading-none">
                        {{ gameState.roundsPlayed + 1 }} <span class="text-white/40 text-sm">/ {{ gameState.config.totalRounds || 5 }}</span>
                    </span>
                </div>
            </div>
            
            <div class="text-center">
                <p class="text-purple-200 text-sm uppercase tracking-widest font-bold">Letra</p>
                <h1 class="text-8xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                    {{ gameState.currentLetter || '?' }}
                </h1>
            </div>
            
            <div class="flex-1 px-8 text-center">
                 <!-- Timer Display -->
                 <div v-if="timeRemaining !== null" class="mb-2">
                     <p class="text-sm text-gray-400 uppercase tracking-wide">Tiempo Restante</p>
                     <p :class="['text-6xl font-black', timerColor]">
                         {{ timeRemaining }}s
                     </p>
                 </div>
                 <p v-if="gameState.status === 'PLAYING'" class="text-gray-400 text-sm">¡Escribe rápido!</p>
                 <p v-else-if="gameState.status === 'REVIEW'" class="text-yellow-400 text-xl font-bold animate-bounce">¡REVISIÓN DE VOTOS!</p>
                 <p v-else-if="gameState.status === 'RESULTS'" class="text-green-400 text-xl font-bold">¡RESULTADOS!</p>
            </div>

            <button 
                v-if="gameState.status === 'PLAYING'"
                @click="handleStop"
                class="group relative px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-2xl rounded-xl transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(220,38,38,0.5)] border-2 border-red-400"
            >
                <span class="absolute inset-0 w-full h-full bg-red-400 opacity-0 group-hover:opacity-20 rounded-xl transition-opacity animate-pulse"></span>
                BASTA!
            </button>
        </div>

        <!-- === PLAYING STATE === -->
        <div v-if="gameState.status === 'PLAYING'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
                v-for="category in gameState.categories" 
                :key="category"
                class="bg-black/30 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:border-purple-500/50 transition-colors group"
            >
                <label class="block text-purple-200 text-sm font-bold mb-2 uppercase tracking-wide group-hover:text-purple-100">
                    {{ category }}
                </label>
                <div class="relative">
                    <input 
                        :value="answers[category]"
                        @input="handleInput(category, $event)"
                        type="text"
                        :placeholder="`Empieza con ${gameState.currentLetter}...`"
                        class="w-full bg-white/5 border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all font-medium text-lg border-white/10 focus:ring-purple-500 focus:bg-black/50"
                        autofocus
                        autocomplete="off"
                    >
                </div>
            </div>
        </div>

        <!-- === REVIEW STATE (VOTING MOCKUP) === -->
        <div v-else-if="gameState.status === 'REVIEW'" class="flex-1 overflow-auto p-4 flex flex-col items-center bg-[#491B8F]">
            
            <!-- Title Section -->
            <h2 class="text-4xl font-bold text-white mb-2 tracking-tight">Votación</h2>
            <h3 class="text-2xl font-bold text-white mb-8">Categoría: <span class="text-white">{{ currentCategory }}</span></h3>
            
            <!-- Carousel Navigation (Hidden visually but functional via swipe/buttons if needed, but mockup implies static or swipe? Kept buttons for usability but styled minimally) -->
            <!-- Actually mockup shows "Categoria: K". We need navigation. I will keep minimal arrows next to category text or bottom. 
                 Mockup doesn't show nav. I'll put arrows next to Category for UX. -->
            
            <div class="flex items-center gap-4 mb-6">
                <button @click="prevCategory" :disabled="activeCategoryIndex === 0" class="text-white/50 hover:text-white disabled:opacity-0 transition-colors">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div class="h-1 w-1"></div> <!-- Spacer -->
                <button @click="nextCategory" :disabled="activeCategoryIndex === gameState.categories.length - 1" class="text-white/50 hover:text-white disabled:opacity-0 transition-colors">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            <!-- Main Container -->
            <div class="w-full max-w-lg bg-[#7C4DFF]/20 backdrop-blur-sm rounded-3xl overflow-hidden mb-24 shadow-2xl border border-white/5">
                
                <!-- Table Header -->
                <div class="grid grid-cols-[1.5fr_1.5fr_auto] px-6 py-4 bg-white/5 border-b border-white/10">
                    <span class="text-white/70 font-bold text-sm tracking-wider uppercase">NOMBRE</span>
                    <span class="text-white/70 font-bold text-sm tracking-wider uppercase">PALABRA</span>
                    <span class="w-12"></span> <!-- Spacer for Toggle -->
                </div>

                <!-- Rows -->
                <div class="divide-y divide-white/10">
                    <div v-for="player in gameState.players" :key="player.id" class="grid grid-cols-[1.5fr_1.5fr_auto] px-6 py-4 items-center bg-[#6D28D9]/40 hover:bg-[#6D28D9]/60 transition-colors">
                        
                        <!-- Col 1: Avatar + Name -->
                        <div class="flex items-center gap-3 overflow-hidden">
                            <div class="w-10 h-10 rounded-full shrink-0 flex items-center justify-center border-2 border-white/20 shadow-inner"
                                 :class="[
                                     player.id === myUserId ? 'bg-pink-400' : 
                                     player.name.length % 2 === 0 ? 'bg-green-400' : 'bg-orange-400'
                                 ]"
                            >
                                <span class="text-white font-bold text-lg shadow-sm">{{ player.name.charAt(0).toUpperCase() }}</span>
                            </div>
                            <span class="text-white font-bold text-lg truncate">{{ player.name }}</span>
                        </div>

                        <!-- Col 2: Word -->
                        <div class="text-white font-bold text-lg truncate px-2">
                             {{ gameState.answers[player.id]?.[currentCategory] || '-' }}
                        </div>

                        <!-- Col 3: Toggle -->
                        <div class="flex justify-end">
                            <div v-if="player.id === myUserId" class="w-14 h-8 bg-gray-600 rounded-full p-1 opacity-50 cursor-not-allowed">
                                <div class="w-6 h-6 bg-white rounded-full shadow-md ml-auto"></div>
                            </div>
                            <button 
                                v-else 
                                @click="toggleVote(player.id, currentCategory)"
                                class="w-14 h-8 rounded-full p-1 transition-colors duration-300 relative focus:outline-none"
                                :class="gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) ? 'bg-gray-400' : 'bg-green-500'"
                            >
                                <div 
                                    class="w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300"
                                    :class="gameState.votes[player.id]?.[currentCategory]?.includes(myUserId) ? 'translate-x-0' : 'translate-x-6'"
                                ></div>
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            <!-- Bottom Navigation/Confirm -->
             <div class="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#491B8F] to-transparent flex justify-center pb-10">
                <button 
                    v-if="activeCategoryIndex < gameState.categories.length - 1"
                    @click="nextCategory"
                    class="w-full max-w-lg bg-white text-[#491B8F] hover:bg-gray-100 font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all text-xl"
                >
                    Siguiente
                </button>
                <button 
                    v-else
                    @click="handleConfirmVotes"
                    class="w-full max-w-lg bg-green-500 hover:bg-green-400 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all text-xl"
                    :disabled="hasConfirmed"
                >
                    {{ hasConfirmed ? 'Esperando...' : 'Confirmar Votos' }}
                </button>
            </div>
        </div>

        <!-- === RESULTS STATE === -->
        <div v-else-if="gameState.status === 'RESULTS'" class="max-w-2xl mx-auto bg-black/40 backdrop-blur-md rounded-2xl p-8 border border-white/10 text-center">
            <h2 class="text-4xl font-black text-white mb-8">Resultados de la Ronda</h2>
            
            <!-- Detailed Results Table -->
            <div class="overflow-x-auto mb-8 bg-black/50 rounded-xl border border-white/10">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-white/10 text-purple-200 uppercase text-xs tracking-wider">
                            <th class="p-3 font-bold border-b border-white/10">Jugador</th>
                            <th v-for="cat in gameState.categories" :key="cat" class="p-3 font-bold border-b border-white/10">{{ cat }}</th>
                            <th class="p-3 font-bold border-b border-white/10 text-right">Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="player in gameState.players" :key="player.id" class="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td class="p-3 font-bold text-white relative">
                                <span v-if="player.isHost" class="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-yellow-500">👑</span>
                                {{ player.name }}
                            </td>
                            
                            <td v-for="cat in gameState.categories" :key="cat" class="p-2">
                                <div class="flex flex-col">
                                    <span 
                                        class="font-medium text-sm"
                                        :class="{
                                            'text-green-400': gameState.answerStatuses[player.id]?.[cat] === 'VALID',
                                            'text-yellow-400': gameState.answerStatuses[player.id]?.[cat] === 'DUPLICATE',
                                            'text-red-500 line-through': gameState.answerStatuses[player.id]?.[cat] === 'INVALID' || !gameState.answerStatuses[player.id]?.[cat]
                                        }"
                                    >
                                        {{ gameState.answers[player.id]?.[cat] || '-' }}
                                    </span>
                                    
                                    <!-- Status Badge -->
                                    <span v-if="gameState.answerStatuses[player.id]?.[cat] === 'DUPLICATE'" class="text-[10px] text-yellow-500/80 uppercase">Repetida</span>
                                </div>
                            </td>
                            <td class="p-3 text-right font-black text-green-400">
                                +{{ gameState.roundScores[player.id] || 0 }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Total Scores Summary -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
                <div v-for="player in gameState.players" :key="player.id" class="p-2 bg-white/5 rounded border border-white/5 text-center">
                    <div class="text-gray-400 text-xs truncate">{{ player.name }}</div>
                    <div class="text-white font-bold">{{ player.score }} pts</div>
                </div>
            </div>

            <div v-if="timeRemaining !== null" class="mb-4">
                <p class="text-gray-400 text-sm mb-2">Siguiente ronda en:</p>
                <p :class="['text-5xl font-black', timerColor]">
                    {{ timeRemaining }}s
                </p>
            </div>
            <div v-else class="text-gray-400 text-sm animate-pulse mb-4">
                Preparando siguiente ronda...
            </div>
            
            <!-- Manual start button (optional, host only) -->
            <button 
                @click="useGame().startGame()"
                class="mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-xl transition-all"
            >
                Iniciar Ahora
            </button>
        </div>

    </div>
</template>
