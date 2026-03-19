# Dark House Survival

## Current State
New project with no existing application files.

## Requested Changes (Diff)

### Add
- Full 2-player top-down survival horror game running in the browser
- Large multi-room dark house map (living room, hallways, bedrooms, kitchen, bathroom, basement)
- Limited visibility via flashlight cone / dim ambient lighting per player
- Player 1: WASD to move, F to hide/unhide
- Player 2: Arrow keys to move, L to hide/unhide
- Monster AI that patrols rooms, hunts players by proximity detection radius, becomes more aggressive each hour
- Multiple hiding spots (closets, under beds, behind furniture) — entering one reduces monster detection radius
- In-game clock: Hours 1-5, each hour = 15 real minutes (75 min total), countdown timer displayed
- Win condition: both players survive until Hour 5 ends
- Lose condition: monster catches both players (single player caught = eliminated but game continues)
- Victory screen and game-over screen
- Atmospheric dark visual style — deep blues, blacks, dim flashlight cones
- Sound descriptions shown in UI ("Floor creaks...", "You hear footsteps...")
- Canvas-based game loop using requestAnimationFrame
- Collision detection for walls, doors, hiding spots

### Modify
N/A

### Remove
N/A

## Implementation Plan
1. Build canvas-based game engine with game loop, input handling, collision system
2. Design house map as a tile/room grid with walls, doors, furniture, hiding spots
3. Implement player entities with movement, flashlight cone rendering, hide state
4. Implement monster entity with patrol AI, line-of-sight detection, aggression scaling by hour
5. Implement hiding spot logic — reduces monster detection radius when occupied
6. Implement game clock: 15-min hour cycles, hour counter 1-5
7. Render dark scene with dim lighting and flashlight cone overlay using canvas compositing
8. HUD: hour display, countdown timer, player status indicators
9. Win/lose/game-over screens
10. Atmospheric text notifications (sound descriptions)
11. Minimal Motoko backend (stub actor)
