# Rocket Blaster

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://rocket-blaster-lilac.vercel.app/)

Live demo: https://rocket-blaster-lilac.vercel.app/

A minimalist, fast, canvas-based arcade shooter built with Next.js and React. Pilot a rocket, survive waves from all directions, chain kills for big scores, and enjoy dynamic space backdrops that evolve over time.

## Overview
- **Framework**: Next.js (App Router) + React
- **Rendering**: HTML5 Canvas
- **Styling**: Tailwind CSS
- **Platform**: Desktop (mobile support planned)

Open the game and play instantly in your browser—no installs.

## Features
- **Full-screen play**: Move freely anywhere on the screen; enemies attack from all directions.
- **Dynamic environments**: Rotating themed space maps with smooth crossfades (e.g., Blue Void, Ember Rift). Each theme affects visuals and enemy behavior.
- **Weapons**: Precise aiming with mouse, bullets originate from the rocket’s nose.
- **Power-ups**: Spread, Laser, Homing, Shield, Slow-mo, Magnet.
- **Combo system**: Chain kills to grow a score multiplier; decays if you slow down.
- **Boss waves**: Themed bosses such as UFO Mothership and Asteroid Golem.
- **Hazards & events**: Gravity wells, meteor showers.
- **Particles & effects**: Thrusters, muzzle flashes, explosions, theme-aware glows.
- **Accessibility**: Pause, hide HUD, high-contrast, reduced motion.
- **Minimalist menu**: Clean black-and-white menu with tabs for quick info.

## Controls
- **Move**: WASD or Arrow Keys
- **Aim**: Mouse
- **Shoot**: Space or Left Click
- **Start**: Enter or Click
- **Pause**: P
- **HUD Toggle**: H
- **Reduced Motion**: M
- **High Contrast**: C
- **Switch Map**: Q / E

## Power-ups
- **Spread**: Fires a multi-shot spread.
- **Laser**: Sustained beam that deals continuous damage.
- **Homing**: Bullets steer toward nearby enemies.
- **Shield**: Absorbs one hit.
- **Slow-mo**: Temporarily slows down time.
- **Magnet**: Pulls score orbs toward you.

## Scoring
- **Score orbs** drop from destroyed enemies. Collect them to score.
- **Combo multiplier** increases with chained kills; decays over time or on hit.

## Maps & Themes
Maps rotate automatically every ~35 seconds with a smooth crossfade. Each theme includes a unique background, starfield, nebula tones, and gameplay modifier (e.g., UFO spawn rate, enemy speed). You can switch manually with Q/E.

## Accessibility
- **Pause** gameplay at any time (P).
- **HUD** can be hidden (H) for a distraction-free experience.
- **Reduced Motion** to limit animated intensity (M).
- **High Contrast** mode for improved visibility (C).

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server (auto-selects port if 3000 is busy):
   ```bash
   npm run dev
   ```
3. Open the game at:
   - `http://localhost:3000` or the printed alternative (e.g., `http://localhost:3001`).

## Scripts
- `npm run dev`: Start Next.js dev server with Turbopack.
- `npm run build`: Build the production bundle.
- `npm run start`: Start the production server.

## Project Structure
```
/rocket-blaster
  ├─ src/app
  │  ├─ page.tsx            // Loads the RocketBlaster client component
  │  ├─ layout.tsx          // App metadata and global layout
  │  └─ globals.css         // Global styles (Tailwind)
  ├─ src/components
  │  └─ RocketBlaster.tsx   // Core game: loop, draw, input, state
  ├─ public                 // Static assets (icons, svgs)
  ├─ package.json
  └─ README.md
```

## Roadmap
- **Dynamic music**: Intensity-based, theme-aware layering (WebAudio).
- **Screen-space effects**: Vignette, bloom, subtle chromatic aberration.
- **Photo mode**: Pause, free-cam pan/zoom, hide UI for screenshots.
- **Mobile**: Virtual joystick, auto-fire, larger hitboxes; performance preset.
- **Theme selector overlay**: Thumbnails and colorblind-safe palettes.

## Credits
- Game design & development: Madhav Panchal
- Built with Next.js, React, and the Canvas API

---

If you have feedback or ideas for new features, feel free to open an issue or suggest improvements!
# Rocket-Blaster
