// Dev-only browser bridge (loaded from main.js when import.meta.env.DEV).
// F9 saves the game canvas to shots/ via the dev server;
// browser errors, rejections and console.warn/error land in logs/browser.log.

const fmt = (f) => {
  if (f instanceof Error) return f.stack || f.message;
  if (typeof f === 'object' && f !== null) {
    try {
      return JSON.stringify(f);
    } catch {
      return String(f);
    }
  }
  return String(f);
};

const sendLog = (kind, detail) => {
  const line = `[${new Date().toISOString()}] [${kind}] ${detail}`;
  try {
    fetch('/__log', { method: 'POST', body: line }).catch(() => {});
  } catch {
    // dev server unreachable; nothing else we can do
  }
};

const saveScreenshot = () => {
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    sendLog('shot', 'F9: no <canvas> found');
    return;
  }
  canvas.toBlob((blob) => {
    if (!blob) {
      sendLog('shot', 'F9: canvas.toBlob failed');
      return;
    }
    fetch('/__shot', { method: 'POST', body: blob })
      .then((res) => {
        if (!res.ok) throw new Error(`server responded ${res.status}`);
        sendLog('shot', `screenshot saved (${Math.round(blob.size / 1024)} kB)`);
      })
      .catch((err) => sendLog('shot', `F9: ${err.message}`));
  }, 'image/png');
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'F9') {
    e.preventDefault();
    saveScreenshot();
  }
});

window.addEventListener('error', (e) => {
  if (e.target && e.target !== window && e.target.tagName) {
    sendLog('error', `resource failed to load: <${e.target.tagName}> ${e.target.src || ''}`);
  } else {
    sendLog('error', `${e.message} @ ${e.filename || '<unknown>'}:${e.lineno}:${e.column}`);
  }
});

window.addEventListener('unhandledrejection', (e) => {
  sendLog('rejection', fmt(e.reason));
});

for (const level of ['warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    sendLog(level, args.map(fmt).join(' '));
  };
}

sendLog('bridge', 'loaded - press F9 to save a screenshot');
