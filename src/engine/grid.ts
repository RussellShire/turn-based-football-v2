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
