import { create } from 'zustand';
import type { MatchState, MatchPlayer, TeamId } from './engine/types';
import { GRID_WIDTH, GRID_HEIGHT } from './engine/grid';

interface GameStore extends MatchState {
    // Actions
    initializeMatch: (homePlayers: MatchPlayer[], awayPlayers: MatchPlayer[]) => void;
    nextPhase: () => void;
    // placeholder for more actions
}

const INITIAL_STATE: Omit<MatchState, 'activeTeam' | 'players' | 'ballPosition'> = {
    turn: 1,
    phase: 'PLANNING',
    gridSize: { width: GRID_WIDTH, height: GRID_HEIGHT },
};

export const useGameStore = create<GameStore>((set) => ({
    ...INITIAL_STATE,
    activeTeam: 'HOME',
    players: [],
    ballPosition: { x: 12, y: 8 }, // Center

    initializeMatch: (homePlayers, awayPlayers) => set({
        players: [...homePlayers, ...awayPlayers],
        turn: 1,
        phase: 'PLANNING',
        activeTeam: 'HOME',
        ballPosition: { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) }
    }),

    nextPhase: () => set((state) => {
        // Simple cycle for now: PLANNING -> EXECUTION -> RESOLUTION -> PLANNING
        let next: MatchState['phase'] = 'PLANNING';
        if (state.phase === 'PLANNING') next = 'EXECUTION';
        else if (state.phase === 'EXECUTION') next = 'RESOLUTION';

        // Increment turn if cycling back to PLANNING
        const nextTurn = next === 'PLANNING' ? state.turn + 1 : state.turn;

        return { phase: next, turn: nextTurn };
    })
}));
