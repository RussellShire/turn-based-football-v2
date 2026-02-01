import type { MatchState, Command, Vector2, MatchPlayer } from './types';
import { getBresenhamLine, arePositionsEqual } from './grid';

type MoveMap = { [playerId: string]: { to: { x: number, y: number }, command: Command } };
type InterceptionMap = { [playerId: string]: { to: { x: number, y: number }, hasBall: boolean } };

export const resolveTurn = (initialState: MatchState): MatchState => {
    // 1. Collect Moves (For identifying movers)
    const moves = collectMoves(initialState);

    // 2. Resolve Collisions (For identifying who bounces)
    const bouncedPlayerIds = resolveCollisions(initialState, moves);

    // 3. Process Kicks (Kicks happen with simultaneous player movement)
    // Returns updated player state (possession) and interceptions (players who must stop)
    const {
        nextPlayers: playersAfterKicks,
        nextBallPos: ballPosAfterKicks,
        interceptions: kickInterceptions
    } = processKicks(
        initialState,
        initialState.players,
        initialState.ballPosition,
        moves,
        bouncedPlayerIds
    );

    // 4. Resolve Ball Interceptions (Movers picking up the ball at its FINAL post-kick position)
    // This is for mid-move pickups of a ball that might have been loose already or just landed.
    const midMoveInterceptions = resolveBallInterceptions(initialState, moves, bouncedPlayerIds, ballPosAfterKicks);

    // Merge interceptions: Kick interceptions (mid-flight) and loose ball pickups.
    const allInterceptions = { ...midMoveInterceptions, ...kickInterceptions };

    // 5. Apply Moves
    let { nextPlayers, nextBallPos } = applyMoves(
        moves,
        bouncedPlayerIds,
        allInterceptions,
        playersAfterKicks,
        ballPosAfterKicks
    );

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
 * 3. Resolve Mid-Turn Ball Interceptions (Loose Ball Pickup)
 */
const resolveBallInterceptions = (
    state: MatchState,
    moves: MoveMap,
    bouncedPlayerIds: Set<string>,
    currentBallPos: Vector2
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

            const index = path.findIndex(p => arePositionsEqual(p, currentBallPos));

            if (index > 0) {
                if (!bestInterceptor || index < bestInterceptor.ticks) {
                    bestInterceptor = { playerId: pid, ticks: index };
                }
            }
        }

        if (bestInterceptor) {
            interceptedMoves[bestInterceptor.playerId] = {
                to: currentBallPos, // Stop at ball
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
    moves: MoveMap,
    bouncedPlayerIds: Set<string>,
    interceptedMoves: InterceptionMap,
    basePlayers: MatchPlayer[],
    baseBallPos: Vector2
) => {
    let nextBallPos = { ...baseBallPos };
    const nextPlayers = basePlayers.map(p => {
        if (moves[p.id] && !bouncedPlayerIds.has(p.id)) {
            let target = moves[p.id].to;
            let hasBall = p.hasBall;

            if (interceptedMoves[p.id]) {
                target = interceptedMoves[p.id].to;
                hasBall = interceptedMoves[p.id].hasBall;
            }

            // Fallback: Check Pickup at FINAL Dest
            const ballWasLoose = !basePlayers.some(pl => pl.hasBall);
            if (!interceptedMoves[p.id] && ballWasLoose && arePositionsEqual(target, baseBallPos)) {
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
 * 5. Process Kicks with simultaneous player movements
 */
const processKicks = (
    state: MatchState,
    players: MatchPlayer[],
    ballPos: Vector2,
    moves: MoveMap,
    bouncedPlayerIds: Set<string>
): { nextPlayers: MatchPlayer[], nextBallPos: Vector2, interceptions: InterceptionMap } => {
    let nextPlayers = players.map(p => ({ ...p }));
    let nextBallPos = { ...ballPos };
    const interceptions: InterceptionMap = {};

    const kickCommands = state.plannedCommands.filter(c => c.type === 'KICK');

    // Pre-calculate paths for all players to check simultaneous collision
    const playerPaths: { [pid: string]: Vector2[] } = {};
    players.forEach(p => {
        const start = p.position;
        if (moves[p.id] && !bouncedPlayerIds.has(p.id)) {
            playerPaths[p.id] = getBresenhamLine(start, moves[p.id].to);
        } else {
            playerPaths[p.id] = [start]; // Stationary
        }
    });

    kickCommands.forEach(cmd => {
        const kickerId = cmd.payload.playerId;
        const target = cmd.payload.to;

        const kickerIndex = nextPlayers.findIndex(p => p.id === kickerId);
        if (kickerIndex === -1) return;

        let kicker = nextPlayers[kickerIndex];

        if (kicker.hasBall) {
            kicker.hasBall = false;
            let actualTarget = target;
            let interceptorId: string | null = null;

            // Ball Flight Path
            const ballPath = getBresenhamLine(kicker.position, target);

            // SIMULATION: Check each tick of the flight
            // Tick 0 is release. We start checking from Tick 1.
            for (let t = 1; t < ballPath.length; t++) {
                const bPos = ballPath[t];

                // Identify if any player is at bPos at time t
                for (const pid of Object.keys(playerPaths)) {
                    if (pid === kickerId) continue; // Kicker can't intercept own ball on first move

                    const pPath = playerPaths[pid];
                    const pPos = pPath[t] || pPath[pPath.length - 1]; // Use last pos if movement ended

                    if (arePositionsEqual(bPos, pPos)) {
                        // HIT!
                        interceptorId = pid;
                        actualTarget = bPos;
                        break;
                    }
                }
                if (interceptorId) break;
            }

            nextBallPos = actualTarget;
            kicker.hasActedThisTurn = true;
            nextPlayers[kickerIndex] = kicker;

            if (interceptorId) {
                const idx = nextPlayers.findIndex(p => p.id === interceptorId);
                nextPlayers[idx].hasBall = true;

                // Interceptor must stop at actualTarget
                interceptions[interceptorId] = {
                    to: actualTarget,
                    hasBall: true
                };
            }
        }
    });

    return { nextPlayers, nextBallPos, interceptions };
};
