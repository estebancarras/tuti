<script setup lang="ts">
import { computed } from 'vue';
import { useGame } from '../composables/useGame';
import { useSocket } from '../composables/useSocket'; // Import socket composable

const { gameState, startGame, updateConfig, myUserId, amIHost } = useGame();
const { socket } = useSocket();

// Local state for config inputs (we'll sync them with gameState.config)
const localConfig = computed(() => gameState.value.config);

const handleConfigChange = (field: 'roundDuration' | 'votingDuration' | 'categoriesCount' | 'totalRounds', value: number) => {
    updateConfig({ [field]: value });
};

const kickPlayer = (targetUserId: string, name: string) => {
    if (confirm(`¿Estás seguro de que quieres expulsar a ${name}?`)) {
        socket.value?.send(JSON.stringify({
            type: 'KICK_PLAYER',
            payload: { targetUserId }
        }));
    }
};
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
                    :class="['flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-black/30 group', 
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
                                <span v-if="player.id === myUserId" class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">(Tú)</span>
                            </span>
                            <span v-if="!player.isConnected" class="text-[10px] text-red-400 uppercase font-bold tracking-wider">
                                DESCONECTADO
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span v-if="player.isHost" class="text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded flex items-center gap-1 shadow-[0_0_10px_rgba(250,204,21,0.2)]">
                            👑 HOST
                        </span>
                        <!-- Kick Button (Host Only) -->
                        <button 
                            v-if="amIHost && player.id !== myUserId"
                            @click="kickPlayer(player.id, player.name)"
                            class="text-red-500 hover:text-red-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Expulsar jugador"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- CONFIGURATION PANEL -->
            <div class="space-y-4">
                <h3 class="text-white font-bold text-lg mb-3">Configuración</h3>
                
                <div v-if="amIHost">
                    <!-- Round Duration -->
                    <div class="bg-black/20 p-4 rounded-lg border border-white/5 mb-4">
                        <label class="block text-purple-200 text-sm font-bold mb-2">
                            Duración de Ronda: {{ localConfig.roundDuration }}s
                        </label>
                        <input 
                            type="range" 
                            min="30" 
                            max="180" 
                            step="10"
                            :value="localConfig.roundDuration"
                            @input="e => handleConfigChange('roundDuration', parseInt((e.target as HTMLInputElement).value))"
                            class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        >
                    </div>

                    <!-- Voting Duration -->
                    <div class="bg-black/20 p-4 rounded-lg border border-white/5 mb-4">
                        <label class="block text-purple-200 text-sm font-bold mb-2">
                            Duración de Votación: {{ localConfig.votingDuration }}s
                        </label>
                        <input 
                            type="range" 
                            min="15" 
                            max="120" 
                            step="5"
                            :value="localConfig.votingDuration"
                            @input="e => handleConfigChange('votingDuration', parseInt((e.target as HTMLInputElement).value))"
                            class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        >
                    </div>

                    <!-- Total Rounds -->
                    <div class="bg-black/20 p-4 rounded-lg border border-white/5 mb-4">
                        <label class="block text-purple-200 text-sm font-bold mb-2">
                            Total de Rondas: {{ localConfig.totalRounds || 5 }}
                        </label>
                        <input 
                            type="range" 
                            min="1" 
                            max="20" 
                            step="1"
                            :value="localConfig.totalRounds || 5"
                            @input="e => handleConfigChange('totalRounds', parseInt((e.target as HTMLInputElement).value))"
                            class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        >
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
                            @input="e => handleConfigChange('categoriesCount', parseInt((e.target as HTMLInputElement).value))"
                            class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        >
                    </div>
                </div>

                <!-- READ ONLY CONFIG FOR GUESTS -->
                <div v-else class="grid grid-cols-1 gap-4">
                    <div class="bg-black/30 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                        <div>
                            <span class="block text-xs uppercase tracking-wider text-purple-400 font-bold mb-1">Duración</span>
                            <span class="text-2xl font-mono text-white font-bold">{{ localConfig.roundDuration }}s</span>
                        </div>
                        <div class="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
                            ⏱️
                        </div>
                    </div>

                    <div class="bg-black/30 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                        <div>
                            <span class="block text-xs uppercase tracking-wider text-purple-400 font-bold mb-1">Votación</span>
                            <span class="text-2xl font-mono text-white font-bold">{{ localConfig.votingDuration }}s</span>
                        </div>
                        <div class="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
                            ⚖️
                        </div>
                    </div>

                    <div class="bg-black/30 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                        <div>
                            <span class="block text-xs uppercase tracking-wider text-purple-400 font-bold mb-1">Rondas</span>
                            <span class="text-2xl font-mono text-white font-bold">{{ localConfig.totalRounds || 5 }}</span>
                        </div>
                        <div class="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
                            🏁
                        </div>
                    </div>

                    <div class="bg-black/30 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                        <div>
                            <span class="block text-xs uppercase tracking-wider text-purple-400 font-bold mb-1">Categorías</span>
                            <span class="text-2xl font-mono text-white font-bold">{{ localConfig.categoriesCount }}</span>
                        </div>
                        <div class="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
                            📚
                        </div>
                    </div>
                    
                    <div class="mt-2 text-center text-xs text-white/30 italic">
                        Esperando que el anfitrión inicie la partida...
                    </div>
                </div>

        </div>
    </div>

        <!-- HOST CONTROLS -->
        <div class="pt-6 mt-6 border-t border-white/10 text-center">
            <button 
                v-if="amIHost"
                @click="startGame"
                class="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold rounded-xl transform transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center justify-center gap-3 text-lg"
            >
                <span>🚀</span> COMENZAR PARTIDA
            </button>
            
            <div v-else class="flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/5 animate-pulse">
                <p class="text-purple-200 font-medium mb-1">Esperando al anfitrión...</p>
                <div class="h-1 w-32 bg-purple-500/20 rounded-full overflow-hidden mt-2">
                    <div class="h-full bg-purple-400 w-1/3 animate-[shimmer_1.5s_infinite]"></div>
                </div>
            </div>
        </div>
    </div>
</template>
