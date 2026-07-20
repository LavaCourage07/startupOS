#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const qiniu = require('qiniu');
const { execFileSync } = require('node:child_process');
const { buildReleaseNotes } = require('./release-notes');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopRoot = path.resolve(__dirname, '..');
const desktopPackage = require('../package.json');
const version = desktopPackage.version;
const releaseDir = path.join(repoRoot, 'release');

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

loadEnvFiles();

function env(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

function requiredEnv(name, fallbackName) {
  const value = env(name, fallbackName);
  if (!value) {
    const suffix = fallbackName ? ` or ${fallbackName}` : '';
    throw new Error(`Missing required env: ${name}${suffix}`);
  }
  return value;
}

function normalizePrefix(prefix) {
  return String(prefix || 'originos-ce/updates/stable')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function remoteKey(prefix, fileName) {
  return prefix ? `${prefix}/${fileName}` : fileName;
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing release artifact: ${filePath}`);
  }
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('base64');
}

function verifyMacSigning() {
  execFileSync(process.execPath, [path.join(__dirname, 'verify-mac-signing.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '',
    },
  });
}

function verifyWindowsPackage() {
  execFileSync(process.execPath, [path.join(__dirname, 'verify-windows-package.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '',
    },
  });
}

function generateUpdateMetadata(platform) {
  const releaseDate = new Date().toISOString();
  const isMac = platform === 'mac';

  const archOrder = isMac ? ['x64', 'arm64'] : ['x64'];
  const ext = isMac ? 'zip' : 'zip';
  const prefix = isMac ? '' : 'OriginOS CE-';

  const entries = archOrder.map((arch) => {
    const zipFileName = `OriginOS CE-${version}-${arch}.zip`;
    const zipFilePath = path.join(releaseDir, zipFileName);
    assertFile(zipFilePath);
    return {
      fileName: zipFileName,
      filePath: zipFilePath,
      size: fs.statSync(zipFilePath).size,
      sha512: sha512Base64(zipFilePath),
    };
  });

  const primary = entries[0];
  const lines = [
    `version: ${version}`,
    'files:',
    ...entries.flatMap((entry) => [
      `  - url: ${entry.fileName}`,
      `    sha512: ${entry.sha512}`,
      `    size: ${entry.size}`,
    ]),
    `path: ${primary.fileName}`,
    `sha512: ${primary.sha512}`,
    `releaseDate: '${releaseDate}'`,
    '',
  ];

  const metadataName = `latest-${platform}.yml`;
  const metadataPath = path.join(releaseDir, metadataName);
  fs.writeFileSync(metadataPath, lines.join('\n'), 'utf8');

  const stableName = `stable-${platform}.yml`;
  fs.copyFileSync(metadataPath, path.join(releaseDir, stableName));

  return metadataPath;
}

function statObject(bucketManager, bucket, key) {
  return new Promise((resolve, reject) => {
    bucketManager.stat(bucket, key, (error, body, info) => {
      if (error) {
        reject(error);
        return;
      }
      if (info.statusCode === 200) {
        resolve({ exists: true, body });
        return;
      }
      if (info.statusCode === 612) {
        resolve({ exists: false });
        return;
      }
      reject(new Error(`Qiniu stat failed: ${key} status=${info.statusCode} body=${JSON.stringify(body)}`));
    });
  });
}

function uploadFile({ mac, config, bucket, key, filePath, overwrite, cacheControl }) {
  return new Promise((resolve, reject) => {
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: `${bucket}:${key}`,
      insertOnly: overwrite ? 0 : 1,
    });
    const uploadToken = putPolicy.uploadToken(mac);
    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();

    // 设置 cache-control
    if (cacheControl) {
      putExtra.customVars = { 'x-qn-meta-cache-control': cacheControl };
    }

    formUploader.putFile(uploadToken, key, filePath, putExtra, (error, body, info) => {
      if (error) {
        reject(error);
        return;
      }
      if (info.statusCode === 200) {
        resolve(body);
        return;
      }
      reject(new Error(`Qiniu upload failed: ${key} status=${info.statusCode} body=${JSON.stringify(body)}`));
    });
  });
}

function buildArtifacts(metadataFiles, metadataOnly, force) {
  const files = [];

  if (!metadataOnly) {
    // macOS 版本
    for (const arch of ['arm64', 'x64']) {
      const dmg = `OriginOS CE-${version}-${arch}.dmg`;
      const dmgPath = path.join(releaseDir, dmg);
      if (fs.existsSync(dmgPath)) {
        files.push({
          fileName: dmg,
          filePath: dmgPath,
          overwrite: force,
        });
        files.push({
          fileName: `${dmg}.blockmap`,
          filePath: path.join(releaseDir, `${dmg}.blockmap`),
          overwrite: force,
        });
      }

      // ZIP 格式（electron-updater 自动更新需要）
      const zip = `OriginOS CE-${version}-${arch}.zip`;
      const zipPath = path.join(releaseDir, zip);
      if (fs.existsSync(zipPath)) {
        files.push({
          fileName: zip,
          filePath: zipPath,
          overwrite: force,
        });
        files.push({
          fileName: `${zip}.blockmap`,
          filePath: path.join(releaseDir, `${zip}.blockmap`),
          overwrite: force,
        });
      }
    }

    // Windows 版本
    const exe = `OriginOS CE-${version}-x64.exe`;
    const exePath = path.join(releaseDir, exe);
    if (fs.existsSync(exePath)) {
      files.push({
        fileName: exe,
        filePath: exePath,
        overwrite: force,
      });
      files.push({
        fileName: `${exe}.blockmap`,
        filePath: path.join(releaseDir, `${exe}.blockmap`),
        overwrite: force,
      });
    }

    // Windows ZIP（electron-updater 需要）
    const winZip = `OriginOS CE-${version}-x64.zip`;
    const winZipPath = path.join(releaseDir, winZip);
    if (fs.existsSync(winZipPath)) {
      // 检查是否和 macOS x64 zip 同名（macOS 也有 x64 zip）
      const macX64Zip = `OriginOS CE-${version}-x64.zip`;
      const macX64ZipPath = path.join(releaseDir, macX64Zip);
      if (!fs.existsSync(macX64ZipPath) || winZipPath === macX64ZipPath) {
        // Windows zip 和 macOS x64 zip 是同一个文件，不需要重复添加
      } else {
        files.push({
          fileName: winZip,
          filePath: winZipPath,
          overwrite: force,
        });
        files.push({
          fileName: `${winZip}.blockmap`,
          filePath: path.join(releaseDir, `${winZip}.blockmap`),
          overwrite: force,
        });
      }
    }
  }

  // 添加元数据文件
  for (const metadataFile of metadataFiles) {
    const metadataName = path.basename(metadataFile);
    files.push({
      fileName: metadataName,
      filePath: metadataFile,
      overwrite: true,
    });

    // 添加 stable 版本
    const stableName = metadataName.replace('latest-', 'stable-');
    if (stableName !== metadataName) {
      files.push({
        fileName: stableName,
        filePath: path.join(releaseDir, stableName),
        overwrite: true,
      });
    }
  }

  return files;
}

function cdnUrl(baseUrl, key, prefix) {
  if (!baseUrl) return null;
  const base = ensureTrailingSlash(baseUrl);
  const relative = prefix && key.startsWith(`${prefix}/`) ? key.slice(prefix.length + 1) : key;
  return new URL(relative.split('/').map(encodeURIComponent).join('/'), base).toString();
}

async function verifyCdnUrl(url) {
  if (!url) return;
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`CDN verification failed: ${response.status} ${url}`);
  }
}

async function main() {
  const accessKey = requiredEnv('QINIU_ACCESS_KEY', 'QINIU_AK');
  const secretKey = requiredEnv('QINIU_SECRET_KEY', 'QINIU_AS');
  const bucket = requiredEnv('QINIU_BUCKET');
  const prefix = normalizePrefix(process.env.QINIU_PREFIX);
  const region = process.env.QINIU_REGION || 'z0';
  const baseUrl = process.env.ORIGINOS_UPDATE_BASE_URL;
  const skipCdnVerify = process.env.QINIU_SKIP_CDN_VERIFY === '1';
  const metadataOnly = process.env.QINIU_METADATA_ONLY === '1';
  const force = process.env.QINIU_FORCE === '1';
  const resumeExisting = process.env.QINIU_RESUME_EXISTING === '1';

  const config = new qiniu.conf.Config();
  config.regionsProvider = qiniu.httpc.Region.fromRegionId(region);
  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  const bucketManager = new qiniu.rs.BucketManager(mac, config);

  // 检测有哪些平台的构建产物
  const hasMacArm64 = fs.existsSync(path.join(releaseDir, `OriginOS CE-${version}-arm64.dmg`));
  const hasMacX64 = fs.existsSync(path.join(releaseDir, `OriginOS CE-${version}-x64.dmg`));
  const hasWinExe = fs.existsSync(path.join(releaseDir, `OriginOS CE-${version}-x64.exe`));
  const hasWinZip = fs.existsSync(path.join(releaseDir, `OriginOS CE-${version}-x64.zip`));

  const metadataFiles = [];

  // 生成 macOS 元数据
  if (hasMacArm64 || hasMacX64) {
    console.log('[publish-qiniu-updates] generating macOS update metadata');
    metadataFiles.push(generateUpdateMetadata('mac'));
  }

  // 生成 Windows 元数据
  if (hasWinExe || hasWinZip) {
    console.log('[publish-qiniu-updates] generating Windows update metadata');
    metadataFiles.push(generateUpdateMetadata('win'));
  }

  const artifacts = buildArtifacts(metadataFiles, metadataOnly, force);

  for (const artifact of artifacts) {
    assertFile(artifact.filePath);
  }

  if (!metadataOnly) {
    if (hasMacArm64 || hasMacX64) {
      verifyMacSigning();
    }
    if (hasWinExe) {
      verifyWindowsPackage();
    }
  }

  console.log('[publish-qiniu-updates] release', {
    version,
    bucket,
    prefix,
    region,
    baseUrl: baseUrl || null,
    metadataOnly,
    force,
    resumeExisting,
    platforms: {
      mac: hasMacArm64 || hasMacX64,
      windows: hasWinExe || hasWinZip,
    },
  });

  // Upload immutable artifacts first. The update metadata is uploaded last so
  // clients never see a new version before its packages are available.
  for (const artifact of artifacts) {
    const key = remoteKey(prefix, artifact.fileName);
    if (!artifact.overwrite) {
      const stat = await statObject(bucketManager, bucket, key);
      if (stat.exists) {
        if (resumeExisting) {
          console.log(`[publish-qiniu-updates] skipping existing ${key}`);
          continue;
        }
        throw new Error(`Refusing to overwrite existing release artifact: ${key}`);
      }
    } else if (force) {
      console.log(`[publish-qiniu-updates] force mode: will overwrite ${key}`);
    }

    console.log(`[publish-qiniu-updates] uploading ${artifact.fileName} -> ${key}`);
    // 为元数据文件设置较短的 cache-control
    const isMetadata = artifact.fileName.endsWith('.yml') || artifact.fileName.endsWith('.yaml');
    const cacheControl = isMetadata ? 'public, max-age=300' : undefined;
    await uploadFile({
      mac,
      config,
      bucket,
      key,
      filePath: artifact.filePath,
      overwrite: artifact.overwrite,
      cacheControl,
    });

    const url = cdnUrl(baseUrl, key, prefix);
    if (url && !skipCdnVerify) {
      console.log(`[publish-qiniu-updates] verifying ${url}`);
      await verifyCdnUrl(url);
    }
  }

  // Notify the official website release service
  await notifyReleaseService(version, baseUrl, prefix);

  console.log('[publish-qiniu-updates] published successfully');
}

async function notifyReleaseService(version, baseUrl, prefix) {
  const releaseApiUrl = process.env.ORIGINOS_RELEASE_API_URL;
  const releaseApiKey = process.env.ORIGINOS_RELEASE_API_KEY;

  if (!releaseApiUrl) {
    console.log('[publish-qiniu-updates] ORIGINOS_RELEASE_API_URL not set, skipping release service notification');
    return;
  }

  if (!releaseApiKey) {
    console.warn('[publish-qiniu-updates] ORIGINOS_RELEASE_API_KEY not set, skipping release service notification');
    return;
  }

  // Build download URLs
  const cdnBase = ensureTrailingSlash(baseUrl || 'https://cdn.artseeu.cn/originos-ce/updates/stable/');
  const releaseNotes = buildReleaseNotes(version);

  const releaseData = {
    version: version,
    win_x64_url: new URL(`OriginOS CE-${version}-x64.exe`, cdnBase).toString(),
    mac_arm64_url: new URL(`OriginOS CE-${version}-arm64.dmg`, cdnBase).toString(),
    mac_x64_url: new URL(`OriginOS CE-${version}-x64.dmg`, cdnBase).toString(),
    release_summary: releaseNotes.summary,
    release_notes: releaseNotes.markdown,
    changelog: releaseNotes,
  };

  console.log('[publish-qiniu-updates] notifying release service', {
    url: releaseApiUrl,
    version: releaseData.version,
    changelogItems: releaseNotes.items.length,
  });

  try {
    const response = await fetch(releaseApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': releaseApiKey,
      },
      body: JSON.stringify(releaseData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Release service returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('[publish-qiniu-updates] release service notified successfully', result);
  } catch (error) {
    // Don't fail the entire publish process if release service notification fails
    console.error('[publish-qiniu-updates] failed to notify release service:', error instanceof Error ? error.message : error);
  }
}

main().catch((error) => {
  console.error('[publish-qiniu-updates] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
