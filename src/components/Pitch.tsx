import React from 'react';
import { useGameStore } from '../store';
import { GRID_WIDTH, GRID_HEIGHT } from '../engine/grid';
import { PlayerToken } from './PlayerToken';

export const Pitch: React.FC = () => {
    const { players, ballPosition, gridSize } = useGameStore();

    // Create grid cells
    const cells = [];
    for (let y = 0; y < gridSize.height; y++) {
        for (let x = 0; x < gridSize.width; x++) {
            cells.push({ x, y });
        }
    }

    return (
        <div className="relative p-4 bg-green-800 rounded-lg shadow-xl overflow-hidden select-none">
            {/* Grid Layer */}
            <div
                className="grid gap-px bg-green-900/30"
                style={{
                    gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(0, 1fr))`,
                    width: 'fit-content',
                }}
            >
                {cells.map((cell) => (
                    <div
                        key={`${cell.x}-${cell.y}`}
                        className="w-10 h-10 bg-green-600 border-green-700/50 border relative"
                    >
                        {/* Coordinate debug (optional, can be toggleable) */}
                        <span className="text-[8px] text-green-900 absolute bottom-0 right-0 opacity-40">{cell.x},{cell.y}</span>
                    </div>
                ))}
            </div>

            {/* Entity Layer (Absolute Overlay) */}
            <div className="absolute top-4 left-4 pointer-events-none" style={{ width: GRID_WIDTH * 40 + (GRID_WIDTH - 1), height: GRID_HEIGHT * 40 + (GRID_HEIGHT - 1) }}>
                {players.map(p => (
                    <div
                        key={p.id}
                        className="absolute w-10 h-10 transition-all duration-300"
                        style={{
                            left: `${p.position.x * 40 + p.position.x}px`, // 40px width + 1px gap estimate
                            top: `${p.position.y * 40 + p.position.y}px`
                        }}
                    >
                        <PlayerToken player={p} />
                    </div>
                ))}

                {/* Ball */}
                <div
                    className="absolute w-4 h-4 bg-white rounded-full shadow-md border border-gray-400 z-20 transition-all duration-300"
                    style={{
                        left: `${ballPosition.x * 41 + 13}px`, // Centered in 40px cell (13 = (40-14)/2 + offset)
                        top: `${ballPosition.y * 41 + 13}px`
                    }}
                />
            </div>
        </div>
    );
};
