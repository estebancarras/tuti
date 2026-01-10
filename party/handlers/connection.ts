import type * as Party from "partykit/server";
import { BaseHandler } from "./base";
import { broadcastState, sendError } from "../utils/broadcaster";

const STORAGE_KEY = "room_state_v1";

export class ConnectionHandler extends BaseHandler {

    async handleConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
        try {
            const url = new URL(ctx.request.url);
            const name = url.searchParams.get("name") || "Guest";
            // CRITICAL FIX: Use client-provided ID if available (persistence), else fallback to connection ID
            const userId = url.searchParams.get("userId") || connection.id;
            const avatar = url.searchParams.get("avatar") || "👤";

            console.log(`[Connect] ${name} (${userId}) joined ${this.room.id}`);

            // Join Player in Engine
            const state = this.engine.joinPlayer(userId, name, avatar, connection.id);

            // Save state
            await this.room.storage.put(STORAGE_KEY, state);

            // Broadcast entire state
            broadcastState(this.room, state);
        } catch (err) {
            console.error("[Connect Error]", err);
            sendError(connection, "Failed to join room");
        }
    }

    async handleClose(connection: Party.Connection) {
        console.log(`[Disconnect] ${connection.id} left ${this.room.id}`);
        // Engine handles logic (update presence, host protection)
        const state = this.engine.playerDisconnected(connection.id);

        // Broadcast update
        broadcastState(this.room, state);
    }
}
