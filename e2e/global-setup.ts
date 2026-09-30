import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* The package is ESM, so there is no __dirname. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Starts an ISOLATED backend for the E2E run and tears it down afterwards.
 *
 * Never point E2E at a developer's running server: tests write data. This boots
 * the built backend (`npm run build` in the backend first) on its own port
 * against a throwaway database, with a throwaway uploads folder, creates the
 * test user it needs, and drops the database when the run ends.
 */

export const E2E_API_PORT = Number(process.env.E2E_API_PORT || 5098);
export const E2E_UI_PORT = Number(process.env.E2E_UI_PORT || 5199);
const E2E_DB = process.env.E2E_DB || 'enterprise_platform_e2e_ui';
const MONGO = process.env.E2E_MONGO || 'mongodb://localhost:27017';
const BACKEND_DIR = path.resolve(
  process.env.E2E_BACKEND_DIR || path.join(HERE, '..', '..', 'Enterprise-platform-be', 'enterprise-platform-backend')
);
export const STATE_FILE = path.join(os.tmpdir(), 'perfox-e2e-state.json');

const waitForHealth = async (url: string, timeoutMs = 30_000) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Backend did not come up at ${url}`);
};

const portInUse = async (port: number) => {
  try {
    await fetch(`http://localhost:${port}/api/health`);
    return true;
  } catch {
    return false;
  }
};

const dropDatabase = () =>
  spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import m from 'mongoose'; await m.connect(${JSON.stringify(`${MONGO}/${E2E_DB}`)}); await m.connection.dropDatabase(); await m.disconnect();`,
    ],
    { cwd: BACKEND_DIR, stdio: 'inherit' }
  );

export default async function globalSetup() {
  if (!fs.existsSync(path.join(BACKEND_DIR, 'dist', 'server.js'))) {
    throw new Error(`Build the backend first: npm run build in ${BACKEND_DIR}`);
  }
  if (await portInUse(E2E_API_PORT)) {
    throw new Error(`Port ${E2E_API_PORT} is already serving something — refusing to run E2E against it`);
  }

  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'perfox-e2e-uploads-'));
  const server: ChildProcess = spawn(process.execPath, ['dist/server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(E2E_API_PORT),
      MONGODB_URI: `${MONGO}/${E2E_DB}`,
      NODE_ENV: 'test',
      CORS_ORIGIN: `http://localhost:${E2E_UI_PORT}`,
      UPLOADS_DIR: uploads,
    },
    stdio: 'ignore',
  });

  await waitForHealth(`http://localhost:${E2E_API_PORT}/api/health`);

  /* One user per role on the throwaway database. `token` (Editor) is kept as
     the default for older specs. */
  const register = async (role: 'Admin' | 'Editor' | 'Viewer') => {
    const email = `e2e-${role.toLowerCase()}-${Date.now()}@test.local`;
    const res = await fetch(`http://localhost:${E2E_API_PORT}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E ${role}`, email, password: 'Passw0rd!e2e', role }),
    });
    const body = await res.json();
    const token = body?.data?.token;
    if (!token) throw new Error(`Could not create the E2E ${role}: ${JSON.stringify(body)}`);
    return token as string;
  };
  const [admin, editor, viewer] = [await register('Admin'), await register('Editor'), await register('Viewer')];
  fs.writeFileSync(STATE_FILE, JSON.stringify({ token: editor, admin, editor, viewer }));

  return async () => {
    server.kill();
    dropDatabase();
    fs.rmSync(uploads, { recursive: true, force: true });
    fs.rmSync(STATE_FILE, { force: true });
  };
}
