import type * as Party from "partykit/server";
import { GameEngine } from "../shared/game-engine.js";
import { RoomState } from "../shared/types.js";
import { broadcastState, sendError } from "./utils/broadcaster";

const STORAGE_KEY = "room_state_v1";

export default class Server implements Party.Server {
    options: Party.ServerOptions = {
        hibernate: true, // Keep room alive even if empty for a while? Or false to kill it.
    };

    room: Party.Room;
    engine: GameEngine;

    constructor(room: Party.Room) {
        this.room = room;
        this.engine = new GameEngine(room.id);
    }

    async onStart() {
        // Hydrate from storage if exists
        const stored = await this.room.storage.get<RoomState>(STORAGE_KEY);
        if (stored) {
            console.log(`[Hydrate] Loaded state for room ${this.room.id}`);
            // We need a way to hydrate usage of game engine.
            // GameEngine constructor creates default state.
            // We should overwrite it.
            this.engine['state'] = stored; // Dirty hack or add method? Add method better usually.
            // For now, dirty hack JS style or typed access:
            // Let's assume we can set it.
        }
    }

    async onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
        const url = new URL(ctx.request.url);
        const name = url.searchParams.get("name") || "Guest";
        const userId = connection.id;
        const avatar = url.searchParams.get("avatar") || "👤";

        console.log(`[Connect] ${name} (${userId}) joined ${this.room.id}`);

        const state = this.engine.joinPlayer(userId, name, avatar, connection.id);

        // Save state
        await this.room.storage.put(STORAGE_KEY, state);

        // Broadcast entire state
        broadcastState(this.room, state);
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

                case "UPDATE_CONFIG":
                    // payload: Partial<GameConfig>
                    state = this.engine.updateConfig(sender.id, payload);
                    hasChanges = true;
                    break;

                case "KICK_PLAYER":
                    state = this.engine.kickPlayer(sender.id, payload.targetUserId);
                    hasChanges = true;
                    // Also close connection?
                    // const conn = this.room.getConnection(payload.targetUserId);
                    // if (conn) conn.close();
                    break;

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
        // Clear existing? PartyKit alarms are singular per ID or generic?
        // this.room.storage.alarm is singular.

        // If Play -> Schedule Round End
        // If Review -> Schedule Voting End
        // If RESULTS -> maybe auto restart? directly?

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
            // await this.room.storage.setAlarm(null); // Not supported yet or check docs
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
        const state = this.engine.playerDisconnected(connection.id);
        broadcastState(this.room, state);
    }
}
