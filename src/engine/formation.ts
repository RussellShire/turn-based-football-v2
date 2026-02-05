import type { TeamId, MatchPlayer, Vector2 } from './types';

export const KICKOFF_POSITIONS = {
    possessor: [
        { x: 11, y: 8 },
        { x: 11, y: 7 }
    ],
    opponent: [
        { x: 15, y: 8 },
        { x: 15, y: 7 }
    ]
};

export const getKickOffState = (
    players: MatchPlayer[],
    possessingTeam: TeamId
): { players: MatchPlayer[]; ballPosition: Vector2 } => {
    const homePlayers = players.filter(p => p.teamId === 'HOME');
    const awayPlayers = players.filter(p => p.teamId === 'AWAY');

    // CENTER is roughly 11.5, 7.5 on a 24x16 grid.
    // Let's use 11 for HOME side of center, 12 for AWAY side of center.

    const isHomePossessing = possessingTeam === 'HOME';

    // HOME positions
    // Mirroring opponent position: if opponent is HOME, they should be at x=8.
    // If opponent is AWAY, they should be at x=15.

    const updatedPlayers = players.map(p => {
        const isHome = p.teamId === 'HOME';
        const teamPlayers = isHome ? homePlayers : awayPlayers;
        const pIndex = teamPlayers.findIndex(tp => tp.id === p.id);

        let newPos: Vector2;
        if (isHome) {
            newPos = isHomePossessing
                ? { x: 11, y: 8 - pIndex } // HOME possessing: (11,8), (11,7)
                : { x: 8, y: 8 - pIndex };  // HOME defending: (8,8), (8,7)
        } else {
            newPos = isHomePossessing
                ? { x: 15, y: 8 - pIndex } // AWAY defending: (15,8), (15,7)
                : { x: 12, y: 8 - pIndex }; // AWAY possessing: (12,8), (12,7)
        }

        return {
            ...p,
            position: newPos,
            hasBall: (isHome === isHomePossessing) && pIndex === 0, // First player of possessing team gets ball
            hasMovedThisTurn: false,
            hasActedThisTurn: false,
            facingDirection: isHome ? 'E' : 'W'
        } as MatchPlayer;
    });

    const ballPos = updatedPlayers.find(p => p.hasBall)?.position || { x: 11, y: 8 };

    return { players: updatedPlayers, ballPosition: ballPos };
};
