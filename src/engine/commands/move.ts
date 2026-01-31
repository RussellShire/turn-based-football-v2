import type { Command, CommandResult } from '../commands';
import type { MatchState, Vector2 } from '../types';
import { isValidTile, getManhattanDistance, arePositionsEqual } from '../grid';

export interface MovePayload {
    playerId: string;
    to: Vector2;
}

export class MoveCommand implements Command {
    type = 'MOVE';

    payload: MovePayload;

    constructor(payload: MovePayload) {
        this.payload = payload;
    }

    execute(state: MatchState): CommandResult {
        const { playerId, to } = this.payload;
        const playerIndex = state.players.findIndex(p => p.id === playerId);

        if (playerIndex === -1) {
            return { success: false, error: 'Player not found' };
        }

        const player = state.players[playerIndex];

        // 1. Validation: Is Tile Valid?
        if (!isValidTile(to)) {
            return { success: false, error: 'Invalid destination tile' };
        }

        // 2. Validation: Is Tile Occupied?
        const isOccupied = state.players.some(p => arePositionsEqual(p.position, to) && p.id !== playerId);
        if (isOccupied) {
            return { success: false, error: 'Tile occupied' };
        }

        // 3. Validation: Max Range / AP Cost
        const distance = getManhattanDistance(player.position, to);
        // We use currentHP as a proxy for AP/Stamina for this iteration
        if (player.currentHP < distance) {
            return { success: false, error: 'Insufficient stamina' };
        }

        // 4. Execute: Update State
        const newPlayers = [...state.players];
        newPlayers[playerIndex] = {
            ...player,
            position: to,
            currentHP: player.currentHP - distance,
            hasMovedThisTurn: true
        };

        // If player has ball, ball moves with them
        let newBallPosition = state.ballPosition;
        if (player.hasBall) {
            newBallPosition = to;
        }

        return {
            success: true,
            newState: {
                ...state,
                players: newPlayers,
                ballPosition: newBallPosition
            }
        };
    }
}
