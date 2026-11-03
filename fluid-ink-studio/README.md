# Fluid Ink Studio v1.6

A browser-based creative painting studio built with React, TypeScript and HTML Canvas. Create flowing, abstract ink art with an interactive pigment simulation.
## Live Demo

Fluid Ink Studio is available online and can be used directly in your browser without any installation.

**Try the application:** [Fluid Ink Studio](https://anna02-08.github.io/VIN---Ink-Studio/)
## Run locally

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Open the URL shown by Vite (usually http://localhost:5173).

## Tools

- **Ink Drop** — add a spot of pigment.
- **Brush** — paint continuous strokes.
- **Stir Ink** — push pigment in the direction of the pointer.
- **Vortex** — swirl pigment around the pointer; choose **Left** (counterclockwise) or **Right** (clockwise) in the Tools panel.
- Set ink color, canvas background, brush size, flow speed, stir strength, saturation and pigment density in the scrollable left sidebar.
- Use **Undo**, **Clear**, and **Export PNG** in the toolbar.
- **Info** opens a brief explanation of the studio and controls.

## Canvas size and zoom

The **Canvas size** menu above the artwork provides three dimensions: Small (600 × 380), Medium (900 × 570) and Large (1200 × 760). It changes the size and pixel dimensions of your artwork while preserving existing pigment data.

Use the **− / +** buttons in the bottom-right corner of the workspace to zoom from 50% to 300% in steps of 25%. **Fit** resets zoom to 100% (sized to fit the available viewport). Zoom changes only the on-screen view: the PNG export resolution remains determined by Canvas size. When zoomed beyond the available space, scroll within the canvas area to inspect the painting. The left settings sidebar scrolls independently.

## Source code

- `src/App.tsx` — main interface, pointer controls, zoom, history and export.
- `src/inkEngine.ts` — pigment simulation.
- `src/style.css` — dark visual theme, layout and zoom controls.

The simulation is artistic rather than physically exact.
