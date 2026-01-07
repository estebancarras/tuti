<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGame } from '../composables/useGame';
import { useSound } from '../composables/useSound';
import { MASTER_CATEGORIES } from '../../shared/game-engine';

const { gameState, startGame, updateConfig, myUserId, amIHost, kickPlayer } = useGame();
const { playClick, playJoin, playAlarm, playSuccess } = useSound();

// Local state
const localConfig = computed(() => gameState.value.config);

// --- Audio Triggers ---
watch(() => gameState.value.players.length, (newCount, oldCount) => {
    if (newCount > oldCount) playJoin();
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

const handleQuickDelete = (catName: string) => {
    const current = localConfig.value.selectedCategories || [];
    const newSelection = current.filter(c => c !== catName);
    handleConfigChange('selectedCategories', newSelection);
};

// --- Manual Selection Modal ---
const showCategoriesModal = ref(false);
const searchQuery = ref('');
const activeFilterTag = ref<string | null>(null);
const tempSelectedCategories = ref<string[]>([]);

const openCategoryModal = () => {
    tempSelectedCategories.value = [...(localConfig.value.selectedCategories || [])];
    showCategoriesModal.value = true;
    searchQuery.value = '';
    activeFilterTag.value = null;
    playClick();
};

const toggleCategory = (catName: string) => {
    const index = tempSelectedCategories.value.indexOf(catName);
    if (index === -1) {
        tempSelectedCategories.value.push(catName);
    } else {
        tempSelectedCategories.value.splice(index, 1);
    }
    playClick();
};

const saveCategories = () => {
    handleConfigChange('selectedCategories', tempSelectedCategories.value);
    showCategoriesModal.value = false;
    playSuccess();
};

// Extract unique tags and filter logic
const availableTags = computed(() => {
    const tags = new Set<string>();
    MASTER_CATEGORIES.forEach(c => c.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
});

const filteredCategories = computed(() => {
    const query = searchQuery.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return MASTER_CATEGORIES.filter(cat => {
        if (activeFilterTag.value && !cat.tags.includes(activeFilterTag.value)) return false;
        const normalized = cat.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalized.includes(query);
    });
});

// --- Steppers Logic ---
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

const incrementDuration = () => {
    const current = localConfig.value.roundDuration || 60;
    const options = [45, 60, 90, 120];
    const idx = options.indexOf(current);
    if (idx < options.length - 1) handleConfigChange('roundDuration', options[idx + 1]);
}
const decrementDuration = () => {
    const current = localConfig.value.roundDuration || 60;
    const options = [45, 60, 90, 120];
    const idx = options.indexOf(current);
    if (idx > 0) handleConfigChange('roundDuration', options[idx - 1]);
}


// Start Logic
const canStart = computed(() => {
    if (!amIHost.value) return false;
    if (localConfig.value.mode === 'MANUAL') {
        return (localConfig.value.selectedCategories?.length || 0) >= 3;
    }
    return true;
});

const handleStart = () => {
    if (canStart.value) {
        playSuccess();
        startGame();
    } else {
        playAlarm();
    }
};
</script>

<template>
    <div class="h-[100dvh] w-full max-w-6xl mx-auto flex flex-col p-2 md:p-4 overflow-hidden">
        
        <!-- === TITLE === -->
        <h1 class="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] mb-4 text-center tracking-tight flex-none">
            CENTRO DE MANDO
        </h1>

        <!-- === GRID LAYOUT === -->
        <div class="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">
            
            <!-- === LEFT PANEL: SOCIAL ZONE (4 cols) === -->
            <div class="md:col-span-4 flex flex-col gap-4 min-h-0">
                
                <!-- ROOM CODE CARD -->
                <div class="bg-indigo-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl relative overflow-hidden group flex-none">
                     <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 via-yellow-400 to-fuchsia-500 opacity-60"></div>
                     <!-- Glowing Background -->
                     <div class="absolute inset-0 bg-indigo-600/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                     <div class="relative z-10 flex flex-col items-center">
                        <span class="text-indigo-300 text-[10px] font-bold tracking-[0.3em] uppercase mb-1">Código de Sala</span>
                        <div class="flex items-center gap-2">
                            <span class="text-5xl font-black text-white tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] font-mono">
                                {{ gameState.roomId || '----' }}
                            </span>
                        </div>
                        <p class="text-white/30 text-[9px] mt-1 font-bold uppercase tracking-wider">Comparte este código para invitar</p>
                     </div>
                </div>

                <!-- PLAYERS LIST CARD -->
                <div class="bg-indigo-900/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex-1 flex flex-col overflow-hidden relative min-h-0">
                    <div class="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                         <h3 class="text-indigo-200 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                             Jugadores <span class="bg-indigo-500 px-2 py-0.5 rounded text-white text-[10px]">{{ gameState.players.length }}</span>
                         </h3>
                         <div v-if="amIHost" class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
                    </div>

                    <div class="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-indigo-500/30 scrollbar-track-transparent">
                        <div v-for="player in gameState.players" :key="player.id"
                             class="flex items-center justify-between p-2 pl-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors group"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-lg shadow-inner border border-white/10 relative">
                                    {{ player.avatar || '👤' }}
                                    <div v-if="player.isHost" class="absolute -top-1 -right-1 bg-yellow-400 text-black text-[7px] font-black px-1 rounded-full shadow-sm">HOST</div>
                                </div>
                                <div>
                                    <div class="font-bold text-slate-100 text-xs flex items-center gap-1">
                                        {{ player.name }}
                                        <span v-if="player.id === myUserId" class="text-[8px] text-cyan-300 bg-cyan-950/50 px-1 rounded border border-cyan-800">YO</span>
                                    </div>
                                    <div class="text-[8px] uppercase font-bold tracking-wider" :class="player.isConnected ? 'text-green-400' : 'text-red-400'">
                                        {{ player.isConnected ? 'Conectado' : 'Desconectado' }}
                                    </div>
                                </div>
                            </div>
                            
                            <button v-if="amIHost && player.id !== myUserId" @click="handleKick(player.id, player.name)" class="opacity-0 group-hover:opacity-100 p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                                🚫
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            <!-- === RIGHT PANEL: CONTROL ZONE (8 cols) === -->
            <div class="md:col-span-8 flex flex-col gap-4 min-h-0">
                
                <!-- MAIN CONFIG CARD -->
                <div class="bg-indigo-900/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col flex-1 relative">
                    <!-- Host Only Overlay (if not host) -->
                    <div v-if="!amIHost" class="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-8">
                        <span class="text-6xl mb-4">🔒</span>
                        <h3 class="text-2xl font-black text-white mb-2">Configuración Bloqueada</h3>
                        <p class="text-indigo-200 font-bold max-w-md">Solo el anfitrión ({{ gameState.players.find(p => p.isHost)?.name }}) puede modificar las reglas del juego.</p>
                    </div>

                    <!-- Header -->
                    <div class="p-4 border-b border-white/5 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
                        <div class="flex gap-4">
                            <!-- Toggle Mode -->
                            <div class="flex bg-black/40 rounded-xl p-1 border border-white/5">
                                <button @click="handleConfigChange('mode', 'RANDOM')" 
                                        class="px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                        :class="localConfig.mode === 'RANDOM' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white'">
                                    🎲 Aleatorio
                                </button>
                                <button @click="handleConfigChange('mode', 'MANUAL')" 
                                        class="px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                        :class="localConfig.mode === 'MANUAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white'">
                                    📝 Manual
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Body -->
                    <div class="p-4 md:p-6 space-y-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500/30">
                        
                        <!-- Row 1: Numbers (Steppers) -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <!-- Rounds -->
                             <div class="space-y-2">
                                 <label class="text-indigo-300 text-[10px] font-bold uppercase tracking-widest block">Rondas Totales</label>
                                 <div class="flex items-center justify-between bg-black/20 rounded-xl border border-white/5 p-1 h-12">
                                    <button @click="decrementRounds" class="w-10 h-full rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors flex items-center justify-center text-lg font-bold active:scale-95">-</button>
                                    <span class="text-2xl font-black text-yellow-400 font-mono">{{ localConfig.totalRounds || 5 }}</span>
                                    <button @click="incrementRounds" class="w-10 h-full rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors flex items-center justify-center text-lg font-bold active:scale-95">+</button>
                                 </div>
                             </div>

                             <!-- Duration -->
                             <div class="space-y-2">
                                 <label class="text-indigo-300 text-[10px] font-bold uppercase tracking-widest block">Tiempo (Segundos)</label>
                                 <div class="flex items-center justify-between bg-black/20 rounded-xl border border-white/5 p-1 h-12">
                                    <button @click="decrementDuration" class="w-10 h-full rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors flex items-center justify-center text-lg font-bold active:scale-95">-</button>
                                    <span class="text-2xl font-black text-yellow-400 font-mono">{{ localConfig.roundDuration || 60 }}</span>
                                    <button @click="incrementDuration" class="w-10 h-full rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors flex items-center justify-center text-lg font-bold active:scale-95">+</button>
                                 </div>
                             </div>
                        </div>

                        <hr class="border-white/5" />

                        <!-- Row 2: Categories -->
                        <div class="space-y-3">
                            <div class="flex justify-between items-end">
                                <label class="text-indigo-300 text-[10px] font-bold uppercase tracking-widest block">
                                    {{ localConfig.mode === 'RANDOM' ? 'Cantidad de Categorías' : 'Categorías Seleccionadas' }}
                                </label>
                                <button v-if="localConfig.mode === 'MANUAL'" @click="openCategoryModal" class="text-[9px] bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-1.5 rounded-lg font-black tracking-wide transition-all shadow-lg border border-white/10 active:scale-95">
                                    EDITAR +
                                </button>
                            </div>

                            <!-- Random Mode: Just a Counter -->
                            <div v-if="localConfig.mode === 'RANDOM'" class="bg-black/20 rounded-2xl border border-white/5 p-4 flex flex-col items-center justify-center">
                                <span class="text-xs text-white/50 mb-2 font-bold">Se elegirán al azar en cada ronda</span>
                                <div class="flex items-center gap-4">
                                    <button @click="decrementCategories" class="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xl font-bold transition-colors shadow-lg active:scale-95">-</button>
                                    <span class="text-4xl font-black text-white font-mono w-16 text-center">{{ localConfig.categoriesCount }}</span>
                                    <button @click="incrementCategories" class="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xl font-bold transition-colors shadow-lg active:scale-95">+</button>
                                </div>
                            </div>

                            <!-- Manual Mode: Pill Grid -->
                            <div v-else class="min-h-[100px]">
                                <div v-if="localConfig.selectedCategories?.length > 0" class="flex flex-wrap gap-2">
                                    <TransitionGroup name="list">
                                    <div v-for="cat in localConfig.selectedCategories" :key="cat" class="animate-in fade-in zoom-in duration-200 group flex items-center pl-3 pr-2 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-full text-xs font-bold text-indigo-100 border border-indigo-500/20 transition-all hover:border-indigo-400/50">
                                        <span>{{ cat }}</span>
                                        <button @click.stop="handleQuickDelete(cat)" class="ml-1 w-4 h-4 flex items-center justify-center rounded-full bg-black/20 text-white/40 hover:text-white hover:bg-red-500/80 transition-colors">
                                            &times;
                                        </button>
                                    </div>
                                    </TransitionGroup>
                                </div>
                                <div v-else class="bg-black/10 border-2 border-dashed border-white/10 rounded-2xl p-6 text-center">
                                    <p class="text-white/30 font-bold text-sm">No hay categorías seleccionadas.</p>
                                    <p class="text-white/20 text-[10px] mt-1">Usa el botón "EDITAR" para agregar.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                    
                    <!-- Footer: Start Button -->
                    <div class="p-4 border-t border-white/5 bg-black/30 flex justify-end flex-none">
                        <button 
                            @click="handleStart"
                            :disabled="!amIHost || !canStart"
                            class="w-full md:w-auto px-8 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale text-white font-black text-lg rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.4)] transform transition-all active:scale-[0.98] border border-white/10 flex items-center justify-center gap-2"
                        >
                            <span class="text-xl drop-shadow-md">🚀</span> INICIAR PARTIDA
                        </button>
                    </div>

                </div>
            </div>

        </div>

        <!-- === CATEGORY EDITOR MODAL (Compact) === -->
        <div v-if="showCategoriesModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div class="bg-indigo-950 border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <div class="p-4 border-b border-white/10 flex items-center justify-between bg-black/20 flex-none">
                    <h3 class="text-xl font-black text-white">Selección Manual</h3>
                    <div class="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                        {{ tempSelectedCategories.length }} elegidas
                    </div>
                </div>

                <div class="p-4 bg-white/5 space-y-3 flex-none">
                     <input v-model="searchQuery" type="text" placeholder="🔍 Buscar categoría..." class="w-full bg-black/30 border-b-2 border-white/10 px-4 py-2 text-white placeholder-white/30 focus:border-yellow-400 outline-none transition-colors font-bold text-base rounded-t-lg">
                     
                     <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                        <button @click="activeFilterTag = null" :class="['px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide transition-all border', !activeFilterTag ? 'bg-yellow-400 border-yellow-400 text-black' : 'border-white/10 bg-black/20 text-white/50 hover:text-white']">Todo</button>
                        <button v-for="tag in availableTags" :key="tag" @click="activeFilterTag = activeFilterTag === tag ? null : tag" :class="['px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide transition-all border whitespace-nowrap', activeFilterTag === tag ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg' : 'border-white/10 bg-black/20 text-white/50 hover:text-white']">{{ tag }}</button>
                     </div>
                </div>

                <div class="flex-1 overflow-y-auto p-4 content-start bg-black/20 min-h-0">
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <button v-for="cat in filteredCategories" :key="cat.name" @click="toggleCategory(cat.name)" 
                            class="text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all duration-200 flex items-center justify-between group"
                            :class="tempSelectedCategories.includes(cat.name) ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'"
                        >
                            {{ cat.name }}
                            <span v-if="tempSelectedCategories.includes(cat.name)" class="text-xs">✓</span>
                        </button>
                    </div>
                    <div v-if="filteredCategories.length === 0" class="text-center py-12 text-white/30 font-bold uppercase tracking-widest">No se encontraron resultados</div>
                </div>

                <div class="p-4 border-t border-white/10 bg-black/40 flex gap-4 flex-none">
                    <button @click="showCategoriesModal = false" class="flex-1 py-3 rounded-xl font-black text-white/50 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-wide text-xs">Cancelar</button>
                    <button @click="saveCategories" class="flex-1 py-3 rounded-xl font-black bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg transition-all active:scale-[0.98] uppercase tracking-wide text-xs">Guardar Cambios</button>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}
::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}
</style>
