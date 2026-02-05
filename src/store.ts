import { create } from 'zustand';
import type { MatchState, MatchPlayer } from './engine/types';
import { GRID_WIDTH, GRID_HEIGHT } from './engine/grid';
import { executeCommand } from './engine/processor';
import type { Command, CommandResult } from './engine/types';
import { generateAIPlans } from './engine/ai';
import { resolveTurn } from './engine/resolution';
import { getKickOffState } from './engine/formation';

interface GameStore extends MatchState {
    // Actions
    initializeMatch: (homePlayers: MatchPlayer[], awayPlayers: MatchPlayer[]) => void;
    nextPhase: () => void;
    dispatch: (command: Command) => CommandResult;
}

const INITIAL_STATE: Omit<MatchState, 'activeTeam' | 'players' | 'ballPosition'> = {
    turn: 1,
    phase: 'PLANNING',
    plannedCommands: [],
    gridSize: { width: GRID_WIDTH, height: GRID_HEIGHT },
    currentHalf: 1,
    maxTurnsPerHalf: 10,
    isGameOver: false,
    score: { HOME: 0, AWAY: 0 },
};

export const useGameStore = create<GameStore>((set, get) => ({
    ...INITIAL_STATE,
    activeTeam: 'HOME',
    players: [],
    ballPosition: { x: 12, y: 8 }, // Center

    initializeMatch: (homePlayers, awayPlayers) => {
        const { players: initialPlayers, ballPosition } = getKickOffState(
            [...homePlayers, ...awayPlayers],
            'HOME'
        );
        set({
            ...INITIAL_STATE,
            players: initialPlayers,
            ballPosition,
            activeTeam: 'HOME'
        });
    },

    dispatch: (command) => {
        const state = get();

        // In PLANNING phase, we just queue moves essentially
        if (state.phase === 'PLANNING') {
            // Check if player already has a planned move, if so replace it
            // Assuming payload always has playerId for now. 
            // In a real robust system we'd use a more generic way to identify actor.
            const newPayload = command.payload as any;
            if (newPayload.playerId) {
                // Allow one command PER TYPE per player.
                // e.g. One MOVE, One PASS.
                const filtered = state.plannedCommands.filter(c =>
                    !((c.payload as any).playerId === newPayload.playerId && c.type === command.type)
                );
                set({ plannedCommands: [...filtered, command] });
                return { success: true };
            } else {
                set({ plannedCommands: [...state.plannedCommands, command] });
                return { success: true };
            }
        }

        // Direct execution (Fallback or for Execution phase if we had manual steps)
        const result = executeCommand(state, command);
        if (result.success && result.newState) {
            set(result.newState);
        }
        return result;
    },

    nextPhase: () => {
        const state = get();
        if (state.isGameOver) return;

        if (state.phase === 'PLANNING') {
            // 1. Generate AI Plans (Opponent - AWAY)
            const aiCommands = generateAIPlans(state);

            // 2. Combine with User Plans
            const allCommands = [...state.plannedCommands, ...aiCommands];

            // 3. Resolve Turn
            const planningState = { ...state, plannedCommands: allCommands };
            const resolvedState = resolveTurn(planningState);

            // Set to RESOLUTION phase first
            set({
                ...resolvedState,
                phase: 'RESOLUTION',
                plannedCommands: [],
            });

            // Automatically transition to next state after animation delay
            setTimeout(() => {
                set((s) => {
                    let nextTurn = s.turn + 1;
                    let nextHalf = s.currentHalf;
                    let gameOver = false;

                    if (nextTurn > s.maxTurnsPerHalf) {
                        if (s.currentHalf === 1) {
                            nextHalf = 2;
                            nextTurn = 1;
                        } else {
                            gameOver = true;
                            // Keep final turn count or set back to max
                        }
                    }

                    return {
                        ...s,
                        turn: nextTurn,
                        currentHalf: nextHalf,
                        isGameOver: gameOver,
                        phase: 'PLANNING',
                        activeTeam: 'HOME',
                    };
                });
            }, 1000); // 1s animation duration
        }
    }
}));

