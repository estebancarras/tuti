<script setup lang="ts">
import { computed } from 'vue';
import { useGame } from '../composables/useGame';

const { gameState, startGame, updateConfig, myUserId, amIHost, kickPlayer } = useGame();

// Local state for config inputs (we'll sync them with gameState.config)
const localConfig = computed(() => gameState.value.config);

const handleConfigChange = (field: 'roundDuration' | 'votingDuration' | 'categoriesCount' | 'totalRounds', value: number) => {
    updateConfig({ [field]: value });
};

const handleKick = (targetUserId: string, name: string) => {
    if (confirm(`¿Estás seguro de que quieres expulsar a ${name}?`)) {
        kickPlayer(targetUserId);
    }
};
</script>

<template>
    <div class="h-full flex flex-col w-full max-w-3xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 overflow-hidden">
        <!-- HEADER (Fixed) -->
        <div class="flex-none text-center p-6 border-b border-white/10 bg-black/10">
            <h2 class="text-3xl font-bold text-white mb-2">Sala de Espera</h2>
            
            <!-- ROOM CODE -->
            <div class="flex flex-col items-center justify-center gap-2 my-2 p-3 bg-black/40 rounded-xl border border-white/10 inline-block min-w-[200px]">
                <span class="text-purple-300 text-[10px] uppercase tracking-widest">Código</span>
                <span class="text-4xl font-mono font-black text-white tracking-[0.5em] pl-2 leading-none">
                    {{ gameState.roomId || '----' }}
                </span>
            </div>

            <div class="mt-2">
                <span class="inline-block px-3 py-1 rounded-full bg-purple-500/30 text-purple-200 text-xs font-bold border border-white/10">
                    {{ gameState.players.length }} Jugadores
                </span>
            </div>
        </div>

        <!-- BODY (Scrollable Players + Config) -->
        <div class="flex-1 overflow-y-auto min-h-0 p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/20">
            
            <!-- PLAYER LIST -->
            <div class="space-y-3">
                <h3 class="text-white font-bold text-lg mb-2 sticky top-0 bg-transparent backdrop-blur-sm z-10">Jugadores</h3>
                <div 
                    v-for="player in gameState.players" 
                    :key="player.id"
                    :class="['flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-black/30 group', 
                             player.isConnected ? 'bg-black/20 border-white/5' : 'bg-black/10 border-white/5 opacity-50']"
                >
                    <div class="flex items-center gap-3">
                        <div class="relative">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-2xl shadow-inner border border-white/20">
                                {{ player.avatar || '👤' }}
                            </div>
                            <!-- Online Status Dot -->
                            <div 
                                :class="['absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-black', 
                                         player.isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-red-500/50']"
                            ></div>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-white font-medium text-sm">
                                {{ player.name }}
                                <span v-if="player.id === myUserId" class="ml-2 text-[10px] bg-blue-100/20 text-blue-200 px-2 py-0.5 rounded-full font-bold uppercase">(Tú)</span>
                            </span>
                            <span v-if="!player.isConnected" class="text-[9px] text-red-400 uppercase font-bold tracking-wider">
                                DESCONECTADO
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span v-if="player.isHost" class="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded flex items-center gap-1 border border-yellow-400/20">
                            👑 HOST
                        </span>
                        <!-- Kick Button (Host Only) -->
                        <button 
                            v-if="amIHost && player.id !== myUserId"
                            @click="handleKick(player.id, player.name)"
                            class="text-red-500 hover:text-red-400 p-1.5 rounded-full hover:bg-white/5 transition-colors"
                            title="Expulsar jugador"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- CONFIGURATION PANEL (Host Only) -->
            <div v-if="amIHost" class="space-y-4 pt-4 border-t border-white/10">
                <h3 class="text-white font-bold text-lg mb-2">Configuración</h3>
                
                <!-- Round Duration -->
                <div class="bg-black/20 p-3 rounded-lg border border-white/5">
                    <label class="block text-purple-200 text-xs font-bold mb-2 uppercase tracking-wide">
                        Duración de Ronda: <span class="text-white">{{ localConfig.roundDuration }}s</span>
                    </label>
                    <input 
                        type="range" 
                        min="30" 
                        max="300" 
                        step="10" 
                        :value="localConfig.roundDuration"
                        @input="(e) => handleConfigChange('roundDuration', Number((e.target as HTMLInputElement).value))"
                        class="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
                    >
                </div>

                <!-- Total Rounds -->
                <div class="bg-black/20 p-3 rounded-lg border border-white/5">
                     <label class="block text-purple-200 text-xs font-bold mb-2 uppercase tracking-wide">
                        Total Rondas: <span class="text-white">{{ localConfig.totalRounds || 5 }}</span>
                    </label>
                    <input 
                        type="range" 
                        min="3" 
                        max="20" 
                        step="1" 
                        :value="localConfig.totalRounds || 5"
                        @input="(e) => handleConfigChange('totalRounds', Number((e.target as HTMLInputElement).value))"
                        class="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400 transition-all"
                    >
                </div>
                 
                 <!-- Categories Count -->
                <div class="bg-black/20 p-3 rounded-lg border border-white/5">
                    <label class="block text-purple-200 text-xs font-bold mb-2 uppercase tracking-wide">
                        Categorías: <span class="text-white">{{ localConfig.categoriesCount }}</span>
                    </label>
                    <input 
                        type="range" 
                        min="3" 
                        max="12" 
                        step="1" 
                        :value="localConfig.categoriesCount"
                        @input="(e) => handleConfigChange('categoriesCount', Number((e.target as HTMLInputElement).value))"
                        class="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                    >
                </div>
            </div>

             <!-- CONFIGURATION READONLY (Guest) -->
             <div v-else class="space-y-4 pt-4 border-t border-white/10 opacity-70">
                <h3 class="text-white font-bold text-lg mb-2">Configuración de la Partida</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-black/20 p-3 rounded-lg border border-white/5 text-center">
                        <span class="block text-purple-300 text-[10px] uppercase font-bold">Rondas</span>
                        <span class="text-white font-bold text-xl">{{ localConfig.totalRounds || 5 }}</span>
                    </div>
                     <div class="bg-black/20 p-3 rounded-lg border border-white/5 text-center">
                        <span class="block text-purple-300 text-[10px] uppercase font-bold">Tiempo</span>
                        <span class="text-white font-bold text-xl">{{ localConfig.roundDuration }}s</span>
                    </div>
                </div>
            </div>

        </div>

        <!-- FOOTER (Action Button) -->
        <div class="flex-none p-6 border-t border-white/10 bg-black/10 flex justify-center">
            <button 
                v-if="amIHost"
                @click="startGame"
                class="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-purple-500/30 transform transition-all active:scale-95"
            >
                🚀 INICIAR PARTIDA
            </button>
            <div v-else class="text-center">
                <p class="text-purple-200 animate-pulse font-medium">Esperando al anfitrión...</p>
            </div>
        </div>
    </div>
</template> 

