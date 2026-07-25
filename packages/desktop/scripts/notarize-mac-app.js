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
      resolve({
        code: code || 0,
        signal,
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
    '--wait',
    '--output-format',
    'json',
  ];
  const result = await run('xcrun', args);
  const output = result.output.trim();
  if (result.signal || result.code !== 0) {
    const status = result.signal ? `signal ${result.signal}` : `exit code ${result.code}`;
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
  const result = await run('xcrun', ['notarytool', 'log', submissionId, ...getAuthArgs(options)]);
  return result.output.trim();
}

async function notarize(zipPath) {
  let response;
  let usedOptions = {};
  try {
    response = await submitForNotarization(zipPath, usedOptions);
  } catch (error) {
    const issuer = process.env.APPLE_API_ISSUER;
    const message = error instanceof Error ? error.message : String(error);
    if (!issuer || !message.includes('empty output')) {
      throw error;
    }
    console.warn('[notarize-mac-app] notarytool returned empty output with issuer; retrying without issuer');
    usedOptions = { omitIssuer: true };
    response = await submitForNotarization(zipPath, usedOptions);
  }

  if (response.status === 'Accepted') {
    return response;
  }

  let diagnostics = '';
  if (response.id) {
    try {
      diagnostics = await readNotaryLog(response.id, usedOptions);
    } catch (error) {
      diagnostics = `failed to read notary log: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  throw new Error(`notarization status was ${response.status || 'unknown'}\n${JSON.stringify(response, null, 2)}\n${diagnostics}`);
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

  const stapleResult = await run('xcrun', ['stapler', 'staple', appPath]);
  if (stapleResult.signal || stapleResult.code !== 0) {
    const status = stapleResult.signal ? `signal ${stapleResult.signal}` : `exit code ${stapleResult.code}`;
    throw new Error(`stapler failed with ${status}\n${stapleResult.output}`);
  }
  console.log('[notarize-mac-app] stapled app successfully');
};
