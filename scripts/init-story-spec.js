#!/usr/bin/env node

/**
 * Story Spec 初始化脚本
 * 用法: node scripts/init-story-spec.js <epic-number> <story-number> [story-title]
 * 示例: node scripts/init-story-spec.js 1 1 "项目访谈流程启动"
 */

const fs = require('fs');
const path = require('path');

// 获取命令行参数
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('❌ 错误: 缺少必要参数');
  console.log('\n用法: node scripts/init-story-spec.js <epic-number> <story-number> [story-title]');
  console.log('示例: node scripts/init-story-spec.js 1 1 "项目访谈流程启动"');
  process.exit(1);
}

const epicNumber = args[0];
const storyNumber = args[1];
const storyTitle = args[2] || 'Story Title';

const storyId = `${epicNumber}.${storyNumber}`;
const epicDir = path.join(process.cwd(), 'docs', 'specs', `epic-${epicNumber}`);
const storyDir = path.join(epicDir, `story-${storyId}`);
const assetsDir = path.join(storyDir, 'assets');
const templateDir = path.join(process.cwd(), 'docs', 'templates', 'story-spec-template');

console.log(`\n🚀 初始化 Story ${storyId}: ${storyTitle}\n`);

// 创建目录
function createDirectories() {
  console.log('📁 创建目录结构...');

  const dirs = [
    epicDir,
    storyDir,
    assetsDir,
    path.join(assetsDir, 'wireframes'),
    path.join(assetsDir, 'mockups'),
    path.join(assetsDir, 'diagrams'),
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  ✅ 创建: ${dir}`);
    } else {
      console.log(`  ⏭️  已存在: ${dir}`);
    }
  });
}

// 复制模板文件
function copyTemplateFiles() {
  console.log('\n📄 复制模板文件...');

  const templateFiles = [
    'README.md',
    'requirements.md',
    'interaction.md',
    'architecture.md',
    'implementation.md',
    'testing.md',
  ];

  templateFiles.forEach((file) => {
    const templatePath = path.join(templateDir, file);
    const targetPath = path.join(storyDir, file);

    if (!fs.existsSync(templatePath)) {
      console.log(`  ⚠️  模板文件不存在: ${file}`);
      return;
    }

    let content = fs.readFileSync(templatePath, 'utf-8');

    // 替换模板变量
    content = content
      .replace(/\{Story Number\}/g, storyId)
      .replace(/\{Story Title\}/g, storyTitle)
      .replace(/\{Epic Number\}/g, epicNumber)
      .replace(/\{Epic Title\}/g, `Epic ${epicNumber}`)
      .replace(/\{Date\}/g, new Date().toISOString().split('T')[0])
      .replace(/\{Name\}/g, 'TBD')
      .replace(/\{N\}/g, epicNumber)
      .replace(/\{M\}/g, storyNumber)
      .replace(/\{N\}\.\{M\}/g, storyId);

    fs.writeFileSync(targetPath, content, 'utf-8');
    console.log(`  ✅ 创建: ${file}`);
  });
}

// 创建 Epic README（如果不存在）
function createEpicReadme() {
  const epicReadmePath = path.join(epicDir, 'README.md');

  if (fs.existsSync(epicReadmePath)) {
    console.log('\n📋 Epic README 已存在');
    return;
  }

  console.log('\n📋 创建 Epic README...');

  const epicReadmeContent = `# Epic ${epicNumber}

**状态:** 🟡 Planning

---

## 📋 Epic 概览

### Epic 目标

{Epic 目标描述}

### 覆盖需求

{从 PRD 提取的需求}

---

## 📊 Story 列表

| Story | 标题 | 状态 | 负责人 |
|-------|------|------|--------|
| ${storyId} | ${storyTitle} | 🟡 Planning | TBD |

---

## 📌 相关文档

- [Epics & Stories](../../_bmad-output/planning-artifacts/epics.md#epic-${epicNumber})
- [PRD](../../_bmad-output/planning-artifacts/prd.md)
- [Architecture](../../_bmad-output/planning-artifacts/architecture.md)
`;

  fs.writeFileSync(epicReadmePath, epicReadmeContent, 'utf-8');
  console.log(`  ✅ 创建: Epic ${epicNumber} README.md`);
}

// 更新文档索引
function updateDocsIndex() {
  console.log('\n📚 更新文档索引...');
  console.log('  ℹ️  请手动运行: node scripts/update-docs-index.js');
}

// 显示下一步操作
function showNextSteps() {
  console.log('\n✅ Story Spec 初始化完成！\n');
  console.log('📂 文档位置:');
  console.log(`   ${storyDir}\n`);
  console.log('📝 下一步操作:');
  console.log('   1. 编辑 README.md - 填写 Story 基本信息');
  console.log('   2. 编辑 requirements.md - 填写详细需求');
  console.log('   3. 编辑 interaction.md - 设计交互流程');
  console.log('   4. 编辑 architecture.md - 设计技术架构');
  console.log('   5. 编辑 implementation.md - 记录开发细节');
  console.log('   6. 编辑 testing.md - 编写测试用例\n');
  console.log('📖 参考文档:');
  console.log('   - docs/DOCUMENTATION-MANAGEMENT.md');
  console.log('   - AGENTS.md\n');
}

// 主函数
function main() {
  try {
    createDirectories();
    copyTemplateFiles();
    createEpicReadme();
    updateDocsIndex();
    showNextSteps();
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
