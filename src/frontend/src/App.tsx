import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "start" | "playing" | "gameover" | "victory";

interface Player {
  x: number;
  y: number;
  alive: boolean;
  downed: boolean;
  downedTimer: number;
  reviveProgress: number;
  hidden: boolean;
  hideSpotId: number | null;
  color: string;
  label: string;
  angle: number;
}

interface Monster {
  x: number;
  y: number;
  angle: number;
  speed: number;
  detectionRadius: number;
  state: "patrol" | "hunt";
  huntTargetIdx: number;
  waypointIdx: number;
  wanderTimer: number;
  wanderAngle: number;
}

interface HideSpot {
  id: number;
  x: number;
  y: number;
  label: string;
}

interface Notification {
  text: string;
  timer: number;
  maxTimer: number;
}

interface GameState {
  players: [Player, Player];
  monster: Monster;
  hideSpots: HideSpot[];
  elapsedSeconds: number;
  currentHour: number;
  notification: Notification | null;
  nextNotifIn: number;
  lastTimestamp: number;
  keys: Record<string, boolean>;
  prevHideKey: [boolean, boolean];
  jumpscareActive: boolean;
}

// ─── Map ──────────────────────────────────────────────────────────────────────
const TILE = 20;
const MAP_COLS = 80;
const MAP_ROWS = 60;

const RAW_MAP: number[][] = (() => {
  const M: number[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) M.push(new Array(MAP_COLS).fill(0));
  function fillRect(r1: number, c1: number, r2: number, c2: number, v: number) {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) M[r][c] = v;
  }
  fillRect(0, 0, MAP_ROWS - 1, 0, 1);
  fillRect(0, 0, 0, MAP_COLS - 1, 1);
  fillRect(MAP_ROWS - 1, 0, MAP_ROWS - 1, MAP_COLS - 1, 1);
  fillRect(0, MAP_COLS - 1, MAP_ROWS - 1, MAP_COLS - 1, 1);
  fillRect(1, 35, 8, 35, 1);
  fillRect(1, 45, 8, 45, 1);
  fillRect(1, 35, 1, 45, 1);
  fillRect(1, 1, 1, 33, 1);
  fillRect(24, 1, 24, 33, 1);
  fillRect(1, 1, 24, 1, 1);
  fillRect(1, 33, 24, 33, 1);
  M[10][33] = 0;
  M[11][33] = 0;
  M[12][33] = 0;
  M[1][18] = 0;
  M[1][19] = 0;
  M[1][20] = 0;
  fillRect(3, 3, 5, 10, 2);
  fillRect(7, 3, 8, 6, 2);
  fillRect(18, 3, 20, 8, 2);
  fillRect(18, 25, 20, 30, 2);
  M[5][3] = 3;
  M[5][4] = 3;
  fillRect(25, 1, 25, 33, 1);
  fillRect(44, 1, 44, 33, 1);
  fillRect(25, 1, 44, 1, 1);
  fillRect(25, 33, 44, 33, 1);
  M[25][14] = 0;
  M[25][15] = 0;
  M[25][16] = 0;
  fillRect(26, 2, 28, 12, 2);
  fillRect(26, 22, 28, 32, 2);
  fillRect(40, 2, 42, 18, 2);
  M[41][9] = 3;
  M[41][10] = 3;
  fillRect(9, 34, 44, 34, 1);
  fillRect(9, 46, 44, 46, 1);
  M[28][34] = 0;
  M[29][34] = 0;
  M[30][34] = 0;
  M[28][46] = 0;
  M[29][46] = 0;
  M[30][46] = 0;
  fillRect(1, 47, 18, 47, 1);
  fillRect(1, 62, 18, 62, 1);
  fillRect(1, 47, 1, 62, 1);
  fillRect(18, 47, 18, 62, 1);
  M[8][47] = 0;
  M[9][47] = 0;
  M[10][47] = 0;
  fillRect(3, 50, 6, 60, 2);
  M[3][58] = 3;
  M[3][59] = 3;
  fillRect(12, 49, 14, 51, 2);
  fillRect(12, 58, 14, 60, 2);
  fillRect(19, 47, 40, 47, 1);
  fillRect(19, 78, 40, 78, 1);
  fillRect(19, 47, 19, 78, 1);
  fillRect(40, 47, 40, 78, 1);
  M[19][58] = 0;
  M[19][59] = 0;
  M[19][60] = 0;
  M[29][47] = 0;
  M[30][47] = 0;
  M[31][47] = 0;
  fillRect(21, 50, 28, 62, 2);
  M[24][51] = 3;
  M[24][52] = 3;
  M[24][53] = 3;
  fillRect(21, 69, 28, 77, 2);
  M[22][69] = 3;
  M[23][69] = 3;
  fillRect(35, 49, 38, 55, 2);
  fillRect(41, 47, 58, 47, 1);
  fillRect(41, 78, 58, 78, 1);
  fillRect(41, 47, 41, 78, 1);
  fillRect(58, 47, 58, 78, 1);
  M[41][58] = 0;
  M[41][59] = 0;
  M[41][60] = 0;
  M[48][47] = 0;
  M[49][47] = 0;
  M[50][47] = 0;
  fillRect(43, 50, 50, 62, 2);
  M[46][51] = 3;
  M[46][52] = 3;
  M[46][53] = 3;
  fillRect(43, 70, 50, 77, 2);
  M[44][70] = 3;
  M[45][70] = 3;
  fillRect(54, 49, 57, 58, 2);
  fillRect(45, 1, 58, 1, 1);
  fillRect(45, 33, 58, 33, 1);
  fillRect(45, 1, 45, 33, 1);
  fillRect(58, 1, 58, 33, 1);
  M[45][14] = 0;
  M[45][15] = 0;
  M[45][16] = 0;
  fillRect(47, 3, 50, 8, 2);
  fillRect(47, 25, 50, 32, 2);
  M[48][3] = 3;
  M[48][4] = 3;
  M[48][28] = 3;
  M[48][29] = 3;
  fillRect(54, 10, 57, 16, 2);
  return M;
})();

function isSolid(wx: number, wy: number): boolean {
  const col = Math.floor(wx / TILE);
  const row = Math.floor(wy / TILE);
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;
  const v = RAW_MAP[row][col];
  return v === 1 || v === 2;
}

function canMoveTo(wx: number, wy: number, radius: number): boolean {
  return (
    !isSolid(wx - radius, wy - radius) &&
    !isSolid(wx + radius, wy - radius) &&
    !isSolid(wx - radius, wy + radius) &&
    !isSolid(wx + radius, wy + radius)
  );
}

