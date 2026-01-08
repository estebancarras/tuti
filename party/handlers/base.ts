import type * as Party from "partykit/server";
import { GameEngine } from "../../shared/game-engine";

export abstract class BaseHandler {
    protected room: Party.Room;
    protected engine: GameEngine;

    constructor(room: Party.Room, engine: GameEngine) {
        this.room = room;
        this.engine = engine;
    }
}
