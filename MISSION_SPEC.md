# Mission Specification

## Design Constraints

Project: Tactical Football (React/TS/Zustand) Core Principle: Strict separation of Game Logic (Core) and React UI (Shell).

Code style: Focus on performance, React and Typescript best practices and code readability. 

## The Strategic Roadmap

### Phase 1: The Match "World" (Foundation)

~~- Goal Space & Grid: Defining the coordinates that represent "Goal" vs. "Field."~~
~~- Turn Logic: Implementing the counter for halves and full time.~~
~~- The Tackle Zone: A logic-only function that calculates distance between players.~~
~~- Stats Influence: Creating the math formula: tackling skill vs dribbling skill with some randomness~~

### Phase 2: The Action & Resolution (The "Meat")

~~- Tackle Success: Using the stats from Phase 1 to decide who keeps the ball.~~
- Score Tracking: Updating the game state when the ball enters the Goal Space.
- Stat Leveling (Logic): Detecting a "Success" and incrementing a number in the player's data.

### Phase 3: The Match UI (The "Shell")

- Scoreboard: Connecting the React UI to the Score state.
- Player Cards & Stamina Bars: Mapping the MatchPlayer stats to visual components.
- Power Ups/Special Moves: Visual triggers for the logic built in Phase 2.

### Phase 4: Upgrade UI Visuals

- Improve the look of players to include
- Add lines to the pitch
- Add visual illustrations when ball is kicked
- Add visual illustrations when player tackles
- Add visual illustrations when player scores
- Add visual illustrations when player is tackled

### Phase 5: The Meta-Game (Persistence)

- Persistent Teams: Moving player data from a local match to a "Club" database.
- Trading & Injuries: Logic for modifying the PersistentPlayer interface.


