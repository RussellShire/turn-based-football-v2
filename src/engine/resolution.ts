import type { MatchState, Command, Vector2, MatchPlayer } from './types';
import { getBresenhamLine } from './grid';

type MoveMap = { [playerId: string]: { to: { x: number, y: number }, command: Command } };
type InterceptionMap = { [playerId: string]: { to: { x: number, y: number }, hasBall: boolean } };

export const resolveTurn = (initialState: MatchState): MatchState => {
    // 1. Collect Moves
    const moves = collectMoves(initialState);

    // 2. Resolve Collisions (Bounce Back)
    const bouncedPlayerIds = resolveCollisions(initialState, moves);

    // 3. Resolve Ball Interceptions (Mid-Move)
    const interceptedMoves = resolveBallInterceptions(initialState, moves, bouncedPlayerIds);

    // 4. Apply Moves & Basic Ball Interaction
    let { nextPlayers, nextBallPos } = applyMoves(initialState, moves, bouncedPlayerIds, interceptedMoves);

    // 5. Process Actions (Kicks)
    const kickResult = processKicks(initialState, nextPlayers, nextBallPos);
    nextPlayers = kickResult.nextPlayers;
    nextBallPos = kickResult.nextBallPos;

    return {
        ...initialState,
        players: nextPlayers,
        ballPosition: nextBallPos,
        plannedCommands: [], // Clear queue
        phase: 'PLANNING'
    };
};

/**
 * 1. Collect all valid MoveCommands
 */
const collectMoves = (state: MatchState): MoveMap => {
    const moves: MoveMap = {};
    state.plannedCommands.forEach(cmd => {
        if (cmd.type === 'MOVE') {
            moves[cmd.payload.playerId] = {
                to: cmd.payload.to,
                command: cmd
            };
        }
    });
    return moves;
};

/**
 * 2. Identify and Resolve Collisions
 * Returns a Set of player IDs that must bounce back to their original position.
 */
const resolveCollisions = (state: MatchState, moves: MoveMap): Set<string> => {
    const bouncedPlayerIds = new Set<string>();
    const targetCounts: { [key: string]: string[] } = {}; // "x,y" -> [playerIds]

    // Count targets
    Object.keys(moves).forEach(pid => {
        const dest = moves[pid].to;
        const key = `${dest.x},${dest.y}`;
        if (!targetCounts[key]) targetCounts[key] = [];
        targetCounts[key].push(pid);
    });

    // Check Type A: Multiple players to same tile
    Object.entries(targetCounts).forEach(([key, pids]) => {
        if (pids.length > 1) {
            // Collision! All bounce back.
            pids.forEach(pid => bouncedPlayerIds.add(pid));
        } else {
            // Only 1 player moving here. But is it occupied by a stationary player?
            const [tx, ty] = key.split(',').map(Number);
            const occupant = state.players.find(p => p.position.x === tx && p.position.y === ty);
            if (occupant && !moves[occupant.id]) {
                // Trying to move into a stationary player -> Bounce
                bouncedPlayerIds.add(pids[0]);
            }
        }
    });

    // Check Type B: Head-on Swaps
    Object.keys(moves).forEach(pidA => {
        if (bouncedPlayerIds.has(pidA)) return; // Already bounced

        const targetA = moves[pidA].to;
        const playerB = state.players.find(p => p.position.x === targetA.x && p.position.y === targetA.y);

        if (playerB && moves[playerB.id]) {
            const targetB = moves[playerB.id].to;
            const originalPosA = state.players.find(p => p.id === pidA)!.position;

            if (targetB.x === originalPosA.x && targetB.y === originalPosA.y) {
                bouncedPlayerIds.add(pidA);
                bouncedPlayerIds.add(playerB.id);
            }
        }
    });

    return bouncedPlayerIds;
};

/**
 * 3. Resolve Mid-Turn Ball Interceptions
 * Calculates if moving players intercept a loose ball along their path.
 */
