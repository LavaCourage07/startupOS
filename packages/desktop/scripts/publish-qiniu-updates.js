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
const MIN_RELEASE_PACKAGE_BYTES = 1024 * 1024;

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

function hasReleasePackage(fileName) {
  const filePath = path.join(releaseDir, fileName);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  return fs.statSync(filePath).size >= MIN_RELEASE_PACKAGE_BYTES;
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

  if (platform === 'win') {
    fs.copyFileSync(metadataPath, path.join(releaseDir, 'latest.yml'));
    fs.copyFileSync(metadataPath, path.join(releaseDir, 'stable.yml'));
  }

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
  const pushArtifact = (fileName, overwrite = force) => {
    files.push({
      fileName,
      filePath: path.join(releaseDir, fileName),
      overwrite,
    });
  };
  const pushOptionalArtifact = (fileName, overwrite = force) => {
    if (fs.existsSync(path.join(releaseDir, fileName))) {
      pushArtifact(fileName, overwrite);
    }
  };

  if (!metadataOnly) {
    // macOS 版本
    for (const arch of ['arm64', 'x64']) {
      const dmg = `OriginOS CE-${version}-${arch}.dmg`;
      if (hasReleasePackage(dmg)) {
        pushArtifact(dmg);
        pushOptionalArtifact(`${dmg}.blockmap`);

        // ZIP 格式（electron-updater 自动更新需要）。macOS x64 zip 与
        // Windows zip 文件名相同，只有对应 dmg 存在时才归类为 macOS。
        const zip = `OriginOS CE-${version}-${arch}.zip`;
        if (hasReleasePackage(zip)) {
          pushArtifact(zip);
          pushOptionalArtifact(`${zip}.blockmap`);
        }
      }
    }

    // Windows 版本
    const exe = `OriginOS CE-${version}-x64.exe`;
    if (hasReleasePackage(exe)) {
      pushArtifact(exe);
      pushOptionalArtifact(`${exe}.blockmap`);
    }

    // Windows ZIP（electron-updater 需要）
    const winZip = `OriginOS CE-${version}-x64.zip`;
    if (hasReleasePackage(winZip)) {
      pushArtifact(winZip);
      pushOptionalArtifact(`${winZip}.blockmap`);
    }
  }

  // 添加元数据文件
  for (const metadataFile of metadataFiles) {
    const metadataName = path.basename(metadataFile);
    pushArtifact(metadataName, true);

    // 添加 stable 版本
    const stableName = metadataName.replace('latest-', 'stable-');
    if (stableName !== metadataName) {
      pushArtifact(stableName, true);
    }

    if (metadataName === 'latest-win.yml') {
      pushArtifact('latest.yml', true);
      pushArtifact('stable.yml', true);
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
  const skipLocalPackageVerify = process.env.QINIU_SKIP_LOCAL_PACKAGE_VERIFY === '1';

  const config = new qiniu.conf.Config();
  config.regionsProvider = qiniu.httpc.Region.fromRegionId(region);
  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  const bucketManager = new qiniu.rs.BucketManager(mac, config);

  // 检测有哪些平台的构建产物
  const hasMacArm64 = hasReleasePackage(`OriginOS CE-${version}-arm64.dmg`);
  const hasMacX64 = hasReleasePackage(`OriginOS CE-${version}-x64.dmg`);
  const hasMacUpdateZip =
    hasMacArm64 &&
    hasMacX64 &&
    hasReleasePackage(`OriginOS CE-${version}-arm64.zip`) &&
    hasReleasePackage(`OriginOS CE-${version}-x64.zip`);
  const hasWinExe = hasReleasePackage(`OriginOS CE-${version}-x64.exe`);
  const hasWinZip = hasReleasePackage(`OriginOS CE-${version}-x64.zip`);

  const metadataFiles = [];

  // 生成 macOS 元数据
  if (hasMacUpdateZip) {
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

  if (!metadataOnly && !skipLocalPackageVerify) {
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
    skipLocalPackageVerify,
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

  // Notify the official website release service only after package URLs are reachable.
  await notifyReleaseService(version, baseUrl, prefix, { skipCdnVerify });

  console.log('[publish-qiniu-updates] published successfully');
}

function appendDownloadUrl(releaseData, fieldName, cdnBase, fileName) {
  if (!hasReleasePackage(fileName)) {
    return false;
  }

  releaseData[fieldName] = new URL(fileName, cdnBase).toString();
  return true;
}

function requireDownloadUrl(releaseData, fieldName, cdnBase, fileNames) {
  const candidates = Array.isArray(fileNames) ? fileNames : [fileNames];

  for (const fileName of candidates) {
    if (appendDownloadUrl(releaseData, fieldName, cdnBase, fileName)) {
      return;
    }
  }

  throw new Error(
    `Missing release package for ${fieldName}. Expected one of: ${candidates
      .map((fileName) => path.join(releaseDir, fileName))
      .join(', ')}`
  );
}

async function notifyReleaseService(version, baseUrl, prefix, options = {}) {
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
    release_summary: releaseNotes.summary,
    release_notes: releaseNotes.markdown,
    changelog: releaseNotes,
  };

  requireDownloadUrl(releaseData, 'win_x64_url', cdnBase, [
    `OriginOS CE-${version}-x64.exe`,
    `OriginOS CE-${version}-x64.zip`,
  ]);
  requireDownloadUrl(releaseData, 'mac_arm64_url', cdnBase, `OriginOS CE-${version}-arm64.dmg`);
  requireDownloadUrl(releaseData, 'mac_x64_url', cdnBase, `OriginOS CE-${version}-x64.dmg`);

  const downloadFields = Object.entries(releaseData).filter(([key]) => key.endsWith('_url'));
  if (downloadFields.length === 0) {
    console.warn('[publish-qiniu-updates] no release packages found, skipping release service notification');
    return;
  }

  if (!options.skipCdnVerify) {
    for (const [fieldName, url] of downloadFields) {
      console.log(`[publish-qiniu-updates] verifying release package ${fieldName} ${url}`);
      await verifyCdnUrl(url);
    }
  }

  console.log('[publish-qiniu-updates] notifying release service', {
    url: releaseApiUrl,
    version: releaseData.version,
    downloadFields: downloadFields.map(([key]) => key),
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
