const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const defaultChangelogPath = path.join(repoRoot, 'docs/changes/changelog.md');

function versionChangelogPath(version) {
  return path.join(repoRoot, `docs/changes/releases/v${version}/changelog.md`);
}

function readChangelogFile(version) {
  const explicitPath = process.env.ORIGINOS_RELEASE_CHANGELOG_FILE
    ? path.resolve(repoRoot, process.env.ORIGINOS_RELEASE_CHANGELOG_FILE)
    : null;
  const versionPath = versionChangelogPath(version);
  const changelogPath = explicitPath || (fs.existsSync(versionPath) ? versionPath : defaultChangelogPath);
  if (!fs.existsSync(changelogPath)) {
    return { changelogPath, content: '', versionScoped: false };
  }
  return {
    changelogPath,
    content: fs.readFileSync(changelogPath, 'utf8'),
    versionScoped: !explicitPath && changelogPath === versionPath,
  };
}

function parseChangelog(content) {
  const headingPattern = /^##\s+(\d{4}-\d{2}-\d{2})\s+—\s+([^：:]+)[：:](.+)$/gm;
  const headings = [];
  let match;
  while ((match = headingPattern.exec(content)) !== null) {
    headings.push({
      index: match.index,
      date: match[1],
      type: match[2].trim(),
      title: match[3].trim(),
    });
  }

  return headings.map((heading, index) => {
    const next = headings[index + 1];
    const body = content.slice(heading.index, next ? next.index : content.length).trim();
    return {
      ...heading,
      body,
      declaredType: extractBoldField(body, '类型') || heading.type,
      modules: extractBoldField(body, '影响模块'),
      summary: extractBoldField(body, '摘要'),
    };
  });
}

function extractBoldField(body, fieldName) {
  const pattern = new RegExp(`^\\*\\*${fieldName}\\*\\*：(.+)$`, 'm');
  const match = pattern.exec(body);
  return match ? match[1].trim() : '';
}

function selectReleaseItems(entries, versionScoped) {
  if (versionScoped) return entries;

  const dateFilter = process.env.ORIGINOS_RELEASE_CHANGELOG_DATE;
  if (dateFilter) {
    return entries.filter((entry) => entry.date === dateFilter);
  }

  const limit = Number(process.env.ORIGINOS_RELEASE_CHANGELOG_LIMIT || 12);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 12;
  return entries.slice(-safeLimit);
}

function summarizeItems(items) {
  if (items.length === 0) {
    return '本次更新包含稳定性改进和例行维护。';
  }

  const typeLabels = {
    feat: '功能',
    fix: '修复',
    refactor: '重构',
    docs: '文档',
  };
  const counts = items.reduce((acc, item) => {
    const key = item.declaredType || item.type;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const countText = Object.entries(counts)
    .map(([type, count]) => `${typeLabels[type] || type} ${count} 项`)
    .join('、');
  const highlights = items
    .slice(-4)
    .map((item) => item.title)
    .join('；');

  return `本次更新包含 ${items.length} 项变更（${countText}），重点包括：${highlights}。`;
}

function toMarkdown(version, items, summary) {
  const lines = [
    `# OriginOS CE ${version} 更新说明`,
    '',
    summary,
    '',
  ];

  for (const item of items) {
    lines.push(`## ${item.date} — ${item.declaredType || item.type}：${item.title}`);
    if (item.modules) lines.push('', `**影响模块**：${item.modules}`);
    if (item.summary) lines.push('', `**摘要**：${item.summary}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildReleaseNotes(version) {
  const { changelogPath, content, versionScoped } = readChangelogFile(version);
  const entries = parseChangelog(content);
  const items = selectReleaseItems(entries, versionScoped).map((item) => ({
    date: item.date,
    type: item.declaredType || item.type,
    title: item.title,
    modules: item.modules,
    summary: item.summary,
  }));
  const summary = summarizeItems(items);
  const markdown = toMarkdown(version, items, summary);

  return {
    source: path.relative(repoRoot, changelogPath),
    version,
    versionScoped,
    summary,
    markdown,
    items,
  };
}

module.exports = {
  buildReleaseNotes,
};
