<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGame } from '../composables/useGame';
import { useSound } from '../composables/useSound';
import { MASTER_CATEGORIES } from '../../shared/game-engine';

const { gameState, startGame, updateConfig, myUserId, amIHost, kickPlayer } = useGame();
const { playClick, playJoin, playAlarm, playSuccess } = useSound();

// Local state for config inputs
const localConfig = computed(() => gameState.value.config);

// --- Audio Triggers ---
// Watch for players joining
watch(() => gameState.value.players.length, (newCount, oldCount) => {
    if (newCount > oldCount) {
        playJoin();
    }
});

const handleConfigChange = (field: string, value: any) => {
    updateConfig({ [field]: value });
    playClick();
};

const handleKick = (targetUserId: string, name: string) => {
    if (confirm(`¿Estás seguro de que quieres expulsar a ${name}?`)) {
        kickPlayer(targetUserId);
    }
};

// --- Manual Selection Modal ---
const showCategoriesModal = ref(false);
const searchQuery = ref('');
// We keep a local copy to allow cancelling edits
const tempSelectedCategories = ref<string[]>([]);

const openCategoryModal = () => {
    tempSelectedCategories.value = [...(localConfig.value.selectedCategories || [])];
    showCategoriesModal.value = true;
    searchQuery.value = '';
    playClick();
};

const toggleCategory = (cat: string) => {
    const index = tempSelectedCategories.value.indexOf(cat);
    if (index === -1) {
        tempSelectedCategories.value.push(cat);
    } else {
        tempSelectedCategories.value.splice(index, 1);
    }
    playClick(); // Short click needed here? Maybe too noisy. Let's keep it.
};

const saveCategories = () => {
    handleConfigChange('selectedCategories', tempSelectedCategories.value);
    showCategoriesModal.value = false;
    playSuccess();
};

const filteredCategories = computed(() => {
    const query = searchQuery.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return MASTER_CATEGORIES.filter(cat => {
        const normalized = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalized.includes(query);
    });
});

// --- Steppers & Segmented Logic ---
const incrementRounds = () => {
    const val = (localConfig.value.totalRounds || 5);
    if (val < 20) handleConfigChange('totalRounds', val + 1);
};
const decrementRounds = () => {
     const val = (localConfig.value.totalRounds || 5);
    if (val > 1) handleConfigChange('totalRounds', val - 1);
};

const incrementCategories = () => {
    const val = localConfig.value.categoriesCount;
    if (val < 10) handleConfigChange('categoriesCount', val + 1);
};
const decrementCategories = () => {
     const val = localConfig.value.categoriesCount;
    if (val > 1) handleConfigChange('categoriesCount', val - 1);
};

// Mode Switch
const setRandomMode = () => handleConfigChange('mode', 'RANDOM');
const setManualMode = () => handleConfigChange('mode', 'MANUAL');

const canStart = computed(() => {
    if (!amIHost.value) return false;
    if (localConfig.value.mode === 'MANUAL') {
        return (localConfig.value.selectedCategories?.length || 0) >= 3;
    }
    return true;
});

const handleStart = () => {
    if (canStart.value) {
        playSuccess(); // Or a specific start sound
        startGame();
    } else {
        playAlarm(); // Error sound
    }
};

</script>

