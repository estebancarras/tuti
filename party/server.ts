import type * as Party from "partykit/server";
import { GameEngine } from "../shared/game-engine.js";

export default class Room implements Party.Server {
    private engine: GameEngine;

    constructor(readonly room: Party.Room) {
        this.engine = new GameEngine(room.id);
    }

    onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
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

    onMessage(message: string, sender: Party.Connection) {
        try {
            console.log(`connection ${sender.id} sent message: ${message}`);
            const parsed = JSON.parse(message);

            try {
                if (parsed.type === 'JOIN') {
                    this.engine.joinPlayer(parsed.payload.userId, parsed.payload.name, sender.id);
                } else if (parsed.type === 'START_GAME') {
                    this.engine.startGame(sender.id);
                } else if (parsed.type === 'STOP_ROUND') {
                    this.engine.stopRound(sender.id, parsed.payload.answers);
                } else if (parsed.type === 'SUBMIT_ANSWERS') {
                    this.engine.submitAnswers(sender.id, parsed.payload.answers);
                } else if (parsed.type === 'TOGGLE_VOTE') {
                    this.engine.toggleVote(sender.id, parsed.payload.targetUserId, parsed.payload.category);
                } else if (parsed.type === 'CONFIRM_VOTES') {
                    this.engine.confirmVotes(sender.id);
                } else if (parsed.type === 'UPDATE_CONFIG') {
                    this.engine.updateConfig(sender.id, parsed.payload);
                }

                else if (parsed.type === 'RESTART_GAME') {
                    this.engine.restartGame();
                }
                else if (parsed.type === 'KICK_PLAYER') {
                    this.engine.kickPlayer(sender.id, parsed.payload.targetUserId);
                    // We rely on the broadcast state update to notify the client they've been kicked
                }
                else if (parsed.type === 'EXIT_GAME') {
                    // Do nothing specific on server, connection close handles disconnect
                }
            } catch (err) {
                console.error("[SERVER ERROR] processing message:", err);
                // Send specific error to the client who caused it
                sender.send(JSON.stringify({
                    type: 'ERROR',
                    payload: { message: (err as Error).message || "Unknown error processing request" }
                }));
                return; // Stop processing to avoid broadcasting invalid state
            }

            const state = this.engine.getState();

            // Schedule alarms based on timers
            this.scheduleAlarms(state);

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
        const state = this.engine.getState();
        const now = Date.now();

        // Check if round timer expired
        if (state.status === 'PLAYING' && state.timers.roundEndsAt && now >= state.timers.roundEndsAt) {
            this.engine.forceEndRound();
        }
        // Check if voting timer expired
        else if (state.status === 'REVIEW' && state.timers.votingEndsAt && now >= state.timers.votingEndsAt) {
            this.engine.forceEndVoting();
        }
        // Check if results timer expired
        else if (state.status === 'RESULTS' && state.timers.resultsEndsAt && now >= state.timers.resultsEndsAt) {
            this.engine.forceStartNextRound();
        }

        const newState = this.engine.getState();

        // Schedule next alarm if needed
        await this.scheduleAlarms(newState);

        // Broadcast updated state
        this.room.broadcast(JSON.stringify({
            type: "UPDATE_STATE",
            payload: newState
        }));
    }

    onClose(connection: Party.Connection) {
        this.engine.playerDisconnected(connection.id);

        // Broadcast new state
        this.room.broadcast(JSON.stringify({
            type: "UPDATE_STATE",
            payload: this.engine.getState()
        }));
    }
}

