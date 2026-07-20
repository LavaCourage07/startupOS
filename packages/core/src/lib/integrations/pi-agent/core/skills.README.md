# OriginOS pi-agent Skill Framework

## 概述 (Overview)

OriginOS pi-agent Skill Framework 是一个基于 Agent Skills 标准 ([agentskills.io](https://agentskills.io)) 的技能加载和执行框架，为 OriginOS 项目提供了灵活的技能系统。

## 特性 (Features)

- 📦 **多来源技能加载**: 支持从捆绑、用户和项目目录加载技能
- 🎯 **前端感知格式**: XML 格式的技能提示注入
- 🔧 **技能验证**: 自动验证技能名称和描述的标准合规性
- 📊 **诊断信息**: 详细的加载诊断和冲突检测
- 🚀 **技能中间件**: 集成到 pi-agent 会话流的中间件支持
- 💾 **使用统计**: 跟踪技能使用情况
- ⚙️ **配置管理**: 动态启用/禁用技能

## 架构 (Architecture)

### 核心模块

```
src/lib/integrations/pi-agent/core/
├── skills.ts              # 技能加载、解析和格式化核心逻辑
├── skills.types.ts        # TypeScript 类型定义
└── skills.middleware.ts  # 技能中间件和管理器
```

### 技能来源 (Skill Sources)

技能按以下优先顺序加载（后面的覆盖前面的）：

1. **Bundled** - 捆绑技能 (`./skills/`)
2. **User** - 用户技能 (`./.claude/skills/`)
3. **Project** - 项目技能 (`./.originos/skills/`)

### 技能文件格式 (Skill File Format)

每个技能目录必须包含 `SKILL.md` 文件：

```markdown
---
name: my-skill
description: A useful skill for specific tasks
disable-model-invocation: false
---

# My Skill

Skill content here...
```

## 使用 (Usage)

### 基本用法 (Basic Usage)

```typescript
import {
  loadSkills,
  formatSkillsForPrompt,
  createSkillManager,
} from "@/lib/integrations/pi-agent/core";

// 加载技能
const result = loadSkills({
  cwd: process.cwd(),
  includeDefaults: true,
});

console.log(`Loaded ${result.skills.length} skills`);
result.diagnostics.forEach(d => {
  console.warn(`[${d.type}] ${d.message}: ${d.path}`);
});

// 格式化为提示词
const skillsPrompt = formatSkillsForPrompt(result.skills);
console.log(skillsPrompt);
```

### 使用 SkillManager (Using SkillManager)

```typescript
import {
  createSkillManager,
  type SkillInvocationContext,
} from "@/lib/integrations/pi-agent/core";

// 创建技能管理器
const skillManager = createSkillManager();

// 获取所有技能
const skills = skillManager.getAllSkills();

// 搜索技能
const searchResults = skillManager.search("interview");

// 检查技能是否启用
const isEnabled = skillManager.isSkillEnabled("project-initialization");

// 获取使用统计
const stats = skillManager.getUsageStats("project-initialization");
```

### 技能中间件 (Skill Middleware)

```typescript
import { createSkillMiddleware, createSkillManager } from "@/lib/integrations/pi-agent/core";

const skillManager = createSkillManager();
const middleware = createSkillMiddleware(skillManager);

// 获取可用技能
const availableSkills = middleware.getAvailableSkills();

const context: SkillInvocationContext = {
  skillName: "project-initialization",
  sessionId: "session-123",
  workspace: process.cwd(),
};

// 执行技能
const result = await middleware.handleSkillInvoke(context);
```

## API 参考 (API Reference)

### `loadSkills(options)`

加载技能并返回结果。

**参数:**
- `options.cwd` - 工作目录 (默认: `process.cwd()`)
- `options.agentDir` - 代理配置目录
- `options.skillPaths` - 明确的技能路径
- `options.includeDefaults` - 是否包含默认技能目录

**返回:**
```typescript
{
  skills: Skill[],
  diagnostics: SkillDiagnostic[]
}
```

### `formatSkillsForPrompt(skills)`

将技能格式化为 XML 格式的提示词。

**参数:**
- `skills` - 技能数组

**返回:**
- XML 格式的字符串

### `SkillManager`

管理技能生命周期的类。

**方法:**
- `load()` - 重新加载技能
- `getAllSkills()` - 获取所有技能
- `getSkill(name)` - 按名称获取技能
- `isSkillEnabled(name)` - 检查技能是否启用
- `setSkillEnabled(name, enabled)` - 设置技能启用状态
- `updateSkillConfig(name, config)` - 更新技能配置
- `recordUsage(name)` - 记录技能使用
- `getUsageStats(name)` - 获取使用统计
- `search(query)` - 搜索技能
- `invoke(context)` - 执行技能

## 技能开发 (Skill Development)

### 创建新技能

1. 在 `skills/` 目录下创建技能目录：
```
skills/
└── my-new-skill/
    └── SKILL.md
```

2. 编写 `SKILL.md` 文件：
```markdown
---
name: my-new-skill
description: Brief description of what this skill does
---

# My New Skill

## Overview
Describe what this skill does...

## Usage
How to use this skill...
```

### 技能规范

- **名称**: 小写字母、数字和连字符，不包含 `--`
- **描述**: 必需字段，最多 1024 字符
- **文件名**: 必须匹配目录名称
- **位置**: `SKILL.md` 在技能目录根下

## 测试 (Testing)

```bash
# 运行技能框架测试
bun test src/lib/integrations/pi-agent/__tests__/skills.test.ts
```

## 示例 (Examples)

### project-initialization Skill

```typescript
// 使用 project-initialization skill
const context: SkillInvocationContext = {
  skillName: "project-initialization",
  sessionId: "session-123",
  workspace: "/workspace",
  args: ["--mode", "create"],
};

const result = skillManager.invoke(context);

if (result.success) {
  console.log("Skill loaded:", result.data);
} else {
  console.error("Skill failed:", result.error);
}
```

```bash
# 通过 CLI 直接加载技能
originos-cli agent skill --load project-initialization --session session-123
```

## 诊断 (Diagnostics)

技能加载过程中的诊断信息类型：

- **`warning`** - 非严重问题（如名称不匹配目录）
- **`error`** - 严重问题（如解析失败）
- **`collision`** - 名称冲突（多个技能同名）

## 未来规划 (Future Plans)

- [ ] 技能版本管理
- [ ] 技能依赖管理
- [ ] 技能热重载
- [ ] 技能市场/分享机制
- [ ] 技能模板生成器
- [ ] 技能文档自动生成

## 相关链接 (Related Links)

- [Agent Skills 标准](https://agentskills.io)
- [OriginOS 文档](../../docs/)
- [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent)
