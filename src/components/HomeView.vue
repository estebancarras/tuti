<script setup lang="ts">
import { ref, watch } from 'vue';
import { generateRoomId } from '../utils/random';
import { useGame } from '../composables/useGame';

const emit = defineEmits(['navigate']);
const { joinGame, myUserName } = useGame();

const showJoinInput = ref(false);
const joinCode = ref('');
// Initialize with persisted name, sync back on input
const playerName = ref(myUserName.value);

watch(playerName, (val: string) => {
    myUserName.value = val;
});

const handleCreateRoom = () => {
    if (!playerName.value.trim()) {
        alert('Por favor ingresa tu nombre primero');
        return;
    }
    const roomId = generateRoomId();
    joinGame(playerName.value, roomId);
    emit('navigate', 'LOBBY');
};

const handleJoinRoom = () => {
    if (!playerName.value.trim()) {
        alert('Por favor ingresa tu nombre primero');
        return;
    }
    if (!joinCode.value.trim() || joinCode.value.length !== 4) {
        alert('Código de sala inválido');
        return;
    }
    joinGame(playerName.value, joinCode.value.toUpperCase());
    emit('navigate', 'LOBBY');
};
</script>

<template>
    <div class="max-w-md mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-white/20 text-center">
        <h2 class="text-3xl font-bold text-white mb-8">Bienvenido</h2>

        <!-- NAME INPUT (Always required) -->
        <div class="mb-8">
            <label class="block text-sm font-medium text-purple-200 mb-2 text-left">Tu Nombre</label>
            <input 
                v-model="playerName"
                type="text" 
                class="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400 transition-all text-center text-lg font-bold"
                placeholder="¿Cómo te llamas?"
            >
        </div>

        <!-- ACTION BUTTONS -->
        <div v-if="!showJoinInput" class="space-y-4">
            <button 
                @click="handleCreateRoom"
                class="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transform transition-all hover:scale-105 shadow-lg flex items-center justify-center gap-3"
            >
                <span class="text-2xl">✨</span> Crear Nueva Sala
            </button>

            <button 
                @click="showJoinInput = true"
                class="w-full py-4 px-6 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transform transition-all hover:scale-105 border border-white/10 flex items-center justify-center gap-3"
            >
                <span class="text-2xl">👋</span> Unirse a Sala
            </button>
        </div>

        <!-- JOIN INPUT -->
        <div v-else class="space-y-4 animate-fade-in">
            <div>
                <label class="block text-sm font-medium text-purple-200 mb-2 text-left">Código de Sala</label>
                <input 
                    v-model="joinCode"
                    @keyup.enter="handleJoinRoom"
                    type="text" 
                    maxlength="4"
                    class="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400 transition-all text-center text-2xl font-mono tracking-widest uppercase"
                    placeholder="ABCD"
                >
            </div>
            <div class="flex gap-3">
                <button 
                    @click="showJoinInput = false"
                    class="flex-1 py-3 px-4 bg-gray-600/50 hover:bg-gray-600/70 text-white font-bold rounded-lg transition-all"
                >
                    Cancelar
                </button>
                <button 
                    @click="handleJoinRoom"
                    class="flex-[2] py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg transition-all shadow-lg"
                >
                    Entrar
                </button>
            </div>
        </div>
    </div>
</template>