const resolveBallInterceptions = (
    state: MatchState,
    moves: MoveMap,
    bouncedPlayerIds: Set<string>
): InterceptionMap => {
    const interceptedMoves: InterceptionMap = {};
    const isBallLoose = !state.players.some(p => p.hasBall);

    if (isBallLoose) {
        let bestInterceptor: { playerId: string, ticks: number } | null = null;

        for (const pid of Object.keys(moves)) {
            if (bouncedPlayerIds.has(pid)) continue;

            const startPos = state.players.find(p => p.id === pid)!.position;
            const endPos = moves[pid].to;
            const path = getBresenhamLine(startPos, endPos);

            const index = path.findIndex(p => p.x === state.ballPosition.x && p.y === state.ballPosition.y);

            if (index > 0) {
                if (!bestInterceptor || index < bestInterceptor.ticks) {
                    bestInterceptor = { playerId: pid, ticks: index };
                }
            }
        }

        if (bestInterceptor) {
            interceptedMoves[bestInterceptor.playerId] = {
                to: state.ballPosition, // Stop at ball
                hasBall: true
            };
        }
    }

    return interceptedMoves;
};

/**
 * 4. Apply Moves to generate Next State
 */
const applyMoves = (
    state: MatchState,
    moves: MoveMap,
    bouncedPlayerIds: Set<string>,
    interceptedMoves: InterceptionMap
) => {
    let nextBallPos = { ...state.ballPosition };
    const nextPlayers = state.players.map(p => {
        if (moves[p.id] && !bouncedPlayerIds.has(p.id)) {
            // Successful move
            let target = moves[p.id].to;
            let hasBall = p.hasBall;

            // Check Interception
            if (interceptedMoves[p.id]) {
                target = interceptedMoves[p.id].to;
                hasBall = interceptedMoves[p.id].hasBall;
            }

            // Check Standard Pickup at Dest
            const ballWasLoose = !state.players.some(pl => pl.hasBall);
            if (!interceptedMoves[p.id] && ballWasLoose && target.x === state.ballPosition.x && target.y === state.ballPosition.y) {
                hasBall = true;
            }

            if (hasBall) {
                nextBallPos = target;
            }

            return {
                ...p,
                position: target,
                currentHP: p.currentHP - 1,
                hasMovedThisTurn: false,
                hasActedThisTurn: false,
                hasBall: hasBall,
            };
        } else {
            // Failed Move / Stationary
            return {
                ...p,
                hasMovedThisTurn: false,
                hasActedThisTurn: false
            };
        }
    });

    return { nextPlayers, nextBallPos };
};

/**
 * 5. Process Kicks and Kick Interceptions
 */
const processKicks = (
    state: MatchState,
    players: MatchPlayer[],
    ballPos: Vector2
) => {
    let nextPlayers = [...players];
    let nextBallPos = { ...ballPos };

    const kickCommands = state.plannedCommands.filter(c => c.type === 'KICK');

    kickCommands.forEach(cmd => {
        const kickerId = cmd.payload.playerId;
        const target = cmd.payload.to;

        const kickerIndex = nextPlayers.findIndex(p => p.id === kickerId);
        if (kickerIndex === -1) return;

        let kicker = nextPlayers[kickerIndex];

        if (kicker.hasBall) {
            kicker.hasBall = false;
            let actualTarget = target;

            // Path Raycast
            const path = getBresenhamLine(kicker.position, target);
            let interceptorIndex = -1;

            for (let i = 1; i < path.length; i++) {
                const cell = path[i];
                const blockerIndex = nextPlayers.findIndex(p => p.position.x === cell.x && p.position.y === cell.y);

                if (blockerIndex !== -1 && nextPlayers[blockerIndex].id !== kicker.id) {
                    interceptorIndex = blockerIndex;
                    actualTarget = cell;
                    break;
                }
            }

            nextBallPos = actualTarget;
            kicker.hasActedThisTurn = true;
            nextPlayers[kickerIndex] = kicker;

            if (interceptorIndex !== -1) {
                nextPlayers[interceptorIndex] = {
                    ...nextPlayers[interceptorIndex],
                    hasBall: true
                };
            }
        }
    });

    return { nextPlayers, nextBallPos };
};
