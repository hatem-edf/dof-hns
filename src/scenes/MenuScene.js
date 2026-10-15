import Phaser from 'phaser';
import { CLASSES } from '../core/player.js';

const PANEL_W = 360;
const PANEL_H = 250;
const PANEL_Y = 180;
const PANEL_X = [90, 510];

const blurbFor = (key) => {
  const t = CLASSES[key];
  return `${t.maxHp} HP · ${t.damage} dmg · ${t.defense} def · ${t.speed} speed`;
};

const PANELS = [
  {
    key: 'iop',
    name: 'Iop',
    color: 0xc0504a,
    spells: ['Charge', 'Coup Tonnerre', 'Coup Maudit'],
  },
  {
    key: 'cra',
    name: 'Cra',
    color: 0x57a05a,
    spells: ['Boule de Feu', 'Tornade', 'Eau Vive'],
  },
];

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.highlight = 0;

    this.add.text(480, 84, 'dof-hns', {
      fontSize: '44px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#d4a942',
    }).setOrigin(0.5);

    this.add.text(480, 130, "Forêt d'Astrub", {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#9aa88f',
    }).setOrigin(0.5);

    this.panelGfx = this.add.graphics();
    this.drawPanels();

    PANELS.forEach((p, i) => {
      const x = PANEL_X[i];
      this.add.text(x + PANEL_W / 2, PANEL_Y + 44, p.name, {
        fontSize: '30px',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        color: '#' + p.color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5);

      this.add.text(x + PANEL_W / 2, PANEL_Y + 84, blurbFor(p.key), {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#c8bfa8',
      }).setOrigin(0.5);

      p.spells.forEach((spell, n) => {
        this.add.text(x + 28, PANEL_Y + 128 + n * 30, `${n + 1}  ${spell}`, {
          fontSize: '18px',
          fontFamily: 'monospace',
          color: '#e8dcc8',
        });
      });

      const zone = this.add
        .zone(x + PANEL_W / 2, PANEL_Y + PANEL_H / 2, PANEL_W, PANEL_H)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.setHighlight(i));
      zone.on('pointerdown', () => this.startGame(i));
    });

    this.add.text(480, 530, 'A / D: choose      Enter or click: play', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#8a8f85',
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-A', () => this.setHighlight(this.highlight - 1));
    this.input.keyboard.on('keydown-D', () => this.setHighlight(this.highlight + 1));
    this.input.keyboard.on('keydown-ENTER', () => this.startGame(this.highlight));
  }

  setHighlight(i) {
    if (i < 0 || i >= PANELS.length || i === this.highlight) return;
    this.highlight = i;
    this.drawPanels();
  }

  drawPanels() {
    const gfx = this.panelGfx;
    gfx.clear();
    PANELS.forEach((p, i) => {
      const x = PANEL_X[i];
      gfx.fillStyle(0x241d15, 1);
      gfx.fillRect(x, PANEL_Y, PANEL_W, PANEL_H);
      gfx.lineStyle(i === this.highlight ? 3 : 1, i === this.highlight ? 0xd4a942 : 0x4a3c2a, 1);
      gfx.strokeRect(x, PANEL_Y, PANEL_W, PANEL_H);
    });
  }

  startGame(i) {
    const seed = Math.floor(Math.random() * 0xfffffff);
    this.scene.start('GameScene', { className: PANELS[i].key, seed });
  }
}
