import type { MatchState, Command } from './types';


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

    // 4. Apply Final State
    nextPlayers = nextPlayers.map(p => {
        if (moves[p.id] && !bouncedPlayerIds.has(p.id)) {
            // Successful move
            const target = moves[p.id].to;

            // Handle Ball
            let hasBall = p.hasBall;
            const ballWasLoose = !initialState.players.some(pl => pl.hasBall);

            // Check if picking up loose ball (intersecting ball position)
            if (ballWasLoose && target.x === initialState.ballPosition.x && target.y === initialState.ballPosition.y) {
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
            nextBallPos = target;

            // Mark as Acted
            kicker.hasActedThisTurn = true;
            nextPlayers[kickerIndex] = kicker;

            // Check interception/reception at target
            const receiverIndex = nextPlayers.findIndex(p => p.position.x === target.x && p.position.y === target.y);
            if (receiverIndex !== -1) {
                // Pass Complete!
                nextPlayers[receiverIndex] = {
                    ...nextPlayers[receiverIndex],
                    hasBall: true
                };
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
