export type GameStatus = 'LOBBY' | 'PLAYING' | 'REVIEW' | 'RESULTS' | 'GAME_OVER';

export interface Player {
    id: string;
    name: string;
    score: number;
    isHost: boolean;
    isConnected: boolean;
    lastSeenAt: number;
    avatar: string;
}

export interface GameConfig {
    roundDuration: number;
    votingDuration: number;
    categoriesCount: number;
    totalRounds: number;
}

export type AnswerStatus = 'VALID' | 'DUPLICATE' | 'INVALID';

export interface RoomState {
    status: GameStatus;
    players: Player[];
    roomId: string | null;
    currentLetter: string | null;
    categories: string[];
    answers: Record<string, Record<string, string>>; // PlayerID -> { Category -> Answer }
    answerStatuses: Record<string, Record<string, AnswerStatus>>; // PlayerID -> { Category -> AnswerStatus }
    roundsPlayed: number;
    // Voting System
    votes: Record<string, Record<string, string[]>>; // targetPlayerId -> category -> voterIds[]
    whoFinishedVoting: string[];
    roundScores: Record<string, number>;
    // Time Controls
    config: GameConfig;
    timers: {
        roundEndsAt: number | null;
        votingEndsAt: number | null;
        resultsEndsAt: number | null;
    };
}

// Messages sent from Client to Server
export type RoundAnswers = Record<string, string>;

export type ClientMessage =
    | { type: 'JOIN'; payload: { name: string; roomId: string; userId: string; avatar: string } }
    | { type: 'START_GAME' }
    | { type: 'STOP_ROUND'; payload: { answers: RoundAnswers } }
    | { type: 'SUBMIT_ANSWERS'; payload: { answers: RoundAnswers } }
    | { type: 'UPDATE_ANSWERS'; payload: { answers: RoundAnswers } }
    | { type: 'TOGGLE_VOTE'; payload: { targetUserId: string; category: string } }
    | { type: 'CONFIRM_VOTES' }
    | { type: 'UPDATE_CONFIG'; payload: Partial<GameConfig> }
    | { type: 'RESTART_GAME' }
    | { type: 'KICK_PLAYER'; payload: { targetUserId: string } }
    | { type: 'EXIT_GAME' };

// Messages sent from Server to Client
export type ServerMessage =
    | { type: 'UPDATE_STATE'; payload: RoomState }
    | { type: 'SYSTEM'; payload: string };
