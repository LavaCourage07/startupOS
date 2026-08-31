import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "learning-note/full-project-course-v2");
const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .sort();

const sourcePattern = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py)$/;
const stylePattern = /\.css$/;
const markupPattern = /\.(html|htm)$/;
const runtimeDataPattern = /^(data\/|packages\/(web|desktop)\/data\/)|\.(jsonl|csv|tsv)$/;
const configPattern = /(^|\/)(package\.json|pnpm-workspace\.yaml|turbo\.json|.*\.config\.[^/]+|.*\.ya?ml|.*\.json|.*\.toml|.*\.ini)$/;
const textAssetPattern = /\.(md|mdx|txt|csv|tsv)$/;
const automationPattern = /(^|\/)(scripts\/|\.husky\/|.*\.(sh|ps1|bat)$|Makefile$)/;
const hiddenConfigPattern = /(^|\/)\.(gitignore|prettierignore|npmrc|nvmrc|editorconfig)$/;

function kindFor(file) {
  if (file.startsWith("learning-note/")) return "learning-material";
  if (sourcePattern.test(file)) return file.includes("/__tests__/") || /\.(test|spec)\.[^.]+$/.test(file) ? "test-source" : "source";
  if (stylePattern.test(file)) return "style-source";
  if (markupPattern.test(file)) return "markup-source";
  if (file.startsWith("templates/") || file.startsWith(".codex/skills/")) return "template-or-skill";
  if (runtimeDataPattern.test(file)) return "runtime-data";
  if (automationPattern.test(file)) return "automation-script";
  if (hiddenConfigPattern.test(file)) return "configuration";
  if (configPattern.test(file)) return "configuration";
  if (textAssetPattern.test(file)) return "documentation";
  return "binary-or-static-asset";
}

function trackFor(file) {
  if (file.startsWith("packages/core/src/lib/integrations/pi-agent/")) return "T04 Pi Agent runtime";
  if (file.startsWith("packages/core/src/modules/collaboration-runtime/")) return "T05 Collaboration runtime";
  if (file.startsWith("packages/core/src/modules/memory-core/")) return "T06 Memory core";
  if (file.startsWith("packages/core/src/lib/features/")) return "T03 Core features";
  if (file.startsWith("packages/core/src/lib/storage/") || file.startsWith("packages/core/src/lib/shared/") || file.startsWith("packages/core/src/types/")) return "T02 Core foundations";
  if (file.startsWith("packages/core/src/modules/")) return "T07 Other core modules";
  if (file.startsWith("packages/core/src/")) return "T01 Core package boundary";
  if (file.startsWith("packages/web/src/app/api/")) return "T09 Web API boundaries";
  if (file.startsWith("packages/web/src/app/")) return "T08 Next App Router";
  if (file.startsWith("packages/web/src/components/")) return "T10 Web interaction components";
  if (file.startsWith("packages/web/src/store/") || file.startsWith("packages/web/src/hooks/") || file.startsWith("packages/web/src/services/")) return "T11 Web state and adapters";
  if (file.startsWith("packages/web/src/")) return "T12 Web package foundations";
  if (file.startsWith("packages/desktop/src/main/")) return "T13 Electron main and services";
  if (file.startsWith("packages/desktop/src/")) return "T14 Electron renderer and adapters";
  if (file.startsWith("packages/pi-tasks/")) return "T15 Agent adapter package";
  if (file.startsWith("packages/agent/")) return "T15 Agent adapter package";
  if (file.startsWith("packages/service/")) return "T16 Service package";
  if (file.startsWith("packages/web/data/") || file.startsWith("packages/desktop/data/") || file.startsWith("data/")) return "T21 Runtime data and fixtures";
  if (file.startsWith("templates/")) return "T17 Templates and bundled skills";
  if (file.startsWith("skills/")) return "T17 Templates and bundled skills";
  if (file.startsWith("openspec/") || file.startsWith(".codex/skills/")) return "T18 OpenSpec workflow";
  if (file.startsWith("docs/")) return "T19 Product, design, Story, QA docs";
  if (file.startsWith("scripts/") || file.startsWith("electron/") || file.startsWith(".github/") || file.startsWith("patches/")) return "T20 Build and release tooling";
  if (file.startsWith("resources/") || file.startsWith("models/")) return "T22 Resources and local models";
  if (file.startsWith("tests/")) return "T23 Cross-package tests";
  if (file.startsWith("learning-note/")) return "T99 Existing learning-note index";
  return "T00 Repository foundations";
}

