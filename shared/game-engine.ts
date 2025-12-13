import { RoomState, Player } from './types.js';

export class GameEngine {
    private state: RoomState;

    constructor(roomId: string) {
        this.state = {
            status: 'LOBBY',
            players: [],
            roomId: roomId,
            currentLetter: null,
            categories: ['Nombre', 'Color', 'Fruta', 'País', 'Cosa'], // Default categories
            answers: {},
            roundsPlayed: 0
        };
    }

    public getState(): RoomState {
        return this.state;
    }

    public joinPlayer(id: string, name: string): RoomState {
        // Check if player already exists to avoid duplicates if re-connecting 
        // (though in this architecture usually we get a new connection ID, but good to be safe if ID persistence is added later)
        const existingPlayer = this.state.players.find(p => p.id === id);
        if (existingPlayer) {
            existingPlayer.name = name; // Update name if joined again
            return this.state;
        }

        const newPlayer: Player = {
            id,
            name,
            score: 0,
            isHost: this.state.players.length === 0 // First player is host
        };

        this.state.players.push(newPlayer);
        return this.state;
    }

    public removePlayer(id: string): RoomState {
        const wasHost = this.state.players.find(p => p.id === id)?.isHost;
        this.state.players = this.state.players.filter(p => p.id !== id);

        // Reassign host if needed
        if (wasHost && this.state.players.length > 0) {
            this.state.players[0].isHost = true;
        }

        // If no players left, we could reset, but the server handles room lifecycle. 
        // The engine just manages state.
        if (this.state.players.length === 0) {
            this.state.status = 'LOBBY';
            this.state.currentLetter = null;
            this.state.roundsPlayed = 0;
            this.state.answers = {};
        }

        return this.state;
    }

    public startGame(playerId: string): RoomState {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && player.isHost) {
            this.state.status = 'PLAYING';
            this.state.currentLetter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
            this.state.answers = {}; // Reset answers for new round
        }
        return this.state;
    }

    public stopRound(playerId: string): RoomState {
        // Ideally enforce that the player is in the game, etc.
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            this.state.status = 'REVIEW';
        }
        return this.state;
    }
}
