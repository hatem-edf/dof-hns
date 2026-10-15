// Forêt d'Astrub: the 12x12 walkable diamond on the 960x640 canvas.
import { TILE_W, TILE_H, gridToScreen, gridOrigin } from './iso.js';

export const MAP_SIZE = 12;
export const MAP_W = 960;
export const MAP_H = 640;

// Screen position of tile (0,0)'s centre, grid centred on the canvas.
export const ORIGIN = gridOrigin(MAP_SIZE, MAP_W / 2, MAP_H / 2);

export function gridToPx(col, row) {
  return gridToScreen(col, row, ORIGIN.x, ORIGIN.y);
}

export function pxToGrid(x, y) {
  const u = (x - ORIGIN.x) / (TILE_W / 2);
  const v = (y - ORIGIN.y) / (TILE_H / 2);
  return { col: (u + v) / 2, row: (v - u) / 2 };
}

// The diamond's corners in screen px: top, right, bottom, left.
export function mapCorners() {
  const half = MAP_SIZE - 0.5;
  return [
    gridToPx(-0.5, -0.5),
    gridToPx(half, -0.5),
    gridToPx(half, half),
    gridToPx(-0.5, half),
  ];
}

// Half a tile past the grid edge on each side is the diamond border, so the
// clamp happens in grid space where the diamond is an axis-aligned square.
export function clampToMap(x, y) {
  const { col, row } = pxToGrid(x, y);
  const c = Math.min(MAP_SIZE - 0.5, Math.max(-0.5, col));
  const r = Math.min(MAP_SIZE - 0.5, Math.max(-0.5, row));
  return gridToPx(c, r);
}
