import type * as Party from "partykit/server";
import { GameEngine } from "../shared/game-engine";

export interface HandlerContext {
    engine: GameEngine;
    room: Party.Room;
    sender?: Party.Connection;
}
