
// Basic Levenshtein implementation
export function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // Increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // Increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// Simple blacklist for example purposes (expand as needed or load from JSON)
const BLACKLIST = new Set([
    "puto", "maricon", "mierda", "verga", "pija", "concha",
    "retrasado", "imbecil", "estupido", "idiota", "mogolico"
]);

// Dictionary Interface
export type Dictionary = Set<string>;

import { countries } from './dictionaries/paises.js';
// Import other dictionaries as needed
import { animals } from './dictionaries/animales.js';
import { colors } from './dictionaries/colores.js';
import { fruits } from './dictionaries/frutas.js';
import { names } from './dictionaries/nombres.js';

const DICTIONARIES: Record<string, Dictionary> = {
    'País': countries,
    'Animal': animals,
    'Color': colors,
    'Fruta/Verdura': fruits,
    'Nombre': names,
    // Add mapping for other categories
};

export function validateWord(word: string, category: string): { isValid: boolean, isFuzzy: boolean } {
    const cleanWord = word.trim().toLowerCase();

    // 1. Sanity Check
    if (!cleanWord) return { isValid: false, isFuzzy: false };

    // 2. Blacklist Check
    // Check strict match or contains? Strict for now to avoid false positives on legitimate words.
    // Or check if any blacklist word is a substring?
    if (BLACKLIST.has(cleanWord)) return { isValid: false, isFuzzy: false };

    // 3. Dictionary Check
    const dictionary = DICTIONARIES[category];
    if (!dictionary) {
        // Fallback: In 1vs1 Authoritative Mode, if we don't know the category, we MUST reject it.
        // Otherwise, players can score points with nonsense.
        // This implicitly prompts us to support all categories in the game config for 1vs1 matches.
        return { isValid: false, isFuzzy: false };
    }

    // 3.1 Exact Match
    // Optimization: Dictionaries should probably be lowercased sets.
    if (dictionary.has(cleanWord)) {
        return { isValid: true, isFuzzy: false };
    }

    // 4. Fuzzy Match (Typo Tolerance)
    // Only for words > 4 length
    if (cleanWord.length > 4) {
        // Iterate dictionary? This is expensive if dictionary is huge.
        // Optimization: Early exit or BK-Tree. 
        // For simple countries list (~200 items), iteration is fine.
        // For larger lists, we might need a better structure.
        // Let's iterate for now, assuming small counts.

        for (const validWord of dictionary) {
            // Optimization: Length diff check first
            if (Math.abs(validWord.length - cleanWord.length) > 2) continue;

            const dist = levenshteinDistance(cleanWord, validWord);
            if (dist <= 2) {
                return { isValid: true, isFuzzy: true };
            }
        }
    }

    return { isValid: false, isFuzzy: false };
}
