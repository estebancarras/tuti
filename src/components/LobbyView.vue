<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGame } from '../composables/useGame';

const { gameState, startGame, updateConfig } = useGame();

// Local state for config inputs (we'll sync them with gameState.config)
const localConfig = computed(() => gameState.value.config);

const handleConfigChange = (field: 'roundDuration' | 'votingDuration' | 'categoriesCount', value: number) => {
    updateConfig({ [field]: value });
};

// Check if current user is host (simplified - in real app would check userId)
const isHost = computed(() => gameState.value.players.length > 0 && gameState.value.players[0].isHost);
</script>

<template>
    <div class="max-w-2xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-white/20">
        <!-- HEADER -->
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold text-white mb-2">Sala de Espera</h2>
            
            <!-- ROOM CODE -->
            <div class="flex flex-col items-center justify-center gap-2 my-4 p-4 bg-black/40 rounded-xl border border-white/10">
                <span class="text-purple-300 text-xs uppercase tracking-widest">Código de Sala</span>
                <span class="text-4xl font-mono font-black text-white tracking-[0.5em] pl-2">
                    {{ gameState.roomId || '----' }}
                </span>
            </div>

            <div class="inline-block px-3 py-1 rounded-full bg-purple-500/30 text-purple-200 text-sm">
                {{ gameState.players.length }} Jugadores Conectados
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- PLAYER LIST -->
            <div class="space-y-3">
                <h3 class="text-white font-bold text-lg mb-3">Jugadores</h3>
                <div 
                    v-for="player in gameState.players" 
                    :key="player.id"
                    :class="['flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-black/30', 
                             player.isConnected ? 'bg-black/20 border-white/5' : 'bg-black/10 border-white/5 opacity-50']"
                >
                    <div class="flex items-center gap-3">
                        <div class="relative">
                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                                {{ player.name.charAt(0).toUpperCase() }}
                            </div>
                            <!-- Online Status Dot -->
                            <div 
                                :class="['absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-black', 
                                         player.isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-red-500/50']"
                            ></div>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-white font-medium">
                                {{ player.name }}
                            </span>
                            <span v-if="!player.isConnected" class="text-[10px] text-red-400 uppercase font-bold tracking-wider">
                                DESCONECTADO
                            </span>
                        </div>
                    </div>
                    <span v-if="player.isHost" class="text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded flex items-center gap-1 shadow-[0_0_10px_rgba(250,204,21,0.2)]">
                        👑 HOST
                    </span>
                </div>
            </div>

            <!-- CONFIGURATION PANEL -->
            <div class="space-y-4">
                <h3 class="text-white font-bold text-lg mb-3">Configuración</h3>
                
                <!-- Round Duration -->
                <div class="bg-black/20 p-4 rounded-lg border border-white/5">
                    <label class="block text-purple-200 text-sm font-bold mb-2">
                        Duración de Ronda: {{ localConfig.roundDuration }}s
                    </label>
                    <input 
                        type="range" 
                        min="30" 
                        max="180" 
                        step="10"
                        :value="localConfig.roundDuration"
                        @input="handleConfigChange('roundDuration', parseInt(($event.target as HTMLInputElement).value))"
                        :disabled="!isHost"
                        class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    <div class="flex justify-between text-xs text-gray-400 mt-1">
                        <span>30s</span>
                        <span>180s</span>
                    </div>
                </div>

                <!-- Voting Duration -->
                <div class="bg-black/20 p-4 rounded-lg border border-white/5">
                    <label class="block text-purple-200 text-sm font-bold mb-2">
                        Duración de Votación: {{ localConfig.votingDuration }}s
                    </label>
                    <input 
                        type="range" 
                        min="15" 
                        max="120" 
                        step="5"
                        :value="localConfig.votingDuration"
                        @input="handleConfigChange('votingDuration', parseInt(($event.target as HTMLInputElement).value))"
                        :disabled="!isHost"
                        class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    <div class="flex justify-between text-xs text-gray-400 mt-1">
                        <span>15s</span>
                        <span>120s</span>
                    </div>
                </div>

                <!-- Categories Count -->
                <div class="bg-black/20 p-4 rounded-lg border border-white/5">
                    <label class="block text-purple-200 text-sm font-bold mb-2">
                        Cantidad de Categorías: {{ localConfig.categoriesCount }}
                    </label>
                    <input 
                        type="range" 
                        min="4" 
                        max="8" 
                        step="1"
                        :value="localConfig.categoriesCount"
                        @input="handleConfigChange('categoriesCount', parseInt(($event.target as HTMLInputElement).value))"
                        :disabled="!isHost"
                        class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    <div class="flex justify-between text-xs text-gray-400 mt-1">
                        <span>4</span>
                        <span>8</span>
                    </div>
                </div>

                <p v-if="!isHost" class="text-xs text-gray-400 italic text-center">
                    Solo el anfitrión puede cambiar la configuración
                </p>
            </div>
        </div>

        <!-- HOST CONTROLS -->
        <div class="pt-6 mt-6 border-t border-white/10 text-center">
            <button 
                v-if="isHost"
                @click="startGame"
                class="w-full py-3 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold rounded-lg transform transition-all hover:scale-105 shadow-lg flex items-center justify-center gap-2"
            >
                <span>🚀</span> Comenzar Partida
            </button>
            
            <p v-else class="text-gray-400 text-sm animate-pulse">
                Esperando al anfitrión para comenzar...
            </p>
        </div>
    </div>
</template>
