#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function fail(message) {
  console.error(`[verify-apple-notary-credentials] ${message}`);
  if (process.env.GITHUB_ACTIONS === 'true') {
    const escaped = message
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A');
    console.error(`::error title=Apple notarization credentials failed::${escaped}`);
  }
  process.exit(1);
}

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

async function writeRcodesignApiKeyFile() {
  const key = process.env.APPLE_API_KEY;
  const keyId = process.env.APPLE_API_KEY_ID;
  const issuer = process.env.APPLE_API_ISSUER;
  if (!key) fail('APPLE_API_KEY must point to the prepared .p8 file');
  if (!keyId) fail('APPLE_API_KEY_ID is required');
  if (!issuer) fail('APPLE_API_ISSUER is required');
  if (!fs.existsSync(key)) fail(`APPLE_API_KEY file does not exist: ${key}`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originos-notary-verify-'));
  const apiKeyPath = path.join(tempDir, 'app-store-connect-api-key.json');
  const result = await run(
    'rcodesign',
    ['encode-app-store-connect-api-key', '-o', apiKeyPath, issuer, keyId, key],
    { timeoutMs: 2 * 60 * 1000 },
  );
  if (result.timedOut || result.signal || result.code !== 0) {
    const status = result.timedOut ? 'timeout' : result.signal ? `signal ${result.signal}` : `exit code ${result.code}`;
    fail(`rcodesign failed to encode App Store Connect API key with ${status}\n${result.output || '(empty output)'}`);
  }
  return apiKeyPath;
}

async function main() {
  const apiKeyPath = await writeRcodesignApiKeyFile();
  console.log('[verify-apple-notary-credentials] validating App Store Connect Notary API credentials');
  const result = await run('rcodesign', ['notary-list', '--api-key-file', apiKeyPath], {
    timeoutMs: 2 * 60 * 1000,
  });
  if (result.timedOut || result.signal || result.code !== 0) {
    const status = result.timedOut ? 'timeout' : result.signal ? `signal ${result.signal}` : `exit code ${result.code}`;
    fail(
      [
        `App Store Connect Notary API authentication failed with ${status}.`,
        'Check that APPLE_API_ISSUER, APPLE_API_KEY_ID, and APPLE_API_KEY belong to the same App Store Connect API key and that the key has notarization access.',
        result.output || '(empty output)',
      ].join('\n'),
    );
  }
  console.log('[verify-apple-notary-credentials] App Store Connect Notary API credentials accepted');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
