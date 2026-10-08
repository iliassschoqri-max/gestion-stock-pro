const { spawn } = require('child_process');
const path = require('path');

const BASE = 'http://localhost:3000';

async function startServer() {
  try {
    await fetch(`${BASE}/api/products`);
    return null;
  } catch { /* pas encore de serveur */ }

  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    stdio: 'ignore',
    detached: true
  });

  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${BASE}/api/products`);
      return child;
    } catch {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  child.kill();
  throw new Error('Le serveur n\'a pas démarré');
}

function stopServer(child) {
  if (child) {
    try { process.kill(-child.pid); } catch { child.kill(); }
  }
}

async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}

module.exports = { startServer, stopServer, api, BASE };
