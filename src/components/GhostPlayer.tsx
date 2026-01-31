import React from 'react';
import type { MatchPlayer } from '../engine/types';
import { PlayerToken } from './PlayerToken';

interface GhostPlayerProps {
    player: MatchPlayer;
}

export const GhostPlayer: React.FC<GhostPlayerProps> = ({ player }) => {
    return (
        <div className="w-full h-full opacity-50 grayscale scale-95 transition-all">
            <PlayerToken player={player} />
        </div>
    );
};
