import { expect, test, describe } from 'vitest';
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

    test('Collision Type A: Same Tile -> Bounce Back', () => {
        const state = createDummyState();
        // P1 moves E (2,2 -> 3,2)
        // P2 moves W (4,2 -> 3,2)
        // Target 3,2 is contested.
        state.plannedCommands = [
            { type: 'MOVE', payload: { playerId: 'p1', to: { x: 3, y: 2 } }, execute: () => ({ success: true }) },
            { type: 'MOVE', payload: { playerId: 'p2', to: { x: 3, y: 2 } }, execute: () => ({ success: true }) }
        ];

        const newState = resolveTurn(state);

        const p1 = newState.players.find(p => p.id === 'p1');
        const p2 = newState.players.find(p => p.id === 'p2');

        // Expect BOUNCE (Stay at original)
        expect(p1?.position).toEqual({ x: 2, y: 2 });
        expect(p2?.position).toEqual({ x: 4, y: 2 });
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

        expect(p1?.position).toEqual({ x: 2, y: 2 });
        expect(p3?.position).toEqual({ x: 3, y: 2 });
    });
});
