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

// Simple blacklist for example purposes
const BLACKLIST = new Set([
    "puto", "maricon", "mierda", "verga", "pija", "concha",
    "retrasado", "imbecil", "estupido", "idiota", "mogolico"
]);

import { DictionaryManager } from './dictionaries/manager.js';

export function validateWord(word: string, category: string): { isValid: boolean, isFuzzy: boolean } {
    const cleanWord = word.trim().toLowerCase();

    // 1. Sanity Check
    if (!cleanWord) return { isValid: false, isFuzzy: false };

    // 2. Blacklist Check
    if (BLACKLIST.has(cleanWord)) return { isValid: false, isFuzzy: false };

    // 3. Dictionary Check (O(1))
    // We strictly assume if dict exists, words must be in it.
    // However, checking existence of collection first is good to define fallback policy.
    const collection = DictionaryManager.getCollection(category);

    if (!collection) {
        // Fallback: In 1vs1 Authoritative Mode, if we don't know the category, we MUST reject it.
        return { isValid: false, isFuzzy: false };
    }

    // 3.1 Exact Match (via Manager which creates normalized sets)
    if (DictionaryManager.hasExact(category, cleanWord)) {
        return { isValid: true, isFuzzy: false };
    }

    // 4. Fuzzy Match (Typo Tolerance)
    // Only for words > 4 length
    if (cleanWord.length > 4) {
        // We iterate the Set from the Manager
        for (const validWord of collection) {
            // Optimization: Length diff check first
            if (Math.abs(validWord.length - cleanWord.length) > 2) continue;


            // Levenshtein on "Peru" vs "Perú" is 1. That's handled.
            // But manager stores "peru". Input "Perú" -> clean "perú".
            // cleanWord still has accents? yes, .toLowerCase() doesn't remove accents.
            // We should ideally compare normalized input against normalized set for fuzzy too.
            // BUT, removing accents is a type of fuzzy matching itself.
            // Let's use the same normalize as Manager for optimal check.
            const normInput = cleanWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Check normalized exact match again? hasExact does it.
            // So this is for real typos. "Perru".

            const distNorm = levenshteinDistance(normInput, validWord);
            if (distNorm <= 2) {
                return { isValid: true, isFuzzy: true };
            }
        }
    }

    return { isValid: false, isFuzzy: false };
}
