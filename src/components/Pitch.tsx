import React from 'react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { useGameStore } from '../store';
import { GRID_WIDTH } from '../engine/grid';
import { DraggablePlayer } from './DraggablePlayer';
import { DraggableBall } from './DraggableBall';
import { DroppableTile } from './DroppableTile';
import { GhostPlayer } from './GhostPlayer';
import { MoveCommand } from '../engine/commands/move';
import type { Vector2 } from '../engine/types';

export const Pitch: React.FC = () => {
    const { players, ballPosition, gridSize, dispatch, plannedCommands, activeTeam } = useGameStore();

    // Extract planned moves
    const plannedMoves = React.useMemo(() => {
        return (plannedCommands || [])
            .filter(c => c.type === 'MOVE')
            .map(c => ({
                playerId: c.payload.playerId,
                to: c.payload.to as Vector2
            }));
    }, [plannedCommands]);

    const plannedKicks = React.useMemo(() => {
        return (plannedCommands || [])
            .filter(c => c.type === 'KICK')
            .map(c => ({
                playerId: c.payload.playerId,
                to: c.payload.to as Vector2
            }));
    }, [plannedCommands]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active) {
            // Extract Tile Coordinates from ID "tile-x-y"
            const overId = over.id as string;
            if (!overId.startsWith('tile-')) return;

            const [, xStr, yStr] = overId.split('-');
            const targetPos: Vector2 = { x: parseInt(xStr), y: parseInt(yStr) };

            // Check if it's the BALL being dragged
            if (active.id === 'ball') {
                // Who has the ball?
                const carrier = players.find(p => p.hasBall);
                if (carrier && carrier.teamId === activeTeam) {
                    // Dispatch KICK Command
                    dispatch({
                        type: 'KICK',
                        payload: { playerId: carrier.id, to: targetPos }, // Kick from carrier to target
                        execute: () => ({ success: true }) // dummy
                    });
                }
                return;
            }

            // Otherwise, Player Drag
            const playerId = active.id as string;

            // Dispatch Move Command
            const command = new MoveCommand({ playerId, to: targetPos });
            const result = dispatch(command);

            if (!result.success) {
                console.warn("Move failed:", result.error);
            }
        }
    };

    // Helper to get player at specific coordinate for rendering
    const getPlayerAt = (x: number, y: number) => {
        return players.find(p => p.position.x === x && p.position.y === y);
    };

    // Create grid cells
    const cells = [];
    for (let y = 0; y < gridSize.height; y++) {
        for (let x = 0; x < gridSize.width; x++) {
            cells.push({ x, y });
        }
    }

    // Find ball carrier to determine if draggable
    const ballCarrier = players.find(p => p.hasBall);
    const isBallHeldByActive = ballCarrier?.teamId === activeTeam;

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <div className="relative p-4 bg-green-800 rounded-lg shadow-xl overflow-hidden select-none">

                {/* HUD Overlay */}
                <div className="absolute top-2 left-2 z-50 bg-black/60 text-white p-2 rounded backdrop-blur-sm text-xs border border-white/10 flex gap-4 items-center">
                    <div>
                        <span className="font-bold block text-gray-400">TURN {useGameStore(s => s.turn)}</span>
                        <span className={useGameStore(s => s.activeTeam === 'HOME' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold')}>
                            {useGameStore(s => s.activeTeam)} TEAM
                        </span>
                        <span className="ml-2 text-gray-500 text-[10px] uppercase tracking-wider">{useGameStore(s => s.phase)}</span>
                    </div>
                    <button
                        onClick={() => useGameStore.getState().nextPhase()}
                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-bold transition-colors"
                    >
                        {useGameStore(s => s.phase === 'PLANNING' ? 'END PLANNING' : 'CONTINUE')}
                    </button>
                </div>

                {/* Grid Container for Layout */}
                <div className="relative">
                    {/* Arrows Overlay (Absolute over grid) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
                        <defs>
                            <marker id="arrowhead-home" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                <polygon points="0 0, 6 2, 0 4" fill="#fca5a5" />
                            </marker>
                            <marker id="arrowhead-away" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                <polygon points="0 0, 6 2, 0 4" fill="#93c5fd" />
                            </marker>
                            <marker id="arrowhead-ball" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                <polygon points="0 0, 6 2, 0 4" fill="#fbbf24" />
                            </marker>
                        </defs>
                        {plannedMoves.map((move, i) => {
                            const player = players.find(p => p.id === move.playerId);
                            if (!player) return null;

                            // Calculate pixel centroids based on 40px cell + 1px gap
                            const CELL = 40;
                            const GAP = 1;
                            const TOTAL = CELL + GAP;
                            const OFFSET = CELL / 2;

                            const startX = player.position.x * TOTAL + OFFSET;
                            const startY = player.position.y * TOTAL + OFFSET;
                            const endX = move.to.x * TOTAL + OFFSET;
                            const endY = move.to.y * TOTAL + OFFSET;

                            const color = player.teamId === 'HOME' ? '#fca5a5' : '#93c5fd';
                            const marker = player.teamId === 'HOME' ? 'url(#arrowhead-home)' : 'url(#arrowhead-away)';

                            return (
                                <line
                                    key={`arrow-${i}`}
                                    x1={startX} y1={startY}
                                    x2={endX} y2={endY}
                                    stroke={color}
                                    strokeWidth="2"
                                    strokeDasharray="4 2"
                                    markerEnd={marker}
                                    opacity="0.7"
                                />
                            );
                        })}

                        {/* Kicks */}
                        {plannedKicks.map((kick, i) => {
                            const player = players.find(p => p.id === kick.playerId);
                            if (!player) return null;

                            let startPos = player.position;
                            const plannedMove = plannedMoves.find(m => m.playerId === kick.playerId);
                            if (plannedMove) startPos = plannedMove.to;

                            const CELL = 40; const GAP = 1; const TOTAL = CELL + GAP; const OFFSET = CELL / 2;
                            const startX = startPos.x * TOTAL + OFFSET;
                            const startY = startPos.y * TOTAL + OFFSET;
                            const endX = kick.to.x * TOTAL + OFFSET;
                            const endY = kick.to.y * TOTAL + OFFSET;

                            return <line key={`kick-${i}`} x1={startX} y1={startY} x2={endX} y2={endY} stroke="#fbbf24" strokeWidth="2" markerEnd="url(#arrowhead-ball)" opacity="1" />;
                        })}
                    </svg>

                    {/* The Grid Itself */}
                    <div
                        className="grid gap-px bg-green-900/30"
                        style={{
                            gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(0, 1fr))`,
                            width: 'fit-content',
                            height: 'fit-content'
                        }}
                    >
                        {cells.map((cell) => {
                            const playerHere = getPlayerAt(cell.x, cell.y);

                            // Check for Ghost
                            const movesHere = plannedMoves.filter(m => m.to.x === cell.x && m.to.y === cell.y);

                            return (
                                <DroppableTile key={`${cell.x}-${cell.y}`} pos={cell}>
                                    {/* Render Ghosts */}
                                    {movesHere.map(m => {
                                        const p = players.find(pl => pl.id === m.playerId);
                                        return p ? <div key={`ghost-${m.playerId}`} className="absolute inset-0 z-10 pointer-events-none"><GhostPlayer player={p} /></div> : null;
                                    })}

                                    {playerHere && (
                                        <div className="absolute inset-0 z-20">
                                            <DraggablePlayer player={playerHere} />
                                        </div>
                                    )}

                                    {/* Ball Rendering - Using DraggableBall */}
                                    {ballPosition.x === cell.x && ballPosition.y === cell.y && (
                                        <DraggableBall isHeld={isBallHeldByActive && !!playerHere} />
                                    )}
                                </DroppableTile>
                            );
                        })}
                    </div>
                </div>

            </div>
        </DndContext>
    );
};
