import React from 'react';
import type { MatchPlayer } from '../engine/types';
import { PlayerToken } from './PlayerToken';

interface GhostPlayerProps {
    player: MatchPlayer;
    isKicking?: boolean;
}

export const GhostPlayer: React.FC<GhostPlayerProps> = ({ player, isKicking }) => {
    // Should be grayscale if they DON'T have the ball, OR if they are kicking it away
    const shouldBeGrayscale = !player.hasBall || isKicking;

    return (
        <div className={`w-full h-full opacity-50 scale-95 transition-all ${shouldBeGrayscale ? 'grayscale' : ''}`}>
            <PlayerToken player={player} />
        </div>
    );
};
