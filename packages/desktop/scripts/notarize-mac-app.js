const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: process.env,
      shell: false,
    });
    let timedOut = false;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, options.timeoutMs)
      : null;
    const output = [];
    child.stdout.on('data', (chunk) => {
      output.push(chunk.toString());
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output.push(chunk.toString());
      process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (timeout) clearTimeout(timeout);
      resolve({
        code: code ?? 0,
        signal,
        timedOut,
        output: output.join(''),
      });
    });
  });
}

function getAuthArgs(options = {}) {
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  if (appleId || appleIdPassword || teamId) {
    if (!appleId || !appleIdPassword || !teamId) {
      throw new Error('APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID must be set together');
    }
    return ['--apple-id', appleId, '--password', appleIdPassword, '--team-id', teamId];
  }

  const key = process.env.APPLE_API_KEY;
  const keyId = process.env.APPLE_API_KEY_ID;
  const issuer = process.env.APPLE_API_ISSUER;
  if (!key || !keyId) {
    throw new Error('APPLE_API_KEY and APPLE_API_KEY_ID are required for macOS notarization');
  }

  const args = ['--key', key, '--key-id', keyId];
  if (!options.omitIssuer && issuer) {
    args.push('--issuer', issuer);
  }
  return args;
}

async function submitForNotarization(zipPath, options = {}) {
  const args = [
    'notarytool',
    'submit',
    zipPath,
    ...getAuthArgs(options),
    '--output-format',
    'json',
  ];
  const result = await run('xcrun', args, { timeoutMs: 5 * 60 * 1000 });
  const output = result.output.trim();
  if (result.timedOut || result.signal || result.code !== 0) {
    const status = result.timedOut ? 'timeout' : result.signal ? `signal ${result.signal}` : `exit code ${result.code}`;
    throw new Error(`notarytool submit failed with ${status}\n${output || '(empty output)'}`);
  }
  if (!output) {
    throw new Error('notarytool submit returned empty output');
  }

  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`notarytool submit returned non-JSON output\n${output}`);
  }
}

async function readNotaryLog(submissionId, options = {}) {
  const result = await run('xcrun', ['notarytool', 'log', submissionId, ...getAuthArgs(options)], {
    timeoutMs: 2 * 60 * 1000,
  });
  return result.output.trim();
}

async function readNotaryInfo(submissionId, options = {}) {
  const result = await run(
    'xcrun',
    ['notarytool', 'info', submissionId, ...getAuthArgs(options), '--output-format', 'json'],
    { timeoutMs: 2 * 60 * 1000 },
  );
  const output = result.output.trim();
  if (result.timedOut || result.signal || result.code !== 0) {
    const status = result.timedOut ? 'timeout' : result.signal ? `signal ${result.signal}` : `exit code ${result.code}`;
    throw new Error(`notarytool info failed with ${status}\n${output || '(empty output)'}`);
  }
  if (!output) {
    throw new Error('notarytool info returned empty output');
  }
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`notarytool info returned non-JSON output\n${output}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNotarization(submissionId, options = {}) {
  const timeoutMs = Number(process.env.ORIGINOS_NOTARY_TIMEOUT_MS || 45 * 60 * 1000);
  const pollMs = Number(process.env.ORIGINOS_NOTARY_POLL_MS || 30 * 1000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const info = await readNotaryInfo(submissionId, options);
    const status = info.status || 'unknown';
    console.log(`[notarize-mac-app] submission ${submissionId} status: ${status}`);
    if (status === 'Accepted') {
      return info;
    }
    if (status === 'Invalid' || status === 'Rejected') {
      let diagnostics = '';
      try {
        diagnostics = await readNotaryLog(submissionId, options);
      } catch (error) {
        diagnostics = `failed to read notary log: ${error instanceof Error ? error.message : String(error)}`;
      }
      throw new Error(`notarization status was ${status}\n${JSON.stringify(info, null, 2)}\n${diagnostics}`);
    }
    await sleep(pollMs);
  }

  throw new Error(`notarization timed out after ${Math.round(timeoutMs / 1000)}s for submission ${submissionId}`);
}

async function notarize(zipPath) {
  const usedOptions = {};
  const submitted = await submitForNotarization(zipPath, usedOptions);
  if (!submitted.id) {
    throw new Error(`notarytool submit did not return a submission id\n${JSON.stringify(submitted, null, 2)}`);
  }
  console.log(`[notarize-mac-app] submission created: ${submitted.id}`);
  const response = await waitForNotarization(submitted.id, usedOptions);

  return response;
}

module.exports = async function notarizeMacApp(context) {
  if (process.platform !== 'darwin') {
    return;
  }
  if (process.env.ORIGINOS_SKIP_MAC_NOTARIZE === '1') {
    console.log('[notarize-mac-app] skipped by ORIGINOS_SKIP_MAC_NOTARIZE');
    return;
  }

  const productFilename = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${productFilename}.app`);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot notarize missing app: ${appPath}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originos-notarize-'));
  const zipPath = path.join(tempDir, `${productFilename}.zip`);
  console.log(`[notarize-mac-app] zipping ${appPath}`);
  const zipResult = await run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', path.basename(appPath), zipPath], {
    cwd: path.dirname(appPath),
  });
  if (zipResult.signal || zipResult.code !== 0) {
    const status = zipResult.signal ? `signal ${zipResult.signal}` : `exit code ${zipResult.code}`;
    throw new Error(`ditto failed with ${status}\n${zipResult.output}`);
  }

  const response = await notarize(zipPath);
  console.log(`[notarize-mac-app] notarization accepted: ${response.id || 'unknown id'}`);

  const stapleResult = await run('xcrun', ['stapler', 'staple', appPath], { timeoutMs: 2 * 60 * 1000 });
  if (stapleResult.timedOut || stapleResult.signal || stapleResult.code !== 0) {
    const status = stapleResult.timedOut ? 'timeout' : stapleResult.signal ? `signal ${stapleResult.signal}` : `exit code ${stapleResult.code}`;
    throw new Error(`stapler failed with ${status}\n${stapleResult.output}`);
  }
  console.log('[notarize-mac-app] stapled app successfully');
};
