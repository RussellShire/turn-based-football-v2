import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { clsx } from 'clsx';
import type { Vector2 } from '../engine/types';

interface DroppableTileProps {
    pos: Vector2;
    children?: React.ReactNode;
}

export const DroppableTile: React.FC<DroppableTileProps> = ({ pos, children }) => {
    const id = `tile-${pos.x}-${pos.y}`;
    const { isOver, setNodeRef } = useDroppable({
        id: id,
        data: { pos }
    });

    return (
        <div
            ref={setNodeRef}
            className={clsx(
                "w-10 h-10 border border-green-700/50 relative transition-colors duration-200",
                isOver ? "bg-green-400/50 scale-105 z-10" : "bg-green-600"
            )}
        >
            {children}
            {/* Coordinate debug */}
            <span className="text-[8px] text-green-900 absolute bottom-0 right-0 opacity-40 pointer-events-none select-none">
                {pos.x},{pos.y}
            </span>
        </div>
    );
};
