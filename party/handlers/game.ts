import type * as Party from "partykit/server";
import { BaseHandler } from "./base";
import { broadcastState, sendError } from "../utils/broadcaster";

const STORAGE_KEY = "room_state_v1";

export class GameHandler extends BaseHandler {

    async handleStartGame(sender: Party.Connection) {
        try {
            const state = this.engine.startGame(sender.id);
            await this.persistAndBroadcast(state);
        } catch (err) {
            sendError(sender, (err as Error).message);
        }
    }

    async handleStopRound(payload: any, sender: Party.Connection) {
        try {
            const state = this.engine.stopRound(sender.id, payload.answers);
            await this.persistAndBroadcast(state);
        } catch (err) {
            sendError(sender, (err as Error).message);
        }
    }

    async handleSubmitAnswers(payload: any, sender: Party.Connection) {
        try {
            const state = this.engine.submitAnswers(sender.id, payload.answers);
            await this.persistAndBroadcast(state);
        } catch (err) {
            sendError(sender, (err as Error).message);
        }
    }

    // Helper to keep DRY
    private async persistAndBroadcast(state: any) {
        await this.room.storage.put(STORAGE_KEY, state);
        broadcastState(this.room, state);
    }
    async handleAdminReset(sender: Party.Connection) {
        try {
            // Security Check: Verify if sender is Host
            const state = this.engine.getState();
            const host = state.players.find(p => p.isHost);

            if (!host || host.id !== sender.id) {
                // Also allow if no host exists? (Safety net)
                // But usually there is a host.
                // If checking adminId (server secret), that's different. 
                // Requirement: "sender.id equals adminId (Solo el host puede resetear)" -> Implies Host player.
                throw new Error("Only the host can reset the game.");
            }

            console.log(`[ADMIN] Game reset by ${sender.id}`);
            const newState = this.engine.reset();
            await this.persistAndBroadcast(newState);
        } catch (err) {
            sendError(sender, (err as Error).message);
        }
    }
}
