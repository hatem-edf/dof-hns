import Phaser from 'phaser';
import { TILE_W, TILE_H, gridToScreen, gridOrigin, diamondCorners } from '../core/iso.js';

export const GRID_SIZE = 12;

// Placeholder palette until real tile art lands in public/assets/.
const TILE_A = 0x3a4a3f;
const TILE_B = 0x33413a;
const TILE_EDGE = 0x22302a;

export default class GridScene extends Phaser.Scene {
  constructor() {
    super('GridScene');
  }

  create() {
    const { width, height } = this.cameras.main;
    const origin = gridOrigin(GRID_SIZE, width / 2, height / 2);

    const g = this.add.graphics();
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const { x, y } = gridToScreen(col, row, origin.x, origin.y);
        const corners = diamondCorners(x, y);

        g.fillStyle((col + row) % 2 === 0 ? TILE_A : TILE_B);
        g.beginPath();
        g.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) g.lineTo(corners[i].x, corners[i].y);
        g.closePath();
        g.fillPath();

        g.lineStyle(1, TILE_EDGE, 0.6);
        g.beginPath();
        g.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) g.lineTo(corners[i].x, corners[i].y);
        g.closePath();
        g.strokePath();
      }
    }
  }
}
