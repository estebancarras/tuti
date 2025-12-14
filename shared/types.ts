export type GameStatus = 'LOBBY' | 'PLAYING' | 'REVIEW' | 'RESULTS';

export interface Player {
    id: string;
    name: string;
    score: number;
    isHost: boolean;
}

export interface RoomState {
    status: GameStatus;
    players: Player[];
    roomId: string | null;
    currentLetter: string | null;
    categories: string[];
    answers: Record<string, Record<string, string>>; // PlayerID -> { Category -> Answer }
    roundsPlayed: number;
}

// Messages sent from Client to Server
export type ClientMessage =
    | { type: 'JOIN'; payload: { name: string; roomId: string; userId: string } }
    | { type: 'START_GAME' }
    | { type: 'STOP_ROUND' };

// Messages sent from Server to Client
export type ServerMessage =
    | { type: 'UPDATE_STATE'; payload: RoomState }
    | { type: 'SYSTEM'; payload: string };
