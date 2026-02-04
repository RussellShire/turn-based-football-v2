import { expect, test, describe, vi } from 'vitest';
import { resolveTurn, resolveTackle } from './resolution';
import type { MatchState } from './types';

const createDummyState = (): MatchState => ({
    turn: 1,
    phase: 'PLANNING',
    activeTeam: 'HOME',
    gridSize: { width: 10, height: 10 },
    ballPosition: { x: 5, y: 5 },
    plannedCommands: [],
    players: [
        {
            id: 'p1', sourcePlayerId: 's1', teamId: 'HOME', position: { x: 2, y: 2 },
            facingDirection: 'E', currentHP: 100, modifiers: [], hasBall: false,
            hasMovedThisTurn: false, hasActedThisTurn: false
        },
        {
            id: 'p2', sourcePlayerId: 's2', teamId: 'AWAY', position: { x: 4, y: 2 },
            facingDirection: 'W', currentHP: 100, modifiers: [], hasBall: false,
            hasMovedThisTurn: false, hasActedThisTurn: false
        }
    ],
    currentHalf: 1,
    maxTurnsPerHalf: 20,
    isGameOver: false,
});

describe('Resolution Logic', () => {
    test('Successful Simultaneous Move (No Conflict)', () => {
        const state = createDummyState();
        // P1 moves East (2,2 -> 3,2)
        // P2 moves East (4,2 -> 5,2)
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 3, y: 2 } }, execute: () => ({ success: true }) },
            { type: 'MOVE', payload: { playerId: 'p2', to: { x: 5, y: 2 } }, execute: () => ({ success: true }) }
        ];

        const newState = resolveTurn(state);

        const p1 = newState.players.find(p => p.id === 'p1');
        const p2 = newState.players.find(p => p.id === 'p2');

        expect(p1?.position).toEqual({ x: 3, y: 2 });
        expect(p2?.position).toEqual({ x: 5, y: 2 });
    });

    test('Collision Type A: Same Tile -> One Claims, One Stops Short', () => {
        const state = createDummyState();
        // P1 moves E (2,2 -> 3,2)
        // P2 moves W (4,2 -> 3,2)
        // They both reach 3,2 at Tick 1. 
        // In my implementation, the first one in the loop (P1) claims it.
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 3, y: 2 } }, execute: () => ({ success: true }) },
            { type: 'MOVE', payload: { playerId: 'p2', to: { x: 3, y: 2 } }, execute: () => ({ success: true }) }
        ];

        const newState = resolveTurn(state);

        const p1 = newState.players.find(p => p.id === 'p1');
        const p2 = newState.players.find(p => p.id === 'p2');

        // P1 got there first in the loop
        expect(p1?.position).toEqual({ x: 3, y: 2 });
        // P2 should stop short at 4,2
        expect(p2?.position).toEqual({ x: 4, y: 2 });
    });

    test('Unit: resolveTackle Probability (Same Tile)', () => {
        const carrier = { id: 'carrier' } as any;
        const tackler = { id: 'tackler' } as any;

        // Same Tile -> 70% Defender win chance
        vi.spyOn(Math, 'random').mockReturnValue(0.69); // Defender wins
        expect(resolveTackle(carrier, tackler, { isSameTile: true }).winnerId).toBe('tackler');

        vi.spyOn(Math, 'random').mockReturnValue(0.71); // Attacker wins
        expect(resolveTackle(carrier, tackler, { isSameTile: true }).winnerId).toBe('carrier');
        vi.restoreAllMocks();
    });

    test('Unit: resolveTackle Probability (Adjacent Zone)', () => {
        const carrier = { id: 'carrier' } as any;
        const tackler = { id: 'tackler' } as any;

        // Adjacent -> 30% Defender win chance
        vi.spyOn(Math, 'random').mockReturnValue(0.29); // Defender wins
        expect(resolveTackle(carrier, tackler, { isSameTile: false }).winnerId).toBe('tackler');

        vi.spyOn(Math, 'random').mockReturnValue(0.31); // Attacker wins
        expect(resolveTackle(carrier, tackler, { isSameTile: false }).winnerId).toBe('carrier');
        vi.restoreAllMocks();
    });

    test('Collision Type B: Head-on Swap -> Bounce Back', () => {
        const state = createDummyState();
        // P1 at 2,2 moves to 3,2 (where P3 is)
        // P3 at 3,2 moves to 2,2 (where P1 is)
        state.players.push({
            id: 'p3', sourcePlayerId: 's3', teamId: 'AWAY', position: { x: 3, y: 2 },
            facingDirection: 'W', currentHP: 100, modifiers: [], hasBall: false,
            hasMovedThisTurn: false, hasActedThisTurn: false
        });

        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 3, y: 2 } }, execute: () => ({ success: true }) },
            { type: 'MOVE', payload: { playerId: 'p3', to: { x: 2, y: 2 } }, execute: () => ({ success: true }) }
        ];

        const newState = resolveTurn(state);
        const p1 = newState.players.find(p => p.id === 'p1');
        const p3 = newState.players.find(p => p.id === 'p3');

        // NEW BEHAVIOR: They can swap through each other!
        expect(p1?.position).toEqual({ x: 3, y: 2 });
        expect(p3?.position).toEqual({ x: 2, y: 2 });
    });

    test('Move Through Opponent -> Should trigger Adjacent Tackle at Tick 1', () => {
        const state = createDummyState();
        // P1 starts at (2,2), P2 at (4,2).
        // P1 moves (2,2) -> (3,2). Path is [2,2, 3,2, 4,2, 5,2]
        // AT TICK 1: P1 is at (3,2), P2 is at (4,2). ADJACENT!
        state.players.find(p => p.id === 'p1')!.hasBall = true;
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 5, y: 2 } }, execute: () => ({ success: true }) }
        ];

        vi.spyOn(Math, 'random').mockReturnValue(0.1); // Adjacent -> 0.3 def win, 0.1 means DEFENDER wins
        const newState = resolveTurn(state);
        const p1 = newState.players.find(p => p.id === 'p1');
        const p2 = newState.players.find(p => p.id === 'p2');

        expect(p2?.hasBall).toBe(true);
        expect(p1?.position).toEqual({ x: 2, y: 2 }); // Loser stops at prev pos
        vi.restoreAllMocks();
    });

    test('Tackle Zone: Intercept when adjacent', () => {
        const state = createDummyState();
        // P1 moves (2,2) -> (3,2). P2 is at (4,2).
        // At Tick 1: P1 is at (3,2), P2 is at (4,2). They are adjacent!
        state.players.find(p => p.id === 'p1')!.hasBall = true;
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 3, y: 2 } }, execute: () => ({ success: true }) }
        ];

        // Adjacent tackle -> 30% defender win chance -> Math.random < 0.7 means carrier wins.
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const newState = resolveTurn(state);
        const p1 = newState.players.find(p => p.id === 'p1');

        expect(p1?.hasBall).toBe(true);
        expect(p1?.position).toEqual({ x: 3, y: 2 });
        vi.restoreAllMocks();
    });

    test('Advantage Logic: Same Tile (Defender Edge)', () => {
        const state = createDummyState();
        // P1 starts at (2,2), P2 at (4,2).
        // P1 moves to (4,2). Tick 2: SAME TILE.
        state.players.find(p => p.id === 'p1')!.hasBall = true;
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 4, y: 2 } }, execute: () => ({ success: true }) }
        ];

        // Same tile -> 70% defender win chance. Math.random < 0.3 means carrier wins.
        // We want defender to win, so we return 0.5 (which is > 0.3)
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const newState = resolveTurn(state);
        const p1 = newState.players.find(p => p.id === 'p1');
        const p2 = newState.players.find(p => p.id === 'p2');

        expect(p2?.hasBall).toBe(true); // P2 wins
        expect(p1?.hasBall).toBe(false);
        vi.restoreAllMocks();
    });

    test('Advantage Logic: Adjacent Zone (Attacker Edge)', () => {
        const state = createDummyState();
        // P1 moves (2,2) -> (3,2). P2 is at (4,2). Adjacent.
        state.players.find(p => p.id === 'p1')!.hasBall = true;
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 3, y: 2 } }, execute: () => ({ success: true }) }
        ];

        // Adjacent -> 30% defender win chance. Math.random < 0.7 means carrier wins.
        // We return 0.5 (which is < 0.7), so carrier wins.
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const newState = resolveTurn(state);
        const p1 = newState.players.find(p => p.id === 'p1');

        expect(p1?.hasBall).toBe(true);
        vi.restoreAllMocks();
    });
});
