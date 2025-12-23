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
    <div class="h-full flex flex-col w-full max-w-4xl mx-auto overflow-hidden">
        <!-- BODY (Scrollable) -->
        <div class="flex-1 overflow-y-auto min-h-0 p-4 scrollbar-thin scrollbar-thumb-white/20">
            <!-- CELEBRATION HEADER -->
            <div class="text-center mb-8 animate-bounce mt-4">
                <h2 class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-200 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                    GAME OVER
                </h2>
                <p class="text-purple-200 text-lg mt-2 font-light tracking-wide uppercase">Podio Final</p>
            </div>
            
            <!-- PODIUM -->
            <div class="flex items-end justify-center gap-4 mb-12 w-full max-w-2xl mx-auto h-64 sm:h-80">
                <!-- 2nd Place -->
                <div v-if="top3[1]" class="flex flex-col items-center w-1/3 animate-[slideUp_1s_ease-out_0.2s_both]">
                    <div class="relative mb-2">
                        <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-gray-300 overflow-hidden shadow-[0_0_20px_rgba(209,213,219,0.5)] bg-gray-200 flex items-center justify-center">
                            <span class="text-4xl sm:text-5xl font-bold text-gray-700">{{ top3[1].avatar || '👤' }}</span>
                        </div>
                        <div class="absolute -top-3 -right-3 bg-gray-300 text-gray-800 font-bold rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center shadow">
                            2
                        </div>
                    </div>
                    <div class="w-full bg-gradient-to-t from-gray-600 to-gray-400 rounded-t-xl h-32 sm:h-48 flex flex-col items-center justify-start pt-4 shadow-2xl relative">
                       <span class="text-white font-bold text-sm sm:text-xl drop-shadow-md truncate w-full text-center px-1">{{ top3[1].name }}</span>
                       <span class="text-gray-200 font-mono text-lg sm:text-2xl mt-1">{{ top3[1].score }} pts</span>
                    </div>
                </div>

                <!-- 1st Place -->
                <div v-if="top3[0]" class="flex flex-col items-center w-1/3 z-10 animate-[slideUp_1s_ease-out_both]">
                     <div class="relative mb-4">
                        <div class="w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-yellow-400 overflow-hidden shadow-[0_0_30px_rgba(250,204,21,0.6)] bg-yellow-100 flex items-center justify-center relative">
                            <span class="text-5xl sm:text-7xl font-bold text-yellow-700">{{ top3[0].avatar || '👤' }}</span>
                        </div>
                         <div class="absolute -top-6 left-1/2 transform -translate-x-1/2 text-4xl sm:text-5xl filter drop-shadow-lg">
                            👑
                        </div>
                        <div class="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 font-bold rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center shadow border-2 border-white">
                            1
                        </div>
                    </div>
                    <div class="w-full bg-gradient-to-t from-yellow-600 via-yellow-500 to-yellow-400 rounded-t-xl h-48 sm:h-64 flex flex-col items-center justify-start pt-6 shadow-[0_0_50px_rgba(234,179,8,0.3)] relative">
                        <span class="text-white font-black text-lg sm:text-2xl drop-shadow-md uppercase tracking-wider truncate w-full text-center px-1">{{ top3[0].name }}</span>
                        <span class="text-yellow-100 font-mono text-2xl sm:text-4xl mt-2 font-bold">{{ top3[0].score }} pts</span>
                        
                        <div class="absolute inset-0 bg-white/10 animate-pulse rounded-t-xl"></div>
                    </div>
                </div>

                <!-- 3rd Place -->
                <div v-if="top3[2]" class="flex flex-col items-center w-1/3 animate-[slideUp_1s_ease-out_0.4s_both]">
                    <div class="relative mb-2">
                        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-orange-400 overflow-hidden shadow-[0_0_20px_rgba(251,146,60,0.5)] bg-orange-200 flex items-center justify-center">
                            <span class="text-3xl sm:text-4xl font-bold text-orange-800">{{ top3[2].avatar || '👤' }}</span>
                        </div>
                         <div class="absolute -top-3 -right-3 bg-orange-400 text-orange-900 font-bold rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center shadow">
                            3
                        </div>
                    </div>
                    <div class="w-full bg-gradient-to-t from-orange-700 to-orange-500 rounded-t-xl h-24 sm:h-36 flex flex-col items-center justify-start pt-4 shadow-2xl relative">
                       <span class="text-white font-bold text-sm sm:text-lg drop-shadow-md truncate w-full text-center px-1">{{ top3[2].name }}</span>
                       <span class="text-orange-200 font-mono text-lg sm:text-xl mt-1">{{ top3[2].score }} pts</span>
                    </div>
                </div>
            </div>
            
            <!-- REST OF PLAYERS -->
            <div v-if="rest.length > 0" class="w-full max-w-xl mx-auto bg-black/20 backdrop-blur-md rounded-xl p-6 border border-white/5 mb-8">
                <h3 class="text-purple-300 font-bold text-center mb-4 uppercase tracking-wider text-sm">Tabla General</h3>
                <div class="space-y-2">
                    <div v-for="(player, idx) in rest" :key="player.id" class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                        <div class="flex items-center gap-3">
                            <span class="text-gray-400 font-mono text-sm">#{{ idx + 4 }}</span>
                            <span class="text-xl">{{ player.avatar || '👤' }}</span>
                            <span class="text-white">{{ player.name }}</span>
                        </div>
                        <span class="text-white font-bold">{{ player.score }} pts</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- FOOTER (Fixed Actions) -->
        <div class="flex-none p-6 border-t border-white/10 bg-black/20 backdrop-blur-sm z-20">
            <div class="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
                 <button 
                    v-if="amIHost"
                    @click="resetGame"
                    class="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-105"
                >
                    🔄 Nueva Partida
                </button>
                <div v-else-if="!amIHost" class="flex-1 text-center py-4 text-white/50 bg-white/5 rounded-xl border border-white/5">
                    Esperando al anfitrión...
                </div>
                
                <button 
                    @click="exitGame"
                    class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all"
                >
                    🚪 Salir
                </button>
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
