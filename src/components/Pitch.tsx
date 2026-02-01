import React from 'react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { useGameStore } from '../store';
import { DraggablePlayer } from './DraggablePlayer';
import { DraggableBall } from './DraggableBall';
import { DroppableTile } from './DroppableTile';
import { GhostPlayer } from './GhostPlayer';
import { MoveCommand } from '../engine/commands/move';
import { KickCommand } from '../engine/commands/kick';
import type { Vector2 } from '../engine/types';

const CELL_SIZE = 40;
const GAP_SIZE = 1;
const TOTAL_CELL = CELL_SIZE + GAP_SIZE;

export const Pitch: React.FC = () => {
    const { players, ballPosition, gridSize, dispatch, plannedCommands, activeTeam, phase } = useGameStore();

    const plannedMoves = React.useMemo(() => {
        return (plannedCommands || [])
            .filter(c => c.type === 'MOVE')
            .map(c => {
                const payload = c.payload as { playerId: string, to: Vector2 };
                return {
                    playerId: payload.playerId,
                    to: payload.to
                };
            });
    }, [plannedCommands]);

    const plannedKicks = React.useMemo(() => {
        return (plannedCommands || [])
            .filter(c => c.type === 'KICK')
            .map(c => {
                const payload = c.payload as { playerId: string, to: Vector2 };
                return {
                    playerId: payload.playerId,
                    to: payload.to
                };
            });
    }, [plannedCommands]);

    const handleDragEnd = (event: DragEndEvent) => {
        if (phase !== 'PLANNING') return;

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
                    // Dispatch KICK Command using our new class
                    const command = new KickCommand({ playerId: carrier.id, to: targetPos });
                    dispatch(command);
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
                        <span className="ml-2 text-gray-500 text-[10px] uppercase tracking-wider">{phase}</span>
                    </div>
                    <button
                        onClick={() => useGameStore.getState().nextPhase()}
                        disabled={phase !== 'PLANNING'}
                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white rounded font-bold transition-colors"
                    >
                        {phase === 'PLANNING' ? 'END PLANNING' : 'RESOLVING...'}
                    </button>
                </div>

                {/* Grid Container for Layout */}
                <div
                    className="relative"
                    style={{
                        width: gridSize.width * TOTAL_CELL,
                        height: gridSize.height * TOTAL_CELL
                    }}
                >
                    {/* The Grid Background */}
                    <div
                        className="grid gap-px bg-green-900/30 absolute inset-0"
                        style={{
                            gridTemplateColumns: `repeat(${gridSize.width}, ${CELL_SIZE}px)`,
                            gridTemplateRows: `repeat(${gridSize.height}, ${CELL_SIZE}px)`,
                        }}
                    >
                        {cells.map((cell) => (
                            <DroppableTile key={`${cell.x}-${cell.y}`} pos={cell}>
                                {/* Render Ghosts in the tile */}
                                {plannedMoves.filter(m => m.to.x === cell.x && m.to.y === cell.y).map(m => {
                                    const p = players.find(pl => pl.id === m.playerId);
                                    return p ? <div key={`ghost-${m.playerId}`} className="absolute inset-0 z-10 pointer-events-none"><GhostPlayer player={p} /></div> : null;
                                })}
                            </DroppableTile>
                        ))}
                    </div>

                    {/* Arrows Overlay */}
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

                            const startX = player.position.x * TOTAL_CELL + CELL_SIZE / 2;
                            const startY = player.position.y * TOTAL_CELL + CELL_SIZE / 2;
                            const endX = move.to.x * TOTAL_CELL + CELL_SIZE / 2;
                            const endY = move.to.y * TOTAL_CELL + CELL_SIZE / 2;

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

                        {plannedKicks.map((kick, i) => {
                            const player = players.find(p => p.id === kick.playerId);
                            if (!player) return null;

                            const startPos = player.position;

                            const startX = startPos.x * TOTAL_CELL + CELL_SIZE / 2;
                            const startY = startPos.y * TOTAL_CELL + CELL_SIZE / 2;
                            const endX = kick.to.x * TOTAL_CELL + CELL_SIZE / 2;
                            const endY = kick.to.y * TOTAL_CELL + CELL_SIZE / 2;

                            return <line key={`kick-${i}`} x1={startX} y1={startY} x2={endX} y2={endY} stroke="#fbbf24" strokeWidth="2" markerEnd="url(#arrowhead-ball)" opacity="1" />;
                        })}
                    </svg>

                    {/* Actors Overlay (Absolute Positioned for Animation) */}
                    <div className="absolute inset-0 pointer-events-none z-20">
                        {players.map(player => (
                            <div
                                key={player.id}
                                className="absolute pointer-events-auto transition-all duration-1000 ease-in-out"
                                style={{
                                    width: CELL_SIZE,
                                    height: CELL_SIZE,
                                    left: player.position.x * TOTAL_CELL,
                                    top: player.position.y * TOTAL_CELL,
                                }}
                            >
                                <DraggablePlayer player={player} />
                            </div>
                        ))}

                        {/* Ball - Container is pass-through, Ball itself is interactive */}
                        <div
                            className="absolute pointer-events-none transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1)"
                            style={{
                                width: CELL_SIZE,
                                height: CELL_SIZE,
                                left: ballPosition.x * TOTAL_CELL,
                                top: ballPosition.y * TOTAL_CELL,
                            }}
                        >
                            <DraggableBall isHeld={isBallHeldByActive} />
                        </div>
                    </div>
                </div>
            </div>
        </DndContext>
    );
};
