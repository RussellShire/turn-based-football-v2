import React from 'react';
import { useDraggable } from '@dnd-kit/core';

interface DraggableBallProps {
    isHeld: boolean; // Only draggable if held by a player (active team?)
}

export const DraggableBall: React.FC<DraggableBallProps> = ({ isHeld }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: 'ball',
        data: { type: 'ball' },
        disabled: !isHeld // Only draggable if held? 
    });

    const style: React.CSSProperties = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
        opacity: isDragging ? 0.8 : 1,
    } : {};

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`
                absolute w-4 h-4 bg-white rounded-full shadow-md border border-gray-400 z-50 
                top-1 left-1 pointer-events-auto
                ${isHeld ? 'cursor-grab hover:scale-110 transition-transform' : 'cursor-default'}
            `}
        />
    );
};
