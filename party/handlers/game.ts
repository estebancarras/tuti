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
}
