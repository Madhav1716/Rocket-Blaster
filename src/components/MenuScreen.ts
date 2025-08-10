/* MenuScreen: draws the monochrome welcome/menu UI */

export type MenuSection = "Controls" | "Power-ups" | "Scoring" | "Boss & Hazards" | "Maps";
export type MenuHitRect = { x: number; y: number; w: number; h: number; type: "section" | "start"; section?: MenuSection };

export function drawLogo(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number) {
  ctx.save();
  // Orbit ring
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, size * 0.12);
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, size, size * 0.55, 0.2, 0, Math.PI * 2);
  ctx.stroke();
  // Rocket capsule
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
  // Star
  ctx.fillStyle = "#ffffff";
  const sx = centerX + size * 0.95;
  const sy = centerY - size * 0.9;
  const s = Math.max(1, size * 0.12);
  ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
  ctx.fillRect(sx - s * 1.5, sy - s / 6, s * 3, s / 3);
  ctx.fillRect(sx - s / 6, sy - s * 1.5, s / 3, s * 3);
  ctx.restore();
}

export function drawMenu(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: {
    themeName: string;
    currentSection: MenuSection;
    aimPosition?: { x: number; y: number } | null;
    hitRects: MenuHitRect[];
    setPointerCursor?: (pointer: boolean) => void;
  }
) {
  const { themeName, currentSection, aimPosition, hitRects, setPointerCursor } = options;
  const panelW = Math.min(780, width - 96);
  const panelH = Math.min(480, height - 200);
  const px = (width - panelW) / 2;
  const py = (height - panelH) / 2;
  const pad = 24;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const pulse = 0.5 + 0.5 * Math.sin(now / 600);

  // Backdrop vignette
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(0, 0, width, height);
  const vg = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.6);
  vg.addColorStop(0, "rgba(255,255,255,0.02)");
  vg.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);

  // Panel
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 14);
  ctx.fill();
  ctx.stroke();
  // inner glow
  ctx.strokeStyle = `rgba(255,255,255,${0.06 + 0.05 * pulse})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(px + 8, py + 8, panelW - 16, panelH - 16, 12);
  ctx.stroke();
  ctx.restore();

  // Title/logo
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 38px ui-sans-serif, system-ui, -apple-system";
  ctx.shadowColor = "rgba(255,255,255," + (0.12 + 0.18 * pulse).toFixed(3) + ")";
  ctx.shadowBlur = 18 + pulse * 8;
  drawLogo(ctx, px + panelW / 2, py + 30, 14);
  ctx.fillText("ROCKET BLASTER", px + panelW / 2, py + 60);
  ctx.shadowBlur = 0;
  // Tagline
  ctx.font = "14px ui-sans-serif, system-ui, -apple-system";
  ctx.fillStyle = "#d4d4d4";
  ctx.fillText("Arcade space shooter. Minimal. Fast. Skill-based.", px + panelW / 2, py + 84);
  ctx.restore();

  // Map pill
  ctx.save();
  const pill = `Map: ${themeName}`;
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
  ctx.textAlign = "center";
  ctx.fillText(pill, pillX + pillW / 2, pillY + 15);
  ctx.restore();

  // Tabs
  ctx.save();
  hitRects.length = 0;
  const mouse = aimPosition;
  let showPointer = false;
  const tabs: MenuSection[] = ["Controls", "Power-ups", "Scoring", "Boss & Hazards", "Maps"];
  ctx.textAlign = "left";
  ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system";
  let tx = px + pad;
  const ty = py + 82;
  for (const t of tabs) {
    const label = t;
    const tw = Math.max(80, ctx.measureText(label).width + 22);
    const th = 28;
    const active = currentSection === t;
    const hovered = !!mouse && mouse.x >= tx && mouse.x <= tx + tw && mouse.y >= ty && mouse.y <= ty + th;
    if (hovered) showPointer = true;
    if (hovered) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 7);
      ctx.fill();
    }
    ctx.strokeStyle = active ? "rgba(255,255,255,0.9)" : hovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = active ? 1.9 : hovered ? 1.6 : 1.2;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 7);
    ctx.stroke();
    ctx.fillStyle = active ? "#ffffff" : hovered ? "#f0f0f0" : "#e5e5e5";
    ctx.textAlign = "center";
    ctx.fillText(label, tx + tw / 2, ty + 19);
    hitRects.push({ x: tx, y: ty, w: tw, h: th, type: "section", section: t });
    tx += tw + 8;
  }

  // Separator glow
  ctx.textAlign = "left";
  let y = py + 128;
  const x = px + pad;
  ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.04 * pulse})`;
  ctx.beginPath();
  ctx.moveTo(px + 8, y - 18);
  ctx.lineTo(px + panelW - 8, y - 18);
  ctx.stroke();

  // Section header + bullets
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

  if (currentSection === "Controls") {
    header("Controls");
    bullet("Move: WASD/Arrows • Aim: Mouse • Shoot: Space/Click");
    bullet("Start: Enter/Click • Pause: P • HUD: H");
    bullet("Reduced Motion: M • High Contrast: C • Switch Map: Q/E");
  } else if (currentSection === "Power-ups") {
    header("Power-ups");
    bullet("Spread • Laser • Homing • Shield • Slow-mo • Magnet");
  } else if (currentSection === "Scoring") {
    header("Scoring");
    bullet("Combo multiplier grows with chained kills");
    bullet("Collect score orbs; magnet attracts them");
  } else if (currentSection === "Boss & Hazards") {
    header("Boss & Hazards");
    bullet("Boss waves (UFO mothership, asteroid golem)");
    bullet("Hazards: Gravity wells • Meteor showers");
  } else if (currentSection === "Maps") {
    header("Maps");
    bullet("Auto-rotate every ~35s with crossfade");
    bullet("Manual switch: Q/E");
  }

  // Start button
  const btnText = "Enter or Click to Start";
  ctx.font = "600 15px ui-sans-serif, system-ui, -apple-system";
  const btnW = Math.max(240, ctx.measureText(btnText).width + 24);
  const btnH = 38;
  const btnX = px + panelW / 2 - btnW / 2;
  const btnY = py + panelH - pad - btnH;
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * pulse})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 10);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(btnText, btnX + btnW / 2, btnY + 24);
  hitRects.push({ x: btnX, y: btnY, w: btnW, h: btnH, type: "start" });

  // Credits
  ctx.font = "12px ui-sans-serif, system-ui, -apple-system";
  ctx.fillStyle = "#d4d4d4";
  ctx.fillText("Credits: Madhav Panchal", px + panelW / 2, py + panelH + 28);

  // pointer cursor
  if (setPointerCursor) setPointerCursor(showPointer);
} 