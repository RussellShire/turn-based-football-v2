import { describe, test, expect } from 'vitest';
import { isGoalSpace, isInsideGoal } from './grid';

describe('Grid Logic', () => {
    test('isGoalSpace -> HOME team scoring goal', () => {
        // HOME scores in column 23, rows 6-9
        expect(isGoalSpace({ x: 23, y: 5 }, 'HOME')).toBe(false);
        expect(isGoalSpace({ x: 23, y: 6 }, 'HOME')).toBe(true);
        expect(isGoalSpace({ x: 23, y: 9 }, 'HOME')).toBe(true);
        expect(isGoalSpace({ x: 23, y: 10 }, 'HOME')).toBe(false);
        expect(isGoalSpace({ x: 0, y: 7 }, 'HOME')).toBe(false); // Wrong side
    });

    test('isGoalSpace -> AWAY team scoring goal', () => {
        // AWAY scores in column 0, rows 6-9
        expect(isGoalSpace({ x: 0, y: 5 }, 'AWAY')).toBe(false);
        expect(isGoalSpace({ x: 0, y: 6 }, 'AWAY')).toBe(true);
        expect(isGoalSpace({ x: 0, y: 9 }, 'AWAY')).toBe(true);
        expect(isGoalSpace({ x: 0, y: 10 }, 'AWAY')).toBe(false);
        expect(isGoalSpace({ x: 23, y: 7 }, 'AWAY')).toBe(false); // Wrong side
    });

    test('isInsideGoal -> General check', () => {
        expect(isInsideGoal({ x: 0, y: 7 })).toBe(true);
        expect(isInsideGoal({ x: 23, y: 7 })).toBe(true);
        expect(isInsideGoal({ x: 12, y: 7 })).toBe(false);
        expect(isInsideGoal({ x: 0, y: 0 })).toBe(false);
    });
});
