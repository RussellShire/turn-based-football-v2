import type { MatchState } from './types';
import type { Command, CommandResult } from './commands';

export const executeCommand = (state: MatchState, command: Command): CommandResult => {
    // Future: Add global checks here (e.g. is game paused, is match over)
    return command.execute(state);
};
