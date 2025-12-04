<script setup lang="ts">
import { ref } from 'vue';
import { useGame } from '../composables/useGame';

const { gameState, stopRound } = useGame();

// Local state for inputs (not synced in real-time for now to save bandwidth)
// In a real app we might want to sync typing status or debounce updates
const answers = ref<Record<string, string>>({});

const handleStop = () => {
    stopRound();
};
</script>

<template>
    <div class="w-full max-w-4xl mx-auto p-4">
        <!-- HEADER: LETTER & TIMER (Placeholder) -->
        <div class="flex items-center justify-between mb-8 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl">
            <div class="text-center">
                <p class="text-purple-200 text-sm uppercase tracking-widest font-bold">Letra</p>
                <h1 class="text-8xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                    {{ gameState.currentLetter || '?' }}
                </h1>
            </div>

            <div class="flex-1 px-8 text-center">
                 <p class="text-gray-400 text-sm animate-pulse">¡Escribe rápido!</p>
            </div>

            <button 
                @click="handleStop"
                class="group relative px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-2xl rounded-xl transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(220,38,38,0.5)] border-2 border-red-400"
            >
                <span class="absolute inset-0 w-full h-full bg-red-400 opacity-0 group-hover:opacity-20 rounded-xl transition-opacity animate-pulse"></span>
                BASTA!
            </button>
        </div>

        <!-- GAME BOARD -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
                v-for="category in gameState.categories" 
                :key="category"
                class="bg-black/30 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:border-purple-500/50 transition-colors group"
            >
                <label class="block text-purple-200 text-sm font-bold mb-2 uppercase tracking-wide group-hover:text-purple-100">
                    {{ category }}
                </label>
                <input 
                    v-model="answers[category]"
                    type="text"
                    :placeholder="`Empieza con ${gameState.currentLetter}...`"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-black/50 transition-all font-medium text-lg"
                    autofocus
                >
            </div>
        </div>
    </div>
</template>
