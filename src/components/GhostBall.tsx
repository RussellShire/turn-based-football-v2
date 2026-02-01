import React from 'react';

export const GhostBall: React.FC = () => {
    return (
        <div
            className="absolute w-4 h-4 bg-white/40 rounded-full shadow-sm border border-gray-300/30 z-30 top-1 left-1 pointer-events-none grayscale"
        />
    );
};
