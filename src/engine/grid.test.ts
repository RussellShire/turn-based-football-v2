import { expect, test } from 'vitest';
import { isValidTile, getManhattanDistance, GRID_WIDTH, GRID_HEIGHT } from './grid';

test('isValidTile returns true for valid coordinates', () => {
    expect(isValidTile({ x: 0, y: 0 })).toBe(true);
    expect(isValidTile({ x: GRID_WIDTH - 1, y: GRID_HEIGHT - 1 })).toBe(true);
});

test('isValidTile returns false for out of bounds', () => {
    expect(isValidTile({ x: -1, y: 0 })).toBe(false);
    expect(isValidTile({ x: GRID_WIDTH, y: 0 })).toBe(false);
    expect(isValidTile({ x: 0, y: GRID_HEIGHT })).toBe(false);
});

test('getManhattanDistance calculates correctly', () => {
    expect(getManhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
});
