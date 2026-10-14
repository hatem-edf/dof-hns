import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Dev-only endpoints for the browser bridge (src/dev/bridge.js):
//   POST /__shot  body = raw PNG bytes -> saved to shots/<timestamp>.png
//   POST /__log   body = one line      -> appended to logs/browser.log
function devEndpoints() {
  const collect = (req) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

  return {
    name: 'dof-hns:dev-endpoints',
    apply: 'serve', // dev server only, never in build/preview
    configureServer(server) {
      server.middlewares.use('/__shot', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        const png = await collect(req);
        fs.mkdirSync(path.join(rootDir, 'shots'), { recursive: true });
        const file = path.join(rootDir, 'shots', `${Date.now()}.png`);
        fs.writeFileSync(file, png);
        res.statusCode = 200;
        res.end(`saved ${path.relative(rootDir, file)} (${png.length} bytes)\n`);
      });

      server.middlewares.use('/__log', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        const line = (await collect(req)).toString('utf8').trimEnd();
        if (line) {
          fs.mkdirSync(path.join(rootDir, 'logs'), { recursive: true });
          fs.appendFileSync(path.join(rootDir, 'logs', 'browser.log'), line + '\n');
        }
        res.statusCode = 200;
        res.end('ok\n');
      });
    },
  };
}

export default defineConfig({
  plugins: [devEndpoints()],
});
