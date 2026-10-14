// Isometric grid math. Plain functions, no Phaser import — testable with node --test.

export const TILE_W = 64; // diamond width in px
export const TILE_H = 32; // diamond height in px

// Grid-space (col, row) -> screen-space position of the tile centre.
export function gridToScreen(col, row, originX, originY) {
  return {
    x: originX + (col - row) * (TILE_W / 2),
    y: originY + (col + row) * (TILE_H / 2),
  };
}

// Origin (screen position of tile (0,0)'s centre) that puts the centre
// of a gridSize x gridSize grid at (centerX, centerY).
export function gridOrigin(gridSize, centerX, centerY) {
  const c = (gridSize - 1) / 2;
  const mid = gridToScreen(c, c, 0, 0);
  return { x: centerX - mid.x, y: centerY - mid.y };
}

// The 4 corners of a diamond tile centred at (x, y): west, north, east, south.
export function diamondCorners(x, y) {
  return [
    { x: x - TILE_W / 2, y },
    { x, y: y - TILE_H / 2 },
    { x: x + TILE_W / 2, y },
    { x, y: y + TILE_H / 2 },
  ];
}
