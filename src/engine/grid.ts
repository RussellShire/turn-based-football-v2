import type { Vector2 } from './types';

export const GRID_WIDTH = 24;
export const GRID_HEIGHT = 16;

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
