const { existsSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = join(__dirname, '..');
const cleanOnly = process.argv.includes('--clean-only');
const artifactsOnly = process.argv.includes('--artifacts-only');
const cleanupDirs = artifactsOnly ? [] : [join(rootDir, 'node_modules')];
const packagesDir = join(rootDir, 'packages');

if (!artifactsOnly && existsSync(packagesDir)) {
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      cleanupDirs.push(join(packagesDir, entry.name, 'node_modules'));
    }
  }
}

cleanupDirs.push(
  join(rootDir, 'packages', 'web', '.next'),
  join(rootDir, 'packages', 'desktop', 'dist-electron'),
  join(rootDir, 'dist-electron'),
);

console.log(
  `[repair-native-dependencies] cleaning dependencies for ${process.platform}/${process.arch}`,
);

for (const directory of cleanupDirs) {
  if (!existsSync(directory)) {
    continue;
  }

  console.log(`[repair-native-dependencies] removing ${directory}`);
  try {
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 250,
    });
  } catch (error) {
    if (process.platform === 'win32') {
      console.error(
        '[repair-native-dependencies] Windows could not remove a WSL-created link.',
      );
      console.error(
        'Run `node scripts/repair-native-dependencies.js --clean-only` once from WSL, then rerun `pnpm deps:repair:native` from Windows.',
      );
    }
    throw error;
  }
}

if (cleanOnly || artifactsOnly) {
  console.log('[repair-native-dependencies] generated directories removed');
  process.exit(0);
}

console.log(
  `[repair-native-dependencies] installing dependencies for ${process.platform}/${process.arch}`,
);

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const install = spawnSync(
  pnpmCommand,
  ['install', '--force', '--frozen-lockfile'],
  {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  },
);

if (install.error) {
  throw install.error;
}

if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

console.log('[repair-native-dependencies] native dependencies restored');
