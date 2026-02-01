import type { MatchState, Command } from './types';
import { getBresenhamLine } from './grid';


export const resolveTurn = (initialState: MatchState): MatchState => {
    // 1. Collect all valid MoveCommands
    // We recreate MoveCommand instances to use their logic if needed, or just process manually.
    // Since we stored simple objects in plannedCommands (or Command objects), we need to ensure they are executable.

    // Deep copy players for mutation during resolution
    let nextPlayers = initialState.players.map(p => ({ ...p }));
    let nextBallPos = { ...initialState.ballPosition };

    // Map playerId -> intended target
    const moves: { [playerId: string]: { to: { x: number, y: number }, command: Command } } = {};

    initialState.plannedCommands.forEach(cmd => {
        if (cmd.type === 'MOVE') {
            moves[cmd.payload.playerId] = {
                to: cmd.payload.to,
                command: cmd
            };
        }
    });

    // 2. Identify Collisions
    // A collision occurs if:
    // A) Two players move to the SAME tile.
    // B) Two players swap tiles (Head-on collision).

    const targetCounts: { [key: string]: string[] } = {}; // "x,y" -> [playerIds]

    Object.keys(moves).forEach(pid => {
        const dest = moves[pid].to;
        const key = `${dest.x},${dest.y}`;
        if (!targetCounts[key]) targetCounts[key] = [];
        targetCounts[key].push(pid);

        // Also check if they are moving into a tile that a NON-moving player occupies?
        // If player A moves to tile X, and Player B is at tile X and DOES NOT MOVE, that is also a collision.
        // We need to handle that.
    });

    // 3. Resolve Collisions
    // Bounce Back strategy: If conflict, player stays at original position.

    const bouncedPlayerIds = new Set<string>();

    // Check Type A: Multiple players to same tile
    Object.entries(targetCounts).forEach(([key, pids]) => {
        if (pids.length > 1) {
            // Collision! All bounce back.
            pids.forEach(pid => bouncedPlayerIds.add(pid));
        } else {
            // Only 1 player moving here. But is it occupied by a stationary player?
            // Note: If the stationary player ALSO wants to move, they are in `moves` map. 
            // If not in `moves` map, they are stationary.
            // But wait, if they move, their current tile is effectively empty (simultaneous).
            // So we only care if the occupant is NOT moving.

            const [tx, ty] = key.split(',').map(Number);
            const occupant = initialState.players.find(p => p.position.x === tx && p.position.y === ty);
            if (occupant && !moves[occupant.id]) {
                // Trying to move into a stationary player -> Bounce
                bouncedPlayerIds.add(pids[0]);
            }
        }
    });

    // Check Type B: Head-on Swaps (A->B, B->A)
    // Iterate moves to check for swaps
    Object.keys(moves).forEach(pidA => {
        if (bouncedPlayerIds.has(pidA)) return; // Already bounced

        const targetA = moves[pidA].to;
        // Check who is currently at targetA
        const playerB = initialState.players.find(p => p.position.x === targetA.x && p.position.y === targetA.y);

        if (playerB && moves[playerB.id]) {
            // Player B is also moving. Where?
            const targetB = moves[playerB.id].to;
            const originalPosA = initialState.players.find(p => p.id === pidA)!.position;

            // If B is moving to A's start -> Head On Collision
            if (targetB.x === originalPosA.x && targetB.y === originalPosA.y) {
                bouncedPlayerIds.add(pidA);
                bouncedPlayerIds.add(playerB.id);
            }
        }
    });

    // 3.5. Resolve Ball Interceptions (Mid-Turn)
    // If the ball is loose, players moving THROUGH the ball's tile should pick it up.
    // We check who reaches the ball in the fewest "ticks" (steps).

    // Track modifications to moves due to interception
    const interceptedMoves: { [playerId: string]: { to: { x: number, y: number }, hasBall: boolean } } = {};

    // Check if ball is currently held by anyone (in initial state)
    // Actually, we should check if it's held by anyone *who isn't moving away*?
    // User request: "If a player's coordinate matches the ball's coordinate... trigger possession change"
    // Implicitly this applies to LOOSE balls or stealing?
    // Let's assume LOOSE BALLS for now as interception is usually that.
    const isBallLoose = !initialState.players.some(p => p.hasBall);

    if (isBallLoose) {
        let bestInterceptor: { playerId: string, ticks: number } | null = null;

        // Iterate all valid movers
        for (const pid of Object.keys(moves)) {
            if (bouncedPlayerIds.has(pid)) continue; // Ignored bounced players

            const startPos = initialState.players.find(p => p.id === pid)!.position;
            const endPos = moves[pid].to;

            // Get Path
            const path = getBresenhamLine(startPos, endPos); // Includes start and end

            // Check intersection
            const ballX = initialState.ballPosition.x;
            const ballY = initialState.ballPosition.y;

            // Find index of ball in path (Tick count)
            const index = path.findIndex(p => p.x === ballX && p.y === ballY);

            if (index > 0) { // Index 0 is start (already there? handled by pre-check logic usually, but ok)
                // Found an interception course
                if (!bestInterceptor || index < bestInterceptor.ticks) {
                    bestInterceptor = { playerId: pid, ticks: index };
                }
            }
        }

        if (bestInterceptor) {
            // Apply interception changes
            const pid = bestInterceptor!.playerId;
            const ballPos = initialState.ballPosition;

            // Update the Move for this player to STOP at the ball
            interceptedMoves[pid] = {
                to: ballPos,
                hasBall: true
            };
        }
    }

    // 4. Apply Final State
    nextPlayers = nextPlayers.map(p => {
        if (moves[p.id] && !bouncedPlayerIds.has(p.id)) {
            // Successful move
            let target = moves[p.id].to;
            let hasBall = p.hasBall;

            // Check if this move was modified by Interception Logic
            if (interceptedMoves[p.id]) {
                target = interceptedMoves[p.id].to;
                hasBall = interceptedMoves[p.id].hasBall;
            }

            // Also check standard loose ball pickup at DESTINATION (if not already handled by interception)
            // If we didn't intercept mid-turn, but ended up on the ball?
            const ballWasLoose = !initialState.players.some(pl => pl.hasBall);
            if (!interceptedMoves[p.id] && ballWasLoose && target.x === initialState.ballPosition.x && target.y === initialState.ballPosition.y) {
                hasBall = true;
            }

            if (hasBall) {
                nextBallPos = target;
            }

            // Update stats (stamina)
            // Just basic deduction for now
            return {
                ...p,
                position: target,
                currentHP: p.currentHP - 1,
                hasMovedThisTurn: false,
                hasActedThisTurn: false,
                hasBall: hasBall,
            };
        } else {
            // Bounced or didn't move
            // Still need to reset flags for next turn!
            return {
                ...p,
                hasMovedThisTurn: false,
                hasActedThisTurn: false
            };
        }
    });

    // 5. Process Kicks / Actions
    // We process kicks AFTER moves.
    // We need to match Kick commands to the players who (likely) moved.

    // Check for KICK commands
    const kickCommands = initialState.plannedCommands.filter(c => c.type === 'KICK');

    kickCommands.forEach(cmd => {
        const kickerId = cmd.payload.playerId;
        const target = cmd.payload.to;

        // Find the kicker in the NEXT state (after moves)
        const kickerIndex = nextPlayers.findIndex(p => p.id === kickerId);
        if (kickerIndex === -1) return;

        let kicker = nextPlayers[kickerIndex];

        // Kicker must have the ball to kick
        if (kicker.hasBall) {
            // Execute Kick
            kicker.hasBall = false;
            // Default target is the intended target
            let actualTarget = target;

            // Calculate Path
            const path = getBresenhamLine(kicker.position, target);

            // Iterate path to find obstacles (players)
            // exclude index 0 (kicker's own pos)
            let interceptorIndex = -1;

            for (let i = 1; i < path.length; i++) {
                const cell = path[i];
                // Check if any player is at this cell (in NEXT state)
                const blockerIndex = nextPlayers.findIndex(p => p.position.x === cell.x && p.position.y === cell.y);

                if (blockerIndex !== -1 && nextPlayers[blockerIndex].id !== kicker.id) {
                    // Found an interceptor/blocker!
                    interceptorIndex = blockerIndex;
                    actualTarget = cell; // Ball stops here
                    break; // Stop at first blocker
                }
            }

            nextBallPos = actualTarget;

            // Mark kicker as Acted
            kicker.hasActedThisTurn = true;
            nextPlayers[kickerIndex] = kicker;

            if (interceptorIndex !== -1) {
                // Interception occurred!
                nextPlayers[interceptorIndex] = {
                    ...nextPlayers[interceptorIndex],
                    hasBall: true
                };
            } else {
                // No mid-path interception, check target reception
                // (Blocker logic covers target reception too if target is occupied! 
                //  But let's be explicit if path logic missed it?)
                // Actually, Bresenham INCLUDES end point. So loop `i < path.length` covers the target tile too.
                // So if there's a player at target, they are found by loop above as a "blocker" (receiver).
                // So we don't need separate receiver logic!
                // Wait, is "Receiver" different from "Blocker"? 
                // Mechanically, same: ball stops, they get it.
            }
        }
    });

    return {
        ...initialState,
        players: nextPlayers,
        ballPosition: nextBallPos,
        plannedCommands: [], // Clear queue
        phase: 'PLANNING'
    };
};
