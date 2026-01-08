import type * as Party from "partykit/server";
import { GameEngine } from "../shared/game-engine.js";
import { RoomState } from "../shared/types.js";
import { broadcastState, sendError } from "./utils/broadcaster";
import { ConnectionHandler } from "./handlers/connection";
import { PlayerHandler } from "./handlers/player";
import { GameHandler } from "./handlers/game";
import { VotingHandler } from "./handlers/voting";

const STORAGE_KEY = "room_state_v1";

export default class Server implements Party.Server {
    options: Party.ServerOptions = {
        hibernate: true,
    };

    room: Party.Room;
    engine: GameEngine;

    // Handlers
    connectionHandler: ConnectionHandler;
    playerHandler: PlayerHandler;
    gameHandler: GameHandler;
    votingHandler: VotingHandler;

    constructor(room: Party.Room) {
        this.room = room;
        this.engine = new GameEngine(room.id);

        // Instantiate Handlers
        this.connectionHandler = new ConnectionHandler(room, this.engine);
        this.playerHandler = new PlayerHandler(room, this.engine);
        this.gameHandler = new GameHandler(room, this.engine);
        this.votingHandler = new VotingHandler(room, this.engine);
    }

    async onStart() {
        const stored = await this.room.storage.get<RoomState>(STORAGE_KEY);
        if (stored) {
            console.log(`[Hydrate] Loaded state for room ${this.room.id}`);
            this.engine['state'] = stored;
        }
    }

    async onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
        await this.connectionHandler.handleConnect(connection, ctx);
    }

    async onMessage(message: string, sender: Party.Connection) {
        try {
            const data = JSON.parse(message);
            const { type, payload } = data;

            console.log(`[Message] ${type} from ${sender.id}`);

            switch (type) {
                // --- Game Logic ---
                case "START_GAME":
                    await this.gameHandler.handleStartGame(sender);
                    break;

                case "STOP_ROUND":
                    await this.gameHandler.handleStopRound(payload, sender);
                    break;

                case "SUBMIT_ANSWERS":
                    await this.gameHandler.handleSubmitAnswers(payload, sender);
                    break;

                // --- Voting Logic ---
                case "TOGGLE_VOTE":
                    await this.votingHandler.handleVote(payload, sender);
                    break;

                case "CONFIRM_VOTES":
                    await this.votingHandler.handleConfirmVotes(sender);
                    break;

                // --- Admin Logic ---
                case "UPDATE_CONFIG":
                    await this.playerHandler.handleUpdateSettings(payload, sender);
                    break;

                case "KICK_PLAYER":
                    await this.playerHandler.handleKick(payload, sender);
                    break;

                case "PONG":
                    return;

                default:
                    console.warn(`Unknown message type: ${type}`);
            }

            // Note: Handlers are now responsible for Persist & Broadcast.
            // But Alarms still need to be scheduled if state changes imply it.
            // Ideally, handlers should return checking if alarms needed, or we just check every time.
            // For Safety/Simplicity in Phase 5, let's trigger alarm check here using current state.
            await this.scheduleAlarms(this.engine['state']);

        } catch (err) {
            console.error("[SERVER ERROR] processing message:", err);
            sendError(sender, (err as Error).message || "Unknown error processing request");
        }
    }

    async scheduleAlarms(state: RoomState) {
        const now = Date.now();
        let nextTarget: number | null = null;

        if (state.status === 'PLAYING' && state.timers.roundEndsAt) {
            nextTarget = state.timers.roundEndsAt;
        } else if (state.status === 'REVIEW' && state.timers.votingEndsAt) {
            nextTarget = state.timers.votingEndsAt;
        } else if (state.status === 'RESULTS' && state.timers.resultsEndsAt) {
            nextTarget = state.timers.resultsEndsAt;
        }

        if (nextTarget && nextTarget > now) {
            // Only set if different? PartyKit optimizes usually.
            // console.log(`⏰ Watchdog scheduled for room ${this.room.id}`);
            await this.room.storage.setAlarm(nextTarget);
        }
    }

    async onAlarm() {
        console.log(`⏰ Watchdog triggered for room ${this.room.id}, status: ${this.engine['state'].status}`);
        try {
            const newState = this.engine.checkTimeouts();
            if (newState) {
                await this.room.storage.put(STORAGE_KEY, newState);
                await this.scheduleAlarms(newState);
                broadcastState(this.room, newState);
            }
        } catch (e) {
            console.error("[SERVER] Error in onAlarm:", e);
        }
    }

    onClose(connection: Party.Connection) {
        this.connectionHandler.handleClose(connection);
    }
}
