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

            if (parsed.type === 'JOIN') {
                this.engine.joinPlayer(sender.id, parsed.payload.name);
            } else if (parsed.type === 'START_GAME') {
                this.engine.startGame(sender.id);
            } else if (parsed.type === 'STOP_ROUND') {
                this.engine.stopRound(sender.id);
            }

            // Broadcast new state
            this.room.broadcast(JSON.stringify({
                type: "UPDATE_STATE",
                payload: this.engine.getState()
            }));

        } catch (e) {
            console.error("Error handling message", e);
        }
    }

    onClose(connection: Party.Connection) {
        this.engine.removePlayer(connection.id);

        // Broadcast new state
        this.room.broadcast(JSON.stringify({
            type: "UPDATE_STATE",
            payload: this.engine.getState()
        }));
    }
}

