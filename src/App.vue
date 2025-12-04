<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSocket } from './composables/useSocket';
import { useGame } from './composables/useGame';
import LobbyView from './components/LobbyView.vue';
import HomeView from './components/HomeView.vue';
import GameView from './components/GameView.vue';

const { isConnected } = useSocket();
const { gameState } = useGame();
const currentView = ref<'HOME' | 'LOBBY' | 'GAME'>('HOME');

const handleNavigate = (view: 'HOME' | 'LOBBY' | 'GAME') => {
  currentView.value = view;
};

// Auto-switch to GAME view when status changes to PLAYING
watch(() => gameState.value.status, (newStatus) => {
    if (newStatus === 'PLAYING' || newStatus === 'REVIEW') {
        currentView.value = 'GAME';
    } else if (newStatus === 'LOBBY' && currentView.value === 'GAME') {
        currentView.value = 'LOBBY';
    }
});
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex flex-col items-center justify-center p-4">
    
    <!-- MAIN TITLE -->
    <h1 class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2 drop-shadow-lg tracking-tight">
      Tutifruti Online
    </h1>
    <p class="text-purple-200 mb-12 text-lg font-light tracking-wide">Project Phoenix</p>

    <!-- CONNECTION STATUS (Top Right) -->
    <div class="fixed top-4 right-4 flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
      <div 
        class="w-3 h-3 rounded-full transition-colors duration-500 shadow-[0_0_10px_currentColor]"
        :class="isConnected ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'"
      ></div>
      <span class="text-xs font-mono text-gray-300">
        {{ isConnected ? 'Connected' : 'Disconnected' }}
      </span>
    </div>

    <!-- MAIN CONTENT -->
    <div class="w-full max-w-4xl transition-all duration-500">
      <HomeView v-if="currentView === 'HOME'" @navigate="handleNavigate" />
      <LobbyView v-else-if="currentView === 'LOBBY'" />
      <GameView v-else-if="currentView === 'GAME'" />
    </div>

  </div>
</template>
