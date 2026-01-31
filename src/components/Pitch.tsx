import React, { useState } from 'react';
import { DndContext, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useGameStore } from '../store';
import { GRID_WIDTH, GRID_HEIGHT } from '../engine/grid';
import { DraggablePlayer } from './DraggablePlayer';
import { DroppableTile } from './DroppableTile';
import { MoveCommand } from '../engine/commands/move';
import type { Vector2 } from '../engine/types';

export const Pitch: React.FC = () => {
    const { players, ballPosition, gridSize, dispatch } = useGameStore();

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active) {
            // Extract Tile Coordinates from ID "tile-x-y"
            const overId = over.id as string;
            if (!overId.startsWith('tile-')) return;

            const [, xStr, yStr] = overId.split('-');
            const targetPos: Vector2 = { x: parseInt(xStr), y: parseInt(yStr) };
            const playerId = active.id as string;

            // Dispatch Move Command
            const command = new MoveCommand({ playerId, to: targetPos });
            const result = dispatch(command);

            if (!result.success) {
                console.warn("Move failed:", result.error);
                // Optional: Visual feedback handling
            }
        }
    };

    // Helper to get player at specific coordinate for rendering
    const getPlayerAt = (x: number, y: number) => {
        return players.find(p => p.position.x === x && p.position.y === y);
    };

    // Create grid cells
    const cells = [];
    for (let y = 0; y < gridSize.height; y++) {
        for (let x = 0; x < gridSize.width; x++) {
            cells.push({ x, y });
        }
    }

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <div className="relative p-4 bg-green-800 rounded-lg shadow-xl overflow-hidden select-none">

                {/* Grid Layer */}
                <div
                    className="grid gap-px bg-green-900/30"
                    style={{
                        gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(0, 1fr))`,
                        width: 'fit-content',
                    }}
                >
                    {cells.map((cell) => {
                        const playerHere = getPlayerAt(cell.x, cell.y);
                        return (
                            <DroppableTile key={`${cell.x}-${cell.y}`} pos={cell}>
                                {playerHere && (
                                    <div className="absolute inset-0 z-20">
                                        <DraggablePlayer player={playerHere} />
                                    </div>
                                )}
                                {/* Ball Rendering (Simple overlay if ball is here) */}
                                {ballPosition.x === cell.x && ballPosition.y === cell.y && (
                                    <div
                                        className="absolute w-4 h-4 bg-white rounded-full shadow-md border border-gray-400 z-30 top-1 left-1 pointer-events-none"
                                    />
                                )}
                            </DroppableTile>
                        );
                    })}
                </div>

            </div>
        </DndContext>
    );
};
