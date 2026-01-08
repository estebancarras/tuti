import type * as Party from "partykit/server";
import { RoomState } from "../../shared/types";

export function broadcastState(room: Party.Room, state: RoomState) {
    room.broadcast(JSON.stringify({
        type: "UPDATE_STATE",
        payload: state
    }));
}

export function sendError(connection: Party.Connection, message: string) {
    connection.send(JSON.stringify({
        type: "ERROR",
        payload: { message }
    }));
}
