import type { MatchState, Command, Vector2, MatchPlayer } from './types';
import { getBresenhamLine, arePositionsEqual, isAdjacent } from './grid';

type MoveMap = { [playerId: string]: { to: { x: number, y: number }, command: Command } };

// --- Simulation Helpers ---

export interface TackleContext {
    isSameTile: boolean;
}

export const resolveTackle = (carrier: MatchPlayer, tackler: MatchPlayer, context: TackleContext): { winnerId: string } => {
    // Current requirement: 
    // Same tile -> Defender advantage (70% win for tackler)
    // Adjacent zone -> Attacker advantage (70% win for carrier)
    const defenderWinChance = context.isSameTile ? 0.7 : 0.3;
    return Math.random() < defenderWinChance ? { winnerId: tackler.id } : { winnerId: carrier.id };
};

const getPosAtTick = (path: Vector2[], t: number): Vector2 => path[t] || path[path.length - 1];

const getFinalOccupantsMap = (players: MatchPlayer[], moves: MoveMap): Record<string, string> => {
    const map: Record<string, string> = {};
    players.forEach(p => {
        if (!moves[p.id]) map[`${p.position.x},${p.position.y}`] = p.id;
    });
    return map;
};

// --- Main Resolution Logic ---

export const resolveTurn = (initialState: MatchState): MatchState => {
    const moves = collectMoves(initialState);
    const kickCommands = initialState.plannedCommands.filter(c => c.type === 'KICK');
    const firstKick = kickCommands.length > 0 ? kickCommands[0] : null;

    // 1. Simulation State Initialization
    const players = initialState.players.map(p => ({ ...p }));
    let ballPos = { ...initialState.ballPosition };
    let ballCarrierId = players.find(p => p.hasBall)?.id || null;
    const finalOccupants = getFinalOccupantsMap(players, moves);

    // 2. Path Calculation
    const playerPaths: Record<string, Vector2[]> = {};
    players.forEach(p => {
        playerPaths[p.id] = moves[p.id] ? getBresenhamLine(p.position, moves[p.id].to) : [p.position];
    });

    let ballPath: Vector2[] = [ballPos];
    if (firstKick) {
        const payload = firstKick.payload as { playerId: string, to: Vector2 };
        ballPath = getBresenhamLine(ballPos, payload.to);
        if (ballCarrierId === payload.playerId) {
            players.find(p => p.id === ballCarrierId)!.hasBall = false;
            players.find(p => p.id === ballCarrierId)!.hasActedThisTurn = true;
            ballCarrierId = null;
        }
    } else if (ballCarrierId) {
        ballPath = playerPaths[ballCarrierId];
    }

    const maxTicks = Math.max(...Object.values(playerPaths).map(p => p.length), ballPath.length);
    const isStopped: Record<string, boolean> = {};
    let isBallStopped = false;

    // 3. Simulation Loop
    for (let t = 1; t < maxTicks; t++) {
        // Calculate proposed movement for this tick
        const proposed: Record<string, Vector2> = {};
        players.forEach(p => {
            proposed[p.id] = isStopped[p.id] ? p.position : getPosAtTick(playerPaths[p.id], t);
        });

        // TILE OCCUPANCY: Prevent players ending on same tile (first-come first-served)
        players.forEach(p => {
            if (isStopped[p.id] || !moves[p.id]) return;
            const path = playerPaths[p.id];
            if (t >= path.length - 1) { // Final destination
                const key = `${proposed[p.id].x},${proposed[p.id].y}`;
                if (finalOccupants[key] && finalOccupants[key] !== p.id) {
                    isStopped[p.id] = true; // Stop short
                } else {
                    finalOccupants[key] = p.id;
                }
            }
        });

        const proposedBallPos = !isBallStopped
            ? (ballCarrierId && !isStopped[ballCarrierId] ? proposed[ballCarrierId] : getPosAtTick(ballPath, t))
            : ballPos;

        // INTERCEPTIONS & TACKLES
        if (!isBallStopped) {
            for (const p of players) {
                if (p.id === ballCarrierId) continue;

                const isSameTile = arePositionsEqual(proposed[p.id], proposedBallPos);
                const isZoneTackle = isAdjacent(proposed[p.id], proposedBallPos);

                if (isSameTile || isZoneTackle) {
                    const interceptTile = proposedBallPos;
                    let ballWinnerId = p.id;

                    if (ballCarrierId) {
                        const carrier = players.find(c => c.id === ballCarrierId)!;
                        const result = resolveTackle(carrier, p, { isSameTile });
                        ballWinnerId = result.winnerId;
                        carrier.hasBall = false;
                        carrier.currentHP = Math.max(0, carrier.currentHP - 1);
                        isStopped[carrier.id] = true;
                    }

                    isStopped[p.id] = true;
                    const winner = players.find(w => w.id === ballWinnerId)!;

                    // Winner takes tile only if free or they already claimed it
                    const key = `${interceptTile.x},${interceptTile.y}`;
                    const currentOccupant = finalOccupants[key];
                    const canWinnerTakeTile = !currentOccupant || currentOccupant === winner.id;

                    if (canWinnerTakeTile) {
                        winner.position = interceptTile;
                        finalOccupants[key] = winner.id;
                        ballPos = interceptTile;
                    } else {
                        ballPos = winner.position; // Stay at previous tile with ball
                    }

                    winner.hasBall = true;
                    ballCarrierId = ballWinnerId;
                    isBallStopped = true;
                    break;
                }
            }
        }

        // Apply movement for this tick
        players.forEach(p => { if (!isStopped[p.id]) p.position = proposed[p.id]; });
        if (!isBallStopped) ballPos = proposedBallPos;
    }

    return finalizeState(initialState, players, ballPos);
};

// --- State Finalization ---

const finalizeState = (initial: MatchState, players: MatchPlayer[], ballPos: Vector2): MatchState => {
    const finalPlayers = players.map(p => {
        const initialP = initial.players.find(ip => ip.id === p.id);
        const moved = initialP && !arePositionsEqual(p.position, initialP.position);
        return {
            ...p,
            currentHP: moved ? p.currentHP - 1 : p.currentHP,
            hasMovedThisTurn: false,
            hasActedThisTurn: false
        } as MatchPlayer;
    });

    return {
        ...initial,
        players: finalPlayers,
        ballPosition: ballPos,
        plannedCommands: [],
        phase: 'PLANNING'
    };
};

const collectMoves = (state: MatchState): MoveMap => {
    const moves: MoveMap = {};
    state.plannedCommands.forEach(cmd => {
        if (cmd.type === 'MOVE') {
            const payload = cmd.payload as { playerId: string, to: Vector2 };
            moves[payload.playerId] = { to: payload.to, command: cmd };
        }
    });
    return moves;
};
