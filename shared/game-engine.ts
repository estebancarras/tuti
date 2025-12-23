import { RoomState, Player, GameConfig } from './types.js';
import { RoundAnswersSchema } from './schemas.js';

const MASTER_CATEGORIES = [
    'Nombre', 'Apellido', 'País', 'Ciudad', 'Animal', 'Color', 'Fruta/Verdura',
    'Cosa', 'Profesión', 'Marca', 'Película', 'Canción', 'Comida', 'Deporte',
    'Famoso', 'Serie de TV', 'Parte del Cuerpo', 'Instrumento Musical'
];

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
            answerStatuses: {},
            roundsPlayed: 0,
            // Voting System Initial State
            votes: {},
            whoFinishedVoting: [],
            roundScores: {},
            // Time Controls
            config: {
                roundDuration: 60, // 60 seconds default
                votingDuration: 45, // 45 seconds default
                categoriesCount: 5,   // 5 categories default
                totalRounds: 5       // 5 rounds default
            },
            timers: {
                roundEndsAt: null,
                votingEndsAt: null,
                resultsEndsAt: null
            }
        };
        this.connections = new Map();
    }

    public getState(): RoomState {
        return this.state;
    }

    public hydrate(newState: RoomState): void {
        this.state = newState;
        console.log("[ENGINE] State hydrated from storage");
    }

    public updateConfig(connectionId: string, newConfig: Partial<GameConfig>): RoomState {
        const userId = this.connections.get(connectionId);
        if (!userId) return this.state;

        const player = this.state.players.find(p => p.id === userId);

        // Only host can update config, and only in LOBBY
        if (player && player.isHost && this.state.status === 'LOBBY') {
            this.state.config = { ...this.state.config, ...newConfig };
            // Update initial preview of categories immediately if count changes? 
            // Better to just wait for start game to pick randoms. 
            // But we could refresh current categories list for UI feedback if we wanted.

            // Validate limits just in case (though schemas handle input validation usually)
            if (this.state.config.categoriesCount < 4) this.state.config.categoriesCount = 4;
            if (this.state.config.categoriesCount > 8) this.state.config.categoriesCount = 8;
        }
        return this.state;
    }

    public joinPlayer(userId: string, name: string, avatar: string, connectionId: string): RoomState {
        this.connections.set(connectionId, userId);

        const existingPlayer = this.state.players.find(p => p.id === userId);
        if (existingPlayer) {
            existingPlayer.name = name;
            existingPlayer.avatar = avatar;
            existingPlayer.isConnected = true;
            existingPlayer.lastSeenAt = Date.now();
            return this.state;
        }

        const newPlayer: Player = {
            id: userId,
            name,
            avatar,
            score: 0,
            isHost: this.state.players.length === 0, // First player is host
            isConnected: true,
            lastSeenAt: Date.now()
        };

        this.state.players.push(newPlayer);
        return this.state;
    }

    public playerDisconnected(connectionId: string): RoomState {
        const userId = this.connections.get(connectionId);
        if (userId) {
            this.connections.delete(connectionId);

            const player = this.state.players.find(p => p.id === userId);
            if (player) {
                player.isConnected = false;
                player.lastSeenAt = Date.now();

                if (player.isHost) {
                    this.handleHostSuccession(player.id);
                }

                // If in REVIEW, check if this disconnection unblocks the game
                if (this.state.status === 'REVIEW') {
                    this.checkConsensus();
                }
            }
        }
        return this.state;
    }

    private handleHostSuccession(oldHostId: string) {
        // Find next candidate: connected and not the old host
        // We prioritize FIFO order which usually matches array order
        const candidate = this.state.players.find(p => p.isConnected && p.id !== oldHostId);

        if (candidate) {
            // Transfer host status
            const oldHost = this.state.players.find(p => p.id === oldHostId);
            if (oldHost) oldHost.isHost = false;

            candidate.isHost = true;
            // console.log(`👑 Host succession: ${oldHostId} -> ${candidate.id}`);
        }
    }

    // We do NOT remove the player from the list to support reconnection (F5).
    // They remain in the state.

    // Note: If we wanted to reassign host on long disconnection, we'd need a timer or explicit "leave" action.
    // For now, we trust the host comes back or the room dies if everyone leaves.

    public startGame(connectionId: string): RoomState {
        const userId = this.connections.get(connectionId);
        if (!userId) return this.state;

        const player = this.state.players.find(p => p.id === userId);
        if (player && player.isHost) {

            // CASE 1: Manual "Next Round" from Results screen
            if (this.state.status === 'RESULTS') {
                return this.forceStartNextRound();
            }

            // CASE 2: Starting new game from Lobby/GameOver
            if (this.state.status === 'LOBBY' || this.state.status === 'GAME_OVER') {
                this.state.roundsPlayed = 0; // Explicit safety reset

                this.state.status = 'PLAYING';
                this.state.currentLetter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));

                // Select random categories
                const shuffled = [...MASTER_CATEGORIES].sort(() => 0.5 - Math.random());
                this.state.categories = shuffled.slice(0, this.state.config.categoriesCount);

                this.state.answers = {}; // Reset answers for new round
                // Reset Voting System
                this.state.votes = {};
                this.state.whoFinishedVoting = [];
                this.state.roundScores = {};

                // Set Timer
                this.state.timers.roundEndsAt = Date.now() + (this.state.config.roundDuration * 1000);
                this.state.timers.votingEndsAt = null;
            }
        }
        return this.state;
    }

    public stopRound(connectionId: string, answers: Record<string, string>): RoomState {
        const userId = this.connections.get(connectionId);
        if (!userId) return this.state;

        const player = this.state.players.find(p => p.id === userId);
        if (player && this.state.status === 'PLAYING') {
            this.state.status = 'REVIEW';

            // Validate and Sanitize
            const sanitizedAnswers = this.validateAndSanitizeAnswers(answers);
            if (!sanitizedAnswers) return this.state; // Invalid payload

            this.state.answers[userId] = sanitizedAnswers;

            // Cancel Round Timer (server will handle clearing alarm if needed, or check state)
            this.state.timers.roundEndsAt = null;
            // Set Voting Timer
            this.state.timers.votingEndsAt = Date.now() + (this.state.config.votingDuration * 1000);
        }
        return this.state;
    }

    public submitAnswers(connectionId: string, answers: Record<string, string>): RoomState {
        const userId = this.connections.get(connectionId);
        if (!userId) return this.state;

        const player = this.state.players.find(p => p.id === userId);
        if (player && (this.state.status === 'PLAYING' || this.state.status === 'REVIEW')) {
            // Validate and Sanitize
            const sanitizedAnswers = this.validateAndSanitizeAnswers(answers);
            if (sanitizedAnswers) {
                this.state.answers[userId] = sanitizedAnswers;
            }
        }
        return this.state;
    }
    public toggleVote(connectionId: string, targetUserId: string, category: string): RoomState {
        const userId = this.connections.get(connectionId);
        if (!userId || this.state.status !== 'REVIEW') return this.state;
        if (userId === targetUserId) return this.state; // Cannot vote self

        if (!this.state.votes[targetUserId]) this.state.votes[targetUserId] = {};
        if (!this.state.votes[targetUserId][category]) this.state.votes[targetUserId][category] = [];

        const voters = this.state.votes[targetUserId][category];
        const index = voters.indexOf(userId);
        if (index === -1) {
            voters.push(userId); // Vote negative
        } else {
            voters.splice(index, 1); // Remove negative vote
        }
        return this.state;
    }

    public confirmVotes(connectionId: string): RoomState {
        const userId = this.connections.get(connectionId);
        if (!userId || this.state.status !== 'REVIEW') return this.state;

        if (!this.state.whoFinishedVoting.includes(userId)) {
            this.state.whoFinishedVoting.push(userId);
        }

        this.checkConsensus();

        return this.state;
    }

    private checkConsensus() {
        const activePlayers = this.state.players.filter(p => p.isConnected);
        const confirmedActivePlayers = activePlayers.filter(p => this.state.whoFinishedVoting.includes(p.id));

        // Check if ALL active players have confirmed
        if (confirmedActivePlayers.length === activePlayers.length && activePlayers.length > 0) {
            this.calculateResults();
        }
    }

    public kickPlayer(hostConnectionId: string, targetUserId: string): RoomState {
        const hostId = this.connections.get(hostConnectionId);
        if (!hostId) return this.state;

        const hostPlayer = this.state.players.find(p => p.id === hostId);
        if (!hostPlayer || !hostPlayer.isHost) return this.state; // Only host can kick

        if (hostId === targetUserId) return this.state; // Cannot kick self

        // Remove player
        const playerIndex = this.state.players.findIndex(p => p.id === targetUserId);
        if (playerIndex !== -1) {
            // Remove from array
            this.state.players.splice(playerIndex, 1);

            // Clean up connections map (inefficient but safe scan)
            for (const [connId, uid] of this.connections.entries()) {
                if (uid === targetUserId) {
                    this.connections.delete(connId);
                }
            }

            // Clean up state
            delete this.state.answers[targetUserId];
            delete this.state.votes[targetUserId];
            delete this.state.roundScores[targetUserId];

            // Remove votes made by this player against others
            for (const targetId in this.state.votes) {
                for (const category in this.state.votes[targetId]) {
                    const voters = this.state.votes[targetId][category];
                    const idx = voters.indexOf(targetUserId);
                    if (idx !== -1) {
                        voters.splice(idx, 1);
                    }
                }
            }

            // If kicking unblocked the game
            if (this.state.status === 'REVIEW') {
                this.checkConsensus();
            }
        }
        return this.state;
    }

    private calculateResults() {
        this.state.status = 'RESULTS';
        const totalPlayers = this.state.players.length;

        // Initialize structures
        this.state.answerStatuses = {};
        this.state.players.forEach(p => {
            this.state.answerStatuses[p.id] = {};
            this.state.roundScores[p.id] = 0;
        });

        // Loop per category to analyze duplicates
        for (const category of this.state.categories) {

            // 1. Collect Valid Answers (Not empty, Not voted out)
            const validAnswersMap: Record<string, string[]> = {}; // Normalized Word -> [PlayerIds]

            this.state.players.forEach(player => {
                const rawAnswer = this.state.answers[player.id]?.[category];

                // Check empty
                if (!rawAnswer || !rawAnswer.trim()) {
                    this.state.answerStatuses[player.id][category] = 'INVALID';
                    return;
                }

                // Check voting (Invalidation)
                const negativeVotes = this.state.votes[player.id]?.[category]?.length || 0;
                if (negativeVotes > totalPlayers / 2) {
                    this.state.answerStatuses[player.id][category] = 'INVALID';
                    return;
                }

                // It is potentially valid. Add to frequency map.
                // Normalize: Lowercase + remove accents
                const normalized = rawAnswer.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                if (!validAnswersMap[normalized]) validAnswersMap[normalized] = [];
                validAnswersMap[normalized].push(player.id);
            });

            // 2. Assign Scores based on Frequency
            Object.entries(validAnswersMap).forEach(([_word, playerIds]) => {
                const isDuplicate = playerIds.length > 1;
                const points = isDuplicate ? 50 : 100;
                const status = isDuplicate ? 'DUPLICATE' : 'VALID';

                playerIds.forEach(pid => {
                    this.state.answerStatuses[pid][category] = status;

                    // Add Score
                    this.state.roundScores[pid] = (this.state.roundScores[pid] || 0) + points;

                    const player = this.state.players.find(p => p.id === pid);
                    if (player) player.score += points;
                });
            });
        }

        // Clear voting timer
        this.state.timers.votingEndsAt = null;

        // Set 10 second timer for results screen
        this.state.timers.resultsEndsAt = Date.now() + 10000; // 10 seconds
    }

    // Forced Transitions (called by server Watchdog)
    public forceEndRound(): RoomState {
        if (this.state.status !== 'PLAYING') return this.state;

        // Transition to REVIEW without any player triggering it
        this.state.status = 'REVIEW';
        // Players who didn't submit get empty answers (already default behavior)

        // Cancel Round Timer
        this.state.timers.roundEndsAt = null;
        // Set Voting Timer
        this.state.timers.votingEndsAt = Date.now() + (this.state.config.votingDuration * 1000);

        return this.state;
    }

    public forceEndVoting(): RoomState {
        if (this.state.status !== 'REVIEW') return this.state;

        // Force calculate results even if not everyone confirmed
        this.calculateResults();

        return this.state;
    }



    // Force start next round (Auto-start)
    public forceStartNextRound(): RoomState {
        // If we are already in Playing, ignore
        if (this.state.status === 'PLAYING') return this.state;

        // Increment round counter (We are ATTEMPTING to start the next round)
        // 0 -> 1 (End of Round 1 attempt)
        this.state.roundsPlayed++;

        // Check if Game Over condition is met
        // If roundsPlayed (e.g. 2) >= totalRounds (2), we are done.
        if (this.state.roundsPlayed >= this.state.config.totalRounds) {
            this.state.status = 'GAME_OVER';
            // Clear timers
            this.state.timers.roundEndsAt = null;
            this.state.timers.votingEndsAt = null;
            this.state.timers.resultsEndsAt = null;
            return this.state;
        }

        // Logic similar to startGame but without resetting scores
        // Randomize letter
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        this.state.currentLetter = alphabet[Math.floor(Math.random() * alphabet.length)];

        // Rotate categories randomly for variety
        const shuffled = [...MASTER_CATEGORIES].sort(() => 0.5 - Math.random());
        this.state.categories = shuffled.slice(0, this.state.config.categoriesCount);

        this.state.status = 'PLAYING';

        // Clear previous answers
        this.state.answers = {};
        this.state.players.forEach(p => {
            this.state.answers[p.id] = {};
        });

        // Reset Voting System
        this.state.votes = {};
        this.state.whoFinishedVoting = [];
        this.state.roundScores = {};

        // Set Timer
        this.state.timers.roundEndsAt = Date.now() + (this.state.config.roundDuration * 1000);
        this.state.timers.votingEndsAt = null;
        this.state.timers.resultsEndsAt = null;

        return this.state;
    }

    public restartGame(requestorId: string): RoomState {
        const userId = this.connections.get(requestorId);
        const player = this.state.players.find(p => p.id === userId);

        // Validate Host
        if (!player || !player.isHost) {
            console.warn(`[SECURITY] Restart denied. Requestor ${requestorId} is not host.`);
            return this.state;
        }

        this.state.status = 'LOBBY';
        this.state.roundsPlayed = 0;
        this.state.currentLetter = null;
        this.state.categories = [];
        this.state.answers = {};
        this.state.answerStatuses = {};
        this.state.votes = {};
        this.state.whoFinishedVoting = [];
        this.state.roundScores = {};

        // Reset scores
        this.state.players.forEach(p => {
            p.score = 0;
        });

        // Clear timers
        this.state.timers.roundEndsAt = null;
        this.state.timers.votingEndsAt = null;
        this.state.timers.resultsEndsAt = null;

        return this.state;
    }

    private validateAndSanitizeAnswers(rawAnswers: any): Record<string, string> | null {
        // 1. Zod Validation
        const result = RoundAnswersSchema.safeParse(rawAnswers);
        if (!result.success) {
            console.error('Invalid answers payload:', result.error);
            return null;
        }

        const answers = result.data;
        const sanitized: Record<string, string> = {};
        const allowedLetter = this.state.currentLetter?.toUpperCase();

        for (const [key, value] of Object.entries(answers)) {
            let processedValue = value.trim().slice(0, 40); // Hard limit safety

            // 2. Rule Enforcement: Start Letter Check
            if (allowedLetter && processedValue.length > 0) {
                const firstChar = processedValue.charAt(0).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const targetChar = allowedLetter.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                if (firstChar !== targetChar) {
                    console.log(`[RULE BREACH] Word '${processedValue}' does not start with '${allowedLetter}'. Cleared.`);
                    processedValue = ""; // WIPE IT
                }
            }

            sanitized[key] = processedValue;
        }

        return sanitized;
    }
}
