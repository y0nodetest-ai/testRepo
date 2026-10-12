/**
 * Minimal dev launcher: runs the API and the web dev server side by side
 * without pulling in an extra dependency like `concurrently`.
 *
 * Both children are spawned as plain `node` processes against their real
 * entry points. That avoids two Windows pitfalls at once:
 *   - spawning the `npm.cmd` shim without a shell fails with EINVAL
 *   - spawning with `shell: true` plus an args array triggers Node DEP0190
 *
 * Usage: npm run dev
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// vite is hoisted to the workspace root, but resolve it rather than assume.
const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');

const targets = [
  {
    name: 'api',
    color: '\x1b[36m',
    cwd: path.join(repoRoot, 'apps', 'api'),
    args: [
      '--disable-warning=ExperimentalWarning',
      '--env-file-if-exists=.env',
      '--watch',
      path.join('src', 'server.js'),
    ],
  },
  {
    name: 'web',
    color: '\x1b[35m',
    cwd: path.join(repoRoot, 'apps', 'web'),
    args: [viteBin],
  },
];

const RESET = '\x1b[0m';
const children = [];
let shuttingDown = false;

function prefixStream(stream, name, color) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      process.stdout.write(`${color}[${name}]${RESET} ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer.length > 0) {
      process.stdout.write(`${color}[${name}]${RESET} ${buffer}\n`);
    }
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
    }
  }
  process.exitCode = code;
}

for (const target of targets) {
  const child = spawn(process.execPath, target.args, {
    cwd: target.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  prefixStream(child.stdout, target.name, target.color);
  prefixStream(child.stderr, target.name, target.color);

  child.on('error', (error) => {
    process.stdout.write(`${target.color}[${target.name}]${RESET} failed to start: ${error.message}\n`);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    process.stdout.write(
      `${target.color}[${target.name}]${RESET} exited (${signal ?? code}). Stopping the rest.\n`,
    );
    shutdown(code ?? 1);
  });

  children.push(child);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}
