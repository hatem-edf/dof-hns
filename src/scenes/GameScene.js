import Phaser from 'phaser';
import { createWorld, step } from '../core/world.js';
import { MAP_SIZE, MAP_W, MAP_H, ORIGIN } from '../core/map.js';
import { gridToScreen, diamondCorners } from '../core/iso.js';
import { ZONE_NAME } from '../core/zone.js';
import { SPELLS, FIREBALL_RADIUS } from '../core/spells.js';
import { CLASSES } from '../core/player.js';
import { MONSTER_TYPES } from '../core/monster.js';

// Placeholder palette until real tile art lands in public/assets/.
const TILE_A = 0x3a4a3f;
const TILE_B = 0x33413a;
const TILE_EDGE = 0x22302a;

// Placeholder body colors until the step 9 art pass.
const PLAYER_COLORS = { iop: 0xc0504a, cra: 0x57a05a };

// Type-colored placeholder bodies; the per-type body size lives in core
// (MONSTER_TYPES.bodyRadius) so the projectile hit test draws what it hits.
const MONSTER_COLORS = { wolf: 0x8a6a42, skeleton: 0xd9d4c0, orik: 0x7a4b57 };

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
    this.projectileGfx = this.add.graphics();
    this.pickupGfx = this.add.graphics();
    this.playerGfx = this.add.graphics();
    this.hudGfx = this.add.graphics();
    this.defeatGfx = this.add.graphics();

    this.classNameText = this.add.text(16, 12,
      this.world.player.class[0].toUpperCase() + this.world.player.class.slice(1), {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#e8e0cc',
      });

    // Step 8 replaces this with the full end screen (stats, R/C).
    this.defeatText = this.add.text(MAP_W / 2, MAP_H / 2, 'Défaite', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#e05048',
    }).setOrigin(0.5).setVisible(false);

    this.zoneText = this.add.text(MAP_W - 16, 12, ZONE_NAME, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#d4a942',
    }).setOrigin(1, 0);
    // Denominator is the zone total: world.monsters.length shrinks on kills,
    // which would make the counter read e.g. "6 of 5" mid-run.
    this.killTotal = this.world.monsters.length;
    this.killText = this.add.text(MAP_W - 16, 36, `0 of ${this.killTotal}`, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#c8bfa8',
    }).setOrigin(1, 0);

    this.keys = this.input.keyboard.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE'
    );

    // Bottom skill boxes: basic attack plus spells 1 to 3, with the
    // class-specific names and a cooldown fill (docs/design.md).
    const spells = SPELLS[className];
    this.skillBoxes = [
      { label: 'clic', name: 'Frappe', total: CLASSES[className].basicCd, cd: () => this.world.player.cooldowns.basic },
      { label: '1', name: spells.s1.name, total: spells.s1.cd, cd: () => this.world.player.cooldowns.s1 },
      { label: '2', name: spells.s2.name, total: spells.s2.cd, cd: () => this.world.player.cooldowns.s2 },
      { label: '3', name: spells.s3.name, total: spells.s3.cd, cd: () => this.world.player.cooldowns.s3 },
    ].map((b, i) => {
      const w = 130;
      const h = 64;
      const gap = 12;
      const x = (MAP_W - (4 * w + 3 * gap)) / 2 + i * (w + gap);
      const y = MAP_H - 80;
      const box = { ...b, x, y, w, h };
      box.keyText = this.add.text(x + 8, y + 6, b.label, {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#9a927c',
      });
      box.nameText = this.add.text(x + w / 2, y + 34, b.name, {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#e8e0cc',
      }).setOrigin(0.5, 0);
      return box;
    });
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
    this.aim = input.aim;
    this.drawMonsters();
    this.drawProjectiles();
    this.drawPickups();
    this.drawPlayer();
    this.drawHud();
    this.drawDefeat();
    this.killText.setText(`${this.world.player.kills} of ${this.killTotal}`);
  }

  drawMonsters() {
    const gfx = this.monsterGfx;
    gfx.clear();
    for (const m of this.world.monsters) {
      const hw = MONSTER_TYPES[m.type].bodyRadius;
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

      // Telegraph: a winding-up monster flashes a yellow "!" above its bar.
      if (m.state === 'windup') {
        const barTop = by - barH;
        gfx.fillStyle(0xffe14a, 1);
        gfx.fillRect(x - 2, barTop - 26, 4, 14);
        gfx.fillRect(x - 2, barTop - 10, 4, 4);
      }
    }
  }

  // Fireball: a small orange dot with a dark rim, sized like the core's
  // FIREBALL_RADIUS so the picture matches the hit test.
  drawProjectiles() {
    const gfx = this.projectileGfx;
    gfx.clear();
    for (const pr of this.world.projectiles) {
      gfx.fillStyle(0xff7a2a, 1);
      gfx.fillCircle(pr.pos.x, pr.pos.y, FIREBALL_RADIUS);
      gfx.lineStyle(1, 0x9a3a10, 1);
      gfx.strokeCircle(pr.pos.x, pr.pos.y, FIREBALL_RADIUS);
    }
  }

  drawPickups() {
    const gfx = this.pickupGfx;
    gfx.clear();
    for (const pk of this.world.pickups) {
      if (pk.kind !== 'gold') continue; // item pickups come in step 6
      gfx.fillStyle(0xffd24a, 1);
      gfx.fillCircle(pk.pos.x, pk.pos.y, 4);
      gfx.lineStyle(1, 0x6a5a20, 1);
      gfx.strokeCircle(pk.pos.x, pk.pos.y, 4);
    }
  }

  drawHud() {
    const p = this.world.player;
    const gfx = this.hudGfx;
    gfx.clear();
    const barW = 160;
    const barH = 10;
    gfx.fillStyle(0x101418, 1);
    gfx.fillRect(16, 34, barW, barH);
    gfx.fillStyle(0x66aa4a, 1);
    gfx.fillRect(16, 34, barW * Math.max(0, p.hp / p.maxHp), barH);

    // Skill boxes: dark panel, name/key labels are static texts, and a
    // bottom-anchored fill whose height is the remaining fraction of the cd.
    for (const b of this.skillBoxes) {
      gfx.fillStyle(0x101418, 0.85);
      gfx.fillRect(b.x, b.y, b.w, b.h);
      const remaining = Math.max(0, b.cd());
      const frac = Math.min(1, remaining / b.total);
      if (frac > 0) {
        gfx.fillStyle(0x000000, 0.55);
        gfx.fillRect(b.x, b.y + b.h * (1 - frac), b.w, b.h * frac);
      }
      gfx.lineStyle(1, 0x4a4436, 1);
      gfx.strokeRect(b.x, b.y, b.w, b.h);
    }
  }

  drawDefeat() {
    const defeated = this.world.status === 'defeat';
    this.defeatGfx.clear();
    this.defeatText.setVisible(defeated);
    if (defeated) {
      this.defeatGfx.fillStyle(0x000000, 0.55);
      this.defeatGfx.fillRect(0, 0, MAP_W, MAP_H);
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

    // Cra staff: a short green line from the body toward the aim, the
    // placeholder stand-in until the step 9 art pass gives it a sprite.
    if (this.world.player.class === 'cra') {
      const ax = this.aim.x - x;
      const ay = this.aim.y - y;
      const al = Math.hypot(ax, ay) || 1;
      const ux = ax / al;
      const uy = ay / al;
      gfx.lineStyle(3, 0x2e6b33, 1);
      gfx.lineBetween(x + ux * 8, y + uy * 8, x + ux * 26, y + uy * 26);
    }
  }
}
