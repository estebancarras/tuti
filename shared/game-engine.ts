import { RoomState, Player } from './types.js';

export class GameEngine {
    private state: RoomState;

    private connections: Map<string, string>; // ConnectionId -> UserId

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
        this.connections = new Map();
    }

    public getState(): RoomState {
        return this.state;
    }

    public joinPlayer(userId: string, name: string, connectionId: string): RoomState {
        this.connections.set(connectionId, userId);

        const existingPlayer = this.state.players.find(p => p.id === userId);
        if (existingPlayer) {
            existingPlayer.name = name; // Update name if joined again
            // Ensure they are host if they were host (state preserves it)
            return this.state;
        }

        const newPlayer: Player = {
            id: userId,
            name,
            score: 0,
            isHost: this.state.players.length === 0 // First player is host
        };

        this.state.players.push(newPlayer);
        return this.state;
    }

    public playerDisconnected(connectionId: string): RoomState {
        const userId = this.connections.get(connectionId);
        if (userId) {
            this.connections.delete(connectionId);
            // We do NOT remove the player from the list to support reconnection (F5).
            // They remain in the state.

            // Note: If we wanted to reassign host on long disconnection, we'd need a timer or explicit "leave" action.
            // For now, we trust the host comes back or the room dies if everyone leaves.
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
