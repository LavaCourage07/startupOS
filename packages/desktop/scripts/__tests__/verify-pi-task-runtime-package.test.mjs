import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import asar from '@electron/asar';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const {
  verifyAsarRuntime,
  verifyRuntimeLayout,
} = require('../verify-pi-task-runtime-package.js');

const temporaryDirectories = [];

function createTemporaryDirectory(prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFixture(options = {}) {
  const root = createTemporaryDirectory('originos-pi-task-layout-');
  const adapterDirectory = path.join(
    root,
    'node_modules',
    '@originos',
    'pi-agent-adapter',
  );
  const piTasksDirectory = path.join(root, 'node_modules', 'pi-tasks');

  writeJson(path.join(root, 'package.json'), {
    name: 'runtime-fixture',
    private: true,
  });
  writeJson(path.join(adapterDirectory, 'package.json'), {
    name: '@originos/pi-agent-adapter',
    version: options.adapterVersion || '0.80.10',
    main: './index.cjs',
    dependencies: {
      'pi-tasks': '0.2.0',
    },
  });
  fs.writeFileSync(
    path.join(adapterDirectory, 'index.cjs'),
    options.adapterSource || 'module.exports = { Agent: class Agent {} };\n',
  );

  if (!options.missingPiTasks) {
    writeJson(path.join(piTasksDirectory, 'package.json'), {
      name: 'pi-tasks',
      version: options.piTasksVersion || '0.2.0',
      type: 'module',
      exports: './index.js',
    });
    fs.writeFileSync(
      path.join(piTasksDirectory, 'index.js'),
      options.piTasksSource || [
        "export const TASK_STATE_EVENT = 'pi-tasks:state';",
        "export const TASK_WIDGET_ID = 'pi-tasks';",
        'export default function piTasks() {}',
        '',
      ].join('\n'),
    );
  }

  return root;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('Pi task runtime package verification', () => {
  it('loads the development CJS adapter and ESM pi-tasks public exports', async () => {
    const desktopDirectory = path.resolve(testDirectory, '..', '..');
    const report = await verifyRuntimeLayout({
      baseDir: desktopDirectory,
      platform: 'development-test',
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      source: 'development',
      platform: 'development-test',
      result: 'passed',
      packages: {
        '@originos/pi-agent-adapter': {
          version: '0.80.10',
          moduleFormat: 'cjs',
          exports: ['Agent'],
        },
        'pi-tasks': {
          version: '0.2.0',
          moduleFormat: 'esm',
          exports: ['TASK_STATE_EVENT', 'TASK_WIDGET_ID', 'default'],
          runtimeDependencies: [],
        },
      },
    });
    expect(report.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('checks ASAR inventory and dynamically imports from the extracted root', async () => {
    const layout = writeFixture();
    const outputDirectory = createTemporaryDirectory('originos-pi-task-asar-');
    const asarPath = path.join(outputDirectory, 'app.asar');
    await asar.createPackage(layout, asarPath);

    const report = await verifyAsarRuntime({
      asarPath,
      platform: 'windows-x64',
    });

    expect(report).toMatchObject({
      source: 'asar',
      platform: 'windows-x64',
      result: 'passed',
    });
  });

  it('fails closed when a packaged module is missing', async () => {
    const layout = writeFixture({ missingPiTasks: true });
    const outputDirectory = createTemporaryDirectory('originos-pi-task-asar-');
    const asarPath = path.join(outputDirectory, 'app.asar');
    await asar.createPackage(layout, asarPath);

    await expect(verifyAsarRuntime({
      asarPath,
      platform: 'macos-arm64',
    })).rejects.toMatchObject({
      code: 'MODULE_MISSING',
    });
  });

  it('rejects an incompatible pi-tasks version', async () => {
    const layout = writeFixture({ piTasksVersion: '0.3.0' });

    await expect(verifyRuntimeLayout({
      baseDir: layout,
      platform: 'fixture',
    })).rejects.toMatchObject({
      code: 'VERSION_MISMATCH',
      details: {
        module: 'pi-tasks',
        expectedVersion: '0.2.0',
        actualVersion: '0.3.0',
      },
    });
  });

  it('rejects an incompatible public export surface', async () => {
    const layout = writeFixture({
      piTasksSource: [
        "export const TASK_STATE_EVENT = 'pi-tasks:state';",
        "export const TASK_WIDGET_ID = 'wrong-widget';",
        'export default function piTasks() {}',
        '',
      ].join('\n'),
    });

    await expect(verifyRuntimeLayout({
      baseDir: layout,
      platform: 'fixture',
    })).rejects.toMatchObject({
      code: 'EXPORT_MISMATCH',
      details: {
        module: 'pi-tasks',
      },
    });
  });

  it('reports a bounded CJS load failure', async () => {
    const layout = writeFixture({
      adapterSource: "throw new Error('credential=/private/value');\n",
    });

    await expect(verifyRuntimeLayout({
      baseDir: layout,
      platform: 'fixture',
    })).rejects.toMatchObject({
      code: 'CJS_LOAD_FAILED',
      message: 'CJS runtime load failed: @originos/pi-agent-adapter',
    });
  });

  it('reports a bounded ESM load failure', async () => {
    const layout = writeFixture({
      piTasksSource: "throw new Error('home=/private/value');\n",
    });

    await expect(verifyRuntimeLayout({
      baseDir: layout,
      platform: 'fixture',
    })).rejects.toMatchObject({
      code: 'ESM_LOAD_FAILED',
      message: 'ESM runtime load failed: pi-tasks',
    });
  });
});
