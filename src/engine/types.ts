export interface Vector2 {
    x: number;
    y: number;
}

export type Direction = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export type TeamId = 'HOME' | 'AWAY';

export interface StatModifier {
    name: string;
    effect: string;
    duration: number; // in turns
}

// RPG Layer
export interface PersistentPlayer {
    id: string;
    name: string;
    attributes: {
        speed: number;
        technique: number;
        strength: number;
        intelligence: number;
    };
    xp: number;
    level: number;
    // traits: Trait[]; // To be implemented
}

// Game Layer
export interface MatchPlayer {
    id: string;
    sourcePlayerId: string;
    position: Vector2;
    facingDirection: Direction;

    currentHP: number; // Stamina
    modifiers: StatModifier[];

    teamId: TeamId;

    hasBall: boolean;
    hasMovedThisTurn: boolean;
    hasActedThisTurn: boolean;
}

export interface CommandResult {
    success: boolean;
    newState?: MatchState;
    error?: string;
}

export interface Command {
    type: string;
    payload: any;
    execute(state: MatchState): CommandResult;
}

export interface MatchState {
    turn: number;
    phase: 'PLANNING' | 'EXECUTION' | 'RESOLUTION';
    activeTeam: TeamId;

    players: MatchPlayer[];
    ballPosition: Vector2;

    plannedCommands: Command[];

    gridSize: { width: number; height: number };
}
