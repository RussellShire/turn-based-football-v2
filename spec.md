# Turn-Based Football v2 - Specification

## 1. Overview
A turn-based, tactical football (soccer) game where users control a team of players on a grid-based pitch. The game emphasizes positioning, resource management (stamina), and tactical decision-making over reflex-based gameplay.

## 2. Core Engine Logic

### 2.1. Game Loop & State
The game operates on a **Turn-Based** system. 
- **State**: The `MatchState` object holds the Single Source of Truth for a match.
- **Phases**:
    1.  **Planning Phase**: User queues commands for their players.
    2.  **Execution Phase**: The engine processes the queue using the Command Pattern.
    3.  **Resolution Phase**: Ball physics, collisions, and rule checks (offside, goals) are resolved.

### 2.2. The Grid
The pitch is represented as a 2D grid (initially 24x16 tiles).
- **Coordinates**: `Vector2 { x: number, y: number }`
- **Entities**: Players, Ball, Obstacles (optional).

## 3. Architecture: Command Pattern

To ensure determinism, replayability, and "Undo" functionality, all game mutations occur via Commands.

### 3.1. Command Interface
```typescript
interface Command {
    type: CommandType; // e.g., 'MOVE', 'PASS', 'SHOOT'
    payload: any;
    execute(state: MatchState): Result<MatchState>; // Returns new state
    undo(state: MatchState): Result<MatchState>;    // Reverts state (optional during planning)
}
```

### 3.2. Command Processing
1.  **CommandQueue**: Stores the sequence of actions for a turn.
2.  **Processor**: Iterates through the queue. logic is strictly functional where possible: `(currentState, command) => newState`.

## 4. Data Models

### 4.1. PersistentPlayer (RPG Layer)
Represents the player across matches. This data is stored in the database/local storage.

```typescript
interface PersistentPlayer {
    id: string;
    name: string;
    
    // Core Attributes (0-100)
    attributes: {
        speed: number;      // Movement range
        technique: number;  // Passing/Shooting accuracy
        strength: number;   // Tackle strength / Shielding
        intelligence: number; // Vision range / Auto-positioning
    };

    // Progression
    xp: number;
    level: number;
    traits: Trait[]; // e.g., 'Playmaker', 'Speedster'
}
```

### 4.2. MatchPlayer (Game Layer)
Represents a player instance within a specific match context. Ephemeral.

```typescript
interface MatchPlayer {
    id: string; // Unique instance ID for the match
    sourcePlayerId: string; // Reference to PersistentPlayer
    
    // Positional State
    position: Vector2;
    facingDirection: Direction; // N, S, E, W, etc.
    
    // Dynamic Stats
    currentHP: number; // Stamina/Condition. Acts as Action Points.
    modifiers: StatModifier[]; // Temporary buffs/debuffs (e.g., "Winded", "In Form")
    
    // Team affiliation
    teamId: 'HOME' | 'AWAY';
    
    // State flags
    hasBall: boolean;
    hasMovedThisTurn: boolean;
    hasActedThisTurn: boolean;
}
```

## 5. Technology Stack
- **Frontend**: React 19 (React Compiler if available), TypeScript
- **State Management**: Zustand (for Game State) or XState (for Phase Management)
- **Styling**: TailwindCSS (standard utility-first CSS)
- **Testing**: Vitest (Unit Logic), Playwright (E2E)

## 6. Next Steps
1.  Initialize Repository.
2.  Implement `MatchState` and `Grid` logic.
3.  Implement `Command` processor.
4.  Build basic UI to visualize the Grid.
