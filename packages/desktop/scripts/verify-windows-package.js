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
  return entry.replace(/^(?:pack|unpack)\s*:\s*/, '');
}

function verifyAsar() {
  requireFile(asarPath);
  if (process.exitCode) return;

  const entries = asar.listPackage(asarPath, { isPack: true }).map(normalizeAsarEntry);
  const requiredEntries = [
    '/dist-electron/core/src/lib/paths.js',
    '/dist-electron/core/src/lib/integrations/pi-agent/display-content.js',
    '/dist-electron/core/src/lib/integrations/pi-agent/core/agent.js',
    '/dist-electron/core/src/lib/integrations/pi-agent/tools/index.js',
    '/dist-electron/core/src/lib/integrations/pi-agent/tools/loop-detector.js',
    '/dist-electron/core/src/lib/integrations/pi-agent/tools/schedule-tools.js',
    '/dist-electron/desktop/src/main/main.js',
    '/node_modules/@mariozechner/agent/index.js',
    '/node_modules/@mariozechner/pi-agent-core/dist/index.js',
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

  const script = [
    'import sys, zipfile',
    'zip_path = sys.argv[1]',
    'required_suffixes = [',
    '  "resources/app.asar",',
    '  "resources/web/packages/web/server.js",',
    '  "resources/web/packages/web/node_modules/next/dist/server/next.js",',
    '  "resources/web/packages/web/node_modules/styled-jsx/package.json",',
    '  "resources/agent-worker/core/lib/integrations/pi-agent/tools/loop-detector.js",',
    '  "resources/agent-worker/core/lib/integrations/pi-agent/tools/schedule-tools.js",',
    '  "resources/app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime_binding.node",',
    '  "resources/app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime.dll",',
    ']',
    'with zipfile.ZipFile(zip_path) as archive:',
    '    names = archive.namelist()',
    '    missing = [suffix for suffix in required_suffixes if not any(name == suffix or name.endswith("/" + suffix) for name in names)]',
    '    if missing:',
    '        print("missing " + ",".join(missing), file=sys.stderr)',
    '        sys.exit(2)',
    '    if any("/.pnpm/" in name for name in names):',
    '        print("shortpath zip still contains .pnpm paths", file=sys.stderr)',
    '        sys.exit(3)',
    '    if any(name.startswith("__MACOSX/") for name in names):',
    '        print("shortpath zip contains __MACOSX entries", file=sys.stderr)',
    '        sys.exit(4)',
    '    longest = max((len(name), name) for name in names)',
    '    print(f"entries={len(names)} longest={longest[0]} {longest[1]}")',
  ].join('\n');

  const output = run('python3', ['-c', script, zipPath]).trim();
  console.log(`[verify-windows-package] Windows zip ok ${output}`);
}

verifyAsar();
verifyResources();
verifyWindowsZip();

if (process.exitCode) {
  process.exit();
}

console.log('[verify-windows-package] verified Windows package runtime files');
