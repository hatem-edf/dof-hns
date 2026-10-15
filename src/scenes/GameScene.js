import Phaser from 'phaser';
import { createWorld, step } from '../core/world.js';
import { MAP_SIZE, ORIGIN } from '../core/map.js';
import { gridToScreen, diamondCorners } from '../core/iso.js';

// Placeholder palette until real tile art lands in public/assets/.
const TILE_A = 0x3a4a3f;
const TILE_B = 0x33413a;
const TILE_EDGE = 0x22302a;

// Placeholder body colors until the step 9 art pass.
const PLAYER_COLORS = { iop: 0xc0504a, cra: 0x57a05a };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.run = data || {};
  }

  create() {
    const { className = 'iop', seed = 1 } = this.run;
    this.world = createWorld(className, seed);

    const tiles = this.add.graphics();
    for (let row = 0; row < MAP_SIZE; row++) {
      for (let col = 0; col < MAP_SIZE; col++) {
        const { x, y } = gridToScreen(col, row, ORIGIN.x, ORIGIN.y);
        const corners = diamondCorners(x, y);

        tiles.fillStyle((col + row) % 2 === 0 ? TILE_A : TILE_B);
        tiles.beginPath();
        tiles.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) tiles.lineTo(corners[i].x, corners[i].y);
        tiles.closePath();
        tiles.fillPath();

        tiles.lineStyle(1, TILE_EDGE, 0.6);
        tiles.beginPath();
        tiles.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) tiles.lineTo(corners[i].x, corners[i].y);
        tiles.closePath();
        tiles.strokePath();
      }
    }

    this.playerGfx = this.add.graphics();
    this.keys = this.input.keyboard.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE'
    );
  }

  update(time, delta) {
    // Clamp dt so a backgrounded tab cannot tunnel a future dash through a wolf.
    const dt = Math.min(delta / 1000, 0.05);
    const ptr = this.input.activePointer;

    const input = {
      move: {
        x: (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) -
          (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0),
        y: (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) -
          (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0),
      },
      aim: { x: ptr.x, y: ptr.y },
      basic: ptr.leftButtonDown(),
      s1: this.keys.ONE.isDown,
      s2: this.keys.TWO.isDown,
      s3: this.keys.THREE.isDown,
    };

    step(this.world, input, dt);
    this.drawPlayer();
  }

  drawPlayer() {
    const { x, y } = this.world.player.pos;
    const gfx = this.playerGfx;
    gfx.clear();
    // Body centred on the world position, so the clamp reads exactly at all
    // four edges. A sprite anchored at the feet comes in the step 9 art pass.
    const pts = [
      { x: x - 14, y },
      { x, y: y - 8 },
      { x: x + 14, y },
      { x, y: y + 8 },
    ];
    gfx.fillStyle(PLAYER_COLORS[this.world.player.class], 1);
    gfx.fillPoints(pts, true);
    gfx.lineStyle(2, 0x101418, 1);
    gfx.strokePoints(pts, true);
  }
}
