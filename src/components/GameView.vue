<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useGame } from '../composables/useGame';

const { gameState, stopRound, submitAnswers, shouldSubmit, toggleVote, confirmVotes } = useGame();

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
    const newValue = input.value;
    
    // Strict Input Blocking
    // If we don't have a letter or input is empty, allow
    if (!gameState.value.currentLetter || newValue.trim().length === 0) {
        answers.value[category] = newValue;
        return;
    }

    const trimmedVal = newValue.trimStart();
    const firstChar = trimmedVal.charAt(0).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const targetChar = gameState.value.currentLetter.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (firstChar === targetChar) {
        // Valid start! Update model.
        answers.value[category] = newValue;
    } else {
        // Invalid start!
        // REJECT change by forcing input back to current model value
        // Note: We access answers.value[category] directly. If it's undefined, default to ''
        const currentModelValue = answers.value[category] || '';
        
        // Only force update if the DOM value is actually different (it is, because user typed)
        if (input.value !== currentModelValue) {
             input.value = currentModelValue;
             
             // Optional: Add shake animation class temporarily
             input.classList.add('animate-pulse', 'bg-red-500/20');
             setTimeout(() => input.classList.remove('animate-pulse', 'bg-red-500/20'), 200);
        }
    }
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

        <!-- === REVIEW STATE (VOTING TABLE) === -->
        <div v-else-if="gameState.status === 'REVIEW'" class="bg-black/40 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-white/10 text-purple-200 uppercase text-sm tracking-wider">
                            <th class="p-4 font-bold border-b border-white/10">Jugador</th>
                            <th v-for="cat in gameState.categories" :key="cat" class="p-4 font-bold border-b border-white/10">{{ cat }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="player in gameState.players" :key="player.id" class="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td class="p-4 text-white font-bold">{{ player.name }}</td>
                            
                            <td v-for="cat in gameState.categories" :key="cat" class="p-2">
                                <div 
                                    @click="toggleVote(player.id, cat)"
                                    class="relative p-3 rounded-lg cursor-pointer transition-all border group select-none"
                                    :class="[
                                        (gameState.votes[player.id]?.[cat]?.length || 0) > 0 
                                            ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30' 
                                            : 'bg-white/5 border-transparent hover:bg-white/10'
                                    ]"
                                >
                                    <!-- Word Value -->
                                    <span class="text-white font-medium block" 
                                          :class="{'line-through text-white/50': (gameState.votes[player.id]?.[cat]?.length || 0) > 0}">
                                        {{ gameState.answers[player.id]?.[cat] || '-' }}
                                    </span>
                                    
                                    <!-- Vote Count Badge -->
                                    <span v-if="(gameState.votes[player.id]?.[cat]?.length || 0) > 0" 
                                          class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">
                                        -1
                                    </span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="p-6 flex justify-end bg-black/20">
                <button 
                    v-if="!hasConfirmed"
                    @click="handleConfirmVotes"
                    class="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all transform hover:scale-105"
                >
                    CONFIRMAR VOTOS
                </button>
                <div v-else class="text-gray-400 font-medium italic bg-white/5 px-6 py-3 rounded-xl">
                    Esperando a los demás jugadores... ({{ gameState.whoFinishedVoting.length }} / {{ gameState.players.length }})
                </div>
            </div>
        </div>

        <!-- === RESULTS STATE === -->
        <div v-else-if="gameState.status === 'RESULTS'" class="max-w-2xl mx-auto bg-black/40 backdrop-blur-md rounded-2xl p-8 border border-white/10 text-center">
            <h2 class="text-4xl font-black text-white mb-8">Resultados de la Ronda</h2>
            
            <div class="space-y-4 mb-8">
                <div v-for="player in gameState.players" :key="player.id" 
                     class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                            {{ player.name[0] }}
                        </div>
                        <span class="text-white text-xl font-bold">{{ player.name }}</span>
                    </div>
                    <div class="text-right">
                        <span class="block text-3xl font-black text-green-400">+{{ gameState.roundScores[player.id] || 0 }}</span>
                        <span class="text-gray-400 text-sm">Total: {{ player.score }}</span>
                    </div>
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