const HIDE_SPOTS: HideSpot[] = [
  { id: 0, x: 3.5 * TILE, y: 5.5 * TILE, label: "Behind Sofa" },
  { id: 1, x: 9.5 * TILE, y: 41.5 * TILE, label: "Under Island" },
  { id: 2, x: 58.5 * TILE, y: 3.5 * TILE, label: "Behind Bathtub" },
  { id: 3, x: 52.5 * TILE, y: 24.5 * TILE, label: "Under Bed 1" },
  { id: 4, x: 69.5 * TILE, y: 22.5 * TILE, label: "Closet" },
  { id: 5, x: 52.5 * TILE, y: 46.5 * TILE, label: "Under Bed 2" },
  { id: 6, x: 70.5 * TILE, y: 44.5 * TILE, label: "Wardrobe" },
  { id: 7, x: 3.5 * TILE, y: 48.5 * TILE, label: "Behind Boxes A" },
  { id: 8, x: 29.5 * TILE, y: 48.5 * TILE, label: "Behind Boxes B" },
];

const WAYPOINTS = [
  { x: 17 * TILE, y: 12 * TILE },
  { x: 17 * TILE, y: 34 * TILE },
  { x: 40 * TILE, y: 26 * TILE },
  { x: 55 * TILE, y: 10 * TILE },
  { x: 62 * TILE, y: 30 * TILE },
  { x: 62 * TILE, y: 50 * TILE },
  { x: 17 * TILE, y: 52 * TILE },
  { x: 40 * TILE, y: 40 * TILE },
];

// ─── Constants ────────────────────────────────────────────────────────────────
const HOUR_DURATION = 900;
const TOTAL_HOURS = 5;
const PLAYER_SPEED = 100;
const PLAYER_RADIUS = 8;
const TURN_SPEED = 2.2;
const MONSTER_CATCH_RADIUS = 18;

const HOUR_MONSTER_SPEED = [0, 60, 75, 90, 110, 130];
const HOUR_DETECTION_RADIUS = [0, 120, 150, 180, 220, 260];

const NOTIFICATIONS = [
  "The floorboards creak...",
  "Something moves in the dark...",
  "You hear heavy breathing...",
  "The monster is searching...",
  "Stay hidden. Stay quiet.",
  "Dawn feels so far away...",
  "A door slams somewhere...",
  "Did that shadow just move?",
  "Your heart pounds in your chest...",
  "Footsteps echo in the hall...",
];

