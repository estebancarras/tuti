import type * as Party from "partykit/server";
import { GameEngine } from "../shared/game-engine.js";
import { RoomState } from "../shared/types.js";
import { broadcastState, sendError } from "./utils/broadcaster";
import { ConnectionHandler } from "./handlers/connection";
import { PlayerHandler } from "./handlers/player";

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

    constructor(room: Party.Room) {
        this.room = room;
        this.engine = new GameEngine(room.id);

        // Instantiate Handlers
        this.connectionHandler = new ConnectionHandler(room, this.engine);
        this.playerHandler = new PlayerHandler(room, this.engine);
    }

    async onStart() {
        // Hydrate from storage if exists
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

            // Simple dispatcher for now. 
            // Phase 2: Refactor to Action Handlers

            let state = this.engine['state']; // Current ref
            let hasChanges = false;

            console.log(`[Message] ${type} from ${sender.id}`);

            switch (type) {
                // --- Game Logic Handled Here (For now) ---
                case "START_GAME":
                    state = this.engine.startGame(sender.id);
                    hasChanges = true;
                    break;

                case "SUBMIT_ANSWERS":
                    // payload: { answers: Record<string,string> }
                    state = this.engine.submitAnswers(sender.id, payload.answers);
                    hasChanges = true;
                    break;

                case "TOGGLE_VOTE":
                    // payload: { targetUserId, category }
                    state = this.engine.toggleVote(sender.id, payload.targetUserId, payload.category);
                    hasChanges = true;
                    break;

                case "CONFIRM_VOTES":
                    state = this.engine.confirmVotes(sender.id);
                    hasChanges = true;
                    break;

                case "STOP_ROUND":
                    // Validar si realmente puede parar
                    state = this.engine.stopRound(sender.id, payload.answers);
                    hasChanges = true;
                    break;

                // --- Admin Logic Delegated to PlayerHandler ---
                case "UPDATE_CONFIG":
                    await this.playerHandler.handleUpdateSettings(payload, sender);
                    return; // Handled by handler

                case "KICK_PLAYER":
                    await this.playerHandler.handleKick(payload, sender);
                    return; // Handled by handler

                case "PONG":
                    // Heartbeat, ignore
                    return;

                default:
                    console.warn(`Unknown message type: ${type}`);
            }

            if (hasChanges) {
                await this.room.storage.put(STORAGE_KEY, state);
                await this.scheduleAlarms(state); // Check if we need to set alarms (e.g. round timer)

                // Broadcast
                broadcastState(this.room, state);
            }

        } catch (err) {
            console.error("[SERVER ERROR] processing message:", err);
            sendError(sender, (err as Error).message || "Unknown error processing request");
            return;
        }
    }

    // Alarm is used for Game Loop Timers (Round End, Voting End)
    async scheduleAlarms(state: RoomState) {
        // Logic: Find the NEXT deadline in the state and set alarm for it.
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
            console.log(`⏰ Watchdog scheduled for room ${this.room.id} in ${nextTarget - now}ms`);
            await this.room.storage.setAlarm(nextTarget);
        } else {
            // Unset?
        }
    }

    async onAlarm() {
        console.log(`⏰ Watchdog triggered for room ${this.room.id}, status: ${this.engine['state'].status}`);

        // The alarm fired, meaning a timer expired.
        // Let the engine handle "Check Timeouts"
        try {
            const newState = this.engine.checkTimeouts();
            if (newState) {
                await this.room.storage.put(STORAGE_KEY, newState);
                await this.scheduleAlarms(newState);

                // Broadcast updated state
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
