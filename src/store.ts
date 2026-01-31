import { create } from 'zustand';
import type { MatchState, MatchPlayer, TeamId } from './engine/types';
import { GRID_WIDTH, GRID_HEIGHT } from './engine/grid';

import { executeCommand } from './engine/processor';
import type { Command, CommandResult } from './engine/commands';

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
};

export const useGameStore = create<GameStore>((set, get) => ({
    ...INITIAL_STATE,
    activeTeam: 'HOME',
    players: [],
    ballPosition: { x: 12, y: 8 }, // Center

    initializeMatch: (homePlayers, awayPlayers) => set({
        players: [...homePlayers, ...awayPlayers],
        turn: 1,
        phase: 'PLANNING',
        activeTeam: 'HOME',
        ballPosition: { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) },
        plannedCommands: []
    }),

    dispatch: (command) => {
        const state = get();

        // In PLANNING phase, we just queue moves essentially
        if (state.phase === 'PLANNING') {
            // Check if player already has a planned move, if so replace it
            // Assuming payload always has playerId for now. 
            // In a real robust system we'd use a more generic way to identify actor.
            const newPayload = command.payload as any;
            if (newPayload.playerId) {
                const filtered = state.plannedCommands.filter(c => (c.payload as any).playerId !== newPayload.playerId);
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

    nextPhase: () => set((state) => {
        // In this simple version, "Next Phase" essentially triggers "End Turn"
        // Cycle: Home Turn -> Away Turn -> Next Round

        const nextTeam: TeamId = state.activeTeam === 'HOME' ? 'AWAY' : 'HOME';
        const nextTurn = nextTeam === 'HOME' ? state.turn + 1 : state.turn;

        // Reset player flags for the NEW active team (or all, simpler to reset all)
        const resetPlayers = state.players.map(p => ({
            ...p,
            hasMovedThisTurn: false,
            hasActedThisTurn: false,
            // Regenerate some AP? For now reset to 100 or keep as is? 
            // Let's assume full recovery for simple testing, or just don't touch HP yet which means stamina is persistent.
            // Plan said "resource management", so let's keep it persistent, maybe regen a bit.
            // Let's just reset flags for now.
        }));

        return {
            activeTeam: nextTeam,
            turn: nextTurn,
            phase: 'PLANNING', // Always go back to planning start of turn
            players: resetPlayers
        };
    })
}));

