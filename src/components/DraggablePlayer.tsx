import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities'; // Needs installation, actually. 
// Note: dnd-kit/core does not export CSS utilities for transform. 
// I need @dnd-kit/utilities or just use inline styles manually. 
// Let's create `useDraggable` logic without utilities first to be safe, 
// or install utilities. standard practice is to use utilities.
// I will install utilities in next step if needed, but let's try manual transform first to avoid extra pkg if simple.
// actually, the transform object is simple.

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
