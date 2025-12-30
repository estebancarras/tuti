import { Ref } from 'vue';
import { RoomState } from '../../shared/types'; // Adjust path if needed

export type ReviewState = 'VALID' | 'DUPLICATE' | 'REJECTED' | 'EMPTY';

export interface PlayerReviewStatus {
    playerId: string;
    answer: string;
    state: ReviewState;
    score: number;
    voteCount: number;
    votesReceived: string[]; // List of voter IDs
}

export function useSmartReview(gameState: Ref<RoomState>, currentCategory: Ref<string>) {

    // Helper to normalize strings for comparison
    const normalize = (str: string) => str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const getPlayerStatus = (playerId: string): PlayerReviewStatus => {
        const stateVal = gameState.value;
        const answer = stateVal.answers[playerId]?.[currentCategory.value] || "";
        const votes = stateVal.votes[playerId]?.[currentCategory.value] || [];

        // 1. Check Empty
        if (!answer || answer.trim() === "") {
            return { playerId, answer, state: 'EMPTY', score: 0, voteCount: 0, votesReceived: [] };
        }

        // 2. Check Votes (Rejection)
        // Threshold: Simple majority of "other" players? Or just > X? 
        // Strict approach: if > 50% of active players (excluding self) voted against it.
        // For 3 players (A, B, C): A is judged. B & C can vote. Max votes = 2. Majority = 2? Or > 0?
        // Let's use a "Tolerance" system. For now, let's say >= 2 votes or > 50% of rivals.
        // Small lobby (2 players): 1 vote is enough? Yes.
        // Lobby (3 players): 2 votes? 
        // Let's use Math.max(1, Math.floor((players.length - 1) / 2) + 1) for majority?
        // Actually, let's simplify: Start with >= 2 for now, or >= 1 if only 2 players.
        // Dynamic Threshold:
        const activePlayersCount = stateVal.players.filter(p => p.isConnected).length;
        const rivalsCount = Math.max(1, activePlayersCount - 1);
        const rejectionThreshold = Math.ceil(rivalsCount / 2); // > 50% of rivals

        // OR simply strict: if it has votes, it's contested. 
        // The user requirement says: "This word has 2 votes... if it reaches 3...".
        // Let's stick to the threshold logic.
        const isRejected = votes.length >= rejectionThreshold;

        if (isRejected) {
            return { playerId, answer, state: 'REJECTED', score: 0, voteCount: votes.length, votesReceived: votes };
        }

        // 3. Check Duplicates (Comparison)
        const normalizedAns = normalize(answer);
        let isDuplicate = false;

        // Check against other players
        for (const player of stateVal.players) {
            if (player.id === playerId) continue; // Skip self

            const otherAns = stateVal.answers[player.id]?.[currentCategory.value];
            if (otherAns && normalize(otherAns) === normalizedAns) {
                isDuplicate = true;
                break;
            }
        }

        if (isDuplicate) {
            return { playerId, answer, state: 'DUPLICATE', score: 50, voteCount: votes.length, votesReceived: votes };
        }

        // 4. Default Valid
        return { playerId, answer, state: 'VALID', score: 100, voteCount: votes.length, votesReceived: votes };
    };

    return {
        getPlayerStatus
    };
}
