import { expect, test, describe, vi } from 'vitest';
import { resolveTurn } from './resolution';
import type { MatchState } from './types';

const createDummyState = (): MatchState => ({
    turn: 1,
    phase: 'PLANNING', // Important: Resolution logic likely resets to PLANNING
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
    ]
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

    test('Tackle Logic -> Randomness (Mocking Math.random)', () => {
        const state = createDummyState();
        // P1 at 2,2 moves to 4,2 with ball
        // P2 is stationary at 4,2
        state.players[0].hasBall = true;

        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 4, y: 2 } }, execute: () => ({ success: true }) }
        ];

        // Case 1: Carrier wins (Math.random < 0.5)
        const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
        const state1 = resolveTurn(state);
        expect(state1.players.find(p => p.id === 'p1')?.hasBall).toBe(true);
        expect(state1.players.find(p => p.id === 'p2')?.hasBall).toBe(false);

        // Case 2: Tackler wins (Math.random >= 0.5)
        mathSpy.mockReturnValue(0.6);
        const state2 = resolveTurn(state);
        expect(state2.players.find(p => p.id === 'p1')?.hasBall).toBe(false);
        expect(state2.players.find(p => p.id === 'p2')?.hasBall).toBe(true);

        mathSpy.mockRestore();
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

    test('Move Through Opponent -> Should triggering Tackle', () => {
        const state = createDummyState();
        // P1 at 2,2 moves to 5,2
        // P2 (AWAY) is at 4,2 (Stationary)
        // Path is 2,2 -> 3,2 -> 4,2 -> 5,2

        state.players = [
            {
                id: 'p1', sourcePlayerId: 's1', teamId: 'HOME', position: { x: 2, y: 2 },
                facingDirection: 'E', currentHP: 100, modifiers: [], hasBall: true,
                hasMovedThisTurn: false, hasActedThisTurn: false
            },
            {
                id: 'p2', sourcePlayerId: 's2', teamId: 'AWAY', position: { x: 4, y: 2 },
                facingDirection: 'W', currentHP: 100, modifiers: [], hasBall: false,
                hasMovedThisTurn: false, hasActedThisTurn: false
            }
        ];

        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 5, y: 2 } }, execute: () => ({ success: true }) }
        ];

        vi.spyOn(Math, 'random').mockReturnValue(0.6); // Tackler wins
        const newState = resolveTurn(state);
        const p1 = newState.players.find(p => p.id === 'p1');
        const p2 = newState.players.find(p => p.id === 'p2');

        // NEW BEHAVIOR: P1 LOST, so they stop at 3,2
        // P2 (the winner) stays at 4,2
        expect(p1?.position).toEqual({ x: 3, y: 2 });
        expect(p2?.position).toEqual({ x: 4, y: 2 });
        expect(p2?.hasBall).toBe(true);
        expect(p1?.hasBall).toBe(false);
        vi.restoreAllMocks();
    });

    test('Free Ball Interception -> Should Reach Destination (No Stop Short)', () => {
        const state = createDummyState();
        // Ball at 5,2
        state.ballPosition = { x: 5, y: 2 };
        // P1 starts at 2,2 moves to 5,2 (destination)
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 5, y: 2 } }, execute: () => ({ success: true }) }
        ];

        const newState = resolveTurn(state);
        const p1 = newState.players.find(p => p.id === 'p1');

        expect(p1?.position).toEqual({ x: 5, y: 2 });
        expect(p1?.hasBall).toBe(true);
        expect(newState.ballPosition).toEqual({ x: 5, y: 2 });
    });
});
