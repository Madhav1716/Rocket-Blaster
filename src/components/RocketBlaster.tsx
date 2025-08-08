"use client";

import React, { useEffect, useRef, useState } from "react";

type Vector2D = { x: number; y: number };

type Bullet = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  direction: Vector2D; // normalized
  homing?: boolean;
};

type Enemy = {
  position: Vector2D;
  width: number;
  height: number;
  velocity: Vector2D; // pixels/sec
  kind: "asteroid" | "ufo" | "bossUfo" | "bossGolem";
  rotation: number; // radians
  spin: number; // radians/sec
  hp: number;
  asteroidRadii: number[] | null; // for asteroid irregular polygon
};

type Rocket = {
  position: Vector2D; // top-left
  width: number;
  height: number;
  speed: number; // pixels/sec
};

type Particle = {
  position: Vector2D;
  velocity: Vector2D;
  life: number; // seconds lived
  maxLife: number; // seconds
  sizeStart: number;
  sizeEnd: number;
  colorStart: string;
  colorEnd: string;
  additive: boolean;
};

type PowerUpType = "spread" | "laser" | "homing" | "shield" | "slowmo" | "magnet";

type PowerUp = {
  position: Vector2D;
  radius: number;
  type: PowerUpType;
  ttl: number; // seconds before despawn
};

type ScoreOrb = {
  position: Vector2D;
  velocity: Vector2D;
  value: number;
};

type GravityWell = {
  position: Vector2D;
  radius: number;
  strength: number; // acceleration toward center
  drift: Vector2D; // slow movement
};

type Beam = {
  origin: Vector2D;
  direction: Vector2D; // normalized
  width: number; // pixels
  ttl: number; // seconds
};

// Environment themes for different maps
type EnvironmentTheme = {
  name: string;
  gradientInner: string;
  gradientOuter: string;
  nebulaColors: string[]; // rgba strings
  starColors: string[]; // hex or rgba
  starDensity: number; // approx stars count baseline
  planetPalette: string[]; // colors for planets
  ufoChance: number; // probability of spawning UFOs (0..1)
  enemySpeedMultiplier: number; // difficulty modifier per theme
};

const THEMES: EnvironmentTheme[] = [
  {
    name: "Blue Void",
    gradientInner: "#0b132b",
    gradientOuter: "#050814",
    nebulaColors: ["rgba(80,160,255,0.10)", "rgba(160,80,255,0.08)"],
    starColors: ["#c0d7ff", "#9ab6ff", "#7aa2f7"],
    starDensity: 120,
    planetPalette: ["#8bc1ff", "#6fb1ff", "#94a3b8", "#64748b"],
    ufoChance: 0.45,
    enemySpeedMultiplier: 1.0,
  },
  {
    name: "Ember Rift",
    gradientInner: "#1a0b0b",
    gradientOuter: "#0a0404",
    nebulaColors: ["rgba(255,120,60,0.10)", "rgba(255,200,120,0.07)"],
    starColors: ["#ffd9a8", "#ffc27a", "#ffad5e"],
    starDensity: 110,
    planetPalette: ["#ffac6b", "#ff8a4a", "#b45309", "#92400e"],
    ufoChance: 0.3,
    enemySpeedMultiplier: 1.1,
  },
  {
    name: "Emerald Drift",
    gradientInner: "#062014",
    gradientOuter: "#03110a",
    nebulaColors: ["rgba(60,200,140,0.10)", "rgba(120,255,200,0.06)"],
    starColors: ["#bdf0dd", "#9be9c8", "#86efac"],
    starDensity: 130,
    planetPalette: ["#34d399", "#10b981", "#047857", "#064e3b"],
    ufoChance: 0.5,
    enemySpeedMultiplier: 0.95,
  },
  {
    name: "Violet Nebula",
    gradientInner: "#1a0f2e",
    gradientOuter: "#0a0616",
    nebulaColors: ["rgba(160,120,255,0.10)", "rgba(255,120,220,0.06)"],
    starColors: ["#e9d5ff", "#c4b5fd", "#a78bfa"],
    starDensity: 140,
    planetPalette: ["#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9"],
    ufoChance: 0.55,
    enemySpeedMultiplier: 1.0,
  },
  {
    name: "Icy Expanse",
    gradientInner: "#0a1b24",
    gradientOuter: "#030c12",
    nebulaColors: ["rgba(120,220,255,0.10)", "rgba(80,180,255,0.06)"],
    starColors: ["#eef7ff", "#dbeafe", "#bfdbfe"],
    starDensity: 150,
    planetPalette: ["#93c5fd", "#7dd3fc", "#67e8f9", "#22d3ee"],
    ufoChance: 0.4,
    enemySpeedMultiplier: 0.9,
  },
];

