# OriginOS pi-agent Skill Framework - 快速开始指南

## 快速开始 (Quick Start)

### 1. 验证 Skill 框架已安装

```bash
# 检查测试是否通过
pnpm test src/lib/integrations/pi-agent/__tests__/skills.test.ts
```

### 2. 查看可用 Skill

```typescript
import { loadSkills } from "@/lib/integrations/pi-agent/core";

const result = loadSkills();
console.log("Available skills:", result.skills.map(s => s.name));
```

### 3. 使用 Skill

```typescript
import {
  createSkillManager,
  type SkillInvocationContext,
} from "@/lib/integrations/pi-agent/core";

// 创建管理器
const skillManager = createSkillManager();

// 执行技能
const context: SkillInvocationContext = {
  skillName: "project-initialization",
  sessionId: "session-123",
  workspace: process.cwd(),
};

const result = skillManager.invoke(context);
```

## 项目技能示例 (Project Skills Examples)

### project-initialization

位置: `skills/project-initialization/SKILL.md`

用途: 用于项目启动时的对话式访谈，引导用户完成业务建模。

### 技能模板 (Skill Template)

创建新技能时，使用以下模板：

```markdown
---
name: my-skill
description: Short description (max 1024 chars)
disable-model-invocation: false
---

# My Skill Name

## 概述 (Overview)
What this skill does...

## 使用场景 (Use Cases)
When to use this skill...

## 执行步骤 (Steps)
1. Step 1
2. Step 2
3. Step 3

## 预期输出 (Expected Output)
What the skill should produce...
```

## 已知问题 (Known Issues)

无

## 下一步 (Next Steps)

- [ ] 集成 Skill 框架到 Epic 1 的项目启动流程
- [ ] 创建 Skill 执行 API 端点
- [ ] 添加 Skill 选择和管理 UI
- [ ] 实现 Skill 执行进度追踪
