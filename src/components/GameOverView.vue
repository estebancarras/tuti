<script setup lang="ts">
import { computed } from 'vue';
import { useGame } from '../composables/useGame';
const { gameState, myUserId, resetGame } = useGame();

// Check if current user is host checking ID
const amIHost = computed(() => {
    const me = gameState.value.players.find(p => p.id === myUserId.value);
    return me?.isHost || false;
});

const sortedPlayers = computed(() => {
    return [...gameState.value.players].sort((a, b) => b.score - a.score);
});

const top3 = computed(() => sortedPlayers.value.slice(0, 3));
const rest = computed(() => sortedPlayers.value.slice(3));



const exitGame = () => {
    window.location.reload();
};
</script>

<template>
    <div class="max-w-4xl mx-auto p-4 flex flex-col items-center">
        <!-- CELEBRATION HEADER -->
        <div class="text-center mb-12 animate-bounce">
            <h2 class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-200 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                GAME OVER
            </h2>
            <p class="text-purple-200 text-lg mt-2 font-light tracking-wide uppercase">Podio Final</p>
        </div>
        
        <!-- PODIUM -->
        <div class="flex items-end justify-center gap-4 mb-16 w-full max-w-2xl h-80">
            <!-- 2nd Place -->
            <div v-if="top3[1]" class="flex flex-col items-center w-1/3 animate-[slideUp_1s_ease-out_0.2s_both]">
                <div class="relative mb-2">
                    <div class="w-20 h-20 rounded-full border-4 border-gray-300 overflow-hidden shadow-[0_0_20px_rgba(209,213,219,0.5)] bg-gray-200 flex items-center justify-center">
                        <span class="text-3xl font-bold text-gray-700">{{ top3[1].name.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="absolute -top-3 -right-3 bg-gray-300 text-gray-800 font-bold rounded-full w-8 h-8 flex items-center justify-center shadow">
                        2
                    </div>
                </div>
                <div class="w-full bg-gradient-to-t from-gray-600 to-gray-400 rounded-t-xl h-48 flex flex-col items-center justify-start pt-4 shadow-2xl relative">
                   <span class="text-white font-bold text-xl drop-shadow-md">{{ top3[1].name }}</span>
                   <span class="text-gray-200 font-mono text-2xl mt-1">{{ top3[1].score }} pts</span>
                </div>
            </div>

            <!-- 1st Place -->
            <div v-if="top3[0]" class="flex flex-col items-center w-1/3 z-10 animate-[slideUp_1s_ease-out_both]">
                 <div class="relative mb-4">
                    <div class="w-28 h-28 rounded-full border-4 border-yellow-400 overflow-hidden shadow-[0_0_30px_rgba(250,204,21,0.6)] bg-yellow-100 flex items-center justify-center relative">
                        <span class="text-5xl font-bold text-yellow-700">{{ top3[0].name.charAt(0).toUpperCase() }}</span>
                    </div>
                     <div class="absolute -top-6 left-1/2 transform -translate-x-1/2 text-5xl filter drop-shadow-lg">
                        👑
                    </div>
                    <div class="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 font-bold rounded-full w-10 h-10 flex items-center justify-center shadow border-2 border-white">
                        1
                    </div>
                </div>
                <div class="w-full bg-gradient-to-t from-yellow-600 via-yellow-500 to-yellow-400 rounded-t-xl h-64 flex flex-col items-center justify-start pt-6 shadow-[0_0_50px_rgba(234,179,8,0.3)] relative">
                    <span class="text-white font-black text-2xl drop-shadow-md uppercase tracking-wider">{{ top3[0].name }}</span>
                    <span class="text-yellow-100 font-mono text-4xl mt-2 font-bold">{{ top3[0].score }} pts</span>
                    
                    <div class="absolute inset-0 bg-white/10 animate-pulse rounded-t-xl"></div>
                </div>
            </div>

            <!-- 3rd Place -->
            <div v-if="top3[2]" class="flex flex-col items-center w-1/3 animate-[slideUp_1s_ease-out_0.4s_both]">
                <div class="relative mb-2">
                    <div class="w-16 h-16 rounded-full border-4 border-orange-400 overflow-hidden shadow-[0_0_20px_rgba(251,146,60,0.5)] bg-orange-200 flex items-center justify-center">
                        <span class="text-2xl font-bold text-orange-800">{{ top3[2].name.charAt(0).toUpperCase() }}</span>
                    </div>
                     <div class="absolute -top-3 -right-3 bg-orange-400 text-orange-900 font-bold rounded-full w-8 h-8 flex items-center justify-center shadow">
                        3
                    </div>
                </div>
                <div class="w-full bg-gradient-to-t from-orange-700 to-orange-500 rounded-t-xl h-36 flex flex-col items-center justify-start pt-4 shadow-2xl relative">
                   <span class="text-white font-bold text-lg drop-shadow-md">{{ top3[2].name }}</span>
                   <span class="text-orange-200 font-mono text-xl mt-1">{{ top3[2].score }} pts</span>
                </div>
            </div>
        </div>
        
        <!-- REST OF PLAYERS -->
        <div v-if="rest.length > 0" class="w-full max-w-xl bg-black/20 backdrop-blur-md rounded-xl p-6 border border-white/5 mb-8">
            <h3 class="text-purple-300 font-bold text-center mb-4 uppercase tracking-wider text-sm">Tabla General</h3>
            <div class="space-y-2">
                <div v-for="(player, idx) in rest" :key="player.id" class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                    <div class="flex items-center gap-3">
                        <span class="text-gray-400 font-mono text-sm">#{{ idx + 4 }}</span>
                        <span class="text-white">{{ player.name }}</span>
                    </div>
                    <span class="text-purple-300 font-mono">{{ player.score }} pts</span>
                </div>
            </div>
        </div>

        <!-- ACTIONS -->
        <div class="flex gap-4">
            <button 
                @click="exitGame"
                class="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold border border-white/10 transition-all hover:scale-105"
            >
                Salir
            </button>
            <button 
                v-if="amIHost"
                @click="resetGame"
                class="px-8 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold shadow-lg transition-all hover:scale-105 hover:shadow-purple-500/25 ring-2 ring-white/20"
            >
                Volver al Lobby
            </button>
            <div v-else class="flex flex-col items-center justify-center p-3 bg-white/5 rounded-full border border-white/10 px-6">
                <span class="text-purple-200 text-sm animate-pulse">Esperando al anfitrión...</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
@keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
</style>