function actionFor(kind) {
  if (kind === "source") return "Direct reading: explain every exported symbol, call site, branch, and failure path.";
  if (kind === "test-source") return "Test reading: pair with production source; explain fixture, assertion, and uncovered risk.";
  if (kind === "style-source") return "Style reading: explain selector scope, design token, responsive rule, and the component it affects.";
  if (kind === "markup-source") return "Markup reading: explain DOM structure, script/style entry points, and runtime role.";
  if (kind === "runtime-data") return "Data reading: explain producer, schema, consumer, lifecycle, and whether it is a fixture or local state.";
  if (kind === "configuration") return "Configuration reading: explain each active field and the runtime/build consequence.";
  if (kind === "automation-script") return "Script reading: explain input, side effects, failure handling, and when the script is run.";
  if (kind === "template-or-skill") return "Template reading: explain variable contract, lifecycle, and generated output boundary.";
  if (kind === "documentation") return "Reference reading: classify as normative, design history, API guide, QA evidence, or archive.";
  if (kind === "learning-material") return "Curriculum artifact: not project implementation; index only to avoid circular teaching claims.";
  return "Asset index: identify consumer and purpose; do not pretend binary internals are source lessons.";
}

function fileLink(file) {
  return "[`" + file + "`](../../" + file + ")";
}

const counters = new Map();
const draftRows = trackedFiles.map((file) => {
  const kind = kindFor(file);
  const track = trackFor(file);
  const number = (counters.get(kind) ?? 0) + 1;
  counters.set(kind, number);
  const unit = `${kind === "source" ? "SRC" : kind === "test-source" ? "TST" : kind === "style-source" ? "STY" : kind === "markup-source" ? "MRK" : kind === "runtime-data" ? "DAT" : kind === "configuration" ? "CFG" : kind === "template-or-skill" ? "TPL" : kind === "documentation" ? "DOC" : kind === "binary-or-static-asset" ? "AST" : "IDX"}-${String(number).padStart(4, "0")}`;
  return { file, kind, track, unit, action: actionFor(kind) };
});

const groupSize = {
  source: 3,
  "test-source": 3,
  "style-source": 3,
  "markup-source": 3,
  "runtime-data": 3,
  configuration: 3,
  "automation-script": 3,
  "template-or-skill": 3,
  documentation: 4,
  "binary-or-static-asset": 8,
  "learning-material": 8,
};

const grouped = new Map();
for (const row of draftRows) {
  const directory = path.posix.dirname(row.file);
  const key = `${row.track}\u0000${row.kind}\u0000${directory}`;
  const items = grouped.get(key) ?? [];
  items.push(row);
  grouped.set(key, items);
}

const trackLessonCounters = new Map();
const lessons = [];
const rows = [];
for (const [key, items] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const [track, kind, directory] = key.split("\u0000");
  const size = groupSize[kind];
  for (let offset = 0; offset < items.length; offset += size) {
    const files = items.slice(offset, offset + size);
    const next = (trackLessonCounters.get(track) ?? 0) + 1;
    trackLessonCounters.set(track, next);
    const trackCode = track.slice(0, 3);
    const lesson = `${trackCode}-L${String(next).padStart(3, "0")}`;
    const title = `${directory === "." ? "仓库根目录" : directory}：${kind}`;
    lessons.push({ lesson, track, title, kind, files: files.map(({ file }) => file) });
    rows.push(...files.map((row) => ({ ...row, lesson, lessonTitle: title })));
  }
}

