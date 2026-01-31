import React, { useEffect } from 'react';
import { Pitch } from './components/Pitch';
import { useGameStore } from './store';
import type { MatchPlayer } from './engine/types';

function App() {
  const initializeMatch = useGameStore(state => state.initializeMatch);

  useEffect(() => {
    // Initialize with dummy data
    const home: MatchPlayer[] = [
      { id: 'h1', sourcePlayerId: 'p1', position: { x: 5, y: 8 }, facingDirection: 'E', teamId: 'HOME', currentHP: 100, modifiers: [], hasBall: false, hasMovedThisTurn: false, hasActedThisTurn: false },
      { id: 'h2', sourcePlayerId: 'p2', position: { x: 8, y: 5 }, facingDirection: 'E', teamId: 'HOME', currentHP: 100, modifiers: [], hasBall: false, hasMovedThisTurn: false, hasActedThisTurn: false },
    ];
    const away: MatchPlayer[] = [
      { id: 'a1', sourcePlayerId: 'p3', position: { x: 18, y: 8 }, facingDirection: 'W', teamId: 'AWAY', currentHP: 100, modifiers: [], hasBall: true, hasMovedThisTurn: false, hasActedThisTurn: false },
    ];

    initializeMatch(home, away);
  }, [initializeMatch]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">Turn-Based Football v2</h1>
      <Pitch />
      <div className="mt-4 text-gray-400 text-sm">
        <p>Pitch Grid: 24x16</p>
      </div>
    </div>
  );
}

export default App;
