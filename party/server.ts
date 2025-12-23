import type * as Party from "partykit/server";
import { GameEngine } from "../shared/game-engine.js";
import { RoomState } from "../shared/types.js";

const STORAGE_KEY = "room_state_v1";

export default class Room implements Party.Server {
    private engine: GameEngine;

    constructor(readonly room: Party.Room) {
        this.engine = new GameEngine(room.id);
    }

    async onStart() {
        try {
            const data = await this.room.storage.get<RoomState>(STORAGE_KEY);
            if (data) {
                this.engine.hydrate(data);
                console.log("[SERVER] Room state hydrated successfully");
            }
        } catch (e) {
            console.error("[SERVER] Failed to hydrate state:", e);
        }
    }

    private async saveState() {
        try {
            const state = this.engine.getState();
            await this.room.storage.put(STORAGE_KEY, state);
            console.log("[PERSISTENCE] Saving state to disk...");
        } catch (e) {
            console.error("[PERSISTENCE] Failed to save state:", e);
        }
    }

    async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        console.log(
            `Connected:
              id: ${conn.id}
              room: ${this.room.id}
              url: ${new URL(ctx.request.url).pathname}`
        );

        // Join logic is handled by client sending JOIN message, but we can send initial state
        conn.send(JSON.stringify({
            type: "UPDATE_STATE",
            payload: this.engine.getState()
        }));
    }

    async onMessage(message: string, sender: Party.Connection) {
        try {
            console.log(`connection ${sender.id} sent message: ${message}`);
            const parsed = JSON.parse(message);
            let shouldPersist = false;

            try {
                if (parsed.type === 'JOIN') {
                    // Avatar comes from payload or fallback if missing (though client should send it)
                    const avatar = parsed.payload.avatar || '👤';
                    this.engine.joinPlayer(parsed.payload.userId, parsed.payload.name, avatar, sender.id);
                    shouldPersist = true;
                } else if (parsed.type === 'START_GAME') {
                    this.engine.startGame(sender.id);
                    shouldPersist = true;
                } else if (parsed.type === 'STOP_ROUND') {
                    this.engine.stopRound(sender.id, parsed.payload.answers);
                    shouldPersist = true;
                } else if (parsed.type === 'SUBMIT_ANSWERS') {
                    this.engine.submitAnswers(sender.id, parsed.payload.answers);
                    shouldPersist = true;
                } else if (parsed.type === 'UPDATE_ANSWERS') {
                    // Passive update (debounce), same logic as submit but distinct message type for clarity
                    this.engine.submitAnswers(sender.id, parsed.payload.answers);
                    shouldPersist = true;
                } else if (parsed.type === 'TOGGLE_VOTE') {
                    this.engine.toggleVote(sender.id, parsed.payload.targetUserId, parsed.payload.category);
                    shouldPersist = true;
                } else if (parsed.type === 'CONFIRM_VOTES') {
                    this.engine.confirmVotes(sender.id);
                    shouldPersist = true;
                } else if (parsed.type === 'UPDATE_CONFIG') {
                    this.engine.updateConfig(sender.id, parsed.payload);
                    shouldPersist = true;
                }
                else if (parsed.type === 'RESTART_GAME') {
                    this.engine.restartGame(sender.id);
                    shouldPersist = true;
                }
                else if (parsed.type === 'KICK_PLAYER') {
                    this.engine.kickPlayer(sender.id, parsed.payload.targetUserId);
                    shouldPersist = true;
                }
                else if (parsed.type === 'EXIT_GAME') {
                    // Do nothing specific on server, connection close handles disconnect
                }
            } catch (err) {
                console.error("[SERVER ERROR] processing message:", err);
                sender.send(JSON.stringify({
                    type: 'ERROR',
                    payload: { message: (err as Error).message || "Unknown error processing request" }
                }));
                return;
            }

            const state = this.engine.getState();

            if (shouldPersist) {
                await this.saveState();
            }

            // Schedule alarms based on timers
            await this.scheduleAlarms(state);

            // Broadcast new state
            this.room.broadcast(JSON.stringify({
                type: "UPDATE_STATE",
                payload: state
            }));

        } catch (e) {
            console.error("Error handling message", e);
        }
    }

    private async scheduleAlarms(state: any) {
        // Clear any existing alarm first
        await this.room.storage.deleteAlarm();

        // Schedule new alarm based on current state
        if (state.status === 'PLAYING' && state.timers.roundEndsAt) {
            await this.room.storage.setAlarm(state.timers.roundEndsAt);
        } else if (state.status === 'REVIEW' && state.timers.votingEndsAt) {
            await this.room.storage.setAlarm(state.timers.votingEndsAt);
        } else if (state.status === 'RESULTS' && state.timers.resultsEndsAt) {
            await this.room.storage.setAlarm(state.timers.resultsEndsAt);
        }
    }

    async onAlarm() {
        try {
            const state = this.engine.getState();
            const now = Date.now();
            let changed = false;

            if (state.status === 'PLAYING' && state.timers.roundEndsAt && now >= state.timers.roundEndsAt) {
                this.engine.forceEndRound();
                changed = true;
            } else if (state.status === 'REVIEW' && state.timers.votingEndsAt && now >= state.timers.votingEndsAt) {
                this.engine.forceEndVoting();
                changed = true;
            } else if (state.status === 'RESULTS' && state.timers.resultsEndsAt && now >= state.timers.resultsEndsAt) {
                this.engine.forceStartNextRound();
                changed = true;
            }

            if (changed) {
                await this.saveState();
                const newState = this.engine.getState();
                // Schedule next alarm if needed
                await this.scheduleAlarms(newState);

                // Broadcast updated state
                this.room.broadcast(JSON.stringify({
                    type: "UPDATE_STATE",
                    payload: newState
                }));
            }
        } catch (e) {
            console.error("[SERVER] Error in onAlarm:", e);
        }
    }

    onClose(connection: Party.Connection) {
        const state = this.engine.playerDisconnected(connection.id);
        this.room.broadcast(JSON.stringify({
            type: "UPDATE_STATE",
            payload: state
        }));
    }
}