const totals = [...counters.entries()].sort(([a], [b]) => a.localeCompare(b));
const trackTotals = new Map();
for (const { track } of rows) trackTotals.set(track, (trackTotals.get(track) ?? 0) + 1);
const lines = [
  "# 全项目文件地图（V2 基线）",
  "",
  "> 生成时间由本地 Git 已跟踪文件决定。每一行都是一个文件，不以目录概览替代文件覆盖。此地图只证明**纳入教学计划**；正式课程完成后，还需在 `精读`、`运行`、`练习`、`验收` 四列逐项打勾。",
  "",
  "## 范围与规则",
  "",
  `- 基线：\`git ls-files\` 返回的 ${rows.length} 个文件。`,
  "- `source`：必须有直接精读卡，不能被概览课替代。",
  "- `test-source`：必须与生产文件配对阅读，解释它证明的行为与未证明的风险。",
  "- `configuration`、`template-or-skill`、`documentation`：必须进入相应课程或参考课，并注明用途。",
  "- `binary-or-static-asset`：记录消费者和用途；不把图片/二进制伪装成源码精读。",
  "- `learning-material`：现有学习笔记本身仅索引，不计入项目源码覆盖率。",
  "",
  "## 类型统计",
  "",
  "| 类型 | 文件数 | 默认教学动作 |",
  "| --- | ---: | --- |",
  ...totals.map(([kind, count]) => `| ${kind} | ${count} | ${actionFor(kind)} |`),
  "",
  "## 课程轨道统计",
  "",
  "| 课程轨道 | 文件数 |",
  "| --- | ---: |",
  ...[...trackTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([track, count]) => `| ${track} | ${count} |`),
  "",
  "## 逐文件地图",
  "",
  "| 文件单元 | 文件 | 第几课讲解 | 课程轨道 | 类型 | 教学动作 | 精读 | 运行 | 练习 | 验收 |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.sort((a, b) => a.file.localeCompare(b.file)).map(({ unit, file, lesson, track, kind, action }) => `| ${unit} | ${fileLink(file)} | ${lesson} | ${track} | ${kind} | ${action} | [ ] | [ ] | [ ] | [ ] |`),
  "",
  "## 冻结说明",
  "",
  "此文件是课程设计基线。课程编写期间新增/删除 Git 文件后，必须重新生成并审查差异；没有对应单元 ID 的新文件不得被声称为已覆盖。",
  "",
];

mkdirSync(outputDir, { recursive: true });
writeFileSync(path.join(outputDir, "02-all-tracked-files-map.md"), `${lines.join("\n")}\n`);

const outline = [
  "# V2 逐文件课程大纲",
  "",
  "> 这是可执行的课程目录。每一行是一节课，并列出该节必须直接阅读的文件。源码与测试每课最多 3 个文件；其余材料按更小的同目录组安排。要查某个文件在哪讲，使用 [全项目文件地图](02-all-tracked-files-map.md)。",
  "",
  `- 课程总数：${lessons.length} 节。`,
  `- 文件总数：${rows.length} 个 Git 已跟踪文件。`,
  "- 所有源码文件的教学动作均为直接精读，不因同目录而自动视为已学。",
  "",
];
for (const [track] of [...trackTotals.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const trackLessons = lessons.filter((lesson) => lesson.track === track);
  outline.push(`## ${track}（${trackLessons.length} 节）`, "");
  outline.push("| 课次 | 本课范围 | 文件 |", "| --- | --- | --- |");
  for (const lesson of trackLessons) {
    outline.push(`| ${lesson.lesson} | ${lesson.title} | ${lesson.files.map(fileLink).join("<br>")} |`);
  }
  outline.push("");
}
writeFileSync(path.join(outputDir, "01-course-outline.md"), `${outline.join("\n")}\n`);
console.log(`Wrote ${rows.length} tracked-file rows and ${lessons.length} lessons.`);
