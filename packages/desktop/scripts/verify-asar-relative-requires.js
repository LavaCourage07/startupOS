#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const releaseDir = path.join(repoRoot, 'release');
const asarPath = process.env.ORIGINOS_ASAR_PATH
  ? path.resolve(process.env.ORIGINOS_ASAR_PATH)
  : path.join(releaseDir, 'win-unpacked', 'resources', 'app.asar');
const asarBin = path.join(repoRoot, 'node_modules/.bin/asar');

function fail(message) {
  console.error(`[verify-asar-relative-requires] ${message}`);
  process.exitCode = 1;
}

function run(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function isJsRuntimeEntry(entry) {
  return (
    entry.startsWith('/dist-electron/desktop/src/main/') ||
    entry.startsWith('/dist-electron/core/src/')
  ) && (entry.endsWith('.js') || entry.endsWith('.mjs'));
}

function parseRelativeRequires(source) {
  const modules = [];
  for (const match of source.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) {
    const specifier = match[1];
    if (specifier.startsWith('.')) {
      modules.push(specifier);
    }
  }
  return modules;
}

function candidateEntries(fromEntry, specifier) {
  const fromDir = path.posix.dirname(fromEntry);
  const base = path.posix.normalize(path.posix.join(fromDir, specifier));
  return [
    base,
    `${base}.js`,
    `${base}.mjs`,
    path.posix.join(base, 'index.js'),
    path.posix.join(base, 'index.mjs'),
  ];
}

if (!fs.existsSync(asarPath)) {
  fail(`app.asar not found: ${asarPath}`);
  process.exit();
}

if (!fs.existsSync(asarBin)) {
  fail(`asar binary not found: ${asarBin}`);
  process.exit();
}

const entries = run(asarBin, ['list', asarPath]).split(/\r?\n/).filter(Boolean);
const entrySet = new Set(entries);
const runtimeEntries = entries.filter(isJsRuntimeEntry);
const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originos-asar-requires-'));

try {
  for (const entry of runtimeEntries) {
    const relativeEntry = entry.replace(/^\//, '');
    const extractedPath = path.join(extractDir, relativeEntry);
    fs.mkdirSync(path.dirname(extractedPath), { recursive: true });
    fs.writeFileSync(extractedPath, run(asarBin, ['extract-file', asarPath, relativeEntry]));
  }

  for (const entry of runtimeEntries) {
    const relativeEntry = entry.replace(/^\//, '');
    const source = fs.readFileSync(path.join(extractDir, relativeEntry), 'utf8');
    for (const specifier of parseRelativeRequires(source)) {
      const candidates = candidateEntries(entry, specifier);
      if (!candidates.some((candidate) => entrySet.has(candidate))) {
        fail(`${entry} requires ${specifier}, missing candidates: ${candidates.join(', ')}`);
      }
    }
  }
} finally {
  fs.rmSync(extractDir, { recursive: true, force: true });
}

if (process.exitCode) {
  process.exit();
}

console.log(`[verify-asar-relative-requires] verified ${runtimeEntries.length} runtime entries in ${path.relative(repoRoot, asarPath)}`);
