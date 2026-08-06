import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import asar from '@electron/asar';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '..', '..', '..', '..');
const { verifyAsarRuntime, verifyRuntimeLayout } = require('../verify-pi-task-runtime-package.js');
const temporaryDirectories = [];

const taskRuntimeExports = [
  'DEFAULT_SANITIZE_LIMITS', 'PI_TASK_COMPATIBILITY_REQUIREMENTS',
  'PI_TASK_CONTRACT_VERSION', 'PI_TASK_SNAPSHOT_VERSION', 'PI_TASK_STATE_EVENT_NAME',
  'PI_TASK_STATE_EVENT_VERSION', 'PI_TASK_TOOL_NAMES', 'assertAllowedPiTaskTool',
  'assertPiTaskCompatibility', 'createBoundedPiTaskSnapshot',
  'createPiTaskCompatibilityGuard', 'createPiTaskRuntimeBridge',
  'evaluatePiTaskCompatibility', 'isAllowedPiTaskTool', 'mapPiTaskRuntimeError',
  'normalizePiTaskCommand', 'sanitizeTaskRuntimeValue', 'stableJsonHash',
  'stableJsonStringify',
];

function temporaryDirectory(prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writePackage(root, packageName, manifest, source) {
  const directory = path.join(root, 'node_modules', ...packageName.split('/'));
  writeJson(path.join(directory, 'package.json'), manifest);
  fs.writeFileSync(path.join(directory, 'index.cjs'), source);
  return directory;
}

function taskRuntimeSource() {
  const functions = taskRuntimeExports.filter((name) => ![
    'DEFAULT_SANITIZE_LIMITS', 'PI_TASK_COMPATIBILITY_REQUIREMENTS',
    'PI_TASK_CONTRACT_VERSION', 'PI_TASK_SNAPSHOT_VERSION', 'PI_TASK_STATE_EVENT_NAME',
    'PI_TASK_STATE_EVENT_VERSION', 'PI_TASK_TOOL_NAMES',
  ].includes(name));
  return [
    "const compatibility = { adapterContractVersion: 1, runtimePackage: '@earendil-works/pi-coding-agent', runtimeVersion: '0.80.10', runtimeHostInvokeContractVersion: 1, taskExtensionPackage: '@originos/pi-tasks', taskExtensionVersion: '0.2.0-originos.1', taskExtensionContractVersion: 2, taskLedgerEventVersion: 2, taskStateEventVersion: 2 };",
    `module.exports = { DEFAULT_SANITIZE_LIMITS: {}, PI_TASK_COMPATIBILITY_REQUIREMENTS: compatibility, PI_TASK_CONTRACT_VERSION: 1, PI_TASK_SNAPSHOT_VERSION: 1, PI_TASK_STATE_EVENT_NAME: 'pi-tasks:state', PI_TASK_STATE_EVENT_VERSION: 2, PI_TASK_TOOL_NAMES: [], ${functions.map((name) => `${name}: function ${name}() {}`).join(', ')} };`,
    '',
  ].join('\n');
}

function writeFixture(options = {}) {
  const root = temporaryDirectory('originos-pi-task-layout-');
  writeJson(path.join(root, 'package.json'), { name: 'runtime-fixture', private: true });
  const adapterDirectory = writePackage(root, '@originos/pi-agent-adapter', {
    name: '@originos/pi-agent-adapter',
    version: '0.80.10',
    main: './index.cjs',
    exports: {
      '.': './index.cjs',
      './task-runtime': './task-runtime.js',
    },
    dependencies: {
      '@earendil-works/pi-agent-core': '0.80.10',
      '@earendil-works/pi-coding-agent': '0.80.10',
      '@originos/pi-tasks': '0.2.0-originos.1',
      ...(options.missingTransitive ? { 'missing-runtime-dependency': '1.0.0' } : {}),
    },
  }, 'module.exports = { Agent: class Agent {} };\n');
  fs.writeFileSync(
    path.join(adapterDirectory, 'task-runtime.js'),
    "module.exports = require('./dist/task-runtime.cjs');\n",
  );
  fs.mkdirSync(path.join(adapterDirectory, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(adapterDirectory, 'dist', 'task-runtime.cjs'),
    options.badTaskRuntime ? 'module.exports = {};\n' : taskRuntimeSource(),
  );

  writePackage(root, '@earendil-works/pi-agent-core', {
    name: '@earendil-works/pi-agent-core', version: '0.80.10', main: './index.cjs',
  }, 'exports.invokeRegisteredToolCall = function invokeRegisteredToolCall() {};\n');
  writePackage(root, '@earendil-works/pi-coding-agent', {
    name: '@earendil-works/pi-coding-agent', version: '0.80.10', main: './index.cjs',
  }, 'exports.AgentSession = class AgentSession { invokeRegisteredTool() {} };\n');

  if (!options.missingControlledPackage) {
    const controlledDirectory = path.join(root, 'node_modules', '@originos', 'pi-tasks');
    fs.cpSync(path.join(repositoryRoot, 'packages', 'pi-tasks'), controlledDirectory, {
      recursive: true,
      filter(source) {
        return !source.includes(`${path.sep}test${path.sep}`);
      },
    });
    if (options.controlledVersion) {
      const manifestPath = path.join(controlledDirectory, 'package.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.version = options.controlledVersion;
      writeJson(manifestPath, manifest);
    }
  }
  return root;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('Pi Task Runtime package verification', () => {
  it('验证 development public export、两个 patch、受控 package 和依赖闭包', async () => {
    const report = await verifyRuntimeLayout({
      baseDir: writeFixture(),
      repositoryRoot,
      platform: 'development-test',
    });
    expect(report).toMatchObject({
      schemaVersion: 2,
      source: 'development',
      platform: 'development-test',
      result: 'passed',
      adapter: { publicExport: '@originos/pi-agent-adapter/task-runtime' },
      controlledTaskPackage: {
        version: '0.2.0-originos.1',
        eventVersion: 2,
        stateEventVersion: 2,
      },
      runtimePatchSet: { version: 1 },
    });
    expect(report.runtimePatchSet.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(report.transitiveDependencies).toMatchObject({ count: 3 });
    expect(report.transitiveDependencies.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('允许布局根目录使用指向真实路径的别名', async () => {
    const layout = writeFixture();
    const aliasRoot = temporaryDirectory('originos-pi-task-alias-');
    const aliasPath = path.join(aliasRoot, 'runtime-layout');
    fs.symlinkSync(layout, aliasPath, process.platform === 'win32' ? 'junction' : 'dir');

    const report = await verifyRuntimeLayout({
      baseDir: aliasPath,
      repositoryRoot,
      platform: 'path-alias-test',
    });

    expect(report).toMatchObject({
      source: 'development',
      platform: 'path-alias-test',
      result: 'passed',
    });
  });

  it('拒绝通过符号链接逃逸到布局外的依赖', async () => {
    const layout = writeFixture();
    const externalRoot = temporaryDirectory('originos-pi-task-external-');
    const externalPackage = writePackage(externalRoot, '@earendil-works/pi-agent-core', {
      name: '@earendil-works/pi-agent-core', version: '0.80.10', main: './index.cjs',
    }, 'exports.invokeRegisteredToolCall = function invokeRegisteredToolCall() {};\n');
    const linkedPackage = path.join(
      layout,
      'node_modules',
      '@earendil-works',
      'pi-agent-core',
    );
    fs.rmSync(linkedPackage, { recursive: true, force: true });
    fs.symlinkSync(externalPackage, linkedPackage, process.platform === 'win32' ? 'junction' : 'dir');

    await expect(verifyRuntimeLayout({ baseDir: layout, repositoryRoot }))
      .rejects.toMatchObject({
        code: 'MODULE_OUTSIDE_LAYOUT',
        details: { modulePath: fs.realpathSync(path.join(externalPackage, 'package.json')) },
      });
  });

  it('将悬空布局别名报告为结构化布局错误', async () => {
    const aliasRoot = temporaryDirectory('originos-pi-task-dangling-');
    const missingLayout = path.join(aliasRoot, 'missing-layout');
    const aliasPath = path.join(aliasRoot, 'runtime-layout');
    fs.symlinkSync(missingLayout, aliasPath, process.platform === 'win32' ? 'junction' : 'dir');

    await expect(verifyRuntimeLayout({ baseDir: aliasPath, repositoryRoot }))
      .rejects.toMatchObject({
        code: 'LAYOUT_INVALID',
        details: { targetPath: aliasPath },
      });
  });

  it('验证 ASAR inventory 和提取后的真实模块加载', async () => {
    const layout = writeFixture();
    const asarPath = path.join(temporaryDirectory('originos-pi-task-asar-'), 'app.asar');
    await asar.createPackage(layout, asarPath);
    const report = await verifyAsarRuntime({ asarPath, platform: 'windows-x64', repositoryRoot });
    expect(report).toMatchObject({ source: 'asar', platform: 'windows-x64', result: 'passed' });
  });

  it('缺少受控 package 时 fail closed', async () => {
    await expect(verifyRuntimeLayout({
      baseDir: writeFixture({ missingControlledPackage: true }), repositoryRoot,
    })).rejects.toMatchObject({ code: 'MODULE_OUTSIDE_LAYOUT' });
  });

  it('拒绝受控 package 版本漂移', async () => {
    await expect(verifyRuntimeLayout({
      baseDir: writeFixture({ controlledVersion: '0.2.0-originos.2' }), repositoryRoot,
    })).rejects.toMatchObject({
      code: 'VERSION_MISMATCH',
      details: { module: '@originos/pi-tasks', expectedVersion: '0.2.0-originos.1' },
    });
  });

  it('拒绝 Adapter public export 漂移', async () => {
    await expect(verifyRuntimeLayout({
      baseDir: writeFixture({ badTaskRuntime: true }), repositoryRoot,
    })).rejects.toMatchObject({ code: 'EXPORT_MISMATCH' });
  });

  it('缺少任意 transitive dependency 时 fail closed', async () => {
    await expect(verifyRuntimeLayout({
      baseDir: writeFixture({ missingTransitive: true }), repositoryRoot,
    })).rejects.toMatchObject({ code: 'MODULE_MISSING' });
  });
});
