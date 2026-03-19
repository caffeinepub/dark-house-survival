import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "start" | "playing" | "gameover" | "victory";

interface Player {
  x: number;
  y: number;
  alive: boolean;
  hidden: boolean;
  hideSpotId: number | null;
  color: string;
  label: string;
  angle: number; // facing angle in radians
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
  x: number; // world px
  y: number;
  label: string;
}

interface Notification {
  text: string;
  timer: number; // seconds remaining
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
  cameraX: number;
  cameraY: number;
  lastTimestamp: number;
  keys: Record<string, boolean>;
  prevHideKey: [boolean, boolean];
}

// ─── Map ──────────────────────────────────────────────────────────────────────
const TILE = 20;
const MAP_COLS = 80;
const MAP_ROWS = 60;

// 0=floor, 1=wall, 2=furniture/obstacle, 3=hiding spot entrance
// prettier-ignore
const RAW_MAP: number[][] = (() => {
  const M: number[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    M.push(new Array(MAP_COLS).fill(0));
  }

  function fillRect(r1: number, c1: number, r2: number, c2: number, v: number) {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) M[r][c] = v;
  }

  // Outer walls
  fillRect(0, 0, MAP_ROWS - 1, 0, 1);
  fillRect(0, 0, 0, MAP_COLS - 1, 1);
  fillRect(MAP_ROWS - 1, 0, MAP_ROWS - 1, MAP_COLS - 1, 1);
  fillRect(0, MAP_COLS - 1, MAP_ROWS - 1, MAP_COLS - 1, 1);

  // ─── GROUND FLOOR ───
  // Entrance hallway (cols 35-45, rows 1-8)
  fillRect(1, 35, 8, 35, 1);
  fillRect(1, 45, 8, 45, 1);
  fillRect(1, 35, 1, 45, 1);
  // hallway door at row 8 col 39-41 (open passage)

  // Living room (cols 1-33, rows 1-24)
  fillRect(1, 1, 1, 33, 1);
  fillRect(24, 1, 24, 33, 1);
  fillRect(1, 1, 24, 1, 1);
  fillRect(1, 33, 24, 33, 1);
  // door opening in living room east wall at rows 10-12
  M[10][33] = 0;
  M[11][33] = 0;
  M[12][33] = 0;
  // door opening top at cols 18-20
  M[1][18] = 0;
  M[1][19] = 0;
  M[1][20] = 0;
  // Furniture in living room
  fillRect(3, 3, 5, 10, 2); // sofa
  fillRect(3, 3, 3, 10, 2); // sofa back
  fillRect(7, 3, 8, 6, 2); // coffee table
  fillRect(18, 3, 20, 8, 2); // bookshelf
  fillRect(18, 25, 20, 30, 2); // tv stand
  // hiding spot: behind sofa
  M[5][3] = 3;
  M[5][4] = 3;

  // Kitchen (cols 1-33, rows 25-44)
  fillRect(25, 1, 25, 33, 1);
  fillRect(44, 1, 44, 33, 1);
  fillRect(25, 1, 44, 1, 1);
  fillRect(25, 33, 44, 33, 1);
  // door from hallway/living room at cols 14-16
  M[25][14] = 0;
  M[25][15] = 0;
  M[25][16] = 0;
  // Furniture: kitchen counters
  fillRect(26, 2, 28, 12, 2);
  fillRect(26, 22, 28, 32, 2);
  fillRect(40, 2, 42, 18, 2); // kitchen island
  // under island = hiding
  M[41][9] = 3;
  M[41][10] = 3;

  // Central hallway (cols 34-46, rows 9-44)
  fillRect(9, 34, 44, 34, 1);
  fillRect(9, 46, 44, 46, 1);
  // Doors: hallway to living room at rows 10-12 (already open)
  // Doors: hallway to kitchen at cols 34,46 rows 28-30
  M[28][34] = 0;
  M[29][34] = 0;
  M[30][34] = 0;
  M[28][46] = 0;
  M[29][46] = 0;
  M[30][46] = 0;

  // Bathroom (cols 47-62, rows 1-18)
  fillRect(1, 47, 18, 47, 1);
  fillRect(1, 62, 18, 62, 1);
  fillRect(1, 47, 1, 62, 1);
  fillRect(18, 47, 18, 62, 1);
  M[8][47] = 0;
  M[9][47] = 0;
  M[10][47] = 0; // door
  // bathtub
  fillRect(3, 50, 6, 60, 2);
  // behind tub hiding
  M[3][58] = 3;
  M[3][59] = 3;
  // toilet / sink
  fillRect(12, 49, 14, 51, 2);
  fillRect(12, 58, 14, 60, 2);

  // Bedroom 1 (cols 47-78, rows 19-40)
  fillRect(19, 47, 40, 47, 1);
  fillRect(19, 78, 40, 78, 1);
  fillRect(19, 47, 19, 78, 1);
  fillRect(40, 47, 40, 78, 1);
  M[19][58] = 0;
  M[19][59] = 0;
  M[19][60] = 0; // door from top
  M[29][47] = 0;
  M[30][47] = 0;
  M[31][47] = 0; // door from hallway
  // Bed
  fillRect(21, 50, 28, 62, 2);
  // Under bed hiding
  M[24][51] = 3;
  M[24][52] = 3;
  M[24][53] = 3;
  // Closet in corner
  fillRect(21, 69, 28, 77, 2);
  M[22][69] = 3;
  M[23][69] = 3; // closet entrance
  // dresser
  fillRect(35, 49, 38, 55, 2);

  // Bedroom 2 (cols 47-78, rows 41-58)
  fillRect(41, 47, 58, 47, 1);
  fillRect(41, 78, 58, 78, 1);
  fillRect(41, 47, 41, 78, 1);
  fillRect(58, 47, 58, 78, 1);
  M[41][58] = 0;
  M[41][59] = 0;
  M[41][60] = 0; // door
  M[48][47] = 0;
  M[49][47] = 0;
  M[50][47] = 0;
  // Bed 2
  fillRect(43, 50, 50, 62, 2);
  M[46][51] = 3;
  M[46][52] = 3;
  M[46][53] = 3; // under bed
  // Wardrobe hiding
  fillRect(43, 70, 50, 77, 2);
  M[44][70] = 3;
  M[45][70] = 3;
  // desk
  fillRect(54, 49, 57, 58, 2);

  // Upstairs / basement corridor (cols 1-33, rows 45-58)
  fillRect(45, 1, 58, 1, 1);
  fillRect(45, 33, 58, 33, 1);
  fillRect(45, 1, 45, 33, 1);
  fillRect(58, 1, 58, 33, 1);
  M[45][14] = 0;
  M[45][15] = 0;
  M[45][16] = 0; // from kitchen
  // Storage boxes
  fillRect(47, 3, 50, 8, 2);
  fillRect(47, 25, 50, 32, 2);
  M[48][3] = 3;
  M[48][4] = 3; // behind boxes
  M[48][28] = 3;
  M[48][29] = 3;
  // corridor furniture
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

// ─── Hide spots (world px coordinates) ────────────────────────────────────────
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

// ─── Waypoints for monster patrol ─────────────────────────────────────────────
const WAYPOINTS = [
  { x: 17 * TILE, y: 12 * TILE }, // living room center
  { x: 17 * TILE, y: 34 * TILE }, // kitchen center
  { x: 40 * TILE, y: 26 * TILE }, // hallway center
  { x: 55 * TILE, y: 10 * TILE }, // bathroom area
  { x: 62 * TILE, y: 30 * TILE }, // bedroom 1
  { x: 62 * TILE, y: 50 * TILE }, // bedroom 2
  { x: 17 * TILE, y: 52 * TILE }, // basement corridor
  { x: 40 * TILE, y: 40 * TILE }, // hallway south
];

// ─── Constants ────────────────────────────────────────────────────────────────
const HOUR_DURATION = 900; // seconds per hour
const TOTAL_HOURS = 5;
const PLAYER_SPEED = 80; // px/sec
const PLAYER_RADIUS = 8;
const MONSTER_CATCH_RADIUS = 18;
const FLASHLIGHT_RANGE = 200;
const FLASHLIGHT_ANGLE = (120 * Math.PI) / 180;

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

// ─── Tile colors ──────────────────────────────────────────────────────────────
const TILE_COLORS: Record<number, string> = {
  0: "#0D1B26",
  1: "#050B12",
  2: "#0A1520",
  3: "#0D2030",
};

const TILE_STROKE: Record<number, string> = {
  0: "#0B1720",
  1: "#080E18",
  2: "#0C1D28",
  3: "#0F2538",
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 700 });
  const gsRef = useRef<GameState | null>(null);
  const animRef = useRef<number>(0);
  const screenRef = useRef<Screen>("start");

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // ─── Resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    function onResize() {
      setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ─── Init game state ─────────────────────────────────────────────────────────
  const initGame = useCallback(() => {
    gsRef.current = {
      players: [
        {
          x: 40 * TILE,
          y: 5 * TILE,
          alive: true,
          hidden: false,
          hideSpotId: null,
          color: "#2E7BE6",
          label: "P1",
          angle: 0,
        },
        {
          x: 42 * TILE,
          y: 5 * TILE,
          alive: true,
          hidden: false,
          hideSpotId: null,
          color: "#D07A2A",
          label: "P2",
          angle: Math.PI,
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
      cameraX: 40 * TILE - 600,
      cameraY: 5 * TILE - 350,
      lastTimestamp: 0,
      keys: {},
      prevHideKey: [false, false],
    };
  }, []);

  // ─── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, gs: GameState, W: number, H: number) => {
      ctx.clearRect(0, 0, W, H);

      const camX = gs.cameraX;
      const camY = gs.cameraY;

      // ─── World layer ────────────────────────────────────────────────────────
      ctx.save();
      ctx.translate(-camX, -camY);

      // Draw tiles
      const startCol = Math.max(0, Math.floor(camX / TILE));
      const endCol = Math.min(MAP_COLS - 1, Math.ceil((camX + W) / TILE));
      const startRow = Math.max(0, Math.floor(camY / TILE));
      const endRow = Math.min(MAP_ROWS - 1, Math.ceil((camY + H) / TILE));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const v = RAW_MAP[r][c];
          ctx.fillStyle = TILE_COLORS[v] ?? "#0D1B26";
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          if (v === 1) {
            ctx.strokeStyle = TILE_STROKE[v];
            ctx.lineWidth = 1;
            ctx.strokeRect(c * TILE, r * TILE, TILE, TILE);
          }
          if (v === 3) {
            // hiding spot marker
            ctx.fillStyle = "rgba(20, 80, 50, 0.4)";
            ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          }
        }
      }

      // Draw furniture details (v=2) with slight texture
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          if (RAW_MAP[r][c] === 2) {
            ctx.strokeStyle = "#162535";
            ctx.lineWidth = 0.5;
            ctx.strokeRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2);
          }
        }
      }

      // Draw hide spots (glow)
      for (const hs of gs.hideSpots) {
        const grd = ctx.createRadialGradient(hs.x, hs.y, 2, hs.x, hs.y, 25);
        grd.addColorStop(0, "rgba(20,100,60,0.35)");
        grd.addColorStop(1, "rgba(20,100,60,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(hs.x, hs.y, 25, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw players in world
      for (const p of gs.players) {
        if (!p.alive) continue;
        ctx.globalAlpha = p.hidden ? 0.35 : 1.0;
        // glow
        const pgrd = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 14);
        pgrd.addColorStop(0, `${p.color}AA`);
        pgrd.addColorStop(1, `${p.color}00`);
        ctx.fillStyle = pgrd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fill();
        // body
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        // direction nub
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(
          p.x + Math.cos(p.angle) * (PLAYER_RADIUS - 2),
          p.y + Math.sin(p.angle) * (PLAYER_RADIUS - 2),
          3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Draw monster
      const m = gs.monster;
      // monster glow
      const mgrd = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, 40);
      mgrd.addColorStop(0, "rgba(180,30,30,0.5)");
      mgrd.addColorStop(1, "rgba(180,30,30,0)");
      ctx.fillStyle = mgrd;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 40, 0, Math.PI * 2);
      ctx.fill();
      // monster body
      ctx.fillStyle = "#8B1A1A";
      ctx.beginPath();
      ctx.arc(m.x, m.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#D24A4A";
      ctx.lineWidth = 2;
      ctx.stroke();
      // eyes
      ctx.fillStyle = "#FF3030";
      const eyeL = {
        x: m.x + Math.cos(m.angle - 0.4) * 7,
        y: m.y + Math.sin(m.angle - 0.4) * 7,
      };
      const eyeR = {
        x: m.x + Math.cos(m.angle + 0.4) * 7,
        y: m.y + Math.sin(m.angle + 0.4) * 7,
      };
      ctx.beginPath();
      ctx.arc(eyeL.x, eyeL.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeR.x, eyeR.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // ─── Darkness overlay ───────────────────────────────────────────────────
      const darknessCanvas = document.createElement("canvas");
      darknessCanvas.width = W;
      darknessCanvas.height = H;
      const dctx = darknessCanvas.getContext("2d")!;

      // Fill with near-black
      dctx.fillStyle = "rgba(0, 0, 0, 0.93)";
      dctx.fillRect(0, 0, W, H);

      dctx.globalCompositeOperation = "destination-out";

      // Punch flashlight cones for alive, non-hidden players
      for (const p of gs.players) {
        if (!p.alive || p.hidden) continue;
        const sx = p.x - camX;
        const sy = p.y - camY;

        // Flashlight cone
        const coneGrad = dctx.createRadialGradient(
          sx,
          sy,
          0,
          sx,
          sy,
          FLASHLIGHT_RANGE,
        );
        coneGrad.addColorStop(0, "rgba(255,255,240,1.0)");
        coneGrad.addColorStop(0.4, "rgba(255,255,200,0.7)");
        coneGrad.addColorStop(0.8, "rgba(255,255,180,0.2)");
        coneGrad.addColorStop(1, "rgba(0,0,0,0)");

        dctx.save();
        dctx.translate(sx, sy);
        dctx.rotate(p.angle - FLASHLIGHT_ANGLE / 2);
        dctx.beginPath();
        dctx.moveTo(0, 0);
        dctx.arc(0, 0, FLASHLIGHT_RANGE, 0, FLASHLIGHT_ANGLE);
        dctx.closePath();
        dctx.fillStyle = coneGrad;
        dctx.fill();
        dctx.restore();

        // Small ambient around player
        const ambGrad = dctx.createRadialGradient(sx, sy, 0, sx, sy, 30);
        ambGrad.addColorStop(0, "rgba(255,255,200,0.6)");
        ambGrad.addColorStop(1, "rgba(0,0,0,0)");
        dctx.fillStyle = ambGrad;
        dctx.beginPath();
        dctx.arc(sx, sy, 30, 0, Math.PI * 2);
        dctx.fill();
      }

      // Monster faint red ambient punch
      const msx = m.x - camX;
      const msy = m.y - camY;
      const monGrad = dctx.createRadialGradient(msx, msy, 0, msx, msy, 60);
      monGrad.addColorStop(0, "rgba(180,0,0,0.55)");
      monGrad.addColorStop(1, "rgba(0,0,0,0)");
      dctx.fillStyle = monGrad;
      dctx.beginPath();
      dctx.arc(msx, msy, 60, 0, Math.PI * 2);
      dctx.fill();

      dctx.globalCompositeOperation = "source-over";

      ctx.drawImage(darknessCanvas, 0, 0);

      // ─── HUD (above darkness) ───────────────────────────────────────────────
      // Top-left: Hour & timer
      const totalLeft = gs.elapsedSeconds;
      const hourElapsed = totalLeft % HOUR_DURATION;
      const timeLeft = HOUR_DURATION - hourElapsed;
      const mins = Math.floor(timeLeft / 60)
        .toString()
        .padStart(2, "0");
      const secs = Math.floor(timeLeft % 60)
        .toString()
        .padStart(2, "0");

      ctx.fillStyle = "rgba(6,10,14,0.75)";
      ctx.fillRect(10, 10, 200, 60);
      ctx.strokeStyle = "rgba(178,58,58,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, 200, 60);

      ctx.font = "bold 13px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#D24A4A";
      ctx.fillText(`HOUR ${gs.currentHour} / 5`, 22, 32);
      ctx.font = "22px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#E7EEF6";
      ctx.fillText(`${mins}:${secs}`, 22, 58);

      // Top-right: Player status
      const statusX = W - 210;
      ctx.fillStyle = "rgba(6,10,14,0.75)";
      ctx.fillRect(statusX, 10, 200, 60);
      ctx.strokeStyle = "rgba(178,58,58,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(statusX, 10, 200, 60);

      for (let i = 0; i < 2; i++) {
        const p = gs.players[i];
        const px = statusX + 14 + i * 100;
        const statusColor = !p.alive ? "#555" : p.hidden ? "#3DA86A" : p.color;
        const statusLabel = !p.alive ? "CAUGHT" : p.hidden ? "HIDDEN" : "ALIVE";
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(px + 8, 28, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "bold 10px 'Share Tech Mono', monospace";
        ctx.fillStyle = statusColor;
        ctx.fillText(p.label, px, 48);
        ctx.font = "9px 'Share Tech Mono', monospace";
        ctx.fillStyle = "#A9B7C6";
        ctx.fillText(statusLabel, px, 60);
      }

      // Notification at bottom
      if (gs.notification) {
        const n = gs.notification;
        const fadeAlpha = n.timer < 1.5 ? n.timer / 1.5 : 1.0;
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.font = "italic 15px Georgia, serif";
        ctx.fillStyle = "#A9B7C6";
        ctx.textAlign = "center";
        ctx.fillText(n.text, W / 2, H - 30);
        ctx.restore();
        ctx.textAlign = "left";
      }

      // Hide spot proximity hint
      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive || p.hidden) {
          for (const hs of gs.hideSpots) {
            const dx = p.x - hs.x;
            const dy = p.y - hs.y;
            if (Math.sqrt(dx * dx + dy * dy) < 40) {
              const hintKey = pi === 0 ? "F" : "L";
              const sx2 = hs.x - camX;
              const sy2 = hs.y - camY;
              ctx.font = "bold 11px 'Share Tech Mono', monospace";
              ctx.fillStyle = "#3DA86A";
              ctx.textAlign = "center";
              ctx.fillText(`[${hintKey}] ${hs.label}`, sx2, sy2 - 20);
              ctx.textAlign = "left";
            }
          }
        }
      }

      // Proximity hints when not hidden
      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive || p.hidden) continue;
        for (const hs of gs.hideSpots) {
          const dx = p.x - hs.x;
          const dy = p.y - hs.y;
          if (Math.sqrt(dx * dx + dy * dy) < 40) {
            const hintKey = pi === 0 ? "F" : "L";
            const sx2 = hs.x - camX;
            const sy2 = hs.y - camY;
            ctx.font = "bold 11px 'Share Tech Mono', monospace";
            ctx.fillStyle = "#3DA86A";
            ctx.textAlign = "center";
            ctx.fillText(`[${hintKey}] ${hs.label}`, sx2, sy2 - 20);
            ctx.textAlign = "left";
          }
        }
      }
    },
    [],
  );

  // ─── Draw start screen ───────────────────────────────────────────────────────
  const drawStartScreen = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number, pulse: number) => {
      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#07121C");
      bgGrad.addColorStop(1, "#0A1A2A");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Vignette
      const vigGrad = ctx.createRadialGradient(
        W / 2,
        H / 2,
        H * 0.2,
        W / 2,
        H / 2,
        H,
      );
      vigGrad.addColorStop(0, "rgba(0,0,0,0)");
      vigGrad.addColorStop(1, "rgba(0,0,0,0.8)");
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.textAlign = "center";
      ctx.font = "bold 72px 'Oswald', sans-serif";
      ctx.fillStyle = "#E7EEF6";
      ctx.shadowColor = "#B23A3A";
      ctx.shadowBlur = 30;
      ctx.fillText("DARK HOUSE", W / 2, H / 2 - 100);
      ctx.font = "bold 48px 'Oswald', sans-serif";
      ctx.fillStyle = "#B23A3A";
      ctx.fillText("SURVIVAL", W / 2, H / 2 - 50);
      ctx.shadowBlur = 0;

      ctx.font = "18px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#A9B7C6";
      ctx.fillText(
        "Survive until dawn — 5 hours of darkness",
        W / 2,
        H / 2 + 5,
      );

      // Controls
      ctx.font = "13px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#A9B7C6";
      ctx.fillText("P1: WASD to move  |  F to hide/unhide", W / 2, H / 2 + 55);
      ctx.fillText(
        "P2: ARROW KEYS to move  |  L to hide/unhide",
        W / 2,
        H / 2 + 78,
      );

      // Pulsing enter
      const pulseAlpha = 0.5 + 0.5 * Math.sin(pulse * 3);
      ctx.globalAlpha = pulseAlpha;
      ctx.font = "bold 16px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#D24A4A";
      ctx.fillText("— PRESS ENTER TO START —", W / 2, H / 2 + 130);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";

      // Footer
      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.fillStyle = "rgba(169,183,198,0.4)";
      ctx.textAlign = "center";
      ctx.fillText(
        `© ${new Date().getFullYear()}. Built with love using caffeine.ai`,
        W / 2,
        H - 20,
      );
      ctx.textAlign = "left";
    },
    [],
  );

  // ─── Draw overlay screens ─────────────────────────────────────────────────────
  const drawOverlayScreen = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      gs: GameState,
      type: "gameover" | "victory",
    ) => {
      ctx.fillStyle =
        type === "victory" ? "rgba(4,12,22,0.92)" : "rgba(2,4,6,0.95)";
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = "center";
      if (type === "gameover") {
        ctx.font = "bold 60px 'Oswald', sans-serif";
        ctx.fillStyle = "#D24A4A";
        ctx.shadowColor = "#D24A4A";
        ctx.shadowBlur = 40;
        ctx.fillText("THE NIGHT CLAIMS YOU", W / 2, H / 2 - 80);
        ctx.shadowBlur = 0;
        ctx.font = "20px 'Share Tech Mono', monospace";
        ctx.fillStyle = "#A9B7C6";
        const survived = gs.elapsedSeconds;
        const hh = Math.floor(survived / 3600);
        const mm = Math.floor((survived % 3600) / 60);
        const ss = Math.floor(survived % 60);
        ctx.fillText(
          `You survived ${hh > 0 ? `${hh}h ` : ""}${mm}m ${ss}s`,
          W / 2,
          H / 2 - 20,
        );
      } else {
        ctx.font = "bold 60px 'Oswald', sans-serif";
        ctx.fillStyle = "#E7EEF6";
        ctx.shadowColor = "#2E7BE6";
        ctx.shadowBlur = 40;
        ctx.fillText("YOU SURVIVED THE NIGHT", W / 2, H / 2 - 80);
        ctx.shadowBlur = 0;
        ctx.font = "28px 'Oswald', sans-serif";
        ctx.fillStyle = "#A9B7C6";
        ctx.fillText("DAWN HAS COME", W / 2, H / 2 - 30);
      }

      const pulseAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 400);
      ctx.globalAlpha = pulseAlpha;
      ctx.font = "bold 15px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#D24A4A";
      ctx.fillText("— PRESS ENTER TO RESTART —", W / 2, H / 2 + 60);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    },
    [],
  );

  // ─── Game loop ───────────────────────────────────────────────────────────────
  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const gs = gsRef.current;
      const currentScreen = screenRef.current;

      if (currentScreen === "start") {
        drawStartScreen(ctx, W, H, timestamp / 1000);
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (currentScreen === "gameover" || currentScreen === "victory") {
        if (gs) drawOverlayScreen(ctx, W, H, gs, currentScreen);
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (!gs) {
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Delta time
      const dt =
        gs.lastTimestamp === 0
          ? 0
          : Math.min((timestamp - gs.lastTimestamp) / 1000, 0.1);
      gs.lastTimestamp = timestamp;

      // ─── Update elapsed time ────────────────────────────────────────────────
      gs.elapsedSeconds += dt;
      const newHour = Math.min(
        TOTAL_HOURS,
        Math.floor(gs.elapsedSeconds / HOUR_DURATION) + 1,
      );
      if (newHour !== gs.currentHour) {
        gs.currentHour = newHour;
        gs.monster.speed = HOUR_MONSTER_SPEED[newHour];
        gs.monster.detectionRadius = HOUR_DETECTION_RADIUS[newHour];
        gs.notification = { text: `HOUR ${newHour}`, timer: 4, maxTimer: 4 };
      }

      // Victory check
      if (gs.elapsedSeconds >= TOTAL_HOURS * HOUR_DURATION) {
        setScreen("victory");
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // ─── Notifications ─────────────────────────────────────────────────────
      gs.nextNotifIn -= dt;
      if (gs.nextNotifIn <= 0) {
        const txt =
          NOTIFICATIONS[Math.floor(Math.random() * NOTIFICATIONS.length)];
        gs.notification = { text: txt, timer: 4, maxTimer: 4 };
        gs.nextNotifIn = 30 + Math.random() * 60;
      }
      if (gs.notification) {
        gs.notification.timer -= dt;
        if (gs.notification.timer <= 0) gs.notification = null;
      }

      // ─── Player movement ────────────────────────────────────────────────────
      const k = gs.keys;
      const moveBindings = [
        { up: "w", down: "s", left: "a", right: "d", hideKey: "f" },
        {
          up: "arrowup",
          down: "arrowdown",
          left: "arrowleft",
          right: "arrowright",
          hideKey: "l",
        },
      ];

      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive || p.hidden) continue;
        const b = moveBindings[pi];
        let vx = 0;
        let vy = 0;
        if (k[b.up]) vy -= 1;
        if (k[b.down]) vy += 1;
        if (k[b.left]) vx -= 1;
        if (k[b.right]) vx += 1;
        if (vx !== 0 || vy !== 0) {
          const len = Math.sqrt(vx * vx + vy * vy);
          vx /= len;
          vy /= len;
          p.angle = Math.atan2(vy, vx);
          const nx = p.x + vx * PLAYER_SPEED * dt;
          const ny = p.y + vy * PLAYER_SPEED * dt;
          if (canMoveTo(nx, p.y, PLAYER_RADIUS)) p.x = nx;
          if (canMoveTo(p.x, ny, PLAYER_RADIUS)) p.y = ny;
          // Clamp to map
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

      // ─── Hide key handling ─────────────────────────────────────────────────
      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive) continue;
        const b = moveBindings[pi];
        const hidePressed = !!k[b.hideKey];
        const wasPressed = gs.prevHideKey[pi];
        if (hidePressed && !wasPressed) {
          if (p.hidden) {
            p.hidden = false;
            p.hideSpotId = null;
          } else {
            // find nearest hide spot
            let best: HideSpot | null = null;
            let bestDist = 50;
            for (const hs of gs.hideSpots) {
              const dx = p.x - hs.x;
              const dy = p.y - hs.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < bestDist) {
                bestDist = d;
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
        gs.prevHideKey[pi] = hidePressed;
      }

      // ─── Monster AI ────────────────────────────────────────────────────────
      const m = gs.monster;

      // Find huntable players
      let huntTarget: Player | null = null;
      let huntDist = Number.POSITIVE_INFINITY;
      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive) continue;
        const detR = p.hidden ? 30 : m.detectionRadius;
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < detR && d < huntDist) {
          huntDist = d;
          huntTarget = p;
          m.huntTargetIdx = pi;
        }
      }

      if (huntTarget) {
        m.state = "hunt";
      } else {
        m.state = "patrol";
      }

      let targetX = m.x;
      let targetY = m.y;

      if (m.state === "hunt" && huntTarget) {
        targetX = huntTarget.x;
        targetY = huntTarget.y;
      } else {
        // Patrol
        const wp = WAYPOINTS[m.waypointIdx % WAYPOINTS.length];
        targetX = wp.x;
        targetY = wp.y;
        const dx = wp.x - m.x;
        const dy = wp.y - m.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 30) {
          m.waypointIdx = (m.waypointIdx + 1) % WAYPOINTS.length;
        }
        // Slight wander
        m.wanderTimer -= dt;
        if (m.wanderTimer <= 0) {
          m.wanderAngle = (Math.random() - 0.5) * 0.8;
          m.wanderTimer = 1 + Math.random() * 2;
        }
        targetX += Math.cos(m.wanderAngle) * 40;
        targetY += Math.sin(m.wanderAngle) * 40;
      }

      const mdx = targetX - m.x;
      const mdy = targetY - m.y;
      const md = Math.sqrt(mdx * mdx + mdy * mdy);
      if (md > 5) {
        const speed = m.state === "hunt" ? m.speed * 1.3 : m.speed;
        const nx = m.x + (mdx / md) * speed * dt;
        const ny = m.y + (mdy / md) * speed * dt;
        m.angle = Math.atan2(mdy, mdx);
        if (canMoveTo(nx, m.y, 10)) m.x = nx;
        if (canMoveTo(m.x, ny, 10)) m.y = ny;
      }

      // Monster catch check
      for (let pi = 0; pi < 2; pi++) {
        const p = gs.players[pi];
        if (!p.alive || p.hidden) continue;
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < MONSTER_CATCH_RADIUS + PLAYER_RADIUS) {
          p.alive = false;
          gs.notification = {
            text: `${p.label} HAS BEEN CAUGHT!`,
            timer: 5,
            maxTimer: 5,
          };
        }
      }

      // Game over check
      if (!gs.players[0].alive && !gs.players[1].alive) {
        setScreen("gameover");
        animRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // ─── Camera ──────────────────────────────────────────────────────────────
      const alivePlayers = gs.players.filter((p) => p.alive);
      if (alivePlayers.length > 0) {
        const cx =
          alivePlayers.reduce((s, p) => s + p.x, 0) / alivePlayers.length;
        const cy =
          alivePlayers.reduce((s, p) => s + p.y, 0) / alivePlayers.length;
        const targetCamX = cx - W / 2;
        const targetCamY = cy - H / 2;
        const clampedCamX = Math.max(
          0,
          Math.min(MAP_COLS * TILE - W, targetCamX),
        );
        const clampedCamY = Math.max(
          0,
          Math.min(MAP_ROWS * TILE - H, targetCamY),
        );
        // Smooth camera
        gs.cameraX += (clampedCamX - gs.cameraX) * 0.1;
        gs.cameraY += (clampedCamY - gs.cameraY) * 0.1;
      }

      // ─── Render ──────────────────────────────────────────────────────────────
      draw(ctx, gs, W, H);

      animRef.current = requestAnimationFrame(gameLoop);
    },
    [draw, drawStartScreen, drawOverlayScreen],
  );

  // ─── Keyboard listeners ──────────────────────────────────────────────────────
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
      // Prevent arrow key scrolling
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
      ) {
        e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (gsRef.current) gsRef.current.keys[key] = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [initGame]);

  // ─── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameLoop]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#07121C",
        position: "relative",
      }}
      data-ocid="game.canvas_target"
    >
      {/* Header bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          height: "48px",
          background: "rgba(6,10,14,0.65)",
          borderBottom: "1px solid rgba(178,58,58,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          backdropFilter: "blur(8px)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: "18px",
            fontWeight: 700,
            color: "#E7EEF6",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "#B23A3A" }}>DARK</span> HOUSE{" "}
          <span style={{ color: "#A9B7C6", fontWeight: 400 }}>SURVIVAL</span>
        </div>
        <div
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "11px",
            color: "#A9B7C6",
            letterSpacing: "0.05em",
          }}
        >
          P1: WASD + F&nbsp;&nbsp;|&nbsp;&nbsp;P2: ARROWS +
          L&nbsp;&nbsp;|&nbsp;&nbsp;SURVIVE 5 HOURS
        </div>
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: "12px",
            color: "#B23A3A",
            letterSpacing: "0.1em",
            border: "1px solid rgba(178,58,58,0.5)",
            padding: "4px 12px",
            textTransform: "uppercase",
          }}
        >
          {screen === "playing" ? "▶ PLAYING" : "PRESS ENTER"}
        </div>
      </div>

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        style={{ display: "block" }}
        data-ocid="game.canvas_target"
      />

      {/* Footer */}
      {screen !== "playing" && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "11px",
            color: "rgba(169,183,198,0.35)",
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
