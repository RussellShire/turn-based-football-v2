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
~~- Score Tracking: Updating the game state when the ball enters the Goal Space.~~


### Phase 3: The Match UI (The "Shell")

- Scoreboard: Connecting the React UI to the Score state.
- Player Cards & Stamina Bars: Mapping the MatchPlayer stats to visual components.
- More advanced AI for CPU player

### Phase 4: Upgrade UI Visuals

- Improve the look of players to include visible team colours, hair colour. Top down view for on pitch.
- Add lines to the pitch
- Add visual illustrations when ball is kicked
- Add visual illustrations when player tackles
- Add visual illustrations when player is tackled
- Add visual illustrations when player scores, confetti at the goal

### Phase 5: The Meta-Game (Persistence)

- Stat Leveling (Logic): Detecting a "Success" and incrementing a number in the player's data. Scoring goals, successful tackles, successful tackle evasion, etc all should increment the relevant experience against the relevant stat. When the experience against a stat reaches a certain threshold, the stat should increase by 1.
- Persistent Teams: Moving player data from a local match to a "Club" database.
- Trading & Injuries: Logic for modifying the PersistentPlayer interface.

### Phase 6: Stretch Goals / Ideas (optional)
- Power Ups/Special Moves: Visual triggers for the logic built in Phase 2.


