# Dark House Survival

## Current State
A 2-player top-down survival horror game on a Canvas. Players move around a tile-based dark house map, avoid a roaming monster, hide in spots, and must both survive 5 hours. The view is top-down with flashlight cone overlays.

## Requested Changes (Diff)

### Add
- First-person raycasting perspective (split-screen: P1 on left half, P2 on right half)
- Jumpscare effect when the monster catches a player: full-screen red flash, distorted monster face overlay, screen shake, scary text
- Revive mechanic: when a player is downed (caught), they become incapacitated on the ground instead of instantly dead. The other player can press E (P1) or K (P2) when near the downed player to revive them over ~3 seconds. Show a revive progress bar. Only trigger game over if both are down simultaneously.

### Modify
- Rendering: replace top-down canvas draw with raycasting first-person renderer split into two half-screen viewports
- Player state: add `downed` state distinct from `alive: false`. Downed players stay at their position, can be seen as a body on the floor in first-person view. Monster can re-catch a downed player (instant game over for that player).
- Controls HUD: update to show revive key hints (E / K) when near a downed teammate
- Game over: only when all players are dead (not just downed). A downed player who is not revived in time (30 seconds) also dies.
- Victory: requires at least one alive (not just downed) player surviving 5 hours

### Remove
- Top-down map draw function
- Per-player flashlight cone in 2D

## Implementation Plan
1. Implement raycasting engine for first-person rendering (wall detection from MAP, floor/ceiling gradient, sprite rendering for monster and downed players)
2. Split canvas into two equal viewports (left = P1 POV, right = P2 POV)
3. Render each viewport using raycasting from that player's position/angle
4. Add jumpscare system: state flag `jumpscareActive`, `jumpscareTimer`, triggered on monster catch; renders fullscreen horror overlay with flash and monster face using canvas
5. Change player death flow: caught → downed (timer starts), near teammate + hold revive key → revive progress bar, timer expires → truly dead
6. Update HUD for split-screen (each side shows its own player status, revive hint)
7. Update controls documentation
