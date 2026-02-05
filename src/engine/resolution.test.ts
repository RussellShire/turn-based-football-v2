import { expect, test, describe, vi } from 'vitest';
import { resolveTurn, resolveTackle } from './resolution';
import type { MatchState } from './types';

const createDummyState = (): MatchState => ({
    turn: 1,
    phase: 'PLANNING',
    activeTeam: 'HOME',
    score: { HOME: 0, AWAY: 0 },
    gridSize: { width: 10, height: 10 },
    ballPosition: { x: 5, y: 5 },
    plannedCommands: [],
    players: [
        {
            id: 'p1', sourcePlayerId: 's1', teamId: 'HOME', position: { x: 2, y: 2 },
            facingDirection: 'E', currentHP: 100, modifiers: [], attributes: { speed: 50, technique: 50, strength: 50, intelligence: 50 }, hasBall: false,
            hasMovedThisTurn: false, hasActedThisTurn: false
        },
        {
            id: 'p2', sourcePlayerId: 's2', teamId: 'AWAY', position: { x: 4, y: 2 },
            facingDirection: 'W', currentHP: 100, modifiers: [], attributes: { speed: 50, technique: 50, strength: 50, intelligence: 50 }, hasBall: false,
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

    test('Unit: resolveTackle Probability (Same Tile, Equal Stats)', () => {
        const attributes = { speed: 50, technique: 50, strength: 50, intelligence: 50 };
        const carrier = { id: 'carrier', attributes } as any;
        const tackler = { id: 'tackler', attributes } as any;

        // Equal Stats (50/50 base) + Same Tile (0.2 bonus) = 70% Defender win chance
        vi.spyOn(Math, 'random').mockReturnValue(0.69); // Defender wins
        expect(resolveTackle(carrier, tackler, { isSameTile: true }).winnerId).toBe('tackler');

        vi.spyOn(Math, 'random').mockReturnValue(0.71); // Attacker wins
        expect(resolveTackle(carrier, tackler, { isSameTile: true }).winnerId).toBe('carrier');
        vi.restoreAllMocks();
    });

    test('Unit: resolveTackle Probability (Adjacent Zone, Equal Stats)', () => {
        const attributes = { speed: 50, technique: 50, strength: 50, intelligence: 50 };
        const carrier = { id: 'carrier', attributes } as any;
        const tackler = { id: 'tackler', attributes } as any;

        // Equal Stats (50/50 base) + Adjacent (-0.2 penalty) = 30% Defender win chance
        vi.spyOn(Math, 'random').mockReturnValue(0.29); // Defender wins
        expect(resolveTackle(carrier, tackler, { isSameTile: false }).winnerId).toBe('tackler');

        vi.spyOn(Math, 'random').mockReturnValue(0.31); // Attacker wins
        expect(resolveTackle(carrier, tackler, { isSameTile: false }).winnerId).toBe('carrier');
        vi.restoreAllMocks();
    });

    test('Unit: resolveTackle Probability (Stats Difference)', () => {
        const carrier = { id: 'carrier', attributes: { technique: 30, strength: 50, speed: 50, intelligence: 50 } } as any;
        const tackler = { id: 'tackler', attributes: { technique: 50, strength: 70, speed: 50, intelligence: 50 } } as any;

        // Base Win Chance = 0.5 + (70 - 30) / 100 = 0.9
        // Same Tile (+0.2) = 1.1 -> Clamped to 0.9
        vi.spyOn(Math, 'random').mockReturnValue(0.89);
        expect(resolveTackle(carrier, tackler, { isSameTile: true }).winnerId).toBe('tackler');

        // Adjacent (-0.2) = 0.7
        vi.spyOn(Math, 'random').mockReturnValue(0.69);
        expect(resolveTackle(carrier, tackler, { isSameTile: false }).winnerId).toBe('tackler');

        vi.spyOn(Math, 'random').mockReturnValue(0.71);
        expect(resolveTackle(carrier, tackler, { isSameTile: false }).winnerId).toBe('carrier');

        vi.restoreAllMocks();
    });

    test('Collision Type B: Head-on Swap -> Bounce Back', () => {
        const state = createDummyState();
        // P1 at 2,2 moves to 3,2 (where P3 is)
        // P3 at 3,2 moves to 2,2 (where P1 is)
        state.players.push({
            id: 'p3', sourcePlayerId: 's3', teamId: 'AWAY', position: { x: 3, y: 2 },
            facingDirection: 'W', currentHP: 100, modifiers: [], attributes: { speed: 50, technique: 50, strength: 50, intelligence: 50 }, hasBall: false,
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
        expect(p1?.position).toEqual({ x: 3, y: 2 }); // Intercepted at (3,2)
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
        // Set stats to 50/50
        // Same tile -> 70% defender win chance. Math.random < 0.7 means defender wins.
        // We return 0.1 (which is < 0.7), so defender wins.
        vi.spyOn(Math, 'random').mockReturnValue(0.1);

        // P1 starts at (2,2), P2 at (4,2).
        // P1 moves to (4,2). Tick 2: SAME TILE.
        state.players.find(p => p.id === 'p1')!.hasBall = true;
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 4, y: 2 } }, execute: () => ({ success: true }) }
        ];

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

    test('Goal Scoring: HOME team scores (KICK) -> Reset State', () => {
        const state = createDummyState();
        state.gridSize = { width: 24, height: 16 };
        state.ballPosition = { x: 22, y: 7 }; // One away from AWAY goal (x=23, y=6-9)
        state.players[0].hasBall = true;
        state.players[0].position = { x: 22, y: 7 };

        state.plannedCommands = [
            { type: 'KICK', payload: { playerId: 'p1', to: { x: 23, y: 7 } }, execute: () => ({ success: true }) }
        ];
        const newState = resolveTurn(state);
        expect(newState.score.HOME).toBe(1);
        expect(newState.score.AWAY).toBe(0);

        // Final positions (not yet reset)
        const p1 = newState.players.find(p => p.id === 'p1');
        expect(p1?.position.x).toBe(22);
        expect(newState.ballPosition.x).toBe(23); // In goal
    });

    test('Goal Scoring: AWAY team scores (DRIBBLE) -> Deferred Reset', () => {
        const state = createDummyState();
        state.gridSize = { width: 24, height: 16 };
        state.ballPosition = { x: 1, y: 7 }; // One away from HOME goal (x=0)
        state.players[1].position = { x: 1, y: 7 }; // P2 is AWAY
        state.players[1].hasBall = true;

        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p2', to: { x: 0, y: 7 } }, execute: () => ({ success: true }) }
        ];

        const newState = resolveTurn(state);

        expect(newState.score.AWAY).toBe(1);
        expect(newState.score.HOME).toBe(0);

        // Final positions (not yet reset)
        const p2 = newState.players.find(p => p.id === 'p2');
        expect(p2?.position.x).toBe(0); // Dribbled into goal
        expect(newState.ballPosition.x).toBe(0); // In goal
    });

    test('Bug Fix: Teammates should not tackle each other during move', () => {
        const state = createDummyState();
        // Remove p2 to avoid accidental AWAY tackle
        state.players = state.players.filter(p => p.id !== 'p2');

        // P1 has ball, P3 is teammate nearby (at 3,2).
        state.players.push({
            id: 'p3', sourcePlayerId: 's3', teamId: 'HOME', position: { x: 3, y: 2 },
            facingDirection: 'E', currentHP: 100, modifiers: [], attributes: { speed: 50, technique: 50, strength: 50, intelligence: 50 }, hasBall: false,
            hasMovedThisTurn: false, hasActedThisTurn: false
        });

        state.players.find(p => p.id === 'p1')!.hasBall = true;
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 5, y: 2 } }, execute: () => ({ success: true }) }
        ];

        const newState = resolveTurn(state);
        const p1 = newState.players.find(p => p.id === 'p1');

        // P1 should reach destination (5,2) and not be stopped by P3 (3,2)
        expect(p1?.position).toEqual({ x: 5, y: 2 });
        expect(p1?.hasBall).toBe(true);
    });

    test('Bug Fix: Teammates CAN catch a loose ball on same tile', () => {
        const state = createDummyState();
        state.players = state.players.filter(p => p.id !== 'p2'); // Remove AWAY player

        // P3 (HOME) is at (3,2).
        state.players.push({
            id: 'p3', sourcePlayerId: 's3', teamId: 'HOME', position: { x: 3, y: 2 },
            facingDirection: 'E', currentHP: 100, modifiers: [], attributes: { speed: 50, technique: 50, strength: 50, intelligence: 50 }, hasBall: false,
            hasMovedThisTurn: false, hasActedThisTurn: false
        });

        // Ball is at (2,2) and is KICKED to (4,2). Tick 1: Ball is at (3,2).
        state.ballPosition = { x: 2, y: 2 };
        state.activeTeam = 'HOME';
        state.plannedCommands = [
            { type: 'KICK', payload: { playerId: 'p1', to: { x: 4, y: 2 } }, execute: () => ({ success: true }) }
        ];

        const newState = resolveTurn(state);
        const p3 = newState.players.find(p => p.id === 'p3');

        // P3 should catch the ball at (3,2)
        expect(p3?.position).toEqual({ x: 3, y: 2 });
        expect(p3?.hasBall).toBe(true);
        expect(newState.ballPosition).toEqual({ x: 3, y: 2 });
    });

    test('Bug Fix: Teammates do NOT intercept loose ball via zone', () => {
        const state = createDummyState();
        state.players = state.players.filter(p => p.id !== 'p2');

        // P3 (HOME) is at (3,3). 
        state.players.push({
            id: 'p3', sourcePlayerId: 's3', teamId: 'HOME', position: { x: 3, y: 3 },
            facingDirection: 'E', currentHP: 100, modifiers: [], attributes: { speed: 50, technique: 50, strength: 50, intelligence: 50 }, hasBall: false,
            hasMovedThisTurn: false, hasActedThisTurn: false
        });

        // Ball is KICKED from (2,2) to (4,2). Tick 1: Ball is at (3,2).
        // (3,3) is ADJACENT to (3,2).
        state.ballPosition = { x: 2, y: 2 };
        state.activeTeam = 'HOME';
        state.plannedCommands = [
            { type: 'KICK', payload: { playerId: 'p1', to: { x: 4, y: 2 } }, execute: () => ({ success: true }) }
        ];

        const newState = resolveTurn(state);
        const p3 = newState.players.find(p => p.id === 'p3');

        // P3 should NOT catch it because they are only adjacent, not on same tile.
        expect(p3?.hasBall).toBe(false);
        expect(newState.ballPosition).toEqual({ x: 4, y: 2 }); // Ball reaches destination
    });
});
