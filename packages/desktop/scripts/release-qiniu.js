#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopRoot = path.resolve(__dirname, '..');

function loadEnvFiles() {
  const envFiles = [
    path.join(desktopRoot, '.env.local'),
    path.join(desktopRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    path.join(repoRoot, '.env'),
  ];

  for (const filePath of envFiles) {
    if (!fs.existsSync(filePath)) continue;
    const parsed = dotenv.parse(fs.readFileSync(filePath));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function normalizeCodeSigningIdentity() {
  const cscName = process.env.CSC_NAME?.trim();
  if (!cscName) return;
  process.env.CSC_NAME = cscName.replace(/^Developer ID Application:\s*/i, '').trim();
}

function run(command, args, options = {}) {
  console.log(`[release-qiniu] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || desktopRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(options.env || {}),
    },
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
  }
}

function hasArg(name) {
  return process.argv.includes(name);
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

function currentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'));
  return pkg.version;
}

function getPlatformTargets() {
  const platform = getArgValue('--platform') || process.env.RELEASE_PLATFORM;

  if (!platform || platform === 'all') {
    return { buildMac: true, buildWin: true };
  }

  const normalized = platform.toLowerCase();
  if (normalized === 'mac' || normalized === 'macos') {
    return { buildMac: true, buildWin: false };
  }
  if (normalized === 'win' || normalized === 'windows') {
    return { buildMac: false, buildWin: true };
  }

  throw new Error(`Invalid platform: ${platform}. Use 'mac', 'windows', or 'all'`);
}

function main() {
  loadEnvFiles();
  normalizeCodeSigningIdentity();

  const skipBump = hasArg('--skip-bump') || process.env.RELEASE_SKIP_BUMP === '1';
  const publishExisting = hasArg('--publish-existing') || process.env.RELEASE_PUBLISH_EXISTING === '1';
  const force = hasArg('--force') || process.env.RELEASE_FORCE === '1';
  const releaseVersion = process.env.RELEASE_VERSION;
  const { buildMac, buildWin } = getPlatformTargets();

  // 传递 --force 给下游脚本
  if (force) {
    process.env.QINIU_FORCE = '1';
  }

  console.log('[release-qiniu] starting', {
    version: currentVersion(),
    platform: buildMac && buildWin ? 'all' : buildMac ? 'mac' : 'windows',
    skipBump,
    publishExisting,
    force,
    releaseVersion: releaseVersion || null,
    hasSigningIdentity: Boolean(process.env.CSC_NAME),
    notifyReleaseService: Boolean(process.env.ORIGINOS_RELEASE_API_URL),
  });

  if (!skipBump && !publishExisting) {
    run('pnpm', ['bump-version', ...(releaseVersion ? [releaseVersion] : [])]);
    console.log('[release-qiniu] bumped version', { version: currentVersion() });
  }

  if (!publishExisting) {
    run('pnpm', ['build:app']);

    if (buildMac) {
      console.log('[release-qiniu] building macOS targets');
      run('pnpm', ['exec', 'electron-builder', '--config', 'electron-builder.yml', '--mac', '--publish', 'never']);
    }

    if (buildWin) {
      console.log('[release-qiniu] building Windows targets');
      run('pnpm', ['exec', 'electron-builder', '--config', 'electron-builder.yml', '--win', '--publish', 'never']);
    }
  }

  if (buildMac) {
    run('pnpm', ['verify:mac-signing']);
  }

  if (buildWin) {
    run('pnpm', ['verify:win-package']);
  }

  run('pnpm', ['publish:qiniu']);

  console.log('[release-qiniu] completed', { version: currentVersion() });
}

try {
  main();
} catch (error) {
  console.error('[release-qiniu] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
