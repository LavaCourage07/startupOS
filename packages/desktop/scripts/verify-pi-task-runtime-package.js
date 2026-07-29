#!/usr/bin/env node

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const asar = require('@electron/asar');

const ADAPTER_PACKAGE = '@originos/pi-agent-adapter';
const ADAPTER_VERSION = '0.80.10';
const PI_TASKS_PACKAGE = 'pi-tasks';
const PI_TASKS_VERSION = '0.2.0';
const PI_TASKS_EXPORTS = ['TASK_STATE_EVENT', 'TASK_WIDGET_ID', 'default'];
const MAX_ERROR_MESSAGE_LENGTH = 240;

class PiTaskRuntimeVerificationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PiTaskRuntimeVerificationError';
    this.code = code;
    this.details = details;
  }
}

function packageNameParts(packageName) {
  return packageName.startsWith('@') ? packageName.split('/').slice(0, 2) : [packageName];
}

function findPackageJson(packageName, fromRequire) {
  const lookupPaths = fromRequire.resolve.paths(packageName) || [];
  for (const lookupPath of lookupPaths) {
    const candidate = path.join(lookupPath, ...packageNameParts(packageName), 'package.json');
    if (fs.existsSync(candidate)) {
      return fs.realpathSync(candidate);
    }
  }

  let entry;
  try {
    entry = fs.realpathSync(fromRequire.resolve(packageName));
  } catch (error) {
    throw new PiTaskRuntimeVerificationError(
      'MODULE_MISSING',
      `Required runtime module is missing: ${packageName}`,
      { module: packageName },
    );
  }

  let directory = fs.statSync(entry).isDirectory() ? entry : path.dirname(entry);
  while (directory !== path.dirname(directory)) {
    const packageJsonPath = path.join(directory, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = readPackageJson(packageJsonPath, packageName);
      if (packageJson.name === packageName) {
        return packageJsonPath;
      }
    }
    directory = path.dirname(directory);
  }

  throw new PiTaskRuntimeVerificationError(
    'PACKAGE_INVALID',
    `Unable to locate package metadata: ${packageName}`,
    { module: packageName },
  );
}

function readPackageJson(packageJsonPath, packageName) {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    throw new PiTaskRuntimeVerificationError(
      'PACKAGE_INVALID',
      `Runtime package metadata is invalid: ${packageName}`,
      { module: packageName },
    );
  }
}

function assertVersion(packageName, actualVersion, expectedVersion) {
  if (actualVersion !== expectedVersion) {
    throw new PiTaskRuntimeVerificationError(
      'VERSION_MISMATCH',
      `Runtime package version mismatch: ${packageName}`,
      {
        module: packageName,
        expectedVersion,
        actualVersion: actualVersion || 'missing',
      },
    );
  }
}

function assertAdapterExports(adapterRuntime) {
  if (!adapterRuntime || typeof adapterRuntime.Agent !== 'function') {
    throw new PiTaskRuntimeVerificationError(
      'EXPORT_MISMATCH',
      `Runtime package export mismatch: ${ADAPTER_PACKAGE}`,
      { module: ADAPTER_PACKAGE, expectedExports: ['Agent'] },
    );
  }
}

function assertPiTasksExports(piTasksRuntime) {
  const actualExports = Object.keys(piTasksRuntime).sort();
  if (
    JSON.stringify(actualExports) !== JSON.stringify(PI_TASKS_EXPORTS) ||
    typeof piTasksRuntime.default !== 'function' ||
    piTasksRuntime.TASK_STATE_EVENT !== 'pi-tasks:state' ||
    piTasksRuntime.TASK_WIDGET_ID !== 'pi-tasks'
  ) {
    throw new PiTaskRuntimeVerificationError(
      'EXPORT_MISMATCH',
      `Runtime package export mismatch: ${PI_TASKS_PACKAGE}`,
      {
        module: PI_TASKS_PACKAGE,
        expectedExports: PI_TASKS_EXPORTS,
        actualExports: actualExports.slice(0, 16),
      },
    );
  }
}

function resolveRuntimeDependencies(packageJson, packageRequire) {
  const dependencies = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
  ].sort();

  for (const dependency of dependencies) {
    try {
      packageRequire.resolve(dependency);
    } catch (error) {
      throw new PiTaskRuntimeVerificationError(
        'TRANSITIVE_DEPENDENCY_MISSING',
        `Runtime dependency is missing: ${dependency}`,
        { module: dependency, owner: packageJson.name },
      );
    }
  }

  return dependencies;
}

function createReport({ source, platform, adapterExports, piTasksExports, dependencies }) {
  const report = {
    schemaVersion: 1,
    source,
    platform,
    result: 'passed',
    packages: {
      [ADAPTER_PACKAGE]: {
        version: ADAPTER_VERSION,
        moduleFormat: 'cjs',
        exports: adapterExports,
      },
      [PI_TASKS_PACKAGE]: {
        version: PI_TASKS_VERSION,
        moduleFormat: 'esm',
        exports: piTasksExports,
        runtimeDependencies: dependencies,
      },
    },
  };
  const serialized = JSON.stringify(report);
  return {
    ...report,
    hash: crypto.createHash('sha256').update(serialized).digest('hex'),
  };
}

