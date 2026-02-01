import type { Command, CommandResult, MatchState, Vector2 } from '../types';

export interface KickPayload {
    playerId: string;
    to: Vector2;
}

export class KickCommand implements Command {
    type = 'KICK';
    payload: KickPayload;

    constructor(payload: KickPayload) {
        this.payload = payload;
    }

    execute(state: MatchState): CommandResult {
        const kicker = state.players.find(p => p.id === this.payload.playerId);

        if (!kicker) {
            return { success: false, error: 'Kicker not found' };
        }

        if (!kicker.hasBall) {
            return { success: false, error: 'Player does not have the ball' };
        }

        // Logic check: Kicking is handled primarily by the resolution engine
        // for simultaneous turns, but we include an execute method for consistency
        // or for immediate feedback if we ever use it that way.

        return {
            success: true,
            // We don't return a newState here because simultaneous resolution 
            // handles the actual state update for kicks.
        };
    }
}
