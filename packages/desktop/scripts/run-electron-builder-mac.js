#!/usr/bin/env node

const { spawn } = require('node:child_process');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('[run-electron-builder-mac] electron-builder arguments are required');
  process.exit(1);
}

const maxTailLines = 120;
const tail = [];

function remember(chunk) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    tail.push(line);
    if (tail.length > maxTailLines) tail.shift();
  }
}

function escapeWorkflowCommand(value) {
  return value
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

const child = spawn('pnpm', ['exec', 'electron-builder', ...args], {
  cwd: process.cwd(),
  env: process.env,
  shell: process.platform === 'win32',
});

child.stdout.on('data', (chunk) => {
  remember(chunk);
  process.stdout.write(chunk);
});

child.stderr.on('data', (chunk) => {
  remember(chunk);
  process.stderr.write(chunk);
});

child.on('error', (error) => {
  console.error(`[run-electron-builder-mac] failed to start electron-builder: ${error.message}`);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (code === 0) {
    process.exit(0);
  }

  const status = signal ? `signal ${signal}` : `exit code ${code}`;
  const tailText = tail.slice(-80).join('\n');
  const message = [
    `electron-builder failed with ${status}.`,
    tailText ? `Last log lines:\n${tailText}` : 'No output was captured.',
  ].join('\n');

  console.error(`::error title=macOS electron-builder failed::${escapeWorkflowCommand(message)}`);
  process.exit(code || 1);
});
