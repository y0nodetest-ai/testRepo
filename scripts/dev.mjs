/**
 * Minimal dev launcher: runs the API and the web dev server side by side
 * without pulling in an extra dependency like `concurrently`.
 *
 * Usage: npm run dev
 */
import { spawn } from 'node:child_process';

const targets = [
  { name: 'api', color: '\x1b[36m', args: ['run', 'dev', '--workspace', '@testrepo/api'] },
  { name: 'web', color: '\x1b[35m', args: ['run', 'dev', '--workspace', '@testrepo/web'] },
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

// Resolve the npm shim directly instead of using `shell: true`, which would
// concatenate arguments unescaped (Node DEP0190).
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const target of targets) {
  const child = spawn(npmCommand, target.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  prefixStream(child.stdout, target.name, target.color);
  prefixStream(child.stderr, target.name, target.color);

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
