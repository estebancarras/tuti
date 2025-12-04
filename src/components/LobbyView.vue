<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGame } from '../composables/useGame';

const { gameState, startGame } = useGame();

// We need to know if *we* are the host. 
// Since we don't have a persistent "myPlayerId" in this simple mock setup yet,
// let's assume for the UI that if we are in the lobby, we are connected.
// Real implementation would check socket.id against player.id.
</script>

<template>
    <div class="max-w-md mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-white/20">
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

        <!-- PLAYER LIST -->
        <div class="space-y-6">
            <div class="space-y-3">
                <div 
                    v-for="player in gameState.players" 
                    :key="player.id"
                    class="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5 transition-all hover:bg-black/30"
                >
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                            {{ player.name.charAt(0).toUpperCase() }}
                        </div>
                        <span class="text-white font-medium">
                            {{ player.name }}
                        </span>
                    </div>
                    <span v-if="player.isHost" class="text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded flex items-center gap-1">
                        👑 HOST
                    </span>
                </div>
            </div>

            <!-- HOST CONTROLS -->
            <div class="pt-4 border-t border-white/10 text-center">
                <!-- We show this button if there is a host (mock simplification) -->
                <!-- In real app: v-if="myPlayer.isHost" -->
                <button 
                    v-if="gameState.players.length > 0 && gameState.players[0].isHost"
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
    </div>
</template>

