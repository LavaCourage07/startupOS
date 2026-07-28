#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const pnpmVersion = process.env.PNPM_VERSION || '9.15.9';
const defaultWinePrefix = path.join(repoRoot, '.wine-originos');
const defaultEnv = {
  CI: process.env.CI || 'true',
  ONNXRUNTIME_NODE_INSTALL: process.env.ONNXRUNTIME_NODE_INSTALL || 'skip',
  npm_config_onnxruntime_node_install: process.env.npm_config_onnxruntime_node_install || 'skip',
};

if (process.platform !== 'win32' && !process.env.WINEPREFIX) {
  defaultEnv.WINEPREFIX = defaultWinePrefix;
}

function run(command, args, options = {}) {
  console.log(`[build-windows-local] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: {
      ...process.env,
      ...defaultEnv,
      ...options.env,
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const pnpm = [`pnpm@${pnpmVersion}`];

run('npx', [...pnpm, 'install', '--frozen-lockfile']);
run('npx', [...pnpm, '--filter', '@originos/desktop', 'build:app'], {
  env: { ORIGINOS_WINDOWS_SHORT_ZIP: '1' },
});
run('npx', [...pnpm, '--filter', '@originos/desktop', 'verify:workspace-upload']);
run('npx', [...pnpm, 'exec', 'electron-builder', '--config', 'electron-builder.yml', '--win', '--publish', 'never'], {
  cwd: desktopDir,
  env: { CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
});
run('npx', [...pnpm, '--filter', '@originos/desktop', 'verify:win-package']);
