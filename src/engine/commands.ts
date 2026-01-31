import type { MatchState } from './types';

export interface CommandResult {
    success: boolean;
    newState?: MatchState;
    error?: string;
}

export interface Command {
    type: string;
    payload: unknown;
    execute(state: MatchState): CommandResult;
}
