import { RoomState, Player, GameConfig } from './types.js';
import { RoundAnswersSchema } from './schemas.js';
import { validateWord } from './validator.js';

export interface CategoryItem {
    id: string;
    name: string;
    tags: string[];
}

export const MASTER_CATEGORIES: CategoryItem[] = [
    // CLASICOS
    { id: '1', name: 'Nombre', tags: ['CLASICO', 'FACIL'] },
    { id: '2', name: 'Apellido', tags: ['CLASICO'] },
    { id: '3', name: 'País', tags: ['CLASICO', 'GEO'] },
    { id: '4', name: 'Ciudad', tags: ['CLASICO', 'GEO'] },
    { id: '5', name: 'Animal', tags: ['CLASICO', 'NATURALEZA'] },
    { id: '6', name: 'Color', tags: ['CLASICO', 'FACIL'] },
    { id: '7', name: 'Fruta/Verdura', tags: ['CLASICO', 'NATURALEZA'] },
    { id: '8', name: 'Cosa', tags: ['CLASICO', 'FACIL'] },
    { id: '9', name: 'Profesión', tags: ['CLASICO', 'SOCIEDAD'] },

    // ENTERTAINMENT
    { id: '10', name: 'Película', tags: ['CINE', 'FUN'] },
    { id: '11', name: 'Serie de TV', tags: ['CINE', 'FUN'] },
    { id: '12', name: 'Actor/Actriz', tags: ['CINE', 'FAMOSO'] },
    { id: '13', name: 'Villano', tags: ['CINE', 'FUN'] },
    { id: '14', name: 'Superhéroe', tags: ['CINE', 'FUN'] },
    { id: '15', name: 'Personaje Ficticio', tags: ['CINE', 'FUN'] },
    { id: '16', name: 'Videojuego', tags: ['GAMING', 'FUN'] },
    { id: '17', name: 'Youtuber/Streamer', tags: ['INTERNET', 'MODERNO'] },

    // MUSIC
    { id: '20', name: 'Canción', tags: ['MUSICA', 'ARTE'] },
    { id: '21', name: 'Cantante/Banda', tags: ['MUSICA', 'FAMOSO'] },
    { id: '22', name: 'Instrumento Musical', tags: ['MUSICA', 'OBJETO'] },
    { id: '23', name: 'Título de Canción de Reggaeton', tags: ['MUSICA', 'FUN', 'HARD'] },

    // BRANDS & TECH
    { id: '30', name: 'Marca', tags: ['MARCAS', 'CONSUMO'] },
    { id: '31', name: 'Marca de Auto', tags: ['MARCAS', 'VEHICULO'] },
    { id: '32', name: 'Marca de Ropa', tags: ['MARCAS', 'MODA'] },
    { id: '33', name: 'Marca de Tecnología', tags: ['MARCAS', 'TECH'] },
    { id: '34', name: 'App Móvil', tags: ['TECH', 'MODERNO'] },
    { id: '35', name: 'Sitio Web', tags: ['TECH', 'INTERNET'] },

    // FOOD
    { id: '40', name: 'Comida', tags: ['COMIDA', 'FACIL'] },
    { id: '41', name: 'Bebida', tags: ['COMIDA'] },
    { id: '42', name: 'Postre', tags: ['COMIDA', 'DULCE'] },
    { id: '43', name: 'Sabor de Helado', tags: ['COMIDA', 'DULCE'] },
    { id: '44', name: 'Ingrediente de Pizza', tags: ['COMIDA'] },
    { id: '45', name: 'Plato Típico', tags: ['COMIDA', 'CULTURA'] },

    // GEO & CULTURE
    { id: '50', name: 'Capital', tags: ['GEO', 'HARD'] },
    { id: '51', name: 'Río/Lago', tags: ['GEO', 'NATURALEZA'] },
    { id: '52', name: 'Idioma', tags: ['CULTURA'] },
    { id: '53', name: 'Moneda', tags: ['CULTURA', 'ECONOMIA'] },
    { id: '54', name: 'Lugar Turístico', tags: ['GEO', 'VIAJES'] },

    // RANDOM & FUN
    { id: '60', name: 'Insulto (suave)', tags: ['FUN', 'SOCIAL'] },
    { id: '61', name: 'Excusa para llegar tarde', tags: ['FUN', 'SITUACIONAL'] },
    { id: '62', name: 'Motivo de divorcio', tags: ['FUN', 'SITUACIONAL'] },
    { id: '63', name: 'Cosa de millonarios', tags: ['FUN', 'SOCIEDAD'] },
    { id: '64', name: 'Cosa que se pierde', tags: ['FUN', 'SITUACIONAL'] },
    { id: '65', name: 'Cosa que huele mal', tags: ['FUN', 'SENSORIAL'] },
    { id: '66', name: 'Miedo/Fobia', tags: ['PSICOLOGIA'] },
    { id: '67', name: 'Pecado Capital', tags: ['CULTURA', 'HARD'] },

    // SPORTS
    { id: '70', name: 'Deporte', tags: ['DEPORTE'] },
    { id: '71', name: 'Deportista', tags: ['DEPORTE', 'FAMOSO'] },
    { id: '72', name: 'Equipo de Fútbol', tags: ['DEPORTE'] },

    // HOUSE & OBJECTS
    { id: '80', name: 'Parte de la Casa', tags: ['HOGAR'] },
    { id: '81', name: 'Electrodoméstico', tags: ['HOGAR', 'TECH'] },
    { id: '82', name: 'Mueble', tags: ['HOGAR'] },
    { id: '83', name: 'Objeto de Cocina', tags: ['HOGAR', 'COCINA'] },
    { id: '84', name: 'Herramienta', tags: ['HOGAR', 'OBJETO'] },
    { id: '85', name: 'Ropa/Accesorio', tags: ['MODA'] },

    // NATURE & ANIMALS
    { id: '90', name: 'Raza de Perro', tags: ['NATURALEZA', 'ANIMALES'] },
    { id: '91', name: 'Insecto', tags: ['NATURALEZA', 'ANIMALES'] },
    { id: '92', name: 'Animal Marino', tags: ['NATURALEZA', 'ANIMALES'] },
    { id: '93', name: 'Flor', tags: ['NATURALEZA'] },

    // SITUATIONAL
    { id: '100', name: 'Lo encuentras en la playa', tags: ['SITUACIONAL', 'VERANO'] },
    { id: '101', name: 'Se compra en farmacia', tags: ['SITUACIONAL', 'COMPRAS'] },
    { id: '102', name: 'Se lleva puesto', tags: ['SITUACIONAL'] },
    { id: '103', name: 'Es redondo', tags: ['SITUACIONAL', 'FORMA'] },
    { id: '104', name: 'Es rojo', tags: ['SITUACIONAL', 'COLOR'] }
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
                totalRounds: 5,       // 5 rounds default
                mode: 'RANDOM',
                selectedCategories: []
            },
            timers: {
                roundEndsAt: null,
                votingEndsAt: null,
                resultsEndsAt: null
            },
            stoppedBy: null
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
            if (this.state.config.categoriesCount < 1) this.state.config.categoriesCount = 1;
            if (this.state.config.categoriesCount > 10) this.state.config.categoriesCount = 10;

            // Validate Manual Config
            if (this.state.config.mode === 'MANUAL') {
                // Ensure selectedCategories respects the count limit logic or overrides it?
                // Let's stick to: count is derived from length in manual mode usually, OR we enforce selection matches count.
                // Easier: In manual mode, keys are keys.
                // We won't auto-truncate here, but we will check length at start.
            }
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

        // Ensure there is always an active host
        this.ensureActiveHost();

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
                    // Host disconnected, try to reassign immediately
                    this.ensureActiveHost();
                }

                // If in REVIEW, check if this disconnection unblocks the game
                if (this.state.status === 'REVIEW') {
                    this.checkConsensus();
                }

                // ABANDONMENT CHECK
                // If game is active and not enough players remain, end it.
                if (this.state.status === 'PLAYING' || this.state.status === 'REVIEW') {
                    const activePlayers = this.state.players.filter(p => p.isConnected);
                    if (activePlayers.length < 2) {
                        console.log(`[GAME OVER] Abandonment detected. Active players: ${activePlayers.length}`);
                        this.state.status = 'GAME_OVER';
                        this.state.gameOverReason = 'ABANDONED';

                        // Clear all timers
                        this.state.timers.roundEndsAt = null;
                        this.state.timers.votingEndsAt = null;
                        this.state.timers.resultsEndsAt = null;
                    }
                }
            }
        }
        return this.state;
    }

    private ensureActiveHost() {
        // 1. Check if we currently have a CONNECTED host
        const activeHost = this.state.players.find(p => p.isHost && p.isConnected);
        if (activeHost) return; // We are good

        // 2. No active host (either no host at all, or host is disconnected)
        // Dethrone offline players to avoid confusion/multi-host (though we only pick one new one)
        this.state.players.forEach(p => {
            if (!p.isConnected) p.isHost = false;
        });

        // 3. Appoint new host: First connected player
        const newHost = this.state.players.find(p => p.isConnected);
        if (newHost) {
            newHost.isHost = true;
            console.log(`[HOST PROTECTION] New host assigned: ${newHost.name} (${newHost.id})`);
        } else {
            console.log(`[HOST PROTECTION] No active players to assign host.`);
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

                // Select categories based on mode
                if (this.state.config.mode === 'MANUAL' && this.state.config.selectedCategories.length >= 3) {
                    this.state.categories = [...this.state.config.selectedCategories];
                } else {
                    // RANDOM MODE (or fallback if manual is empty)
                    // shuffle objects then map to names
                    const shuffled = [...MASTER_CATEGORIES].sort(() => 0.5 - Math.random());
                    this.state.categories = shuffled.slice(0, this.state.config.categoriesCount).map(c => c.name);
                }

                this.state.answers = {}; // Reset answers for new round
                // Reset Voting System
                this.state.votes = {};
                this.state.whoFinishedVoting = [];
                this.state.roundScores = {};

                // Set Timer
                this.state.timers.roundEndsAt = Date.now() + (this.state.config.roundDuration * 1000);
                this.state.timers.votingEndsAt = null;
                this.state.stoppedBy = null;
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
            this.state.stoppedBy = userId;

            // --- 1vs1 GHOST VOTING ---
            // If strictly 2 active players, we automate the "voting" judgment
            // using the Validator Service, but keep the Review Phase for visual feedback.
            const activePlayers = this.state.players.filter(p => p.isConnected);
            if (activePlayers.length === 2) {
                console.log("[1vs1] Injecting Ghost Votes for Automated Judgment");
                this.injectAutomatedVotes(activePlayers);
                // Do NOT return. Fall through to normal REVIEW state.
            }
        }
        return this.state;
    }

    private injectAutomatedVotes(activePlayers: Player[]) {
        const playerA = activePlayers[0];
        const playerB = activePlayers[1];

        // Ensure votes object exists
        if (!this.state.votes) this.state.votes = {};

        // Loop all categories
        for (const category of this.state.categories) {
            // Validate A
            const ansA = this.state.answers[playerA.id]?.[category] || "";
            const valA = validateWord(ansA, category);
            if (!valA.isValid) {
                // Inject vote from B against A
                if (!this.state.votes[playerA.id]) this.state.votes[playerA.id] = {};
                if (!this.state.votes[playerA.id][category]) this.state.votes[playerA.id][category] = [];
                // Check if already voted (unlikely in fresh round but safe)
                if (!this.state.votes[playerA.id][category].includes(playerB.id)) {
                    this.state.votes[playerA.id][category].push(playerB.id);
                }
            }

            // Validate B
            const ansB = this.state.answers[playerB.id]?.[category] || "";
            const valB = validateWord(ansB, category);
            if (!valB.isValid) {
                // Inject vote from A against B
                if (!this.state.votes[playerB.id]) this.state.votes[playerB.id] = {};
                if (!this.state.votes[playerB.id][category]) this.state.votes[playerB.id][category] = [];
                if (!this.state.votes[playerB.id][category].includes(playerA.id)) {
                    this.state.votes[playerB.id][category].push(playerA.id);
                }
            }
        }

        // Note: Duplicates are handled by the 'calculateResults' logic during scoring, 
        // which runs AFTER the review phase. We only need to inject rejection votes here.
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

        // Rotate categories randomly for variety or keep manual
        if (this.state.config.mode === 'MANUAL' && this.state.config.selectedCategories.length >= 3) {
            this.state.categories = [...this.state.config.selectedCategories];
            // In manual mode, we usually keep the SAME categories every round? Or shuffle them?
            // "Tutti Frutti" usually means same categories, different letter.
            // So we just keep them.
        } else {
            // shuffle objects then map to names
            const shuffled = [...MASTER_CATEGORIES].sort(() => 0.5 - Math.random());
            this.state.categories = shuffled.slice(0, this.state.config.categoriesCount).map(c => c.name);
        }

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
        this.state.stoppedBy = null;

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
        this.state.stoppedBy = null;

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
