import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from './store';

// Mock generateAIPlans and resolveTurn if necessary, 
// but we want to test the store's orchestration.
vi.mock('./engine/ai', () => ({
    generateAIPlans: () => []
}));

vi.mock('./engine/resolution', () => ({
    resolveTurn: (state: any) => ({ ...state, players: [...state.players] })
}));

describe('GameStore Turn/Half Logic', () => {
    beforeEach(() => {
        const store = useGameStore.getState();
        store.initializeMatch([], []);
    });

    test('should increment turn correctly', async () => {
        vi.useFakeTimers();
        const store = useGameStore.getState();

        expect(store.turn).toBe(1);
        expect(store.currentHalf).toBe(1);

        store.nextPhase(); // PLANNING -> RESOLUTION
        vi.advanceTimersByTime(1000); // Wait for transition

        expect(useGameStore.getState().turn).toBe(2);
        vi.useRealTimers();
    });

    test('should transition to 2nd half after max turns', async () => {
        vi.useFakeTimers();
        const store = useGameStore.getState();

        // Manual jump to turn 10
        useGameStore.setState({ turn: 10, maxTurnsPerHalf: 10, currentHalf: 1 });

        useGameStore.getState().nextPhase();
        vi.advanceTimersByTime(1000);

        const state = useGameStore.getState();
        expect(state.currentHalf).toBe(2);
        expect(state.turn).toBe(1);
        expect(state.isGameOver).toBe(false);
        vi.useRealTimers();
    });

    test('should set isGameOver after 2nd half ends', async () => {
        vi.useFakeTimers();

        // Manual jump to 2nd half, turn 10
        useGameStore.setState({ turn: 10, maxTurnsPerHalf: 10, currentHalf: 2 });

        useGameStore.getState().nextPhase();
        vi.advanceTimersByTime(1000);

        const state = useGameStore.getState();
        expect(state.isGameOver).toBe(true);
        vi.useRealTimers();
    });
});