// ─── Raycaster ───────────────────────────────────────────────────────────────
function castRays(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  angle: number,
  vpX: number,
  vpY: number,
  vpW: number,
  vpH: number,
  monsterWX: number,
  monsterWY: number,
  downdedSprites: Array<{ wx: number; wy: number }>,
  flashOpacity: number,
): void {
  // Ceiling
  const cg = ctx.createLinearGradient(vpX, vpY, vpX, vpY + vpH * 0.5);
  cg.addColorStop(0, "#020408");
  cg.addColorStop(1, "#060c12");
  ctx.fillStyle = cg;
  ctx.fillRect(vpX, vpY, vpW, vpH * 0.5);

  // Floor
  const fg = ctx.createLinearGradient(vpX, vpY + vpH * 0.5, vpX, vpY + vpH);
  fg.addColorStop(0, "#050a0e");
  fg.addColorStop(1, "#020406");
  ctx.fillStyle = fg;
  ctx.fillRect(vpX, vpY + vpH * 0.5, vpW, vpH * 0.5);

  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const planeLen = 0.6;
  const planeX = -dirY * planeLen;
  const planeY = dirX * planeLen;

  const zBuffer: number[] = new Array(vpW).fill(Number.POSITIVE_INFINITY);

  for (let x = 0; x < vpW; x++) {
    const camX = (2 * x) / vpW - 1;
    const rdX = dirX + planeX * camX;
    const rdY = dirY + planeY * camX;

    let mapX = Math.floor(px / TILE);
    let mapY = Math.floor(py / TILE);
    const fracX = px / TILE - mapX;
    const fracY = py / TILE - mapY;

    const ddX = rdX === 0 ? 1e30 : Math.abs(1 / rdX);
    const ddY = rdY === 0 ? 1e30 : Math.abs(1 / rdY);

    let stepX: number;
    let stepY: number;
    let sdX: number;
    let sdY: number;
    if (rdX < 0) {
      stepX = -1;
      sdX = fracX * ddX;
    } else {
      stepX = 1;
      sdX = (1 - fracX) * ddX;
    }
    if (rdY < 0) {
      stepY = -1;
      sdY = fracY * ddY;
    } else {
      stepY = 1;
      sdY = (1 - fracY) * ddY;
    }

    let hit = false;
    let side = 0;
    let tileVal = 0;
    let count = 0;
    while (!hit && count++ < 200) {
      if (sdX < sdY) {
        sdX += ddX;
        mapX += stepX;
        side = 0;
      } else {
        sdY += ddY;
        mapY += stepY;
        side = 1;
      }
      if (mapX < 0 || mapX >= MAP_COLS || mapY < 0 || mapY >= MAP_ROWS) {
        tileVal = 1;
        hit = true;
        break;
      }
      tileVal = RAW_MAP[mapY][mapX];
      if (tileVal === 1 || tileVal === 2) hit = true;
    }
    if (!hit) tileVal = 1;

    let perpDist = side === 0 ? sdX - ddX : sdY - ddY;
    perpDist = Math.max(0.05, perpDist);
    zBuffer[x] = perpDist;

    const lineH = Math.min(vpH * 5, vpH / perpDist);
    const y0 = Math.max(vpY, (vpY + vpH / 2 - lineH / 2) | 0);
    const y1 = Math.min(vpY + vpH - 1, (vpY + vpH / 2 + lineH / 2) | 0);
    if (y1 <= y0) continue;

    const shade = Math.max(0, 1 - perpDist / 14) * flashOpacity;
    const sideMul = side === 1 ? 0.6 : 1.0;
    const s = shade * sideMul;

    let r: number;
    let g: number;
    let b: number;
    if (tileVal === 2) {
      r = Math.floor(8 + s * 65);
      g = Math.floor(12 + s * 35);
      b = Math.floor(8 + s * 25);
    } else {
      r = Math.floor(6 + s * 40);
      g = Math.floor(12 + s * 52);
      b = Math.floor(18 + s * 88);
    }

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(vpX + x, y0, 1, y1 - y0 + 1);
  }

  // Vignette / darkness overlay
  if (flashOpacity < 0.4) {
    ctx.fillStyle = `rgba(0,0,0,${0.82 + (1 - flashOpacity * 2.5) * 0.15})`;
    ctx.fillRect(vpX, vpY, vpW, vpH);
  } else {
    const vig = ctx.createRadialGradient(
      vpX + vpW / 2,
      vpY + vpH / 2,
      vpH * 0.08,
      vpX + vpW / 2,
      vpY + vpH / 2,
      vpH * 0.85,
    );
    vig.addColorStop(0, "rgba(0,0,0,0.15)");
    vig.addColorStop(0.5, "rgba(0,0,0,0.55)");
    vig.addColorStop(1, "rgba(0,0,0,0.95)");
    ctx.fillStyle = vig;
    ctx.fillRect(vpX, vpY, vpW, vpH);
  }

  // Monster sprite
  if (flashOpacity > 0.05) {
    const msx = (monsterWX - px) / TILE;
    const msy = (monsterWY - py) / TILE;
    const invDet = 1.0 / (planeX * dirY - dirX * planeY);
    const tx = invDet * (dirY * msx - dirX * msy);
    const ty = invDet * (-planeY * msx + planeX * msy);

    if (ty > 0.15) {
      const screenX = Math.floor((vpW / 2) * (1 + tx / ty));
      const sprH = Math.min(vpH * 4, Math.abs(Math.floor(vpH / ty)));
      const sprW = sprH;
      const sx0 = Math.floor(screenX - sprW / 2);
      const sx1 = Math.floor(screenX + sprW / 2);
      const sy0 = (vpH / 2 - sprH / 2 + vpY) | 0;
      const sy1 = (vpH / 2 + sprH / 2 + vpY) | 0;

      const mAlpha = Math.min(
        0.88,
        flashOpacity * (0.2 + 0.9 / (ty * 0.4 + 0.1)),
      );

      for (let sx = sx0; sx <= sx1; sx++) {
        if (sx < 0 || sx >= vpW) continue;
        if (ty < zBuffer[sx]) {
          const sy = Math.max(vpY, sy0);
          const ey = Math.min(vpY + vpH - 1, sy1);
          if (ey > sy) {
            const colA = Math.min(mAlpha, 0.92);
            ctx.fillStyle = `rgba(160,10,10,${colA})`;
            ctx.fillRect(vpX + sx, sy, 1, ey - sy);
          }
        }
      }

      // Glowing eyes when close
      if (ty < 7 && screenX >= 0 && screenX < vpW) {
        const midSx = Math.max(0, Math.min(vpW - 1, screenX));
        if (zBuffer[midSx] > ty) {
          const eyeR = Math.max(3, sprW / 9);
          const eyeY = sy0 + sprH * 0.28;
          const eyeGap = Math.max(6, sprW * 0.2);
          ctx.save();
          ctx.shadowColor = "#ff1010";
          ctx.shadowBlur = eyeR * 6;
          ctx.fillStyle = "#ff2020";
          ctx.beginPath();
          ctx.arc(vpX + screenX - eyeGap, eyeY, eyeR, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(vpX + screenX + eyeGap, eyeY, eyeR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  // Downed player sprites
  for (const dp of downdedSprites) {
    const dsx = (dp.wx - px) / TILE;
    const dsy = (dp.wy - py) / TILE;
    const invDet2 = 1.0 / (planeX * dirY - dirX * planeY);
    const dtx = invDet2 * (dirY * dsx - dirX * dsy);
    const dty = invDet2 * (-planeY * dsx + planeX * dsy);
    if (dty > 0.2) {
      const dScrX = Math.floor((vpW / 2) * (1 + dtx / dty));
      const dSprH = Math.min(
        vpH * 0.5,
        Math.abs(Math.floor((vpH / dty) * 0.3)),
      );
      const dSprW = Math.max(4, dSprH * 2.5);
      const dsx0 = Math.floor(dScrX - dSprW / 2);
      const dsx1 = Math.floor(dScrX + dSprW / 2);
      const dfloorY = (vpH / 2 + vpH * 0.13 + vpY) | 0;
      for (let sx = dsx0; sx <= dsx1; sx++) {
        if (sx < 0 || sx >= vpW) continue;
        if (dty < zBuffer[sx]) {
          ctx.fillStyle = "rgba(190,160,30,0.6)";
          ctx.fillRect(vpX + sx, dfloorY, 1, Math.max(2, dSprH));
        }
      }
    }
  }
}

// ─── Per-player HUD ───────────────────────────────────────────────────────────
function drawPlayerHUD(
  ctx: CanvasRenderingContext2D,
  player: Player,
  teammate: Player,
  vpX: number,
  vpY: number,
  _vpW: number,
  _vpH: number,
  playerIdx: number,
  hideSpots: HideSpot[],
): void {
  const revKey = playerIdx === 0 ? "E" : "K";
  const hideKey = playerIdx === 0 ? "F" : "L";
  const distToTeam = Math.hypot(player.x - teammate.x, player.y - teammate.y);
  const nearTeam = distToTeam < 70;

  // Status panel
  ctx.fillStyle = "rgba(3,6,10,0.82)";
  ctx.fillRect(vpX + 10, vpY + 10, 170, 54);
  ctx.strokeStyle = "rgba(178,58,58,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(vpX + 10, vpY + 10, 170, 54);

  const statusColor = !player.alive
    ? "#333"
    : player.downed
      ? "#D24A4A"
      : player.hidden
        ? "#3DA86A"
        : "#E7EEF6";
  const statusText = !player.alive
    ? "DEAD"
    : player.downed
      ? `DOWNED  ${Math.ceil(player.downedTimer)}s`
      : player.hidden
        ? "HIDING"
        : "ALIVE";

  ctx.font = "bold 11px 'Share Tech Mono', monospace";
  ctx.fillStyle = statusColor;
  ctx.fillText(`${player.label}: ${statusText}`, vpX + 18, vpY + 28);

  // Downtime bar
  if (player.downed) {
    const bx = vpX + 15;
    const by = vpY + 36;
    const bw = 155;
    ctx.fillStyle = "rgba(255,0,0,0.15)";
    ctx.fillRect(bx, by, bw, 8);
    const pct = Math.max(0, player.downedTimer / 30);
    const rc = Math.floor(255 * (1 - pct * 0.4));
    ctx.fillStyle = `rgba(${rc},${Math.floor(40 * pct)},0,0.9)`;
    ctx.fillRect(bx, by, bw * pct, 8);
    ctx.font = "8px 'Share Tech Mono', monospace";
    ctx.fillStyle = "rgba(255,200,200,0.7)";
    ctx.fillText("BLEED OUT", bx, by + 18);
  }

  // Revive UI
  if (!player.downed && player.alive && teammate.downed && nearTeam) {
    const panelH = teammate.reviveProgress > 0 ? 52 : 32;
    ctx.fillStyle = "rgba(3,12,6,0.85)";
    ctx.fillRect(vpX + 10, vpY + 70, 190, panelH);
    ctx.strokeStyle = "rgba(61,168,106,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(vpX + 10, vpY + 70, 190, panelH);
    ctx.font = "bold 10px 'Share Tech Mono', monospace";
    ctx.fillStyle = "#3DA86A";
    ctx.fillText(
      `[${revKey}] HOLD — REVIVE ${teammate.label}`,
      vpX + 18,
      vpY + 84,
    );
    if (teammate.reviveProgress > 0) {
      const bx2 = vpX + 15;
      const by2 = vpY + 90;
      ctx.fillStyle = "rgba(61,168,106,0.15)";
      ctx.fillRect(bx2, by2, 175, 8);
      ctx.fillStyle = "#3DA86A";
      ctx.fillRect(bx2, by2, 175 * teammate.reviveProgress, 8);
      ctx.font = "8px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#3DA86A";
      ctx.fillText("REVIVING...", bx2, by2 + 18);
    }
  }

  // Hide spot hint
  if (!player.downed && player.alive && !player.hidden) {
    for (const hs of hideSpots) {
      if (Math.hypot(player.x - hs.x, player.y - hs.y) < 45) {
        ctx.fillStyle = "rgba(3,12,6,0.82)";
        const hintY = vpY + (teammate.downed && nearTeam ? 130 : 70);
        ctx.fillRect(vpX + 10, hintY, 200, 28);
        ctx.strokeStyle = "rgba(61,168,106,0.4)";
        ctx.strokeRect(vpX + 10, hintY, 200, 28);
        ctx.font = "bold 10px 'Share Tech Mono', monospace";
        ctx.fillStyle = "#3DA86A";
        ctx.fillText(`[${hideKey}] HIDE — ${hs.label}`, vpX + 18, hintY + 17);
        break;
      }
    }
  }
  if (player.hidden) {
    ctx.fillStyle = "rgba(3,12,6,0.82)";
    ctx.fillRect(vpX + 10, vpY + 70, 200, 28);
    ctx.strokeStyle = "rgba(61,168,106,0.4)";
    ctx.strokeRect(vpX + 10, vpY + 70, 200, 28);
    ctx.font = "bold 10px 'Share Tech Mono', monospace";
    ctx.fillStyle = "#3DA86A";
    ctx.fillText(`[${hideKey}] STOP HIDING`, vpX + 18, vpY + 84);
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 700 });
  const [jumpscareState, setJumpscareState] = useState<{
    active: boolean;
    playerIdx: number;
    phase: number;
  } | null>(null);
  const gsRef = useRef<GameState | null>(null);
  const animRef = useRef<number>(0);
  const screenRef = useRef<Screen>("start");
  const jumpscareTimerRef = useRef<number>(0);
  const shakeRef = useRef<{ x: number; y: number; timer: number }>({
    x: 0,
    y: 0,
    timer: 0,
  });
  const pulseRef = useRef<number>(0);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    function onResize() {
      setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const initGame = useCallback(() => {
    gsRef.current = {
      players: [
        {
          x: 40 * TILE,
          y: 5 * TILE,
          alive: true,
          downed: false,
          downedTimer: 30,
          reviveProgress: 0,
          hidden: false,
          hideSpotId: null,
          color: "#2E7BE6",
          label: "P1",
          angle: Math.PI / 2,
        },
        {
          x: 42 * TILE,
          y: 5 * TILE,
          alive: true,
          downed: false,
          downedTimer: 30,
          reviveProgress: 0,
          hidden: false,
          hideSpotId: null,
          color: "#D07A2A",
          label: "P2",
          angle: Math.PI / 2,
        },
      ],
      monster: {
        x: 75 * TILE,
        y: 55 * TILE,
        angle: Math.PI,
        speed: HOUR_MONSTER_SPEED[1],
        detectionRadius: HOUR_DETECTION_RADIUS[1],
        state: "patrol",
        huntTargetIdx: 0,
        waypointIdx: 0,
        wanderTimer: 0,
        wanderAngle: 0,
      },
      hideSpots: HIDE_SPOTS,
      elapsedSeconds: 0,
      currentHour: 1,
      notification: null,
      nextNotifIn: 30 + Math.random() * 60,
      lastTimestamp: 0,
      keys: {},
      prevHideKey: [false, false],
      jumpscareActive: false,
    };
    setJumpscareState(null);
    jumpscareTimerRef.current = 0;
    shakeRef.current = { x: 0, y: 0, timer: 0 };
  }, []);

  // ─── Draw first-person ──────────────────────────────────────────────────────
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, gs: GameState, W: number, H: number) => {
      ctx.clearRect(0, 0, W, H);
      const halfW = W / 2;
      const p1 = gs.players[0];
      const p2 = gs.players[1];
      const m = gs.monster;

      const downdedForP1 = p2.downed ? [{ wx: p2.x, wy: p2.y }] : [];
      const downdedForP2 = p1.downed ? [{ wx: p1.x, wy: p1.y }] : [];

      // ── P1 viewport (left) ──
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, halfW, H);
      ctx.clip();
      if (!p1.alive) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, halfW, H);
        ctx.font = "bold 28px 'Oswald', sans-serif";
        ctx.fillStyle = "#D24A4A";
        ctx.textAlign = "center";
        ctx.fillText("YOU ARE DEAD", halfW / 2, H / 2);
        ctx.font = "14px 'Share Tech Mono', monospace";
        ctx.fillStyle = "#A9B7C6";
        ctx.fillText("Waiting for teammate...", halfW / 2, H / 2 + 36);
        ctx.textAlign = "left";
      } else {
        const p1Flash = p1.hidden ? 0.08 : p1.downed ? 0.3 : 1.0;
        castRays(
          ctx,
          p1.x,
          p1.y,
          p1.angle,
          0,
          0,
          halfW,
          H,
          m.x,
          m.y,
          downdedForP1,
          p1Flash,
        );
        // Red tint when downed
        if (p1.downed) {
          ctx.fillStyle = "rgba(160,0,0,0.35)";
          ctx.fillRect(0, 0, halfW, H);
        }
        drawPlayerHUD(ctx, p1, p2, 0, 0, halfW, H, 0, gs.hideSpots);
      }
      ctx.restore();

      // ── P2 viewport (right) ──
      ctx.save();
      ctx.beginPath();
      ctx.rect(halfW, 0, halfW, H);
      ctx.clip();
      if (!p2.alive) {
        ctx.fillStyle = "#000";
        ctx.fillRect(halfW, 0, halfW, H);
        ctx.font = "bold 28px 'Oswald', sans-serif";
        ctx.fillStyle = "#D24A4A";
        ctx.textAlign = "center";
        ctx.fillText("YOU ARE DEAD", halfW + halfW / 2, H / 2);
        ctx.font = "14px 'Share Tech Mono', monospace";
        ctx.fillStyle = "#A9B7C6";
        ctx.fillText("Waiting for teammate...", halfW + halfW / 2, H / 2 + 36);
        ctx.textAlign = "left";
      } else {
        const p2Flash = p2.hidden ? 0.08 : p2.downed ? 0.3 : 1.0;
        castRays(
          ctx,
          p2.x,
          p2.y,
          p2.angle,
          halfW,
          0,
          halfW,
          H,
          m.x,
          m.y,
          downdedForP2,
          p2Flash,
        );
        if (p2.downed) {
          ctx.fillStyle = "rgba(160,0,0,0.35)";
          ctx.fillRect(halfW, 0, halfW, H);
        }
        drawPlayerHUD(ctx, p2, p1, halfW, 0, halfW, H, 1, gs.hideSpots);
      }
      ctx.restore();

      // ── Divider ──
      ctx.fillStyle = "rgba(210,74,74,0.6)";
      ctx.fillRect(halfW - 1, 0, 2, H);

      // ── Top center HUD ──
      const hourElapsed = gs.elapsedSeconds % HOUR_DURATION;
      const timeLeft = HOUR_DURATION - hourElapsed;
      const mins = Math.floor(timeLeft / 60)
        .toString()
        .padStart(2, "0");
      const secs = Math.floor(timeLeft % 60)
        .toString()
        .padStart(2, "0");

      ctx.fillStyle = "rgba(3,6,10,0.85)";
      ctx.fillRect(W / 2 - 100, 0, 200, 46);
      ctx.strokeStyle = "rgba(178,58,58,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(W / 2 - 100, 0, 200, 46);
      ctx.font = "bold 12px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#D24A4A";
      ctx.textAlign = "center";
      ctx.fillText(`HOUR ${gs.currentHour} / ${TOTAL_HOURS}`, W / 2, 16);
      ctx.font = "20px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#E7EEF6";
      ctx.fillText(`${mins}:${secs}`, W / 2, 38);
      ctx.textAlign = "left";

      // ── Notification ──
      if (gs.notification) {
        const n = gs.notification;
        const fadeAlpha = n.timer < 1.5 ? n.timer / 1.5 : 1.0;
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.font = "italic 15px Georgia, serif";
        ctx.fillStyle = "#A9B7C6";
        ctx.textAlign = "center";
        ctx.fillText(n.text, W / 2, H - 28);
        ctx.restore();
        ctx.textAlign = "left";
      }
    },
    [],
  );

  // ─── Start screen ────────────────────────────────────────────────────────────
  const drawStartScreen = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number, t: number) => {
      // Raycasted corridor background effect
      ctx.fillStyle = "#04080f";
      ctx.fillRect(0, 0, W, H);

      // Simple corridor perspective
      const cg = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      cg.addColorStop(0, "#02040a");
      cg.addColorStop(1, "#06101a");
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H * 0.5);
      const fg = ctx.createLinearGradient(0, H * 0.5, 0, H);
      fg.addColorStop(0, "#04090e");
      fg.addColorStop(1, "#010305");
      ctx.fillStyle = fg;
      ctx.fillRect(0, H * 0.5, W, H * 0.5);

      // Corridor walls perspective lines
      ctx.strokeStyle = "rgba(25,40,60,0.6)";
      ctx.lineWidth = 1;
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 0; i <= 8; i++) {
        const edgeX = (i / 8) * W;
        ctx.beginPath();
        ctx.moveTo(edgeX, 0);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(edgeX, H);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }

      // Pulsing red eye in the distance
      const eyePulse = 0.5 + 0.5 * Math.sin(t * 1.8);
      const eyeGrd = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        80 + eyePulse * 30,
      );
      eyeGrd.addColorStop(0, `rgba(210,30,30,${0.3 + eyePulse * 0.3})`);
      eyeGrd.addColorStop(1, "rgba(210,30,30,0)");
      ctx.fillStyle = eyeGrd;
      ctx.fillRect(cx - 150, cy - 150, 300, 300);

      // Left eye
      ctx.save();
      ctx.shadowColor = "#ff1010";
      ctx.shadowBlur = 20 + eyePulse * 20;
      ctx.fillStyle = `rgba(255,30,30,${0.5 + eyePulse * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(
        cx - 30,
        cy,
        6 + eyePulse * 3,
        8 + eyePulse * 4,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        cx + 30,
        cy,
        6 + eyePulse * 3,
        8 + eyePulse * 4,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();

      // Vignette
      const vig = ctx.createRadialGradient(cx, cy, H * 0.2, cx, cy, H);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.92)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = "center";
      ctx.font = "bold 80px 'Oswald', sans-serif";
      ctx.fillStyle = "#E7EEF6";
      ctx.shadowColor = "#B23A3A";
      ctx.shadowBlur = 40;
      ctx.fillText("DARK HOUSE", cx, H / 2 - 110);
      ctx.font = "bold 52px 'Oswald', sans-serif";
      ctx.fillStyle = "#B23A3A";
      ctx.fillText("SURVIVAL", cx, H / 2 - 55);
      ctx.shadowBlur = 0;

      ctx.font = "16px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#A9B7C6";
      ctx.fillText(
        "First-person 2-player co-op · Survive 5 hours of darkness",
        cx,
        H / 2,
      );

      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.fillStyle = "rgba(169,183,198,0.75)";
      ctx.fillText(
        "P1: W/S move · A/D turn · F hide · E revive",
        cx,
        H / 2 + 40,
      );
      ctx.fillText(
        "P2: ↑/↓ move · ←/→ turn · L hide · K revive",
        cx,
        H / 2 + 60,
      );

      const pulseAlpha = 0.45 + 0.55 * Math.sin(t * 3);
      ctx.globalAlpha = pulseAlpha;
      ctx.font = "bold 15px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#D24A4A";
      ctx.fillText("— PRESS ENTER TO START —", cx, H / 2 + 110);
      ctx.globalAlpha = 1;

      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.fillStyle = "rgba(169,183,198,0.3)";
      ctx.fillText(
        `© ${new Date().getFullYear()}. Built with love using caffeine.ai`,
        cx,
        H - 18,
      );
      ctx.textAlign = "left";
    },
    [],
  );

  const drawOverlayScreen = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      gs: GameState,
      type: "gameover" | "victory",
    ) => {
      ctx.fillStyle =
        type === "victory" ? "rgba(4,10,20,0.94)" : "rgba(2,3,5,0.97)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      if (type === "gameover") {
        ctx.font = "bold 64px 'Oswald', sans-serif";
        ctx.fillStyle = "#D24A4A";
        ctx.shadowColor = "#D24A4A";
        ctx.shadowBlur = 50;
        ctx.fillText("THE NIGHT CLAIMS YOU", W / 2, H / 2 - 90);
        ctx.shadowBlur = 0;
        ctx.font = "18px 'Share Tech Mono', monospace";
        ctx.fillStyle = "#A9B7C6";
        const mm = Math.floor(gs.elapsedSeconds / 60);
        const ss = Math.floor(gs.elapsedSeconds % 60);
        ctx.fillText(`You survived ${mm}m ${ss}s`, W / 2, H / 2 - 30);
      } else {
        ctx.font = "bold 64px 'Oswald', sans-serif";
        ctx.fillStyle = "#E7EEF6";
        ctx.shadowColor = "#2E7BE6";
        ctx.shadowBlur = 50;
        ctx.fillText("YOU SURVIVED THE NIGHT", W / 2, H / 2 - 90);
        ctx.shadowBlur = 0;
        ctx.font = "30px 'Oswald', sans-serif";
        ctx.fillStyle = "#A9B7C6";
        ctx.fillText("DAWN HAS COME", W / 2, H / 2 - 35);
      }
      const pa = 0.4 + 0.6 * Math.sin(Date.now() / 400);
      ctx.globalAlpha = pa;
      ctx.font = "bold 14px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#D24A4A";
      ctx.fillText("— PRESS ENTER TO RESTART —", W / 2, H / 2 + 55);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    },
    [],
  );

  // ─── Game loop ────────────────────────────────────────────────────────────────
  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const gs = gsRef.current;
      const curScreen = screenRef.current;
      pulseRef.current = timestamp / 1000;

      if (curScreen === "start") {
        drawStartScreen(ctx, W, H, pulseRef.current);
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }
      if (curScreen === "gameover" || curScreen === "victory") {
        if (gs) drawOverlayScreen(ctx, W, H, gs, curScreen);
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }
      if (!gs) {
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const dt =
        gs.lastTimestamp === 0
          ? 0
          : Math.min((timestamp - gs.lastTimestamp) / 1000, 0.1);
      gs.lastTimestamp = timestamp;

      // ── Update jumpscare timer ──
      if (jumpscareTimerRef.current > 0) {
        jumpscareTimerRef.current -= dt;
        // Shake
        if (shakeRef.current.timer > 0) {
          shakeRef.current.timer -= dt;
          const intensity = Math.min(1, shakeRef.current.timer / 0.6) * 14;
          shakeRef.current.x = (Math.random() - 0.5) * intensity * 2;
          shakeRef.current.y = (Math.random() - 0.5) * intensity * 2;
          if (containerRef.current) {
            containerRef.current.style.transform = `translate(${shakeRef.current.x}px,${shakeRef.current.y}px)`;
          }
        } else {
          if (containerRef.current) containerRef.current.style.transform = "";
        }
        if (jumpscareTimerRef.current <= 0) {
          jumpscareTimerRef.current = 0;
          gs.jumpscareActive = false;
          setJumpscareState(null);
          if (containerRef.current) containerRef.current.style.transform = "";
        }
      }

      // ── Time ──
      gs.elapsedSeconds += dt;
      const newHour = Math.min(
        TOTAL_HOURS,
        Math.floor(gs.elapsedSeconds / HOUR_DURATION) + 1,
      );
      if (newHour !== gs.currentHour) {
        gs.currentHour = newHour;
        gs.monster.speed = HOUR_MONSTER_SPEED[newHour];
        gs.monster.detectionRadius = HOUR_DETECTION_RADIUS[newHour];
        gs.notification = {
          text: `HOUR ${newHour} — IT GROWS STRONGER`,
          timer: 4,
          maxTimer: 4,
        };
      }

      if (gs.elapsedSeconds >= TOTAL_HOURS * HOUR_DURATION) {
        setScreen("victory");
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // ── Notifications ──
      gs.nextNotifIn -= dt;
      if (gs.nextNotifIn <= 0) {
        gs.notification = {
          text: NOTIFICATIONS[Math.floor(Math.random() * NOTIFICATIONS.length)],
          timer: 4,
          maxTimer: 4,
        };
        gs.nextNotifIn = 30 + Math.random() * 60;
      }
      if (gs.notification) {
        gs.notification.timer -= dt;
        if (gs.notification.timer <= 0) gs.notification = null;
      }

      // ── Player movement (first-person) ──
      const k = gs.keys;
      const bindings = [
        { fwd: "w", bwd: "s", rotL: "a", rotR: "d", hideKey: "f", revKey: "e" },
        {
          fwd: "arrowup",
          bwd: "arrowdown",
          rotL: "arrowleft",
          rotR: "arrowright",
          hideKey: "l",
          revKey: "k",
        },
      ];

      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive || p.downed) continue;
        const b = bindings[pi];
        if (!p.hidden) {
          if (k[b.rotL]) p.angle -= TURN_SPEED * dt;
          if (k[b.rotR]) p.angle += TURN_SPEED * dt;
          let fwd = 0;
          if (k[b.fwd]) fwd += 1;
          if (k[b.bwd]) fwd -= 1;
          if (fwd !== 0) {
            const nx = p.x + Math.cos(p.angle) * PLAYER_SPEED * fwd * dt;
            const ny = p.y + Math.sin(p.angle) * PLAYER_SPEED * fwd * dt;
            if (canMoveTo(nx, p.y, PLAYER_RADIUS)) p.x = nx;
            if (canMoveTo(p.x, ny, PLAYER_RADIUS)) p.y = ny;
            p.x = Math.max(
              PLAYER_RADIUS,
              Math.min(MAP_COLS * TILE - PLAYER_RADIUS, p.x),
            );
            p.y = Math.max(
              PLAYER_RADIUS,
              Math.min(MAP_ROWS * TILE - PLAYER_RADIUS, p.y),
            );
          }
        }
      }

      // ── Hide toggle ──
      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive || p.downed) continue;
        const b = bindings[pi];
        const pressed = !!k[b.hideKey];
        const was = gs.prevHideKey[pi];
        if (pressed && !was) {
          if (p.hidden) {
            p.hidden = false;
            p.hideSpotId = null;
          } else {
            let best: HideSpot | null = null;
            let bestD = 55;
            for (const hs of gs.hideSpots) {
              const d = Math.hypot(p.x - hs.x, p.y - hs.y);
              if (d < bestD) {
                bestD = d;
                best = hs;
              }
            }
            if (best) {
              p.hidden = true;
              p.hideSpotId = best.id;
              p.x = best.x;
              p.y = best.y;
            }
          }
        }
        gs.prevHideKey[pi] = pressed;
      }

      // ── Revive mechanic ──
      for (let pi = 0; pi < 2; pi++) {
        const reviver = gs.players[pi];
        if (!reviver.alive || reviver.downed) continue;
        const targetIdx = pi === 0 ? 1 : 0;
        const target = gs.players[targetIdx];
        if (!target.downed) continue;
        const dist = Math.hypot(reviver.x - target.x, reviver.y - target.y);
        const b = bindings[pi];
        if (dist < 70 && k[b.revKey]) {
          target.reviveProgress += dt / 3;
          if (target.reviveProgress >= 1) {
            target.downed = false;
            target.reviveProgress = 0;
            target.downedTimer = 30;
            gs.notification = {
              text: `${target.label} IS BACK ON THEIR FEET!`,
              timer: 3,
              maxTimer: 3,
            };
          }
        } else {
          target.reviveProgress = Math.max(0, target.reviveProgress - dt * 0.4);
        }
      }

      // ── Downed timers ──
      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.downed) continue;
        p.downedTimer -= dt;
        if (p.downedTimer <= 0) {
          p.alive = false;
          p.downed = false;
          gs.notification = {
            text: `${p.label} HAS BLED OUT...`,
            timer: 4,
            maxTimer: 4,
          };
        }
      }

      // ── Monster AI ──
      const m = gs.monster;
      let huntTarget: Player | null = null;
      let huntDist = Number.POSITIVE_INFINITY;
      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive) continue;
        const detR = p.hidden ? 30 : m.detectionRadius;
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < detR && d < huntDist) {
          huntDist = d;
          huntTarget = p;
          m.huntTargetIdx = pi;
        }
      }
      m.state = huntTarget ? "hunt" : "patrol";

      let tgtX = m.x;
      let tgtY = m.y;
      if (m.state === "hunt" && huntTarget) {
        tgtX = huntTarget.x;
        tgtY = huntTarget.y;
      } else {
        const wp = WAYPOINTS[m.waypointIdx % WAYPOINTS.length];
        tgtX = wp.x;
        tgtY = wp.y;
        if (Math.hypot(wp.x - m.x, wp.y - m.y) < 30)
          m.waypointIdx = (m.waypointIdx + 1) % WAYPOINTS.length;
        m.wanderTimer -= dt;
        if (m.wanderTimer <= 0) {
          m.wanderAngle = (Math.random() - 0.5) * 0.8;
          m.wanderTimer = 1 + Math.random() * 2;
        }
        tgtX += Math.cos(m.wanderAngle) * 40;
        tgtY += Math.sin(m.wanderAngle) * 40;
      }

      const mdx = tgtX - m.x;
      const mdy = tgtY - m.y;
      const md = Math.hypot(mdx, mdy);
      if (md > 5) {
        const spd = m.state === "hunt" ? m.speed * 1.3 : m.speed;
        const nx = m.x + (mdx / md) * spd * dt;
        const ny = m.y + (mdy / md) * spd * dt;
        m.angle = Math.atan2(mdy, mdx);
        if (canMoveTo(nx, m.y, 10)) m.x = nx;
        if (canMoveTo(m.x, ny, 10)) m.y = ny;
      }

      // ── Catch check ──
      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive || p.hidden) continue;
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < MONSTER_CATCH_RADIUS + PLAYER_RADIUS) {
          if (p.downed) {
            // Re-caught while downed = permanent death
            p.alive = false;
            p.downed = false;
            gs.notification = {
              text: `${p.label} HAS BEEN KILLED!`,
              timer: 5,
              maxTimer: 5,
            };
          } else if (!gs.jumpscareActive) {
            // First catch: go downed + jumpscare
            p.downed = true;
            p.downedTimer = 30;
            p.reviveProgress = 0;
            gs.jumpscareActive = true;
            jumpscareTimerRef.current = 2.2;
            shakeRef.current = { x: 0, y: 0, timer: 0.7 };
            setJumpscareState({ active: true, playerIdx: pi, phase: 0 });
            gs.notification = {
              text: `${p.label} HAS BEEN FOUND!`,
              timer: 4,
              maxTimer: 4,
            };
            // Push monster back slightly
            const pushAngle = Math.atan2(m.y - p.y, m.x - p.x);
            m.x += Math.cos(pushAngle) * 40;
            m.y += Math.sin(pushAngle) * 40;
          }
        }
      }

      // ── Game over ──
      if (!gs.players[0].alive && !gs.players[1].alive) {
        setScreen("gameover");
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // ── Render ──
      draw(ctx, gs, W, H);
      animRef.current = requestAnimationFrame(gameLoop);
    },
    [draw, drawStartScreen, drawOverlayScreen],
  );

  // ─── Keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (gsRef.current) gsRef.current.keys[key] = true;
      if (key === "enter") {
        const s = screenRef.current;
        if (s === "start" || s === "gameover" || s === "victory") {
          initGame();
          setScreen("playing");
        }
      }
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
      )
        e.preventDefault();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (gsRef.current) gsRef.current.keys[e.key.toLowerCase()] = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [initGame]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameLoop]);

  // Jumpscare phase animation
  useEffect(() => {
    if (!jumpscareState?.active) return;
    const t = setTimeout(() => {
      setJumpscareState((prev) => (prev ? { ...prev, phase: 1 } : null));
    }, 300);
    return () => clearTimeout(t);
  }, [jumpscareState?.active]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#04080f",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;700;900&family=Share+Tech+Mono&display=swap');
        @keyframes jsFlash {
          0%   { background: rgba(255,255,255,0.98); }
          15%  { background: rgba(255,80,80,0.97); }
          40%  { background: rgba(180,0,0,0.95); }
          100% { background: rgba(120,0,0,0.92); }
        }
        @keyframes jsTextShake {
          0%,100% { transform: translate(-50%,-50%) rotate(0deg) scale(1); }
          15%     { transform: translate(-52%,-48%) rotate(-2.5deg) scale(1.04); }
          30%     { transform: translate(-48%,-52%) rotate(2.5deg) scale(0.97); }
          45%     { transform: translate(-51%,-49%) rotate(-1.5deg) scale(1.02); }
          60%     { transform: translate(-49%,-51%) rotate(1.5deg) scale(1.0); }
          75%     { transform: translate(-50%,-50%) rotate(-1deg) scale(1.01); }
        }
        @keyframes jsEyePulse {
          0%,100% { box-shadow: 0 0 35px 18px rgba(255,0,0,0.85), 0 0 70px 35px rgba(255,0,0,0.4); }
          50%     { box-shadow: 0 0 55px 28px rgba(255,50,0,1.0), 0 0 110px 55px rgba(255,0,0,0.65); }
        }
        @keyframes jsContainerShake {
          0%,100% { transform: translate(0,0); }
          10%  { transform: translate(-9px,-7px); }
          20%  { transform: translate(9px,7px); }
          30%  { transform: translate(-7px,9px); }
          40%  { transform: translate(7px,-9px); }
          50%  { transform: translate(-11px,5px); }
          60%  { transform: translate(11px,-5px); }
          70%  { transform: translate(-5px,11px); }
          80%  { transform: translate(5px,-11px); }
          90%  { transform: translate(-9px,7px); }
        }
      `}</style>

      {/* Game container — shakes on jumpscare */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          animation:
            jumpscareState?.active && (jumpscareState.phase ?? 0) === 0
              ? "jsContainerShake 0.09s infinite"
              : "none",
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          style={{ display: "block" }}
          data-ocid="game.canvas_target"
        />
      </div>

      {/* Jumpscare overlay */}
      {jumpscareState?.active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            animation: "jsFlash 2.2s forwards",
            pointerEvents: "none",
          }}
        >
          {/* Monster face */}
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: "-60px",
            }}
          >
            {/* Eyes */}
            <div style={{ display: "flex", gap: "90px", marginBottom: "28px" }}>
              <div
                style={{
                  width: "68px",
                  height: "80px",
                  background:
                    "radial-gradient(circle, #ff4040 0%, #cc0000 60%, #6b0000 100%)",
                  borderRadius: "50% 50% 45% 45%",
                  animation: "jsEyePulse 0.25s infinite",
                  transform: "rotate(-8deg)",
                }}
              />
              <div
                style={{
                  width: "68px",
                  height: "80px",
                  background:
                    "radial-gradient(circle, #ff4040 0%, #cc0000 60%, #6b0000 100%)",
                  borderRadius: "50% 50% 45% 45%",
                  animation: "jsEyePulse 0.25s infinite 0.12s",
                  transform: "rotate(8deg)",
                }}
              />
            </div>
            {/* Nose */}
            <div
              style={{
                width: "0",
                height: "0",
                borderLeft: "12px solid transparent",
                borderRight: "12px solid transparent",
                borderTop: "22px solid rgba(80,0,0,0.8)",
                marginBottom: "14px",
              }}
            />
            {/* Mouth with teeth */}
            <div
              style={{
                position: "relative",
                width: "260px",
                height: "50px",
                background: "#0a0000",
                borderRadius: "0 0 30px 30px",
                overflow: "hidden",
                border: "2px solid rgba(100,0,0,0.6)",
              }}
            >
              {/* Teeth */}
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${i * 38 - 4}px`,
                    width: "28px",
                    height: "36px",
                    background: "rgba(230,220,200,0.9)",
                    clipPath: "polygon(0 0, 100% 0, 80% 100%, 20% 100%)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* "IT FOUND YOU" text */}
          <div
            style={{
              position: "absolute",
              top: "55%",
              left: "50%",
              fontFamily: "'Oswald', sans-serif",
              fontSize: "clamp(44px, 9vw, 100px)",
              fontWeight: 900,
              color: "white",
              textShadow:
                "0 0 50px rgba(255,255,255,0.9), 0 0 100px rgba(255,50,50,0.7)",
              animation: "jsTextShake 0.12s infinite",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            IT FOUND YOU
          </div>

          {/* Player label */}
          <div
            style={{
              position: "absolute",
              bottom: "18%",
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "20px",
              color: "rgba(255,200,200,0.9)",
              letterSpacing: "0.15em",
              textShadow: "0 0 20px rgba(255,0,0,0.8)",
              userSelect: "none",
            }}
          >
            {jumpscareState.playerIdx === 0 ? "PLAYER 1" : "PLAYER 2"} — HOLD
            ON...
          </div>
        </div>
      )}

      {/* Top header bar (non-playing) */}
      {screen !== "playing" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "48px",
            background: "rgba(4,8,14,0.7)",
            borderBottom: "1px solid rgba(178,58,58,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            pointerEvents: "none",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: "18px",
              fontWeight: 700,
              color: "#E7EEF6",
              letterSpacing: "0.15em",
            }}
          >
            <span style={{ color: "#B23A3A" }}>DARK</span> HOUSE{" "}
            <span style={{ color: "#A9B7C6", fontWeight: 400 }}>SURVIVAL</span>
          </div>
          <div
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "11px",
              color: "rgba(210,74,74,0.8)",
              border: "1px solid rgba(178,58,58,0.4)",
              padding: "4px 12px",
            }}
          >
            PRESS ENTER
          </div>
        </div>
      )}

      {/* Footer */}
      {screen !== "playing" && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "11px",
            color: "rgba(169,183,198,0.3)",
            pointerEvents: "none",
          }}
        >
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            style={{ color: "rgba(178,58,58,0.5)", pointerEvents: "auto" }}
            target="_blank"
            rel="noreferrer"
          >
            caffeine.ai
          </a>
        </div>
      )}
    </div>
  );
}