// Helpers
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const length = (v: Vector2D) => Math.hypot(v.x, v.y);
const normalize = (v: Vector2D): Vector2D => {
  const len = length(v) || 1;
  return { x: v.x / len, y: v.y / len };
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mixColors(c1: string, c2: string, t: number): string {
  function parse(c: string) {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return { r: 255, g: 255, b: 255, a: 1 };
    const parts = m[1].split(",").map((p) => parseFloat(p));
    const [r, g, b, a] = [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] ?? 1];
    return { r, g, b, a };
  }
  const A = parse(c1);
  const B = parse(c2);
  const r = Math.round(lerp(A.r, B.r, t));
  const g = Math.round(lerp(A.g, B.g, t));
  const b = Math.round(lerp(A.b, B.b, t));
  const a = lerp(A.a, B.a, t);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function createRng(seed: number) {
  let s = Math.floor(seed * 1e9) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

export default function RocketBlaster() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const pressedKeysRef = useRef<Set<string>>(new Set());
  const aimPositionRef = useRef<Vector2D | null>(null);

  const [score, setScore] = useState<number>(0);
  const [mode, setMode] = useState<"menu" | "playing" | "gameover">("menu");

  const rocketRef = useRef<Rocket>({
    position: { x: 0, y: 0 },
    width: 48,
    height: 28,
    speed: 460,
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  const spawnAccumulatorRef = useRef<number>(0);
  const spawnIntervalRef = useRef<number>(900);
  const difficultyTimerRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);

  // New gameplay refs
  const powerUpsRef = useRef<PowerUp[]>([]);
  const scoreOrbsRef = useRef<ScoreOrb[]>([]);
  const wellsRef = useRef<GravityWell[]>([]);
  const beamsRef = useRef<Beam[]>([]);
  const powerupSpawnTimerRef = useRef<number>(0);
  const wellSpawnTimerRef = useRef<number>(0);
  const hideHUDRef = useRef<boolean>(false);

  // Boss and events
  const bossTimerRef = useRef<number>(0);
  const eventTimerRef = useRef<number>(0);
  const eventActiveRef = useRef<null | "meteor">(null);
  const eventTimeLeftRef = useRef<number>(0);
  const meteorSpawnAccRef = useRef<number>(0);

  // Player effects
  const hasShieldRef = useRef<boolean>(false);
  const shieldTimerRef = useRef<number>(0);
  const slowMoRef = useRef<number>(0); // seconds remaining
  const magnetRef = useRef<number>(0); // seconds remaining
  const homingRef = useRef<number>(0); // seconds remaining
  const spreadRef = useRef<number>(0); // seconds remaining
  const laserRef = useRef<number>(0); // seconds remaining

  // Combo/multiplier
  const multiplierRef = useRef<number>(1);
  const comboTimerRef = useRef<number>(0); // seconds since last kill

  // Toggles and effects
  const pauseRef = useRef<boolean>(false);
  const highContrastRef = useRef<boolean>(false);
  const reducedMotionRef = useRef<boolean>(false);
  const flashTimerRef = useRef<number>(0);

  // Environment rotation state
  const currentThemeIdxRef = useRef<number>(Math.floor(Math.random() * THEMES.length));
  const nextThemeIdxRef = useRef<number>((currentThemeIdxRef.current + 1) % THEMES.length);
  const themeBlendRef = useRef<number>(0); // 0..1 when transitioning
  const themeTimerRef = useRef<number>(0); // seconds since current theme started
  const themeDurationRef = useRef<number>(35); // seconds per map
  const themeTransitioningRef = useRef<boolean>(false);

  // Menu sections
  type MenuSection = "Controls" | "Power-ups" | "Scoring" | "Boss & Hazards" | "Maps";
  const menuSectionRef = useRef<MenuSection>("Controls");
  const menuHitRectsRef = useRef<Array<{ x: number; y: number; w: number; h: number; type: "section" | "start"; section?: MenuSection }>>([]);

  function pickNextThemeIndex(exclude: number): number {
    if (THEMES.length <= 1) return exclude;
    let idx = exclude;
    while (idx === exclude) {
      idx = Math.floor(Math.random() * THEMES.length);
    }
    return idx;
  }

  function getEffectiveThemeBlend() {
    const idxA = currentThemeIdxRef.current;
    const idxB = nextThemeIdxRef.current;
    const blend = themeTransitioningRef.current ? clamp(themeBlendRef.current, 0, 1) : 0;
    return { themeA: THEMES[idxA], themeB: THEMES[idxB], blend };
  }

  function resizeCanvasToContainer() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();

    const width = Math.max(360, Math.floor(rect.width));
    const height = Math.max(360, Math.floor(rect.height));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Place rocket at center initially
    const rocket = rocketRef.current;
    if (rocket.position.x === 0 && rocket.position.y === 0) {
      rocket.position.x = width / 2 - rocket.width / 2;
      rocket.position.y = height / 2 - rocket.height / 2;
    } else {
      rocket.position.x = clamp(rocket.position.x, 0, width - rocket.width);
      rocket.position.y = clamp(rocket.position.y, 0, height - rocket.height);
    }
  }

  function resetGame() {
    setScore(0);
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    spawnAccumulatorRef.current = 0;
    spawnIntervalRef.current = 900;
    difficultyTimerRef.current = 0;
    lastTimeRef.current = null;
    screenShakeRef.current = 0;
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      rocketRef.current.position.x = rect.width / 2 - rocketRef.current.width / 2;
      rocketRef.current.position.y = rect.height / 2 - rocketRef.current.height / 2;
    }
  }

  function startGame() {
    resetGame();
    setMode("playing");
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    pressedKeysRef.current.add(key);

    if (mode === "menu" && (key === "enter" || key === " ")) {
      e.preventDefault();
      startGame();
      return;
    }

    // toggles
    if (key === "p") {
      pauseRef.current = !pauseRef.current;
      return;
    }
    if (key === "h") {
      hideHUDRef.current = !hideHUDRef.current;
    }
    if (key === "m") {
      reducedMotionRef.current = !reducedMotionRef.current;
    }
    if (key === "c") {
      highContrastRef.current = !highContrastRef.current;
    }
    if (mode === "gameover" && (key === "r" || key === "enter")) {
      e.preventDefault();
      startGame();
      return;
    }
    if (mode === "playing" && (key === " " || key === "k")) {
      e.preventDefault();
      shootBullet();
    }

    // Manual map switch
    if (key === "q" || key === "e") {
      const dir = key === "e" ? 1 : -1;
      const len = THEMES.length;
      currentThemeIdxRef.current = (currentThemeIdxRef.current + dir + len) % len;
      nextThemeIdxRef.current = pickNextThemeIndex(currentThemeIdxRef.current);
      themeTransitioningRef.current = false;
      themeBlendRef.current = 0;
      themeTimerRef.current = 0;
    }
  }
  function handleKeyUp(e: KeyboardEvent) {
    pressedKeysRef.current.delete(e.key.toLowerCase());
  }
  function handleMouseMove(e: MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    aimPositionRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function handleMouseDown(e?: MouseEvent) {
    // If menu: handle button clicks
    if (mode === "menu") {
      if (e) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          for (const hit of menuHitRectsRef.current) {
            if (mx >= hit.x && mx <= hit.x + hit.w && my >= hit.y && my <= hit.y + hit.h) {
              if (hit.type === "start") {
                startGame();
                return;
              }
              if (hit.type === "section" && hit.section) {
                menuSectionRef.current = hit.section;
                return;
              }
            }
          }
        }
      }
      // fallback start if no specific button
      startGame();
      return;
    }
    if (mode === "gameover") {
      startGame();
      return;
    }
    if (mode === "playing") shootBullet();
  }

  function shootBullet() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rocket = rocketRef.current;

    // Compute direction from rocket center to aim
    const center: Vector2D = {
      x: rocket.position.x + rocket.width / 2,
      y: rocket.position.y + rocket.height / 2,
    };
    const aim = aimPositionRef.current ?? { x: center.x, y: center.y - 1 };
    const direction = normalize({ x: aim.x - center.x, y: aim.y - center.y });

    // Spawn from nose tip (front of rocket)
    const noseOffset = rocket.width * 0.52;
    const origin: Vector2D = {
      x: center.x + direction.x * noseOffset,
      y: center.y + direction.y * noseOffset,
    };

    if (laserRef.current > 0) {
      // fire beam instead of bullets
      beamsRef.current.push({ origin, direction: { ...direction }, width: 6, ttl: 0.12 });
      return;
    }

    const makeBullet = (dir: Vector2D) => {
      const b: Bullet = { x: origin.x, y: origin.y, radius: 3.2, speed: 1000, direction: dir };
      bulletsRef.current.push(b);
    };

    if (spreadRef.current > 0) {
      // 3-way spread
      const ang = Math.atan2(direction.y, direction.x);
      const off = 0.18;
      makeBullet({ x: Math.cos(ang - off), y: Math.sin(ang - off) });
      makeBullet(direction);
      makeBullet({ x: Math.cos(ang + off), y: Math.sin(ang + off) });
    } else {
      makeBullet(direction);
    }

    // muzzle flash particles at nose
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        position: { x: origin.x + direction.x * 4, y: origin.y + direction.y * 4 },
        velocity: {
          x: direction.x * (200 + Math.random() * 200) + (Math.random() - 0.5) * 80,
          y: direction.y * (200 + Math.random() * 200) + (Math.random() - 0.5) * 80,
        },
        life: 0,
        maxLife: 0.18 + Math.random() * 0.12,
        sizeStart: 4,
        sizeEnd: 0,
        colorStart: "rgba(255,210,120,0.9)",
        colorEnd: "rgba(255,120,40,0.0)",
        additive: true,
      });
    }
  }

  function rectCircleCollide(
    rectX: number,
    rectY: number,
    rectW: number,
    rectH: number,
    circleX: number,
    circleY: number,
    radius: number
  ): boolean {
    const closestX = clamp(circleX, rectX, rectX + rectW);
    const closestY = clamp(circleY, rectY, rectY + rectH);
    const dx = circleX - closestX;
    const dy = circleY - closestY;
    return dx * dx + dy * dy <= radius * radius;
  }
  function rectRectOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function spawnEnemy(width: number, height: number) {
    const { themeA, themeB, blend } = getEffectiveThemeBlend();
    const theme = blend > 0 ? themeB : themeA;

    const edge = Math.floor(Math.random() * 4); // 0=T,1=R,2=B,3=L
    let x = 0;
    let y = 0;

    if (edge === 0) {
      x = Math.random() * width;
      y = -20;
    } else if (edge === 1) {
      x = width + 20;
      y = Math.random() * height;
    } else if (edge === 2) {
      x = Math.random() * width;
      y = height + 20;
    } else {
      x = -20;
      y = Math.random() * height;
    }

    const kind: Enemy["kind"] = Math.random() < theme.ufoChance ? "ufo" : "asteroid";

    let enemyWidth = 40;
    let enemyHeight = 24;
    let hp = 2;
    let asteroidRadii: number[] | null = null;

    if (kind === "asteroid") {
      const base = 20 + Math.random() * 18; // radius-ish
      const segments = 10 + Math.floor(Math.random() * 5);
      asteroidRadii = new Array(segments).fill(0).map(() => base + (Math.random() * 10 - 5));
      enemyWidth = base * 2;
      enemyHeight = base * 2;
      hp = 2 + (Math.random() < 0.5 ? 1 : 0);
    } else {
      // UFO
      enemyWidth = 52 + Math.random() * 12;
      enemyHeight = 26 + Math.random() * 6;
      hp = 2;
    }

    const rocket = rocketRef.current;
    const target = {
      x: rocket.position.x + rocket.width / 2 + (Math.random() * 80 - 40),
      y: rocket.position.y + rocket.height / 2 + (Math.random() * 80 - 40),
    };
    const dir = normalize({ x: target.x - x, y: target.y - y });
    const speed = (90 + Math.random() * 140) * theme.enemySpeedMultiplier;

    enemiesRef.current.push({
      position: { x: x - enemyWidth / 2, y: y - enemyHeight / 2 },
      width: enemyWidth,
      height: enemyHeight,
      velocity: { x: dir.x * speed, y: dir.y * speed },
      kind,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.6,
      hp,
      asteroidRadii,
    });
  }

  function createExplosion(x: number, y: number, kind: Enemy["kind"]) {
    const count = kind === "asteroid" ? 30 : 24;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 240;
      const vel = { x: Math.cos(ang) * spd, y: Math.sin(ang) * spd };
      const life = 0.5 + Math.random() * 0.4;
      if (kind === "asteroid") {
        particlesRef.current.push({
          position: { x, y },
          velocity: { x: vel.x * 0.8, y: vel.y * 0.8 },
          life: 0,
          maxLife: life,
          sizeStart: 4 + Math.random() * 3,
          sizeEnd: 0,
          colorStart: "rgba(255,185,90,0.95)",
          colorEnd: "rgba(255,80,30,0.0)",
          additive: true,
        });
        particlesRef.current.push({
          position: { x, y },
          velocity: { x: vel.x * 0.3, y: vel.y * 0.3 },
          life: 0,
          maxLife: life + 0.2,
          sizeStart: 2 + Math.random() * 2,
          sizeEnd: 0,
          colorStart: "rgba(200,200,200,0.9)",
          colorEnd: "rgba(180,180,180,0.0)",
          additive: false,
        });
      } else {
        // UFO: cool colors
        particlesRef.current.push({
          position: { x, y },
          velocity: { x: vel.x, y: vel.y },
          life: 0,
          maxLife: life,
          sizeStart: 3.5 + Math.random() * 2.5,
          sizeEnd: 0,
          colorStart: "rgba(140,220,255,0.95)",
          colorEnd: "rgba(80,160,255,0.0)",
          additive: true,
        });
      }
    }
    screenShakeRef.current = Math.max(screenShakeRef.current, 6);
  }

  function onEnemyDestroyed(enemy: Enemy) {
    const cx = enemy.position.x + enemy.width / 2;
    const cy = enemy.position.y + enemy.height / 2;
    // score with combo
    setScore((s) => s + Math.max(1, Math.floor(multiplierRef.current)));
    multiplierRef.current = Math.min(5, multiplierRef.current + 0.2);
    comboTimerRef.current = 0;
    // score orbs
    const orbs = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < orbs; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 120;
      scoreOrbsRef.current.push({ position: { x: cx, y: cy }, velocity: { x: Math.cos(ang) * spd, y: Math.sin(ang) * spd }, value: 1 });
    }
    createExplosion(cx, cy, enemy.kind);
  }

  function spawnThruster(dt: number) {
    const rocket = rocketRef.current;
    const center: Vector2D = { x: rocket.position.x + rocket.width / 2, y: rocket.position.y + rocket.height / 2 };

    // Determine movement vector from keys
    const pressed = pressedKeysRef.current;
    const left = pressed.has("arrowleft") || pressed.has("a");
    const right = pressed.has("arrowright") || pressed.has("d");
    const up = pressed.has("arrowup") || pressed.has("w");
    const down = pressed.has("arrowdown") || pressed.has("s");
    let mv = { x: 0, y: 0 };
    if (left && !right) mv.x = -1;
    else if (right && !left) mv.x = 1;
    if (up && !down) mv.y = -1;
    else if (down && !up) mv.y = 1;
    const moving = mv.x !== 0 || mv.y !== 0;
    const dir = moving ? normalize(mv) : { x: 0, y: 1 };

    const rate = moving ? 90 : 45; // particles/sec
    const count = Math.floor(rate * dt);
    for (let i = 0; i < count; i++) {
      const jitter = (Math.random() - 0.5) * 0.6;
      const back = { x: center.x - dir.x * (rocket.width * 0.6), y: center.y - dir.y * (rocket.height * 0.6) };
      particlesRef.current.push({
        position: { x: back.x + -dir.y * (Math.random() * 6 - 3), y: back.y + dir.x * (Math.random() * 6 - 3) },
        velocity: { x: -dir.x * (120 + Math.random() * 120) + jitter * 40, y: -dir.y * (120 + Math.random() * 120) + jitter * 40 },
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        sizeStart: 3 + Math.random() * 2,
        sizeEnd: 0,
        colorStart: "rgba(255,220,140,0.9)",
        colorEnd: "rgba(255,120,40,0.0)",
        additive: true,
      });
    }
  }

  function update(dt: number, width: number, height: number) {
    if (mode !== "playing") return;
    if (pauseRef.current) return;

    const rocket = rocketRef.current;

    // Input
    const pressed = pressedKeysRef.current;
    const left = pressed.has("arrowleft") || pressed.has("a");
    const right = pressed.has("arrowright") || pressed.has("d");
    const up = pressed.has("arrowup") || pressed.has("w");
    const down = pressed.has("arrowdown") || pressed.has("s");

    let moveX = 0;
    let moveY = 0;
    if (left && !right) moveX = -1;
    else if (right && !left) moveX = 1;
    if (up && !down) moveY = -1;
    else if (down && !up) moveY = 1;

    if (moveX !== 0 || moveY !== 0) {
      const n = normalize({ x: moveX, y: moveY });
      rocket.position.x += n.x * rocket.speed * dt;
      rocket.position.y += n.y * rocket.speed * dt;
    }

    rocket.position.x = clamp(rocket.position.x, 0, width - rocket.width);
    rocket.position.y = clamp(rocket.position.y, 0, height - rocket.height);

    // Theme rotation
    themeTimerRef.current += dt;
    if (!themeTransitioningRef.current && themeTimerRef.current > themeDurationRef.current) {
      themeTransitioningRef.current = true;
      themeBlendRef.current = 0;
      themeTimerRef.current = 0;
      nextThemeIdxRef.current = pickNextThemeIndex(currentThemeIdxRef.current);
    }
    if (themeTransitioningRef.current) {
      themeBlendRef.current += dt / 4; // 4s crossfade
      if (themeBlendRef.current >= 1) {
        themeBlendRef.current = 0;
        themeTransitioningRef.current = false;
        currentThemeIdxRef.current = nextThemeIdxRef.current;
        nextThemeIdxRef.current = pickNextThemeIndex(currentThemeIdxRef.current);
      }
    }

    // Combo decay
    comboTimerRef.current += dt;
    if (comboTimerRef.current > 2.5) {
      multiplierRef.current = Math.max(1, multiplierRef.current - dt * 0.4);
    }

    // Difficulty
    difficultyTimerRef.current += dt * 1000;
    if (difficultyTimerRef.current > 5000) {
      difficultyTimerRef.current = 0;
      spawnIntervalRef.current = Math.max(220, spawnIntervalRef.current - 40);
    }

    // Spawning
    spawnAccumulatorRef.current += dt * 1000;
    // If a boss is active, reduce normal spawns
    const bossAlive = enemiesRef.current.some((e) => e.kind === "bossUfo" || e.kind === "bossGolem");
    const spawnStep = bossAlive ? spawnIntervalRef.current * 1.8 : spawnIntervalRef.current;
    while (spawnAccumulatorRef.current >= spawnStep) {
      spawnAccumulatorRef.current -= spawnStep;
      if (!bossAlive) spawnEnemy(width, height);
    }

    // Boss waves
    bossTimerRef.current += dt;
    if (!bossAlive && bossTimerRef.current > 45) {
      bossTimerRef.current = 0;
      const bossKind: Enemy["kind"] = Math.random() < 0.5 ? "bossUfo" : "bossGolem";
      if (bossKind === "bossUfo") {
        enemiesRef.current.push({
          position: { x: width / 2 - 120, y: -100 },
          width: 240,
          height: 120,
          velocity: { x: (Math.random() - 0.5) * 30, y: 40 },
          kind: "bossUfo",
          rotation: 0,
          spin: 0.2,
          hp: 50,
          asteroidRadii: null,
        });
      } else {
        const base = 80;
        const segments = 14;
        const radii = new Array(segments).fill(0).map(() => base + (Math.random() * 24 - 12));
        enemiesRef.current.push({
          position: { x: Math.random() * (width - base * 2), y: -base * 2 },
          width: base * 2,
          height: base * 2,
          velocity: { x: (Math.random() - 0.5) * 20, y: 35 },
          kind: "bossGolem",
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.6,
          hp: 60,
          asteroidRadii: radii,
        });
      }
    }

    // Environmental events: meteor shower
    eventTimerRef.current += dt;
    if (!eventActiveRef.current && eventTimerRef.current > 25) {
      eventActiveRef.current = "meteor";
      eventTimeLeftRef.current = 8; // seconds
      eventTimerRef.current = 0;
      meteorSpawnAccRef.current = 0;
    }
    if (eventActiveRef.current === "meteor") {
      eventTimeLeftRef.current -= dt;
      meteorSpawnAccRef.current += dt * 1000;
      const meteorInterval = 180; // ms per meteor
      while (meteorSpawnAccRef.current > meteorInterval) {
        meteorSpawnAccRef.current -= meteorInterval;
        // fast small asteroids from random top positions
        const w = 18 + Math.random() * 10;
        const h = 14 + Math.random() * 8;
        const x = Math.random() * width;
        enemiesRef.current.push({
          position: { x, y: -h - 10 },
          width: w,
          height: h,
          velocity: { x: (Math.random() - 0.5) * 80, y: 260 + Math.random() * 80 },
          kind: "asteroid",
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 2.0,
          hp: 1,
          asteroidRadii: [w / 2, w / 2.4, w / 2.1, w / 2.6, w / 2.2, w / 2.5],
        });
      }
      if (eventTimeLeftRef.current <= 0) {
        eventActiveRef.current = null;
      }
    }

    // Update wells (gravity effects)
    for (const w of wellsRef.current) {
      w.position.x += w.drift.x * dt;
      w.position.y += w.drift.y * dt;
    }

    // Slow-mo effect scale for movement
    const effectiveDt = slowMoRef.current > 0 ? dt * 0.6 : dt;
    if (slowMoRef.current > 0) slowMoRef.current -= dt;

    // Update enemies
    for (const enemy of enemiesRef.current) {
      enemy.position.x += enemy.velocity.x * effectiveDt;
      enemy.position.y += enemy.velocity.y * effectiveDt;
      enemy.rotation += enemy.spin * effectiveDt;
      // gravity influence
      for (const w of wellsRef.current) {
        const to = { x: w.position.x - (enemy.position.x + enemy.width / 2), y: w.position.y - (enemy.position.y + enemy.height / 2) };
        const d = Math.hypot(to.x, to.y) || 1;
        if (d < w.radius) {
          const n = { x: to.x / d, y: to.y / d };
          const pull = (1 - d / w.radius) * w.strength;
          enemy.velocity.x += n.x * pull * effectiveDt;
          enemy.velocity.y += n.y * pull * effectiveDt;
        }
      }
    }

    // Update bullets (with optional homing)
    for (const bullet of bulletsRef.current) {
      if (homingRef.current > 0 && !bullet.homing) {
        // some bullets become homing when effect is active
        bullet.homing = Math.random() < 0.5;
      }
      if (bullet.homing) {
        // steer toward nearest enemy
        let best: Enemy | null = null;
        let bestDist = Infinity;
        for (const e of enemiesRef.current) {
          const ex = e.position.x + e.width / 2;
          const ey = e.position.y + e.height / 2;
          const d = (ex - bullet.x) * (ex - bullet.x) + (ey - bullet.y) * (ey - bullet.y);
          if (d < bestDist) {
            bestDist = d;
            best = e;
          }
        }
        if (best) {
          const ex = best.position.x + best.width / 2;
          const ey = best.position.y + best.height / 2;
          const desired = normalize({ x: ex - bullet.x, y: ey - bullet.y });
          // steer by small factor
          bullet.direction.x = lerp(bullet.direction.x, desired.x, 0.08);
          bullet.direction.y = lerp(bullet.direction.y, desired.y, 0.08);
          // renormalize
          const L = Math.hypot(bullet.direction.x, bullet.direction.y) || 1;
          bullet.direction.x /= L;
          bullet.direction.y /= L;
        }
      }
      bullet.x += bullet.direction.x * effectiveDt * bullet.speed;
      bullet.y += bullet.direction.y * effectiveDt * bullet.speed;
    }

    // Beams TTL and damage
    const remainingBeams: Beam[] = [];
    for (const b of beamsRef.current) {
      b.ttl -= dt;
      if (b.ttl > 0) remainingBeams.push(b);
      // damage application
      const nx = -b.direction.y;
      const ny = b.direction.x;
      const half = b.width / 2 + 2;
      for (const e of enemiesRef.current) {
        const ex = e.position.x + e.width / 2;
        const ey = e.position.y + e.height / 2;
        const to = { x: ex - b.origin.x, y: ey - b.origin.y };
        const distSide = Math.abs(to.x * nx + to.y * ny);
        const along = to.x * b.direction.x + to.y * b.direction.y;
        if (distSide < half && along > -20) {
          e.hp -= 0.8; // more damage than draw check
        }
      }
    }
    beamsRef.current = remainingBeams;

    // Collisions bullets vs enemies
    const remainingEnemies: Enemy[] = [];
    const remainingBullets: Bullet[] = [];

    for (const enemy of enemiesRef.current) {
      let isDestroyed = false;
      for (let i = 0; i < bulletsRef.current.length; i++) {
        const bullet = bulletsRef.current[i];
        if (
          rectCircleCollide(
            enemy.position.x,
            enemy.position.y,
            enemy.width,
            enemy.height,
            bullet.x,
            bullet.y,
            bullet.radius
          )
        ) {
          // impact
          bulletsRef.current.splice(i, 1);
          i--;
          enemy.hp -= 1;
          particlesRef.current.push({
            position: { x: bullet.x, y: bullet.y },
            velocity: { x: (Math.random() - 0.5) * 120, y: (Math.random() - 0.5) * 120 },
            life: 0,
            maxLife: 0.25,
            sizeStart: 3,
            sizeEnd: 0,
            colorStart: "rgba(255,200,120,0.9)",
            colorEnd: "rgba(255,100,30,0.0)",
            additive: true,
          });
          if (enemy.hp <= 0) {
            isDestroyed = true;
            onEnemyDestroyed(enemy);
            break;
          }
        }
      }
      if (!isDestroyed) remainingEnemies.push(enemy);
    }

    // Keep on-screen bullets
    for (const bullet of bulletsRef.current) {
      if (
        bullet.x + bullet.radius >= 0 &&
        bullet.x - bullet.radius <= width &&
        bullet.y + bullet.radius >= 0 &&
        bullet.y - bullet.radius <= height
      ) {
        remainingBullets.push(bullet);
      }
    }

    enemiesRef.current = remainingEnemies.filter((e) =>
      e.position.x + e.width >= -80 &&
      e.position.x <= width + 80 &&
      e.position.y + e.height >= -80 &&
      e.position.y <= height + 80
    );
    bulletsRef.current = remainingBullets;

    // Score orbs (magnet)
    const remainingOrbs: ScoreOrb[] = [];
    for (const orb of scoreOrbsRef.current) {
      if (magnetRef.current > 0) {
        const cx = rocket.position.x + rocket.width / 2;
        const cy = rocket.position.y + rocket.height / 2;
        const dir = normalize({ x: cx - orb.position.x, y: cy - orb.position.y });
        orb.velocity.x = lerp(orb.velocity.x, dir.x * 220, 0.08);
        orb.velocity.y = lerp(orb.velocity.y, dir.y * 220, 0.08);
      }
      orb.position.x += orb.velocity.x * effectiveDt;
      orb.position.y += orb.velocity.y * effectiveDt;
      const dx = orb.position.x - (rocket.position.x + rocket.width / 2);
      const dy = orb.position.y - (rocket.position.y + rocket.height / 2);
      if (dx * dx + dy * dy < 26 * 26) {
        setScore((s) => s + orb.value);
      } else {
        remainingOrbs.push(orb);
      }
    }
    scoreOrbsRef.current = remainingOrbs;

    // Power-up TTL and collection
    const remainingPups: PowerUp[] = [];
    for (const p of powerUpsRef.current) {
      p.ttl -= dt;
      const dx = p.position.x - (rocket.position.x + rocket.width / 2);
      const dy = p.position.y - (rocket.position.y + rocket.height / 2);
      const r = p.radius + Math.max(rocket.width, rocket.height) * 0.25;
      if (dx * dx + dy * dy < r * r) {
        // collect
        if (p.type === "shield") {
          hasShieldRef.current = true;
          shieldTimerRef.current = 8;
        } else if (p.type === "slowmo") {
          slowMoRef.current = 6;
        } else if (p.type === "magnet") {
          magnetRef.current = 10;
        } else if (p.type === "homing") {
          homingRef.current = 10;
        } else if (p.type === "spread") {
          spreadRef.current = 10;
        } else if (p.type === "laser") {
          laserRef.current = 6;
        }
      } else if (p.ttl > 0) {
        remainingPups.push(p);
      }
    }
    powerUpsRef.current = remainingPups;

    // Decrement timers
    if (shieldTimerRef.current > 0) {
      shieldTimerRef.current -= dt;
      if (shieldTimerRef.current <= 0) hasShieldRef.current = false;
    }
    if (magnetRef.current > 0) magnetRef.current -= dt;
    if (homingRef.current > 0) homingRef.current -= dt;
    if (spreadRef.current > 0) spreadRef.current -= dt;
    if (laserRef.current > 0) laserRef.current -= dt;

    // Particles
    const remainingParticles: Particle[] = [];
    for (const p of particlesRef.current) {
      p.life += dt;
      p.position.x += p.velocity.x * effectiveDt;
      p.position.y += p.velocity.y * effectiveDt;
      p.velocity.x *= 0.98;
      p.velocity.y *= 0.98;
      if (p.life <= p.maxLife) remainingParticles.push(p);
    }
    particlesRef.current = remainingParticles;

    // Thruster
    spawnThruster(dt);

    // Screen shake decay
    if (screenShakeRef.current > 0) screenShakeRef.current *= 0.9;

    // Game over with shield check
    const survivors: Enemy[] = [];
    for (const enemy of enemiesRef.current) {
      if (
        rectRectOverlap(
          rocket.position.x,
          rocket.position.y,
          rocket.width,
          rocket.height,
          enemy.position.x,
          enemy.position.y,
          enemy.width,
          enemy.height
        )
      ) {
        if (hasShieldRef.current) {
          hasShieldRef.current = false;
          shieldTimerRef.current = 0;
          onEnemyDestroyed(enemy);
          continue; // do not add this enemy
        } else {
          setMode("gameover");
          break;
        }
      }
      survivors.push(enemy);
    }
    enemiesRef.current = survivors;
  }

  function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const { themeA, themeB, blend } = getEffectiveThemeBlend();
    const pick = <T,>(a: T, b: T): T => (blend > 0 ? b : a);

    // Gradient background
    const gradA = ctx.createRadialGradient(width * 0.7, height * 0.3, 20, width * 0.5, height * 0.5, Math.max(width, height));
    gradA.addColorStop(0, themeA.gradientInner);
    gradA.addColorStop(1, themeA.gradientOuter);
    const gradB = ctx.createRadialGradient(width * 0.7, height * 0.3, 20, width * 0.5, height * 0.5, Math.max(width, height));
    gradB.addColorStop(0, themeB.gradientInner);
    gradB.addColorStop(1, themeB.gradientOuter);

    // High-contrast tweaks
    if (highContrastRef.current) {
      // brighten inner
      gradA.addColorStop(0.2, "rgba(255,255,255,0.02)");
      gradB.addColorStop(0.2, "rgba(255,255,255,0.02)");
    }

    // Paint A then overlay B with blend alpha
    ctx.fillStyle = gradA;
    ctx.fillRect(0, 0, width, height);
    if (blend > 0) {
      ctx.save();
      ctx.globalAlpha = blend;
      ctx.fillStyle = gradB;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Soft nebulas from both themes
    const nebulaCount = reducedMotionRef.current ? 1 : 3;
    for (let i = 0; i < nebulaCount; i++) {
      const gx = (i * 97) % width;
      const baseY = (i * 173) % height;
      const tY = reducedMotionRef.current ? baseY : (baseY + (Date.now() / 120) % height) % height;
      const colA = themeA.nebulaColors[i % themeA.nebulaColors.length];
      const colB = themeB.nebulaColors[i % themeB.nebulaColors.length];
      const col = blend > 0 ? mixColors(colA, colB, blend) : colA;
      const g = ctx.createRadialGradient(gx, tY, 0, gx, tY, 200);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, tY, 200, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stars with theme colors and density blending
    const density = Math.round(lerp(themeA.starDensity, themeB.starDensity, blend)) * (highContrastRef.current ? 1.2 : 1);
    ctx.save();
    ctx.globalAlpha = highContrastRef.current ? 0.6 : 0.45;
    for (let i = 0; i < density; i++) {
      const x = (i * 97) % width;
      const baseY = (i * 173) % height;
      const y = reducedMotionRef.current ? baseY : ((baseY + (Date.now() / 40) % height) % height);
      const ca = themeA.starColors[i % themeA.starColors.length];
      const cb = themeB.starColors[i % themeB.starColors.length];
      const c = blend > 0 ? (ca.startsWith("#") || cb.startsWith("#") ? (blend < 0.5 ? ca : cb) : mixColors(ca, cb, blend)) : ca;
      ctx.fillStyle = c;
      const s = i % 17 === 0 ? 2 : 1;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();

    // Planets
    const planetCount = reducedMotionRef.current ? 1 : 2;
    for (let i = 0; i < planetCount; i++) {
      const px = ((i * 331) % width + width * 0.2) % width;
      const basePy = ((i * 271) % height + height * 0.2);
      const py = reducedMotionRef.current ? basePy : (basePy + (Date.now() / 4000) % height) % height;
      const ca = themeA.planetPalette[i % themeA.planetPalette.length];
      const cb = themeB.planetPalette[i % themeB.planetPalette.length];
      const c = blend > 0 ? (blend < 0.5 ? ca : cb) : ca;
      const r = 28 + (i * 9) % 18;
      const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
      g.addColorStop(0, c);
      g.addColorStop(1, "rgba(0,0,0,0.1)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRocket(ctx: CanvasRenderingContext2D) {
    const rocket = rocketRef.current;
    const x = rocket.position.x;
    const y = rocket.position.y;
    const w = rocket.width;
    const h = rocket.height;
    const cx = x + w / 2;
    const cy = y + h / 2;

    const aim = aimPositionRef.current ?? { x: cx, y: cy - 1 };
    const dir = normalize({ x: aim.x - cx, y: aim.y - cy });
    const angle = Math.atan2(dir.y, dir.x);

    // soft shadow beneath
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.filter = "blur(6px)";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.ellipse(cx - dir.x * 6, cy - dir.y * 6, w * 0.55, h * 0.55, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // fuselage body
    const bodyGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    bodyGrad.addColorStop(0, "#f1f5f9");
    bodyGrad.addColorStop(0.5, "#c9d2dc");
    bodyGrad.addColorStop(1, "#9aa7b5");
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 7);
    ctx.fill();
    ctx.stroke();

    // rear fins (top and bottom, mirrored)
    const finGrad = ctx.createLinearGradient(-w / 2, 0, -w / 2 + w * 0.25, 0);
    finGrad.addColorStop(0, "#7c8696");
    finGrad.addColorStop(1, "#b6c0cc");
    ctx.fillStyle = finGrad;
    // top fin
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 2, -h / 2 + 4);
    ctx.lineTo(-w / 2 - h * 0.6, 0);
    ctx.lineTo(-w / 2 + 2, h / 2 - 4);
    ctx.closePath();
    ctx.fill();
    // bottom fin (mirror)
    ctx.save();
    ctx.scale(1, -1);
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 2, -h / 2 + 4);
    ctx.lineTo(-w / 2 - h * 0.6, 0);
    ctx.lineTo(-w / 2 + 2, h / 2 - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // engine nozzle
    const nozzleW = h * 0.55;
    const nozzleH = h * 0.4;
    const nozGrad = ctx.createLinearGradient(-w / 2 - nozzleW * 0.2, 0, -w / 2 + nozzleW * 0.5, 0);
    nozGrad.addColorStop(0, "#3b3f46");
    nozGrad.addColorStop(1, "#69707a");
    ctx.fillStyle = nozGrad;
    ctx.beginPath();
    ctx.ellipse(-w / 2 - nozzleW * 0.2, 0, nozzleW * 0.55, nozzleH * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // engine glow
    const glow = ctx.createRadialGradient(-w / 2 - nozzleW * 0.4, 0, 0, -w / 2 - nozzleW * 0.4, 0, nozzleW * 0.9);
    const flicker = 0.85 + Math.sin(Date.now() / 80) / 10;
    glow.addColorStop(0, `rgba(255,230,160,${0.7 * flicker})`);
    glow.addColorStop(1, "rgba(255,140,40,0.0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(-w / 2 - nozzleW * 0.35, 0, nozzleW * 0.9, nozzleW * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // panel lines
    ctx.strokeStyle = "rgba(15,23,42,0.4)";
    ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const yy = (i / 5) * h;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 6, yy);
      ctx.lineTo(w / 2 - 6, yy);
      ctx.stroke();
    }
    // rivets
    ctx.fillStyle = "rgba(15,23,42,0.55)";
    for (let i = 0; i < 6; i++) {
      const t = (i + 1) / 7;
      ctx.beginPath();
      ctx.arc(lerp(-w / 2 + 8, w / 2 - 8, t), -h * 0.28, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lerp(-w / 2 + 8, w / 2 - 8, t), h * 0.28, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // top rim highlight
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, -h / 2 + 3);
    ctx.lineTo(w / 2 - 8, -h / 2 + 3);
    ctx.stroke();

    // canopy
    const canopyGrad = ctx.createRadialGradient(w * 0.05, -h * 0.15, 2, w * 0.08, -h * 0.1, h * 0.6);
    canopyGrad.addColorStop(0, "rgba(150,210,255,0.95)");
    canopyGrad.addColorStop(1, "rgba(150,210,255,0.1)");
    ctx.fillStyle = canopyGrad;
    ctx.beginPath();
    ctx.ellipse(w * 0.1, -h * 0.1, w * 0.18, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // canopy glint
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w * 0.06, -h * 0.16, h * 0.18, -0.8, 0.2);
    ctx.stroke();

    // nose tip light
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(200,230,255,0.8)";
    ctx.beginPath();
    ctx.arc(w * 0.52, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // Minimalist black-and-white logo (canvas-drawn)
  function drawLogo(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number) {
    ctx.save();

    // Orbit ring
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, size, size * 0.55, 0.2, 0, Math.PI * 2);
    ctx.stroke();

    // Rocket (simple capsule + fins)
    const r = size * 0.52;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - r * 1.2);
    ctx.quadraticCurveTo(centerX + r * 0.6, centerY - r * 0.2, centerX + r * 0.4, centerY + r * 0.8);
    ctx.lineTo(centerX, centerY + r * 0.5);
    ctx.lineTo(centerX - r * 0.4, centerY + r * 0.8);
    ctx.quadraticCurveTo(centerX - r * 0.6, centerY - r * 0.2, centerX, centerY - r * 1.2);
    ctx.closePath();
    ctx.fill();

    // Window
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(centerX, centerY - r * 0.2, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Small star
    ctx.fillStyle = "#ffffff";
    const sx = centerX + size * 0.95;
    const sy = centerY - size * 0.9;
    const s = Math.max(1, size * 0.12);
    ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    ctx.fillRect(sx - s * 1.5, sy - s / 6, s * 3, s / 3);
    ctx.fillRect(sx - s / 6, sy - s * 1.5, s / 3, s * 3);

    ctx.restore();
  }

  function drawAsteroid(ctx: CanvasRenderingContext2D, e: Enemy) {
    if (!e.asteroidRadii) return;
    const cx = e.position.x + e.width / 2;
    const cy = e.position.y + e.height / 2;
    const radii = e.asteroidRadii;
    const n = radii.length;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(e.rotation);

    // fill
    const fillGrad = ctx.createRadialGradient(0, 0, 4, -4, -4, Math.max(e.width, e.height) * 0.6);
    fillGrad.addColorStop(0, "#9aa0a6");
    fillGrad.addColorStop(1, "#6b7280");
    ctx.fillStyle = fillGrad;
    ctx.strokeStyle = "#3f4550";
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const r = radii[i];
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawUfo(ctx: CanvasRenderingContext2D, e: Enemy) {
    const x = e.position.x;
    const y = e.position.y;
    const w = e.width;
    const h = e.height;
    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(e.rotation * 0.1);

    // base disk
    const baseGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    baseGrad.addColorStop(0, "#94a3b8");
    baseGrad.addColorStop(1, "#64748b");
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.45, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // lights
    ctx.fillStyle = "#9ae6b4";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc((i * w) / 10, h * 0.1, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // dome
    const domeGrad = ctx.createRadialGradient(-4, -h * 0.4, 2, -2, -h * 0.3, h * 0.6);
    domeGrad.addColorStop(0, "rgba(160,220,255,0.95)");
    domeGrad.addColorStop(1, "rgba(160,220,255,0.1)");
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.2, w * 0.25, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBoss(ctx: CanvasRenderingContext2D, e: Enemy) {
    if (e.kind === "bossUfo") {
      // reuse ufo but beefier and with glow ring
      drawUfo(ctx, e);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(140,220,255,0.35)";
      ctx.lineWidth = 8;
      const cx = e.position.x + e.width / 2;
      const cy = e.position.y + e.height / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, e.width * 0.45, e.height * 0.48, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (e.kind === "bossGolem") {
      // giant shaded asteroid
      drawAsteroid(ctx, e);
    }
  }

  function drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of particlesRef.current) {
      const t = clamp(p.life / p.maxLife, 0, 1);
      const size = lerp(p.sizeStart, p.sizeEnd, t);
      const color = mixColors(p.colorStart, p.colorEnd, t);
      if (p.additive) {
        ctx.save();
        const prevOp = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.position.x, p.position.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = prevOp;
        ctx.restore();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.position.x, p.position.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    drawBackground(ctx, width, height);

    // Screen shake
    const shake = screenShakeRef.current;
    if (shake > 0.1) {
      const dx = (Math.random() * 2 - 1) * shake;
      const dy = (Math.random() * 2 - 1) * shake;
      ctx.save();
      ctx.translate(dx, dy);

      drawWorld(ctx, width, height);
      ctx.restore();
    } else {
      drawWorld(ctx, width, height);
    }

    // HUD
    if (!hideHUDRef.current) {
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "bold 16px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`Score: ${score}`, 12, 22);
      ctx.fillText(`x${multiplierRef.current.toFixed(1)}`, 12, 42);

      // Active effects badges
      ctx.font = "12px ui-sans-serif";
      let y = 64;
      const badge = (label: string) => {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(10, y - 12, ctx.measureText(label).width + 10, 16);
        ctx.fillStyle = "#e5e7eb";
        ctx.fillText(label, 14, y);
        y += 18;
      };
      if (shieldTimerRef.current > 0) badge(`Shield ${shieldTimerRef.current.toFixed(0)}s`);
      if (magnetRef.current > 0) badge(`Magnet ${magnetRef.current.toFixed(0)}s`);
      if (homingRef.current > 0) badge(`Homing ${homingRef.current.toFixed(0)}s`);
      if (spreadRef.current > 0) badge(`Spread ${spreadRef.current.toFixed(0)}s`);
      if (laserRef.current > 0) badge(`Laser ${laserRef.current.toFixed(0)}s`);
      if (slowMoRef.current > 0) badge(`Slow-mo ${slowMoRef.current.toFixed(0)}s`);
    }

    if (mode === "menu") {
      const { themeA } = getEffectiveThemeBlend();

      // Layout
      const panelW = Math.min(780, width - 96);
      const panelH = Math.min(480, height - 200);
      const px = (width - panelW) / 2;
      const py = (height - panelH) / 2;
      const pad = 24;

      // Backdrop (monochrome)
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, width, height);

      // Panel (no shadows/gradients)
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(px, py, panelW, panelH, 14);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Title (centered)
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 36px ui-sans-serif, system-ui, -apple-system";
      // Logo above title
      drawLogo(ctx, px + panelW / 2, py + 32, 14);
      ctx.fillText("Rocket Blaster", px + panelW / 2, py + 60);

      // Map pill (top right of panel) - outlined
      const pill = `Map: ${themeA.name}`;
      ctx.font = "12px ui-sans-serif";
      const pillW = ctx.measureText(pill).width + 16;
      const pillX = px + panelW - pad - pillW;
      const pillY = py + 18;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, 22, 11);
      ctx.stroke();
      ctx.fillStyle = "#e5e5e5";
      ctx.fillText(pill, pillX + pillW / 2, pillY + 15);
      ctx.restore();

      // Content + tabs (monochrome)
      ctx.save();
      menuHitRectsRef.current = [];

      // Tabs
      const tabs: MenuSection[] = ["Controls", "Power-ups", "Scoring", "Boss & Hazards", "Maps"];
      ctx.textAlign = "left";
      ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system";
      let tx = px + pad;
      const ty = py + 82;
      for (const t of tabs) {
        const label = t;
        const tw = Math.max(80, ctx.measureText(label).width + 22);
        const th = 28;
        const active = menuSectionRef.current === t;
        ctx.strokeStyle = active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)";
        ctx.lineWidth = active ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 7);
        ctx.stroke();
        ctx.fillStyle = active ? "#ffffff" : "#e5e5e5";
        ctx.textAlign = "center";
        ctx.fillText(label, tx + tw / 2, ty + 19);
        // hit
        menuHitRectsRef.current.push({ x: tx, y: ty, w: tw, h: th, type: "section", section: t });
        tx += tw + 8;
      }

      // Selected section content
      ctx.textAlign = "left";
      let y = py + 128;
      const x = px + pad;
      const rule = () => {
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(px + panelW - pad, y);
        ctx.stroke();
        y += 12;
      };
      const header = (label: string) => {
        ctx.fillStyle = "#ffffff";
        ctx.font = "600 15px ui-sans-serif, system-ui, -apple-system";
        ctx.fillText(label, x, y);
        y += 8;
        rule();
        ctx.fillStyle = "#e5e5e5";
        ctx.font = "14px ui-sans-serif, system-ui, -apple-system";
      };
      const bullet = (text: string) => {
        ctx.fillText(`- ${text}`, x, y);
        y += 18;
      };

      const sec = menuSectionRef.current;
      if (sec === "Controls") {
        header("Controls");
        bullet("Move: WASD/Arrows • Aim: Mouse • Shoot: Space/Click");
        bullet("Start: Enter/Click • Pause: P • HUD: H");
        bullet("Reduced Motion: M • High Contrast: C • Switch Map: Q/E");
      } else if (sec === "Power-ups") {
        header("Power-ups");
        bullet("Spread • Laser • Homing • Shield • Slow-mo • Magnet");
      } else if (sec === "Scoring") {
        header("Scoring");
        bullet("Combo multiplier grows with chained kills");
        bullet("Collect score orbs; magnet attracts them");
      } else if (sec === "Boss & Hazards") {
        header("Boss & Hazards");
        bullet("Boss waves (UFO mothership, asteroid golem)");
        bullet("Hazards: Gravity wells • Meteor showers");
      } else if (sec === "Maps") {
        header("Maps");
        bullet("Auto-rotate every ~35s with crossfade");
        bullet("Manual switch: Q/E");
      }

      // Start button (outlined, minimal)
      const btnText = "Enter or Click to Start";
      ctx.font = "600 15px ui-sans-serif, system-ui, -apple-system";
      const btnW = Math.max(220, ctx.measureText(btnText).width + 24);
      const btnH = 36;
      const btnX = px + panelW / 2 - btnW / 2;
      const btnY = py + panelH - pad - btnH;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(btnText, btnX + btnW / 2, btnY + 24);
      // hit
      menuHitRectsRef.current.push({ x: btnX, y: btnY, w: btnW, h: btnH, type: "start" });

      // Credits
      ctx.font = "12px ui-sans-serif, system-ui, -apple-system";
      ctx.fillStyle = "#d4d4d4";
      ctx.fillText("Credits: Madhav Panchal", px + panelW / 2, py + panelH + 28);
      ctx.restore();
    } else if (mode === "gameover") {
      const { themeA } = getEffectiveThemeBlend();
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#f9fafb";
      ctx.textAlign = "center";
      ctx.font = "bold 32px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText("Game Over", width / 2, height / 2 - 18);
      ctx.font = "16px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText(`Score: ${score}`, width / 2, height / 2 + 8);
      ctx.fillText(`Map: ${themeA.name}`, width / 2, height / 2 + 28);
      ctx.fillText("Press Enter/R to Restart", width / 2, height / 2 + 50);
      ctx.restore();
    }
  }

  function drawWorld(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const { themeA, themeB, blend } = getEffectiveThemeBlend();

    // Particles back
    drawParticles(ctx);

    // Enemies
    for (const e of enemiesRef.current) {
      if (e.kind === "asteroid") drawAsteroid(ctx, e);
      else if (e.kind === "ufo") drawUfo(ctx, e);
      else drawBoss(ctx, e);
    }

    // Gravity wells
    for (const w of wellsRef.current) {
      const g = ctx.createRadialGradient(w.position.x, w.position.y, 0, w.position.x, w.position.y, w.radius);
      g.addColorStop(0, "rgba(130,180,255,0.25)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w.position.x, w.position.y, w.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Beams
    for (const b of beamsRef.current) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const endX = b.origin.x + b.direction.x * 2000;
      const endY = b.origin.y + b.direction.y * 2000;
      const grad = ctx.createLinearGradient(b.origin.x, b.origin.y, endX, endY);
      grad.addColorStop(0, "rgba(200,240,255,0.9)");
      grad.addColorStop(1, "rgba(140,200,255,0.2)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      ctx.moveTo(b.origin.x, b.origin.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }

    // Bullets (glow) color shifts slightly with theme
    for (const b of bulletsRef.current) {
      ctx.save();
      const warm = "rgba(255,220,140,0.9)";
      const cool = "rgba(160,220,255,0.9)";
      const shadow = blend > 0.5 ? cool : warm;
      ctx.shadowColor = shadow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = blend > 0.5 ? "rgba(210,235,255,0.95)" : "rgba(255,240,200,0.95)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Rocket
    drawRocket(ctx);

    // Power-ups
    for (const p of powerUpsRef.current) {
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.6)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.type === "shield" ? "#93c5fd" : p.type === "laser" ? "#a5f3fc" : p.type === "homing" ? "#f0abfc" : p.type === "spread" ? "#fde68a" : p.type === "slowmo" ? "#c7d2fe" : "#86efac";
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Foreground particles
    drawParticles(ctx);
  }

  useEffect(() => {
    function onResize() {
      resizeCanvasToContainer();
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    const canvas = canvasRef.current;
          if (canvas) {
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mousedown", handleMouseDown as any);
      }

    resizeCanvasToContainer();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", handleKeyDown as any);
      window.removeEventListener("keyup", handleKeyUp as any);
      if (canvas) {
        canvas.removeEventListener("mousemove", handleMouseMove as any);
        canvas.removeEventListener("mousedown", handleMouseDown as any);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (lastTimeRef.current == null) {
        lastTimeRef.current = time;
      }
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      update(dt, width, height);
      draw(ctx, width, height);

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
      lastTimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, score]);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="pointer-events-none absolute select-none m-3 text-xs text-white/70">
        <p>Move: WASD/Arrows • Aim: mouse • Shoot: Space/Click • Enter to start</p>
      </div>
    </div>
  );
} 