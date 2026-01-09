import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './game-engine';

describe('GameEngine Core', () => {
    let engine: GameEngine;
    const roomId = 'TEST_ROOM';
    const hostId = 'user-host';
    const hostConn = 'conn-host';

    beforeEach(() => {
        engine = new GameEngine(roomId);
    });

    // A. Inicialización y Gestión de Salas
    describe('Initialization & Player Management', () => {
        it('should initialize in LOBBY status', () => {
            const state = engine.getState();
            expect(state.status).toBe('LOBBY');
            expect(state.players).toHaveLength(0);
        });

        it('should add players correctly', () => {
            engine.joinPlayer(hostId, 'Host', 'avatar1', hostConn);
            const state = engine.getState();

            expect(state.players).toHaveLength(1);
            expect(state.players[0].id).toBe(hostId);
            expect(state.players[0].name).toBe('Host');
            expect(state.players[0].isHost).toBe(true);

            // Add second player
            engine.joinPlayer('user-2', 'Guest', 'avatar2', 'conn-2');
            expect(engine.getState().players).toHaveLength(2);
            expect(engine.getState().players[1].isHost).toBe(false);
        });

        it('should start game', () => {
            engine.joinPlayer(hostId, 'Host', 'avatar1', hostConn);
            engine.joinPlayer('user-2', 'Guest', 'avatar2', 'conn-2');

            engine.startGame(hostConn);

            const state = engine.getState();
            expect(state.status).toBe('PLAYING');
            expect(state.currentLetter).not.toBeNull();
            expect(state.timers.roundEndsAt).not.toBeNull();
        });
    });

    // B. Cálculo de Puntajes
    describe('Scoring Logic', () => {
        it('should calculate scores correctly (Unique/Duplicate/Empty/Invalid)', () => {
            // Setup Players
            const pA = 'player-A'; const cA = 'conn-A';
            const pB = 'player-B'; const cB = 'conn-B';
            const pC = 'player-C'; const cC = 'conn-C';
            const pD = 'player-D'; const cD = 'conn-D';
            const pE = 'player-E'; const cE = 'conn-E';

            engine.joinPlayer(pA, 'A', 'av', cA);
            engine.joinPlayer(pB, 'B', 'av', cB);
            engine.joinPlayer(pC, 'C', 'av', cC);
            engine.joinPlayer(pD, 'D', 'av', cD);
            engine.joinPlayer(pE, 'E', 'av', cE);

            engine.startGame(cA);

            // Mock categories and letter to control validation
            // We force 'Fruta' as the first category and 'M' as letter for 'Manzana' example
            const state = engine.getState();
            state.categories = ['Fruta'];
            state.currentLetter = 'M'; // Though our manual validation bypasses this if we want, but let's be consistent

            // To test scoring purely, we need to bypass strict letter validation or ensure inputs match.
            // The prompt asks for: "Manzana" (Unique), "Pera" (Repeated), etc.
            // Let's assume strict validation is ON, so we need to mock currentLetter or use words that match (or just inject directly if possible).
            // Actually, submitAnswers validates. Let's use internal state manipulation for setup if needed, or just standard flow.
            // Standard flow:
            // A: Manzana
            // B: Pera
            // C: Pera
            // D: ""
            // E: Xylofono (Rechazada)

            // Problem: If currentLetter is random, "Manzana" might be invalid.
            // Let's FORCE currentLetter to 'M' (Manzana) or 'P' (Pera)... waits, different letters.
            // Validator checks checking `startsWith`.
            // Let's FORCE validation logic to pass or inject 'M' and ignore others?
            // "Xylofono" needs to be voted out. "Manzana" needs to be unique. "Pera" repeated.
            // Just force currentLetter to null or update it to match nothing to disable check?
            // Looking at `validateAndSanitizeAnswers`:
            // `if (allowedLetter && ...)` 
            // If we set currentLetter to null, validation is skipped?
            // `state.currentLetter` is nullable in Types, but `startGame` sets it.
            // Let's overwrite it to null for this test to focus on duplicates/empty logic.
            state.currentLetter = null;

            // Submit Answers
            // A: Manzana
            engine.submitAnswers(cA, { 'Fruta': 'Manzana' });
            // B: Pera
            engine.submitAnswers(cB, { 'Fruta': 'Pera' });
            // C: Pera
            engine.submitAnswers(cC, { 'Fruta': 'Pera' });
            // D: "" (Empty)
            engine.submitAnswers(cD, { 'Fruta': '' });
            // E: Xylofono (Will be voted out)
            engine.submitAnswers(cE, { 'Fruta': 'Xylofono' });

            // Force End Round -> Review
            (engine as any).forceEndRound();

            // Perform Voting: Reject Player E's "Xylofono"
            // Everyone votes against E
            engine.toggleVote(cA, pE, 'Fruta');
            engine.toggleVote(cB, pE, 'Fruta');
            engine.toggleVote(cC, pE, 'Fruta');
            // 3/5 votes > 50% ? 3 > 2.5 -> Yes.

            // Confirm votes to proceed to results
            engine.confirmVotes(cA);
            engine.confirmVotes(cB);
            engine.confirmVotes(cC);
            engine.confirmVotes(cD);
            engine.confirmVotes(cE);

            // Now check scores in RESULTS state
            const finalState = engine.getState();
            expect(finalState.status).toBe('RESULTS');

            // Verify points
            // A (Unique): 100
            expect(finalState.roundScores[pA]).toBe(100);

            // B (Repeated): 50
            expect(finalState.roundScores[pB]).toBe(50);

            // C (Repeated): 50
            expect(finalState.roundScores[pC]).toBe(50);

            // D (Empty): 0
            expect(finalState.roundScores[pD]).toBe(0);

            // E (Invalid/Voted): 0
            expect(finalState.roundScores[pE]).toBe(0);
        });
    });

    // C. Validaciones de Seguridad
    describe('Security checks', () => {
        it('should ignore start game from non-host', () => {
            engine.joinPlayer(hostId, 'Host', 'av1', hostConn);
            engine.joinPlayer('guest', 'Guest', 'av2', 'conn-guest');

            // Attempt start from guest
            engine.startGame('conn-guest');

            expect(engine.getState().status).toBe('LOBBY');
        });
    });
});
