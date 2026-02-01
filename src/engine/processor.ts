import type { Command, CommandResult, MatchState } from './types';

export const executeCommand = (state: MatchState, command: Command): CommandResult => {
    // Future: Add global checks here (e.g. is game paused, is match over)
    return command.execute(state);
};
