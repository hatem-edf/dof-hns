import Phaser from 'phaser';
import GridScene from './scenes/GridScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  backgroundColor: '#101418',
  pixelArt: true,
  // Keep the WebGL buffer between frames so F9 / canvas.toBlob captures
  // the actual frame instead of the cleared (black) one.
  preserveDrawingBuffer: true,
  scene: [GridScene],
});

// Dev-only: screenshot bridge (F9) and error capture. Dropped from prod builds.
if (import.meta.env.DEV) {
  import('./dev/bridge.js');
}
