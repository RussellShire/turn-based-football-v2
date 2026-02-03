import type { MatchState, Command, Vector2, MatchPlayer } from './types';
import { getBresenhamLine, arePositionsEqual } from './grid';

type MoveMap = { [playerId: string]: { to: { x: number, y: number }, command: Command } };

/**
 * Resolves a tackle randomly between two players.
 */
const resolveTackle = (carrier: MatchPlayer, tackler: MatchPlayer): { winnerId: string } => {
    // For now, 50/50 chance. Can be based on attributes later.
    return Math.random() < 0.5 ? { winnerId: carrier.id } : { winnerId: tackler.id };
};

/**
 * Resolves a turn by simulating movement and actions one tick (tile) at a time.
 */
export const resolveTurn = (initialState: MatchState): MatchState => {
    // 1. Collect Actions
    const moves = collectMoves(initialState);
    const kickCommands = initialState.plannedCommands.filter(c => c.type === 'KICK');
    const firstKick = kickCommands.length > 0 ? kickCommands[0] : null;

    // Clone state for simulation
    const players = initialState.players.map(p => ({ ...p }));
    let ballPos = { ...initialState.ballPosition };
    let ballCarrierId = players.find(p => p.hasBall)?.id || null;

    // Track which tiles are "claimed" as final positions to avoid ending on same tile
    // Initial stationary players claim their starting positions
    const finalOccupants: { [key: string]: string } = {}; // "x,y" -> playerId
    players.forEach(p => {
        if (!moves[p.id]) {
            finalOccupants[`${p.position.x},${p.position.y}`] = p.id;
        }
    });

    // 2. Path Generation
    const playerPaths: { [pid: string]: Vector2[] } = {};
    players.forEach(p => {
        if (moves[p.id]) {
            playerPaths[p.id] = getBresenhamLine(p.position, moves[p.id].to);
        } else {
            playerPaths[p.id] = [p.position];
        }
    });

    let ballPath: Vector2[] = [];
    if (firstKick) {
        const payload = firstKick.payload as { playerId: string, to: Vector2 };
        ballPath = getBresenhamLine(ballPos, payload.to);
        // Remove ball from carrier if they are the kicker
        if (ballCarrierId === payload.playerId) {
            const kicker = players.find(p => p.id === ballCarrierId)!;
            kicker.hasBall = false;
            kicker.hasActedThisTurn = true;
            ballCarrierId = null;
        }
    } else if (ballCarrierId) {
        ballPath = playerPaths[ballCarrierId];
    } else {
        ballPath = [ballPos];
    }

    const maxTicks = Math.max(
        ...Object.values(playerPaths).map(p => p.length),
        ballPath.length
    );

    const isStopped: { [pid: string]: boolean } = {};
    let isBallStopped = false;

    // 3. Simulation Loop
    for (let t = 1; t < maxTicks; t++) {
        // Calculate where everyone WANTS to be this tick
        const proposedPositions: { [pid: string]: Vector2 } = {};
        players.forEach(p => {
            if (isStopped[p.id]) {
                proposedPositions[p.id] = p.position;
            } else {
                const path = playerPaths[p.id];
                proposedPositions[p.id] = path[t] || path[path.length - 1];
            }
        });

        // TILE OCCUPANCY CHECK: If a player reaches their destination, can they claim it?
        players.forEach(p => {
            if (isStopped[p.id] || !moves[p.id]) return;

            const path = playerPaths[p.id];
            const isAtEnd = t >= path.length - 1;

            if (isAtEnd) {
                const pos = proposedPositions[p.id];
                const key = `${pos.x},${pos.y}`;
                if (finalOccupants[key] && finalOccupants[key] !== p.id) {
                    // Tile taken! Stop short.
                    isStopped[p.id] = true;
                    // No change to p.position, it remains at path[t-1]
                } else {
                    // Claim it
                    finalOccupants[key] = p.id;
                }
            }
        });

        let proposedBallPos = ballPos;
        if (!isBallStopped) {
            if (ballCarrierId && !isStopped[ballCarrierId]) {
                proposedBallPos = proposedPositions[ballCarrierId];
            } else {
                proposedBallPos = ballPath[t] || ballPath[ballPath.length - 1];
            }
        }

        // Check Interceptions/Tackles
        if (!isBallStopped) {
            for (const p of players) {
                if (p.id === ballCarrierId) continue;

                const pPos = proposedPositions[p.id];
                const prevPPos = p.position;
                const prevBallPos = ballPos;

                let intercepted = false;
                let interceptTile = proposedBallPos;

                if (arePositionsEqual(pPos, proposedBallPos)) {
                    intercepted = true;
                } else if (arePositionsEqual(pPos, prevBallPos) && arePositionsEqual(proposedBallPos, prevPPos)) {
                    intercepted = true;
                    interceptTile = pPos;
                }

                if (intercepted) {
                    let ballWinnerId = p.id;

                    if (ballCarrierId) {
                        const carrier = players.find(c => c.id === ballCarrierId)!;
                        const result = resolveTackle(carrier, p);
                        ballWinnerId = result.winnerId;

                        carrier.hasBall = false;
                        carrier.currentHP = Math.max(0, carrier.currentHP - 1);
                        isStopped[carrier.id] = true;
                    }

                    // Reset both to stopped status
                    isStopped[p.id] = true;

                    const winner = players.find(w => w.id === ballWinnerId)!;

                    // Winner takes tile ONLY if it is free or they already claimed it
                    const key = `${interceptTile.x},${interceptTile.y}`;
                    const currentOccupant = finalOccupants[key];
                    const canWinnerTakeTile = !currentOccupant || currentOccupant === winner.id;

                    if (canWinnerTakeTile) {
                        winner.position = interceptTile;
                        finalOccupants[key] = winner.id;
                        ballPos = interceptTile;
                    } else {
                        // Winner stops short, ball stays with them at their previous tile
                        ballPos = winner.position;
                    }

                    winner.hasBall = true;
                    ballCarrierId = ballWinnerId;
                    isBallStopped = true;
                    break;
                }
            }
        }

        // Move everyone who wasn't stopped to their proposed positions
        players.forEach(p => {
            if (!isStopped[p.id]) {
                p.position = proposedPositions[p.id];
            }
        });
        if (!isBallStopped) {
            ballPos = proposedBallPos;
        }
    }

    // Update HP and reset turn flags
    const finalPlayers = players.map(p => {
        const initialP = initialState.players.find(ip => ip.id === p.id);
        const initialPos = initialP ? initialP.position : p.position;
        const moved = !arePositionsEqual(p.position, initialPos);

        return {
            ...p,
            currentHP: moved ? p.currentHP - 1 : p.currentHP,
            hasMovedThisTurn: false,
            hasActedThisTurn: false
        } as MatchPlayer;
    });

    return {
        ...initialState,
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
            moves[payload.playerId] = {
                to: payload.to,
                command: cmd
            };
        }
    });
    return moves;
};