async function verifyRuntimeLayout(options) {
  const {
    baseDir,
    source = 'development',
    platform = `${process.platform}-${process.arch}`,
  } = options;
  const basePackageJson = path.join(baseDir, 'package.json');
  if (!fs.existsSync(basePackageJson)) {
    throw new PiTaskRuntimeVerificationError(
      'LAYOUT_INVALID',
      'Runtime layout does not contain package.json',
    );
  }

  const baseRequire = createRequire(basePackageJson);
  const adapterPackageJsonPath = findPackageJson(ADAPTER_PACKAGE, baseRequire);
  const adapterPackageJson = readPackageJson(adapterPackageJsonPath, ADAPTER_PACKAGE);
  assertVersion(ADAPTER_PACKAGE, adapterPackageJson.version, ADAPTER_VERSION);

  let adapterRuntime;
  try {
    adapterRuntime = baseRequire(ADAPTER_PACKAGE);
  } catch (error) {
    throw new PiTaskRuntimeVerificationError(
      'CJS_LOAD_FAILED',
      `CJS runtime load failed: ${ADAPTER_PACKAGE}`,
      { module: ADAPTER_PACKAGE },
    );
  }
  assertAdapterExports(adapterRuntime);

  const adapterRequire = createRequire(adapterPackageJsonPath);
  const piTasksPackageJsonPath = findPackageJson(PI_TASKS_PACKAGE, adapterRequire);
  const piTasksPackageJson = readPackageJson(piTasksPackageJsonPath, PI_TASKS_PACKAGE);
  assertVersion(PI_TASKS_PACKAGE, piTasksPackageJson.version, PI_TASKS_VERSION);

  const piTasksRequire = createRequire(piTasksPackageJsonPath);
  const runtimeDependencies = resolveRuntimeDependencies(piTasksPackageJson, piTasksRequire);
  let piTasksRuntime;
  try {
    const piTasksEntry = piTasksRequire.resolve(PI_TASKS_PACKAGE);
    piTasksRuntime = await import(pathToFileURL(piTasksEntry).href);
  } catch (error) {
    throw new PiTaskRuntimeVerificationError(
      'ESM_LOAD_FAILED',
      `ESM runtime load failed: ${PI_TASKS_PACKAGE}`,
      { module: PI_TASKS_PACKAGE },
    );
  }
  assertPiTasksExports(piTasksRuntime);

  return createReport({
    source,
    platform,
    adapterExports: ['Agent'],
    piTasksExports: Object.keys(piTasksRuntime).sort(),
    dependencies: runtimeDependencies,
  });
}

function normalizeAsarEntry(entry) {
  const normalized = entry
    .replace(/^(?:pack|unpack)\s*:\s*/, '')
    .replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized.slice(1) : normalized;
}

async function verifyAsarRuntime(options) {
  const {
    asarPath,
    platform,
  } = options;
  if (!fs.existsSync(asarPath)) {
    throw new PiTaskRuntimeVerificationError(
      'ASAR_MISSING',
      'Packaged runtime ASAR is missing',
    );
  }

  const entries = new Set(
    asar.listPackage(asarPath, { isPack: true }).map(normalizeAsarEntry),
  );
  const requiredEntries = [
    'node_modules/@originos/pi-agent-adapter/package.json',
    'node_modules/pi-tasks/package.json',
  ];
  for (const entry of requiredEntries) {
    if (!entries.has(entry)) {
      throw new PiTaskRuntimeVerificationError(
        'MODULE_MISSING',
        `Packaged runtime module is missing: ${entry.split('/package.json')[0]}`,
        { entry },
      );
    }
  }

  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originos-pi-task-package-'));
  try {
    asar.extractAll(asarPath, extractDir);
    return await verifyRuntimeLayout({
      baseDir: extractDir,
      source: 'asar',
      platform,
    });
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

function boundedFailure(error) {
  const knownError = error instanceof PiTaskRuntimeVerificationError;
  const message = knownError ? error.message : 'Unexpected runtime verification failure';
  return {
    schemaVersion: 1,
    result: 'failed',
    code: knownError ? error.code : 'UNEXPECTED_ERROR',
    message: message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
    details: knownError ? error.details : {},
  };
}

function parseArguments(argv) {
  const options = {
    mode: 'development',
    platform: `${process.platform}-${process.arch}`,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--development') {
      options.mode = 'development';
    } else if (argument === '--asar') {
      options.mode = 'asar';
      options.asarPath = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (argument === '--platform') {
      options.platform = argv[index + 1] || options.platform;
      index += 1;
    } else {
      throw new PiTaskRuntimeVerificationError(
        'ARGUMENT_INVALID',
        `Unknown verification argument: ${argument.slice(0, 80)}`,
      );
    }
  }
  if (options.mode === 'asar' && !options.asarPath) {
    throw new PiTaskRuntimeVerificationError('ARGUMENT_INVALID', '--asar requires a path');
  }
  return options;
}

async function main() {
  const desktopDir = path.resolve(__dirname, '..');
  const options = parseArguments(process.argv.slice(2));
  const report = options.mode === 'asar'
    ? await verifyAsarRuntime({
      asarPath: options.asarPath,
      platform: options.platform,
    })
    : await verifyRuntimeLayout({
      baseDir: desktopDir,
      source: 'development',
      platform: options.platform,
    });
  console.log(`[verify-pi-task-runtime-package] ${JSON.stringify(report)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[verify-pi-task-runtime-package] ${JSON.stringify(boundedFailure(error))}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ADAPTER_PACKAGE,
  ADAPTER_VERSION,
  PI_TASKS_EXPORTS,
  PI_TASKS_PACKAGE,
  PI_TASKS_VERSION,
  PiTaskRuntimeVerificationError,
  boundedFailure,
  verifyAsarRuntime,
  verifyRuntimeLayout,
};
