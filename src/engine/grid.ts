import type { Vector2 } from './types';

export const GRID_WIDTH = 24;
export const GRID_HEIGHT = 16;

export const GOAL_WIDTH_SIZE = 1; // 1 tile wide for the line
export const GOAL_HEIGHT_SIZE = 4; // 4 tiles high
export const GOAL_Y_START = Math.floor((GRID_HEIGHT - GOAL_HEIGHT_SIZE) / 2); // 6
export const GOAL_Y_END = GOAL_Y_START + GOAL_HEIGHT_SIZE - 1; // 9

export type TeamId = 'HOME' | 'AWAY';

export const isGoalSpace = (pos: Vector2, scoringTeam: TeamId): boolean => {
    // HOME scores in AWAY goal (x = 23)
    // AWAY scores in HOME goal (x = 0)
    const targetX = scoringTeam === 'HOME' ? GRID_WIDTH - 1 : 0;
    return (
        pos.x === targetX &&
        pos.y >= GOAL_Y_START &&
        pos.y <= GOAL_Y_END
    );
};

export const isInsideGoal = (pos: Vector2): boolean => {
    return (pos.x === 0 || pos.x === GRID_WIDTH - 1) &&
        (pos.y >= GOAL_Y_START && pos.y <= GOAL_Y_END);
};

export const isValidTile = (pos: Vector2): boolean => {
    return (
        Number.isInteger(pos.x) &&
        Number.isInteger(pos.y) &&
        pos.x >= 0 &&
        pos.x < GRID_WIDTH &&
        pos.y >= 0 &&
        pos.y < GRID_HEIGHT
    );
};

export const arePositionsEqual = (a: Vector2, b: Vector2): boolean => {
    return a.x === b.x && a.y === b.y;
};

export const isAdjacent = (a: Vector2, b: Vector2): boolean => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    // Chebyshev distance of 1 means they are adjacent or diagonal
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1) || (dx === 1 && dy === 1);
};

export const getManhattanDistance = (a: Vector2, b: Vector2): number => {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

export const getBresenhamLine = (start: Vector2, end: Vector2): Vector2[] => {
    const points: Vector2[] = [];
    let x0 = start.x;
    let y0 = start.y;
    const x1 = end.x;
    const y1 = end.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
        points.push({ x: x0, y: y0 });

        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
    return points;
};
