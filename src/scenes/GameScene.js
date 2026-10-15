import Phaser from 'phaser';
import { createWorld, step } from '../core/world.js';
import { MAP_SIZE, MAP_W, ORIGIN } from '../core/map.js';
import { gridToScreen, diamondCorners } from '../core/iso.js';
import { ZONE_NAME } from '../core/zone.js';

// Placeholder palette until real tile art lands in public/assets/.
const TILE_A = 0x3a4a3f;
const TILE_B = 0x33413a;
const TILE_EDGE = 0x22302a;

// Placeholder body colors until the step 9 art pass.
const PLAYER_COLORS = { iop: 0xc0504a, cra: 0x57a05a };

// Type-colored placeholder bodies; Orik is larger and darker (docs/design.md).
const MONSTER_COLORS = { wolf: 0x8a6a42, skeleton: 0xd9d4c0, orik: 0x7a4b57 };
const MONSTER_HALF_W = { wolf: 9, skeleton: 11, orik: 17 };

const TREE_GREEN = 0x4a6a3a;
const TREE_TRUNK = 0x6a4a2a;
const ROCK_GREY = 0x84847c;

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

    this.drawDecor(tiles);

    this.monsterGfx = this.add.graphics();
    this.playerGfx = this.add.graphics();

    this.zoneText = this.add.text(MAP_W - 16, 12, ZONE_NAME, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#d4a942',
    }).setOrigin(1, 0);
    this.killText = this.add.text(MAP_W - 16, 36, `0 of ${this.world.monsters.length}`, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#c8bfa8',
    }).setOrigin(1, 0);

    this.keys = this.input.keyboard.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE'
    );
  }

  // Decor is fixed and visual only, so it is drawn once into the tile layer.
  drawDecor(gfx) {
    for (const d of this.world.zone.decor) {
      const { x, y } = gridToScreen(d.col, d.row, ORIGIN.x, ORIGIN.y);
      if (d.kind === 'tree') {
        gfx.fillStyle(TREE_TRUNK, 1);
        gfx.fillRect(x - 2, y - 4, 4, 8);
        gfx.fillStyle(TREE_GREEN, 1);
        gfx.fillPoints(
          [{ x, y: y - 26 }, { x: x - 11, y: y - 4 }, { x: x + 11, y: y - 4 }],
          true
        );
      } else {
        gfx.fillStyle(ROCK_GREY, 1);
        gfx.fillPoints(
          [
            { x: x - 9, y: y + 3 },
            { x: x - 5, y: y - 6 },
            { x: x + 4, y: y - 7 },
            { x: x + 9, y: y + 1 },
            { x: x + 4, y: y + 5 },
            { x: x - 4, y: y + 6 },
          ],
          true
        );
      }
    }
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
    this.drawMonsters();
    this.drawPlayer();
    this.killText.setText(`${this.world.player.kills} of ${this.world.monsters.length}`);
  }

  drawMonsters() {
    const gfx = this.monsterGfx;
    gfx.clear();
    for (const m of this.world.monsters) {
      const hw = MONSTER_HALF_W[m.type];
      const { x, y } = m.pos;
      const pts = [
        { x: x - hw, y },
        { x, y: y - hw * 0.6 },
        { x: x + hw, y },
        { x, y: y + hw * 0.6 },
      ];
      gfx.fillStyle(MONSTER_COLORS[m.type], 1);
      gfx.fillPoints(pts, true);
      gfx.lineStyle(2, 0x101418, 1);
      gfx.strokePoints(pts, true);

      // Mini HP bar above the body, full width at full HP.
      const barW = hw * 2;
      const barH = 3;
      const bx = x - hw;
      const by = y - hw * 0.6 - 9;
      gfx.fillStyle(0x101418, 1);
      gfx.fillRect(bx, by, barW, barH);
      gfx.fillStyle(0x66aa4a, 1);
      gfx.fillRect(bx, by, barW * (m.hp / m.maxHp), barH);
    }
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
