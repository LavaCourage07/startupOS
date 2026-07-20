# OriginOS Lint 和规约检查

本项目使用多层 Lint 工具确保代码符合 AGENTS.md 架构规约。

## 📋 规约文档

**核心规约文档：** [AGENTS.md](./AGENTS.md)

所有实施工作必须遵守 AGENTS.md 中定义的架构约束。

## 🔧 Lint 工具

### 1. TypeScript 严格模式

配置文件：`tsconfig.json`

**检查项：**
- 禁止 `any` 类型
- 严格空值检查
- 未使用变量检查
- 隐式返回检查

**运行：**
```bash
npm run type-check
```

### 2. ESLint

配置文件：`.eslintrc.json`

**检查项：**
- TypeScript 规则
- 目录结构规约
- 禁止使用的技术（Redux、CSS Modules、数据库等）
- React 规范（函数式组件、Hooks）
- 导入顺序规范
- 命名规范
- 循环依赖检测

**运行：**
```bash
npm run lint          # 检查
npm run lint:fix      # 自动修复
```

### 3. Prettier

配置文件：`.prettierrc.json`

**检查项：**
- 代码格式统一
- Tailwind CSS 类名排序

**运行：**
```bash
npm run format:check  # 检查格式
npm run format        # 自动格式化
```

### 4. AGENTS.md 依赖规约检查

脚本：`scripts/check-agents-compliance.js`

**检查项：**
- 单向按序依赖
- 禁止双向依赖和循环依赖
- 层级依赖规则
- 组件分层规则
- Feature 模块 API 规则
- App 层业务逻辑检查

**运行：**
```bash
npm run agents:check
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 运行所有检查

```bash
npm run validate
```

这会依次运行：
1. TypeScript 类型检查
2. ESLint
3. Prettier 格式检查

### 自动修复

```bash
npm run lint:fix      # 修复 ESLint 错误
npm run format        # 格式化代码
```

## 🔒 Git Hooks

项目配置了 pre-commit hook，在每次提交前自动运行所有检查。

**Hook 位置：** `.husky/pre-commit`

**检查流程：**
1. TypeScript 类型检查
2. ESLint 检查
3. Prettier 格式检查
4. AGENTS.md 依赖规约检查

如果任何检查失败，提交将被阻止。

### 跳过 Hook（不推荐）

```bash
git commit --no-verify
```

⚠️ **警告：** 跳过 hook 可能导致违反架构规约的代码被提交。

## 📖 常见违规和修复

### 1. 违反层级依赖

**错误：**
```typescript
// src/lib/features/ontology/index.ts
import { CUIComponent } from '@/components/organisms/CommandInterface';
```

**修复：**
```typescript
// 业务逻辑不应依赖组件
// 应该在组件中导入业务逻辑
// src/components/organisms/CommandInterface.tsx
import { useOntology } from '@/lib/features/ontology';
```

### 2. 双向依赖

**错误：**
```typescript
// ontology.ts
import { queryGraph } from './knowledge';

// knowledge.ts
import { buildOntology } from './ontology'; // 循环依赖！
```

**修复：**
```typescript
// 提取共享逻辑到下层
// lib/storage/ontology-graph-bridge.ts
export class OntologyGraphBridge {
  // 共享逻辑
}
```

### 3. 跨 Feature 直接导入

**错误：**
```typescript
// lib/features/ontology/ontology-builder.ts
import { GraphStore } from '@/lib/features/knowledge/graph-store';
```

**修复：**
```typescript
// lib/features/ontology/ontology-builder.ts
import { GraphStore } from '@/lib/features/knowledge'; // 通过 index.ts
```

### 4. 组件分层违规

**错误：**
```typescript
// components/atoms/Button.tsx
import { Card } from '../molecules/Card'; // atoms 不能依赖 molecules
```

**修复：**
```typescript
// 重新设计组件层级，或将 Button 移到 molecules
```

### 5. 使用禁止的技术

**错误：**
```typescript
import { createStore } from 'redux'; // 禁止使用 Redux
```

**修复：**
```typescript
import { create } from 'zustand'; // 使用 Zustand
```

## 🛠️ 自定义规则

### 添加新的 ESLint 规则

编辑 `.eslintrc.json`：

```json
{
  "rules": {
    "your-custom-rule": "error"
  }
}
```

### 添加新的依赖检查

编辑 `scripts/check-agents-compliance.js`。

## 📚 参考文档

- [AGENTS.md](./AGENTS.md) - 架构规约
- [ESLint 配置](./.eslintrc.json)
- [TypeScript 配置](./tsconfig.json)
- [Prettier 配置](./.prettierrc.json)

## ❓ 常见问题

### Q: 为什么这么严格？

A: 严格的规约确保代码库的长期可维护性，防止架构腐化。

### Q: 可以临时禁用某个规则吗？

A: 可以，但必须有充分理由：

```typescript
// eslint-disable-next-line rule-name
const code = 'with exception';
```

### Q: 检查太慢怎么办？

A: 可以只检查变更的文件：

```bash
npm run lint -- --fix $(git diff --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$')
```

## 🤝 贡献

在提交 PR 前，请确保：

1. ✅ 所有 Lint 检查通过
2. ✅ 代码符合 AGENTS.md 规约
3. ✅ 添加了必要的测试
4. ✅ 更新了相关文档

---

**记住：规约是为了帮助我们构建更好的系统，而不是限制创造力。**
