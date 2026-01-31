import React from 'react';
import type { MatchPlayer } from '../engine/types';
import { clsx } from 'clsx';

interface PlayerTokenProps {
    player: MatchPlayer;
}

export const PlayerToken: React.FC<PlayerTokenProps> = ({ player }) => {
    const isHome = player.teamId === 'HOME';

    return (
        <div
            className={clsx(
                "absolute w-full h-full flex items-center justify-center rounded-full text-xs font-bold border-2 transition-all duration-300",
                isHome ? "bg-red-600 border-red-800 text-white" : "bg-blue-600 border-blue-800 text-white",
                player.hasBall && "ring-2 ring-yellow-400 z-10 scale-110"
            )}
            style={{
                // We will position this via parent grid cell, or absolute positioning?
                // If absolute on the pitch container:
                // left: player.position.x * CELL_SIZE
                // top: player.position.y * CELL_SIZE
                // But for better structure, we might map over the grid.
                // Let's assume Pitch renders cells, and if a player is there, renders Token.
                // OR Pitch renders a layer of players. Let's go with Pitch renders Player Layer.
            }}
        >
            {player.id.slice(0, 2)}
        </div>
    );
};
