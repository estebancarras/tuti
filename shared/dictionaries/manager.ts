
// Import raw JSON data
import animales from './data/animales.json';
import colores from './data/colores.json';
import frutas from './data/frutas.json';
import nombres from './data/nombres.json';
import paises from './data/paises.json';

// Helper to normalized strings: Lowercase + NFD + Remove Accents + Trim
const normalize = (str: string) => str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export class DictionaryManager {
    // Static collection storage
    private static datasets: Record<string, Set<string>> = {};
    private static initialized = false;

    // Initialize/Load mappings
    private static initialize() {
        if (this.initialized) return;

        this.addDictionary('Animal', animales);
        this.addDictionary('Color', colores);
        this.addDictionary('Fruta/Verdura', frutas);
        this.addDictionary('Nombre', nombres);
        this.addDictionary('País', paises);

        this.initialized = true;
    }

    private static addDictionary(category: string, rawList: string[]) {
        const set = new Set<string>();
        for (const word of rawList) {
            set.add(normalize(word));
        }
        this.datasets[category] = set;
    }

    public static hasExact(category: string, word: string): boolean {
        if (!this.initialized) this.initialize();

        const collection = this.datasets[category];
        if (!collection) return false;
        return collection.has(normalize(word));
    }

    public static getCollection(category: string): Set<string> | undefined {
        if (!this.initialized) this.initialize();
        return this.datasets[category];
    }
}
