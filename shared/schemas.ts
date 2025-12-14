import { z } from "zod";

export const PlayerSchema = z.object({
    id: z.string(),
    name: z.string().min(1).max(20),
    score: z.number(),
    isHost: z.boolean(),
});

export const GameStatusSchema = z.enum(['LOBBY', 'PLAYING', 'REVIEW', 'RESULTS']);

export const RoomStateSchema = z.object({
    status: GameStatusSchema,
    players: z.array(PlayerSchema),
});

export const JoinRoomSchema = z.object({
    type: z.literal('JOIN'),
    payload: z.object({
        name: z.string().min(1, "El nombre es obligatorio").max(20, "El nombre es muy largo"),
        userId: z.string(),
    }),
});

export const UpdateStateSchema = z.object({
    type: z.literal('UPDATE_STATE'),
    payload: RoomStateSchema,
});
