import type { MatchState, Command, Vector2, MatchPlayer } from './types';
import { getBresenhamLine, arePositionsEqual, isAdjacent, isGoalSpace } from './grid';

type MoveMap = { [playerId: string]: { to: { x: number, y: number }, command: Command } };

// --- Simulation Helpers ---

export interface TackleContext {
    isSameTile: boolean;
}

export const resolveTackle = (carrier: MatchPlayer, tackler: MatchPlayer, context: TackleContext): { winnerId: string } => {
    console.log('resolveTackle', carrier, tackler, context);
    // Stat Influence:
    // Tackling Skill -> strength
    // Dribbling Skill -> technique

    // Base win chance (0.5 if stats are equal)
    // Every 10 points difference changes the balance by 10%
    const baseWinChance = 0.5 + (tackler.attributes.strength - carrier.attributes.technique) / 100;

    // Situational context bonus/penalty
    // Same tile -> Defender (tackler) advantage
    // Adjacent zone -> Attacker (carrier) advantage
    const situationalBonus = context.isSameTile ? 0.2 : -0.2;

    // Clamp to [0.1, 0.9] to maintain some randomness
    const finalDefenderWinChance = Math.min(Math.max(baseWinChance + situationalBonus, 0.1), 0.9);

    return Math.random() < finalDefenderWinChance ? { winnerId: tackler.id } : { winnerId: carrier.id };
};

const getPosAtTick = (path: Vector2[], t: number): Vector2 => path[t] || path[path.length - 1];

const getPushBackPosition = (
    loser: MatchPlayer,
    players: MatchPlayer[],
    gridSize: { width: number; height: number }
): Vector2 => {
    // Push back direction: towards own goal
    const pushDir = loser.teamId === 'HOME' ? -1 : 1;
    const candidates = [
        { x: loser.position.x + pushDir, y: loser.position.y },          // Straight back
        { x: loser.position.x + pushDir, y: loser.position.y + 1 },      // Diagonal back-up
        { x: loser.position.x + pushDir, y: loser.position.y - 1 }       // Diagonal back-down
    ];

    for (const cand of candidates) {
        // Bounds check
        if (cand.x < 0 || cand.x >= gridSize.width || cand.y < 0 || cand.y >= gridSize.height) continue;

        // Occupancy check
        const isOccupied = players.some(p => p.id !== loser.id && arePositionsEqual(p.position, cand));
        if (!isOccupied) return cand;
    }

    return loser.position; // Stumble - no room to push back
};

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

    let score = { ...initialState.score };

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

        // Apply movement for this tick
        players.forEach(p => { if (!isStopped[p.id]) p.position = proposed[p.id]; });
        if (!isBallStopped) ballPos = proposedBallPos;

        // GOAL DETECTION
        if (!isBallStopped) {
            if (isGoalSpace(ballPos, 'HOME')) {
                score.HOME++;
                isBallStopped = true;
                break;
            } else if (isGoalSpace(ballPos, 'AWAY')) {
                score.AWAY++;
                isBallStopped = true;
                break;
            }
        }

        // INTERCEPTIONS & TACKLES
        if (!isBallStopped) {
            const carrier = ballCarrierId ? players.find(c => c.id === ballCarrierId) : null;
            // For loose balls, we consider the team who was active during planning as the "owner" 
            // to determine who is an "opponent" for zone interceptions.
            const ownerTeam = carrier ? carrier.teamId : initialState.activeTeam;

            for (const p of players) {
                if (p.id === ballCarrierId) continue;

                const isSameTile = arePositionsEqual(p.position, ballPos);
                const isZoneTackle = isAdjacent(p.position, ballPos);

                // TRIGGER RULES:
                // 1. Same Tile: Transitions possession (Tackle or Catch). 
                //    Teammates only trigger on same tile if the ball is LOOSE (catching a pass).
                // 2. Zone (Adjacent): Only triggers for OPPONENTS (Tackling or Intercepting).
                const isOpponent = p.teamId !== ownerTeam;
                const isTriggered = isOpponent
                    ? (isSameTile || isZoneTackle)
                    : (isSameTile && !carrier);

                if (isTriggered) {
                    const interceptTile = ballPos;
                    let ballWinnerId = p.id;

                    if (carrier) {
                        const result = resolveTackle(carrier, p, { isSameTile });
                        ballWinnerId = result.winnerId;
                        carrier.hasBall = false;
                        carrier.currentHP = Math.max(0, carrier.currentHP - 1);
                        isStopped[carrier.id] = true;
                    }

                    isStopped[p.id] = true;
                    const winner = players.find(w => w.id === ballWinnerId)!;

                    // TACKLE PUSH-BACK: 
                    // Only push back the BALL CARRIER if they lose the tackle.
                    // This creates space for the winner and acts as a penalty for losing possession.
                    if (carrier && ballWinnerId !== carrier.id) {
                        carrier.position = getPushBackPosition(carrier, players, initialState.gridSize);
                    }

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
    }

    return finalizeState(initialState, players, ballPos, score);
};

// --- State Finalization ---

const finalizeState = (initial: MatchState, players: MatchPlayer[], ballPos: Vector2, score: { HOME: number; AWAY: number }): MatchState => {
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
        score: score,
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
