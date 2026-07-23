#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const asar = require('@electron/asar');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const releaseDir = path.join(repoRoot, 'release');
const unpackedDir = path.join(releaseDir, 'win-unpacked');
const resourcesDir = path.join(unpackedDir, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');
const desktopPackage = require(path.join(desktopDir, 'package.json'));
const zipPath = process.env.WINDOWS_ZIP_PATH
  ? path.resolve(process.env.WINDOWS_ZIP_PATH)
  : path.join(releaseDir, `OriginOS CE-${desktopPackage.version}-x64.zip`);
const verifyAsarRequiresScript = path.join(desktopDir, 'scripts', 'verify-asar-relative-requires.js');

function fail(message) {
  console.error(`[verify-windows-package] ${message}`);
  process.exitCode = 1;
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function requireFile(filePath) {
  if (!exists(filePath)) {
    fail(`missing required file: ${path.relative(repoRoot, filePath)}`);
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function normalizeAsarEntry(entry) {
  const normalized = entry
    .replace(/^(?:pack|unpack)\s*:\s*/, '')
    .replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized.slice(1) : normalized;
}

function verifyAsar() {
  requireFile(asarPath);
  if (process.exitCode) return;

  const entries = asar.listPackage(asarPath, { isPack: true }).map(normalizeAsarEntry);
  const requiredEntries = [
    'dist-electron/core/src/lib/paths.js',
    'dist-electron/core/src/lib/integrations/pi-agent/display-content.js',
    'dist-electron/core/src/lib/integrations/pi-agent/core/agent.js',
    'dist-electron/core/src/lib/integrations/pi-agent/tools/index.js',
    'dist-electron/core/src/lib/integrations/pi-agent/tools/loop-detector.js',
    'dist-electron/core/src/lib/integrations/pi-agent/tools/schedule-tools.js',
    'dist-electron/desktop/src/main/main.js',
    'node_modules/@mariozechner/agent/index.js',
    'node_modules/@mariozechner/pi-agent-core/dist/index.js',
  ];

  for (const entry of requiredEntries) {
    if (!entries.includes(entry)) {
      fail(`app.asar missing ${entry}`);
    }
  }

  const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originos-win-asar-smoke-'));
  const modules = [
    'dist-electron/core/src/lib/integrations/pi-agent/core/agent.js',
    'dist-electron/core/src/lib/integrations/pi-agent/tools/loop-detector.js',
    'dist-electron/core/src/lib/integrations/pi-agent/tools/schedule-tools.js',
  ];

  asar.extractAll(asarPath, smokeDir);

  const smokeRequire = createRequire(path.join(smokeDir, 'package.json'));
  for (const modulePath of modules) {
    smokeRequire.resolve(path.join(smokeDir, modulePath));
  }
  smokeRequire.resolve('@mariozechner/agent');
  smokeRequire.resolve('@mariozechner/pi-agent-core');

  run(process.execPath, [verifyAsarRequiresScript], {
    env: {
      ...process.env,
      NODE_OPTIONS: '',
      ORIGINOS_ASAR_PATH: asarPath,
    },
  });

  console.log('[verify-windows-package] app.asar module smoke ok');
}

function verifyResources() {
  const requiredFiles = [
    'web/packages/web/server.js',
    'web/packages/web/node_modules/next/dist/server/next.js',
    'web/packages/web/node_modules/styled-jsx/package.json',
    'agent-worker/agent-worker.mjs',
    'agent-worker/core/lib/integrations/pi-agent/tools/loop-detector.js',
    'agent-worker/core/lib/integrations/pi-agent/tools/schedule-tools.js',
    'app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime_binding.node',
    'app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime.dll',
  ];

  for (const relativePath of requiredFiles) {
    requireFile(path.join(resourcesDir, relativePath));
  }

  console.log('[verify-windows-package] unpacked resources ok');
}

function verifyWindowsZip() {
  if (!exists(zipPath)) {
    console.warn(`[verify-windows-package] Windows zip not found, skipped: ${path.relative(repoRoot, zipPath)}`);
    return;
  }

  const names = listZipEntries(zipPath);
  const requiredSuffixes = [
    'resources/app.asar',
    'resources/web/packages/web/server.js',
    'resources/web/packages/web/node_modules/next/dist/server/next.js',
    'resources/web/packages/web/node_modules/styled-jsx/package.json',
    'resources/agent-worker/core/lib/integrations/pi-agent/tools/loop-detector.js',
    'resources/agent-worker/core/lib/integrations/pi-agent/tools/schedule-tools.js',
    'resources/app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime_binding.node',
    'resources/app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime.dll',
  ];
  const missing = requiredSuffixes.filter(
    (suffix) => !names.some((name) => name === suffix || name.endsWith(`/${suffix}`)),
  );
  if (missing.length > 0) {
    fail(`Windows zip missing ${missing.join(',')}`);
    return;
  }
  if (names.some((name) => name.includes('/.pnpm/'))) {
    fail('shortpath zip still contains .pnpm paths');
    return;
  }
  if (names.some((name) => name.startsWith('__MACOSX/'))) {
    fail('shortpath zip contains __MACOSX entries');
    return;
  }

  const longest = names.reduce((current, name) => (name.length > current.length ? name : current), '');
  console.log(`[verify-windows-package] Windows zip ok entries=${names.length} longest=${longest.length} ${longest}`);
}

function listZipEntries(filePath) {
  const buffer = fs.readFileSync(filePath);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > buffer.length) {
    throw new Error(`invalid ZIP central directory in ${path.relative(repoRoot, filePath)}`);
  }

  const names = [];
  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`invalid ZIP central directory header at offset ${offset}`);
    }
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    names.push(buffer.toString('utf8', fileNameStart, fileNameEnd).replace(/\\/g, '/'));
    offset = fileNameEnd + extraLength + commentLength;
  }

  return names;
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      return offset;
    }
  }
  throw new Error('ZIP end of central directory not found');
}

verifyAsar();
verifyResources();
verifyWindowsZip();

if (process.exitCode) {
  process.exit();
}

console.log('[verify-windows-package] verified Windows package runtime files');
