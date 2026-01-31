import { expect, test, describe } from 'vitest';
import { MoveCommand } from './move';
import type { MatchState } from '../types';

// Helper to create a dummy state
const createDummyState = (): MatchState => ({
    turn: 1,
    phase: 'EXECUTION',
    activeTeam: 'HOME',
    gridSize: { width: 10, height: 10 },
    ballPosition: { x: 5, y: 5 },
    plannedCommands: [],
    players: [
        {
            id: 'p1',
            sourcePlayerId: 'source1',
            teamId: 'HOME',
            position: { x: 2, y: 2 },
            facingDirection: 'E',
            currentHP: 100, // plenty of stamina
            modifiers: [],
            hasBall: false,
            hasMovedThisTurn: false,
            hasActedThisTurn: false
        },
        {
            id: 'p2',
            sourcePlayerId: 'source2',
            teamId: 'AWAY',
            position: { x: 3, y: 2 }, // adjacent to p1
            facingDirection: 'W',
            currentHP: 100,
            modifiers: [],
            hasBall: false,
            hasMovedThisTurn: false,
            hasActedThisTurn: false
        }
    ]
});

describe('MoveCommand', () => {
    test('SUCCESS: Valid move updates position and consumes stamina', () => {
        const state = createDummyState();
        const command = new MoveCommand({ playerId: 'p1', to: { x: 2, y: 3 } }); // 1 step South

        const result = command.execute(state);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();

        const updatedPlayer = result.newState?.players.find(p => p.id === 'p1');
        expect(updatedPlayer?.position).toEqual({ x: 2, y: 3 });
        expect(updatedPlayer?.currentHP).toBe(99); // 100 - 1 distance
        expect(updatedPlayer?.hasMovedThisTurn).toBe(true);
    });

    test('FAILURE: Cannot move to occupied tile', () => {
        const state = createDummyState();
        const command = new MoveCommand({ playerId: 'p1', to: { x: 3, y: 2 } }); // p2 is here

        const result = command.execute(state);

        expect(result.success).toBe(false);
        expect(result.error).toContain('occupied');
    });

    test('FAILURE: Cannot move out of bounds', () => {
        const state = createDummyState();
        const command = new MoveCommand({ playerId: 'p1', to: { x: -1, y: 2 } });

        const result = command.execute(state);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid destination');
    });

    test('FAILURE: Insufficient stamina', () => {
        const state = createDummyState();
        state.players[0].currentHP = 0; // Exhausted

        const command = new MoveCommand({ playerId: 'p1', to: { x: 2, y: 3 } });

        const result = command.execute(state);

        expect(result.success).toBe(false);
        expect(result.error).toContain('stamina');
    });
});
