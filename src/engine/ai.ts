import type { MatchState, Command } from './types';
import { GRID_WIDTH, GRID_HEIGHT } from './grid';

export const generateAIPlans = (state: MatchState): Command[] => {
    const aiCommands: Command[] = [];
    const aiTeam = 'AWAY'; // Assuming AI is always AWAY for now

    const aiPlayers = state.players.filter(p => p.teamId === aiTeam);

    aiPlayers.forEach(player => {
        // Simple random move: Try random adjacent tiles until one is valid
        // In a real AI, this would be much smarter (A*, goal oriented)

        const possibleMoves = [
            { x: player.position.x, y: player.position.y - 0 }, // N
            { x: player.position.x, y: player.position.y + 0 }, // S
            { x: player.position.x - 0, y: player.position.y }, // W
            { x: player.position.x + 0, y: player.position.y }, // E
        ];

        // Shuffle moves
        const shuffled = possibleMoves.sort(() => 0.5 - Math.random());

        for (const target of shuffled) {
            // Check bounds (isValidTile)
            if (target.x >= 0 && target.x < GRID_WIDTH && target.y >= 0 && target.y < GRID_HEIGHT) {
                // Check if tile is occupied by ANOTHER player (ignoring self, though we are moving so self is empty technically, 
                // but for planning we check static state usually.
                // Depending on MoveCommand validation.
                // Let's just create the command. Resolution will handle collisions.
                // But we shouldn't plan to walk into a wall or obvious obstruction if possible?
                // For "Simultaneous" we want conflicts, so let's allow moving to occupied tiles?
                // No, usually you plan to move to open space.
                // Let's check current occupancy to be "smart-ish".
                const occupied = state.players.some(p => p.position.x === target.x && p.position.y === target.y);
                if (!occupied) {
                    aiCommands.push({
                        type: 'MOVE',
                        payload: { playerId: player.id, to: target },
                        execute: () => ({ success: true }) // Dummy execute, real one comes from MoveCommand class usually or we reconstruct
                    });
                    break; // Found a move, stop
                }
            }
        }
    });

    return aiCommands;
};
