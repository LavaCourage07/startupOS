#!/usr/bin/env node

/**
 * AGENTS.md 依赖规约检查脚本
 * 检查模块依赖是否符合单向按序依赖原则
 */

const fs = require('fs');
const path = require('path');

// 定义依赖层级（数字越大层级越高）
const DEPENDENCY_LAYERS = {
  'src/app': 5,
  'src/components': 4,
  'src/services': 3,
  'src/lib/features': 2,
  'src/modules': 2,
  'src/lib/storage': 1,
  'src/lib/integrations': 1,
  'src/lib/hooks': 1,
  'src/lib/shared': 0,
  'src/lib/utils.ts': 1,
};

// 组件内部分层
const COMPONENT_LAYERS = {
  'src/components/atoms': 1,
  'src/components/molecules': 2,
  'src/components/organisms': 3,
};

const violations = [];

/**
 * 获取文件所属的层级
 */
function getFileLayer(filePath) {
  for (const [layerPath, level] of Object.entries(DEPENDENCY_LAYERS)) {
    if (filePath.includes(layerPath)) {
      return { path: layerPath, level };
    }
  }
  return null;
}

/**
 * 获取组件所属的子层级
 */
function getComponentSubLayer(filePath) {
  for (const [layerPath, level] of Object.entries(COMPONENT_LAYERS)) {
    if (filePath.includes(layerPath)) {
      return { path: layerPath, level };
    }
  }
  return null;
}

/**
 * 解析 import 语句
 */
function parseImports(content, filePath) {
  const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
  const imports = [];
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // 解析相对路径
    if (importPath.startsWith('.')) {
      const resolvedPath = path.resolve(path.dirname(filePath), importPath);
      imports.push(resolvedPath);
    }
    // 解析别名路径
    else if (importPath.startsWith('@/')) {
      const resolvedPath = path.join(
        process.cwd(),
        'src',
        importPath.substring(2)
      );
      imports.push(resolvedPath);
    }
  }

  return imports;
}

/**
 * 检查单个文件的依赖
 */
function checkFileDependencies(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = parseImports(content, filePath);

  const fileLayer = getFileLayer(filePath);
  if (!fileLayer) return;

  imports.forEach((importPath) => {
    const importLayer = getFileLayer(importPath);
    if (!importLayer) return;

    // 检查是否违反层级依赖
    if (importLayer.level > fileLayer.level) {
      violations.push({
        type: 'LAYER_VIOLATION',
        file: filePath,
        import: importPath,
        message: `违反单向依赖：${fileLayer.path} (层级 ${fileLayer.level}) 不能依赖 ${importLayer.path} (层级 ${importLayer.level})`,
      });
    }

    // 检查组件内部分层
    if (filePath.includes('src/components')) {
      const fileSubLayer = getComponentSubLayer(filePath);
      const importSubLayer = getComponentSubLayer(importPath);

      if (fileSubLayer && importSubLayer && importSubLayer.level > fileSubLayer.level) {
        violations.push({
          type: 'COMPONENT_LAYER_VIOLATION',
          file: filePath,
          import: importPath,
          message: `违反组件分层：${fileSubLayer.path} 不能依赖 ${importSubLayer.path}`,
        });
      }
    }

    // 检查 feature 跨模块导入
    if (filePath.includes('src/lib/features')) {
      const fileFeature = filePath.match(/features\/([^\/]+)\//)?.[1];
      const importFeature = importPath.match(/features\/([^\/]+)\//)?.[1];

      if (fileFeature && importFeature && fileFeature !== importFeature) {
        // 检查是否通过 index.ts 导入
        if (!importPath.endsWith('/index.ts') && !importPath.endsWith('/index')) {
          violations.push({
            type: 'FEATURE_API_VIOLATION',
            file: filePath,
            import: importPath,
            message: `违反 Feature API 规约：跨 feature 导入必须通过 index.ts`,
          });
        }
      }
    }

    // 检查 app/ 中是否有业务逻辑
    if (filePath.includes('src/app') && !importPath.includes('src/lib') &&
        !importPath.includes('src/components') && !importPath.includes('src/modules') &&
        !importPath.includes('react') && !importPath.includes('next')) {
      violations.push({
        type: 'APP_LOGIC_VIOLATION',
        file: filePath,
        import: importPath,
        message: `违反 App 层规约：src/app/ 不能包含业务逻辑`,
      });
    }
  });
}

/**
 * 递归扫描目录
 */
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 跳过 node_modules 等目录
      if (!file.startsWith('.') && file !== 'node_modules') {
        scanDirectory(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      checkFileDependencies(filePath);
    }
  });
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始检查 AGENTS.md 依赖规约...\n');

  const srcDir = path.join(process.cwd(), 'src');

  if (!fs.existsSync(srcDir)) {
    console.log('⚠️  src/ 目录不存在，跳过检查');
    return;
  }

  scanDirectory(srcDir);

  if (violations.length === 0) {
    console.log('✅ 所有依赖符合 AGENTS.md 规约！\n');
    process.exit(0);
  } else {
    console.log(`❌ 发现 ${violations.length} 个依赖违规：\n`);

    violations.forEach((violation, index) => {
      console.log(`${index + 1}. [${violation.type}]`);
      console.log(`   文件: ${violation.file}`);
      console.log(`   导入: ${violation.import}`);
      console.log(`   说明: ${violation.message}\n`);
    });

    console.log('请修复以上违规后再提交代码。');
    console.log('参考 AGENTS.md "模块依赖规约" 章节。\n');
    process.exit(1);
  }
}

main();