<template>
    <div class="h-full flex flex-col w-full max-w-3xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 overflow-hidden relative">
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

            <div class="mt-2 text-center">
                 <span class="inline-block px-3 py-1 rounded-full bg-purple-500/30 text-purple-200 text-xs font-bold border border-white/10">
                    {{ gameState.players.length }} Jugadores
                </span>
            </div>
        </div>

        <!-- BODY (Scrollable Players + Config) -->
        <div class="flex-1 overflow-y-auto min-h-0 p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/20">
            
            <!-- CONFIGURATION PANEL (Host Only) -->
            <div v-if="amIHost" class="space-y-6">
                <!-- Modes -->
                <div class="flex p-1 bg-black/20 rounded-xl">
                    <button 
                        @click="setRandomMode"
                        class="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                        :class="localConfig.mode === 'RANDOM' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/50 hover:text-white'"
                    >
                        🎲 Aleatorio
                    </button>
                    <button 
                         @click="setManualMode"
                        class="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                        :class="localConfig.mode === 'MANUAL' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/50 hover:text-white'"
                    >
                        📝 Manual
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Round Duration (Segmented) -->
                    <div class="bg-black/20 p-4 rounded-xl border border-white/5">
                        <label class="block text-purple-200 text-xs font-bold mb-3 uppercase tracking-wide">Tiempo por Ronda</label>
                        <div class="flex gap-2">
                             <button @click="handleConfigChange('roundDuration', 45)" :class="['flex-1 py-2 rounded-lg text-xs font-bold border transition-all', localConfig.roundDuration === 45 ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10']">Rápido (45s)</button>
                             <button @click="handleConfigChange('roundDuration', 60)" :class="['flex-1 py-2 rounded-lg text-xs font-bold border transition-all', localConfig.roundDuration === 60 ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10']">Normal (60s)</button>
                             <button @click="handleConfigChange('roundDuration', 90)" :class="['flex-1 py-2 rounded-lg text-xs font-bold border transition-all', localConfig.roundDuration === 90 ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10']">Lento (90s)</button>
                        </div>
                    </div>

                    <!-- Total Rounds (Stepper) -->
                    <div class="bg-black/20 p-4 rounded-xl border border-white/5">
                         <label class="block text-purple-200 text-xs font-bold mb-3 uppercase tracking-wide">Cantidad de Rondas</label>
                         <div class="flex items-center justify-between bg-white/5 rounded-lg border border-white/10 p-1">
                             <button @click="decrementRounds" class="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors">
                                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" /></svg>
                             </button>
                             <span class="text-xl font-black text-white font-mono">{{ localConfig.totalRounds || 5 }}</span>
                             <button @click="incrementRounds" class="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors">
                                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                             </button>
                         </div>
                    </div>
                </div>

                <!-- DYNAMIC CONTENT CONFIG -->
                <div class="bg-black/20 p-4 rounded-xl border border-white/5 relative overflow-hidden transition-all duration-300">
                    <div v-if="localConfig.mode === 'RANDOM'">
                         <label class="block text-purple-200 text-xs font-bold mb-3 uppercase tracking-wide">Categorías por Ronda</label>
                         <div class="flex items-center justify-between bg-white/5 rounded-lg border border-white/10 p-1">
                             <button @click="decrementCategories" class="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors">
                                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" /></svg>
                             </button>
                             <span class="text-xl font-black text-white font-mono">{{ localConfig.categoriesCount }}</span>
                             <button @click="incrementCategories" class="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors">
                                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                             </button>
                         </div>
                         <p class="text-xs text-white/40 mt-2 text-center">Se elegirán al azar en cada ronda.</p>
                    </div>

                    <div v-else>
                         <div class="flex justify-between items-center mb-3">
                            <label class="block text-purple-200 text-xs font-bold uppercase tracking-wide">
                                Categorías Seleccionadas ({{ localConfig.selectedCategories?.length || 0 }})
                            </label>
                            <button @click="openCategoryModal" class="text-xs bg-purple-500 hover:bg-purple-400 text-white px-3 py-1.5 rounded-full font-bold transition-all">
                                EDITAR SELECCIÓN
                            </button>
                         </div>
                         
                         <div v-if="localConfig.selectedCategories?.length > 0" class="flex flex-wrap gap-2">
                             <span v-for="cat in localConfig.selectedCategories" :key="cat" class="px-2 py-1 bg-white/10 rounded-md text-xs text-white border border-white/10">
                                 {{ cat }}
                             </span>
                         </div>
                         <div v-else class="text-center py-4 border-2 border-dashed border-white/10 rounded-lg">
                             <p class="text-white/50 text-sm">No has seleccionado categorías.</p>
                             <p class="text-red-400 text-xs mt-1" v-if="localConfig.mode === 'MANUAL' && (localConfig.selectedCategories?.length || 0) < 3">Mínimo 3 requeridas.</p>
                         </div>
                    </div>
                </div>

            </div> 
            <!-- END HOST CONFIG -->
            
             <!-- CONFIGURATION READONLY (Guest) -->
             <div v-else class="space-y-4 pt-4 border-t border-white/10 opacity-70">
                <div class="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col gap-2 text-center">
                    <span class="text-purple-300 text-xs uppercase font-bold tracking-widest">{{ localConfig.mode === 'RANDOM' ? 'Modo Aleatorio' : 'Modo Manual' }}</span>
                    <div class="flex justify-center gap-8 mt-2">
                         <div>
                            <span class="block text-white/50 text-[10px] uppercase font-bold">Rondas</span>
                            <span class="text-white font-bold text-xl">{{ localConfig.totalRounds || 5 }}</span>
                         </div>
                         <div>
                            <span class="block text-white/50 text-[10px] uppercase font-bold">Tiempo</span>
                            <span class="text-white font-bold text-xl">{{ localConfig.roundDuration }}s</span>
                         </div>
                         <div>
                            <span class="block text-white/50 text-[10px] uppercase font-bold">Categs</span>
                            <span class="text-white font-bold text-xl">{{ localConfig.mode === 'RANDOM' ? localConfig.categoriesCount : (localConfig.selectedCategories?.length || 0) }}</span>
                         </div>
                    </div>
                </div>
            </div>

            <!-- PLAYER LIST -->
            <div class="space-y-3">
                <h3 class="text-white font-bold text-lg mb-2 sticky top-0 bg-transparent backdrop-blur-sm z-10">Jugadores Conectados</h3>
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
                    <!-- Actions -->
                    <div class="flex items-center gap-2">
                        <span v-if="player.isHost" class="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded flex items-center gap-1 border border-yellow-400/20">
                            👑 HOST
                        </span>
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

        </div>

        <!-- FOOTER (Action Button) -->
        <div class="flex-none p-6 border-t border-white/10 bg-black/10 flex justify-center z-10">
            <button 
                v-if="amIHost"
                @click="handleStart"
                :disabled="!canStart"
                class="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-purple-500/30 transform transition-all active:scale-95"
            >
                🚀 INICIAR PARTIDA
            </button>
            <div v-else class="text-center">
                <p class="text-purple-200 animate-pulse font-medium">Esperando al anfitrión...</p>
            </div>
        </div>

        <!-- CATEGORY SELECTION MODAL -->
        <div v-if="showCategoriesModal" class="absolute inset-0 z-50 bg-gray-900/95 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom-10 duration-300">
            <div class="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                <h3 class="text-white font-bold text-lg">Seleccionar Categorías</h3>
                <span class="text-purple-300 text-xs font-mono bg-purple-500/10 px-2 py-1 rounded">{{ tempSelectedCategories.length }} seleccionadas</span>
            </div>
            
            <div class="p-4 bg-black/20">
                <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Buscar categoría (ej: Animal, País)..." 
                    class="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    autoFocus
                >
            </div>

            <div class="flex-1 overflow-y-auto p-4 content-start">
                 <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                     <button
                        v-for="cat in filteredCategories"
                        :key="cat"
                        @click="toggleCategory(cat)"
                        class="text-left px-3 py-2 rounded-lg text-sm border transition-all duration-200"
                        :class="tempSelectedCategories.includes(cat) ? 'bg-purple-600 border-purple-400 text-white shadow-md transform scale-[1.02]' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'"
                     >
                        {{ cat }}
                     </button>
                     <p v-if="filteredCategories.length === 0" class="col-span-full text-center text-white/30 py-8">
                         No se encontraron resultados para "{{ searchQuery }}"
                     </p>
                 </div>
            </div>

            <div class="p-4 border-t border-white/10 bg-black/40 flex gap-3">
                <button @click="showCategoriesModal = false" class="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all">
                    Cancelar
                </button>
                <button @click="saveCategories" class="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg">
                    Guardar ({{ tempSelectedCategories.length }})
                </button>
            </div>
        </div>

    </div>
</template> 

