import React from 'react';
import type { Vector2 } from '../engine/types';

interface MovementArrowProps {
    from: Vector2;
    to: Vector2;
    color?: string;
}

export const MovementArrow: React.FC<MovementArrowProps> = ({ from, to, color = 'white' }) => {
    // Basic arrow rendering logic using SVG
    // Convert grid coords to pixels (assuming 40px cell size roughly, but we used grid gap)
    // Actually, Pitch uses CSS Grid. We need absolute positioning relative to a container.
    // Let's assume this component is rendered inside the cell at 'from' or 'to'?
    // Easier to render an SVG overlay on top of the whole pitch.

    // BUT for simplicity in V1:
    // We can render a small arrow icon inside the 'to' cell pointing from 'from'.

    // Better yet: Simple 50% transparent line overlay.
    // We need pixel coordinates. 
    // Cell size is approx 40px + 1px gap.

    const CELL_SIZE = 41; // 40px + 1px gap
    const OFFSET = 20; // Center of cell

    const x1 = from.x * CELL_SIZE + OFFSET;
    const y1 = from.y * CELL_SIZE + OFFSET;
    const x2 = to.x * CELL_SIZE + OFFSET;
    const y2 = to.y * CELL_SIZE + OFFSET;

    return (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
            <line
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                stroke={color}
                strokeWidth="2"
                strokeDasharray="4"
                markerEnd="url(#arrowhead)"
            />
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={color} />
                </marker>
            </defs>
        </svg>
    );
};
