import type * as Party from "partykit/server";
import { BaseHandler } from "./base";
import { broadcastState, sendError } from "../utils/broadcaster";

const STORAGE_KEY = "room_state_v1";

export class PlayerHandler extends BaseHandler {

    async handleKick(payload: any, sender: Party.Connection) {
        try {
            const { targetUserId } = payload;

            // Engine logic
            const state = this.engine.kickPlayer(sender.id, targetUserId);

            // Persist
            await this.room.storage.put(STORAGE_KEY, state);

            // Broadcast
            broadcastState(this.room, state);

            // Optional: Force close connection of kicked player? 
            // Logic in engine removes them from state, but connection might stay open.
            // We can force close it here if we want strict kicking.
            // For now, let's keep it simple as per original server.ts behavior.

        } catch (err) {
            sendError(sender, (err as Error).message);
        }
    }

    async handleUpdateSettings(payload: any, sender: Party.Connection) {
        try {
            // Engine logic
            const state = this.engine.updateConfig(sender.id, payload);

            // Persist
            await this.room.storage.put(STORAGE_KEY, state);

            // Broadcast
            broadcastState(this.room, state);

        } catch (err) {
            sendError(sender, (err as Error).message);
        }
    }
}
