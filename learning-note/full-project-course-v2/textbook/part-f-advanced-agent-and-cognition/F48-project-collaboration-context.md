# F48：`project-collaboration-context.ts` —— 多 Agent 协作上下文

## 开篇场景

在多 Agent 协作场景中，ProjectAgent 不仅需要加载普通的项目上下文，还需要加载 `Data.md`（数据契约）和 `Process.md`（处理流程、协作协议）。这节课看 `project-collaboration-context.ts`。

## 核心问题

**`ProjectCollaborationContext` 和 `ProjectContext` 有什么区别？`Data.md` 和 `Process.md` 分别包含什么内容？**

## 概念阶梯

**ProjectCollaborationContext**：多 Agent 协作上下文，包含 `ProjectContext` 的所有字段，额外加上 `dataMd` 和 `processMd`。

**Data.md**：数据契约，定义可操作的本体对象、字段、约束、操作权限、Agent 间数据边界。

**Process.md**：处理流程，包含触发条件、输入数据、处理步骤、输出数据、异常处理、协作协议。

## 源码精读

### 1. ProjectCollaborationContext 接口

[packages/core/src/lib/integrations/pi-agent/project-agent/project-collaboration-context.ts 第 16—45 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-collaboration-context.ts#L16)

```typescript
export interface ProjectCollaborationContext {
  agentMd: string;
  dataMd: string;            // 新增：Data.md
  processMd: string;         // 新增：Process.md
  toolMd: string | null;
  tasteMd: string | null;
  memoryMd: string | null;
  knowledgeMd: string | null;
  patternsMd: string | null;
  installedSkills: SkillInfo[];
  allowedTools: string[];
  workingDirectory: string;
  projectId: string;
  agentId: string;
  originosProjectId: string | null;
}
```

### 2. loadProjectCollaborationContext

[packages/core/src/lib/integrations/pi-agent/project-agent/project-collaboration-context.ts 第 80—127 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-collaboration-context.ts#L80)

```typescript
export async function loadProjectCollaborationContext(
  projectDir: string,
  projectId: string,
  agentId: string,
): Promise<ProjectCollaborationContext | null> {
  const agentMd = readMdFile(projectDir, 'Agent.md');
  if (agentMd === null) { return null; }

  const dataMd = readMdFile(projectDir, 'Data.md') ?? '';
  const processMd = readMdFile(projectDir, 'Process.md') ?? '';
  const toolMd = readMdFile(projectDir, 'Tool.md');
  const tasteMd = readMdFile(projectDir, 'Taste.md');
  const memoryMd = readMdFile(projectDir, 'Memory.md');
  const knowledgeMd = readMdFile(projectDir, 'Knowledge.md');
  const patternsMd = readMdFile(projectDir, 'Patterns.md');

  const allowedTools = parseAllowedTools(toolMd);
  const installedSkills = scanInstalledSkills(projectDir);

  // 尝试从 project-collaboration-context.json 读取 originosProjectId
  let originosProjectId: string | null = null;
  const contextJsonPath = path.join(projectDir, 'project-collaboration-context.json');
  if (existsSync(contextJsonPath)) {
    try {
      const contextJson = JSON.parse(readFileSync(contextJsonPath, 'utf-8'));
      originosProjectId = contextJson.originosProjectId ?? null;
    } catch {
      // 忽略解析错误
    }
  }

  return {
    agentMd, dataMd, processMd, toolMd, tasteMd, memoryMd,
    knowledgeMd, patternsMd, installedSkills, allowedTools,
    workingDirectory: projectDir, projectId, agentId, originosProjectId,
  };
}
```

关键点：

- `dataMd` 和 `processMd` 不存在时返回空字符串（不是 `null`）；
- 其他字段和 `loadProjectContext` 相同。

## Data.md 和 Process.md 示例

### Data.md

```markdown
## 数据契约

### 可操作本体
- **园区** (name: string, description: string)
  - 操作: read, create
- **客户** (name: string, contact: string)
  - 操作: read, create, update

### Agent 间数据边界
- 需求调研Agent: 独占写入园区、客户
- 项目管理Agent: 只读访问
```

### Process.md

```markdown
## 处理流程

### 触发条件
收到用户新的需求调研任务

### 输入数据
- 园区基本信息
- 客户联系方式

### 处理步骤
1. 读取 Data.md 确认数据权限
2. 调用技能进行需求分析
3. 输出调研报告

### 输出数据
- 需求调研报告

## 异常处理
| 异常场景 | 处理策略 |
|---------|---------|
| 数据缺失 | 向用户确认 |
| 权限不足 | 报告错误 |

## 协作协议

### 被触发
- 触发方：用户
- 触发类型：手动启动
- 传递数据：需求描述

### 触发其他
- 触发目标：项目管理Agent
- 触发类型：完成通知
- 传递数据：调研报告
```

## 真实调用链

1. 多 Agent 协作场景下，`CollaborationRuntime` 调用 `loadProjectCollaborationContext`；
2. 返回的 `ProjectCollaborationContext` 被传给 `buildCollaborationPrompt`；
3. 构建 7 层协作 prompt。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Data.md 不存在 | `dataMd = ''` | 可选文件 |
| Process.md 不存在 | `processMd = ''` | 可选文件 |
| 协作协议章节缺失 | `extractCollaborationSection` 返回空 | 正则匹配失败 |

## 测试证据

- `collaboration-prompt.test.ts` 中的 `loadProjectCollaborationContext` 测试：
  - `Data.md` + `Process.md` 同时存在时正确加载；
  - 仅 `Agent.md` 存在时，其他字段为空字符串或空数组。

## 练习与验收

1. **构造协作上下文**：创建 `Data.md` 和 `Process.md`，验证 `loadProjectCollaborationContext` 输出。
2. **测试协作协议提取**：构造包含“协作协议”章节的 `Process.md`，验证 `extractCollaborationSection` 行为。

**验收标准**：能解释 `ProjectCollaborationContext` 的额外字段。

## 章节收束

`project-collaboration-context.ts` 是多 Agent 协作的数据基础。下一节课（F49）看 `project-prompt.ts`。
