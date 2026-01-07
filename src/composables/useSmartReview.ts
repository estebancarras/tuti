import { Ref } from 'vue';
import { RoomState } from '../../shared/types'; // Adjust path if needed

export type ReviewState = 'VALID' | 'DUPLICATE' | 'REJECTED' | 'CONTESTED' | 'EMPTY';

export interface PlayerReviewStatus {
    playerId: string;
    answer: string;
    state: ReviewState;
    score: number;
    voteCount: number;
    votesNeeded: number; // For UI display (e.g., "1/3")
    votesReceived: string[]; // List of voter IDs
}

export function useSmartReview(gameState: Ref<RoomState>, currentCategory: Ref<string>) {

    // Helper to normalize strings for comparison
    const normalize = (str: string) => str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const getPlayerStatus = (playerId: string, categoryOverride?: string): PlayerReviewStatus => {
        const category = categoryOverride || currentCategory.value;
        const stateVal = gameState.value;
        const answer = stateVal.answers[playerId]?.[category] || "";
        const votes = stateVal.votes[playerId]?.[category] || [];

        // 1. Check Empty
        if (!answer || answer.trim() === "") {
            return { playerId, answer, state: 'EMPTY', score: 0, voteCount: 0, votesNeeded: 0, votesReceived: [] };
        }

        // 2. Check Votes (Progressive Tolerance)
        // Formula: Threshold = floor((active - 1) / 2) + 1
        // We exclude the player being judged from the "Jury Pool".

        const activePlayersCount = stateVal.players.filter(p => p.isConnected).length;
        // Note: isSpectator check removed previously due to type error, assuming spectators are handled by logic or not in list. 
        // If spectators are in list but not playing, we might need a better filter. For now relying on 'isConnected'.
        // Wait, self is in stateVal.players.

        const juryPoolSize = Math.max(1, activePlayersCount - 1); // Exclude self
        const rejectionThreshold = Math.floor(juryPoolSize / 2) + 1;

        const voteCount = votes.length;
        const isRejected = voteCount >= rejectionThreshold;

        // RETURN OBJECT HELPER
        const buildStatus = (state: ReviewState, score: number) => ({
            playerId,
            answer,
            state,
            score,
            voteCount,
            votesNeeded: rejectionThreshold,
            votesReceived: votes
        });

        if (isRejected) {
            return buildStatus('REJECTED', 0);
        }

        if (voteCount > 0) {
            // CONTESTED STATE (Warning but points kept)
            // If it's a duplicate, it keeps 50pts. If unique, 100pts.
            // We need to check duplicate status first to know the score.
            // Let's reorganize.
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
            return buildStatus('DUPLICATE', 50);
        }

        // 4. Default Valid
        return buildStatus('VALID', 100);
    };

    return {
        getPlayerStatus
    };
}
