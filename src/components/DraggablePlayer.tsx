import React from 'react';
import { useDraggable } from '@dnd-kit/core';


import { PlayerToken } from './PlayerToken';
import type { MatchPlayer } from '../engine/types';

interface DraggablePlayerProps {
    player: MatchPlayer;
}

export const DraggablePlayer: React.FC<DraggablePlayerProps> = ({ player }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: player.id,
        data: { player }
    });

    const style: React.CSSProperties = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 50 : undefined,
        cursor: 'grab',
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="w-full h-full">
            <PlayerToken player={player} />
        </div>
    );
};
