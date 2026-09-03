# G10：单元小结课——画出“小王创建社区咖啡馆项目”的完整调用链

> 本课核心问题：从 G01 到 G09，我们已经把项目创建与服务体系拆成了九节课。现在请你脱离源码，把“小王点击创建按钮 → 项目可用”的完整旅程画出来，并标出每个关键节点的责任方、数据格式、失败路径和测试缺口。

## 1. 开篇场景：九节课之后，小王的项目终于能用了

让我们回到小王的视角：

1. 小王打开 OriginOS，点击“创建项目”。
2. 系统弹出第一个问题：“这个项目主要是做什么的？”
3. 小王回答：“我想在社区楼下开一家精品咖啡馆，卖咖啡和轻食。”
4. 系统又问优先级、工作模式。
5. 小王确认后，系统显示“项目创建成功”。
6. 小王进入项目，发现已经有 `project.json`、`taste/profile.json`、`ontology.json`，甚至还有 `Agent.md` 和 `Tool.md`。

这个看似简单的流程，背后涉及多个服务、多个文件、多个数据格式。

本单元小结课的任务，就是**把这条线从头到尾画清楚**，并回答：

- 每个阶段谁负责？
- 每个阶段写入什么文件？
- 每个阶段可能在哪里失败？
- 哪些行为有测试证明，哪些没有？

## 2. 概念阶梯回顾

在进入工作坊之前，先快速回顾本单元的核心概念。

### 2.1 从直觉到术语

| 直觉说法 | 专业术语 | 对应源码 |
| --- | --- | --- |
| “创建项目不是直接写一条记录” | 项目创建会话（`ProjectCreationSession`） | `project-creation-service.ts` |
| “会话里存了用户答案和提取信息” | `data` vs `extractedData` | `types/project-creation.ts` |
| “项目被写进磁盘” | `ProjectService.createProject` / `ProjectCreationService.completeCreation` | `services/project-service.ts`、`project/project-creation-service.ts` |
| “两套项目服务” | `project-service.ts` vs `project-service-real.ts` | `services/` |
| “项目创建后还要初始化目录和 Agent 文件” | `ProjectInitializationService.initializeProject` | `services/project-initialization-service.ts` |
| “Skill 发现服务” | `SkillService.getSkills` / `getSkillByName` | `services/skill-service.ts` |
| “feature 的公共 API” | `index.ts` 导出边界 | `services/index.ts`、`project/index.ts` |

### 2.2 关键边界

本单元反复强调的边界：

- **`project/` feature 只管创建流程，不管长期 CRUD。**
- **`services/` feature 里有多个项目相关实现，但桶文件只导出了一部分。**
- **全局 `types/project.ts` 被多个 feature 共享，但实现未必严格遵守。**
- **创建流程和初始化流程是两条并行的“项目出生”路径。**
- **测试主要分布在 web 集成测试和 launcher 单元测试，核心服务大量无测。**

## 3. 完整调用链图解

```mermaid
flowchart TD
    User([小王]) -->|点击“创建项目”| Start[POST /api/project/create/start]
    Start -->|调用| PCS[startSession]
    PCS -->|生成| SID[sessionId]
    PCS -->|生成| PID[projectId]
    PCS -->|写入| SFile[data/sessions/project-creation/{sessionId}.json]
    PCS -->|返回| Q1[问题 1：项目背景]

    User -->|回答| A1[POST /api/project/create/{sessionId}/answer]
    A1 -->|调用| SA[submitAnswer]
    SA -->|更新| SFile
    SA -->|提取| Ext1[experience_topology<br/>context_features]
    SA -->|返回| Q2[问题 2：优先级]

    User -->|回答| A2[POST /api/project/create/{sessionId}/answer]
    A2 -->|调用| SA2[submitAnswer]
    SA2 -->|提取| Ext2[taste_standards<br/>tension_position]
    SA2 -->|返回| Q3[问题 3：工作模式]

    User -->|回答| A3[POST /api/project/create/{sessionId}/answer]
    A3 -->|调用| SA3[submitAnswer]
    SA3 -->|提取| Ext3[symbiosis_boundary]
    SA3 -->|返回| Q4[问题 4：确认]

    User -->|点击“完成创建”| Complete[POST /api/project/create/{sessionId}/complete]
    Complete -->|调用| CC[completeCreation]
    CC -->|写入| PFile[data/projects/{projectId}/project.json]
    CC -->|写入| TFile[data/taste/projects/{projectId}/profile.json]
    CC -->|写入| OFile[data/ontologies/{projectId}/ontology.json]
    CC -->|更新| SFile2[session status=completed]
    CC -->|返回| Result1[{ project, taste, ontology }]

    User -->|进入项目并初始化| Init[POST /api/projects/initialize]
    Init -->|调用| PIS[projectInitializationService.initializeProject]
    PIS -->|创建| Dirs[reference/<br/>skills/<br/>output/<br/>sessions/<br/>files/]
    PIS -->|复制| AgentFiles[Agent.md<br/>Tool.md<br/>MEMORY.md<br/>taste.md]
    PIS -->|写入| BM[business-model.json]
    PIS -->|调用| ASS[agentSessionService]
    PIS -->|返回| Result2[{ project, agentSessionId, projectPath }]

    User -->|调用 Skill| SkillAPI[GET /api/skills]
    SkillAPI -->|调用| SS[skillService.getSkills]
    SS -->|读取| SkillSources[.claude/skills/<br/>data/skills/<br/>templates/skills/]
    SS -->|返回| SkillList
```

这张图把整个单元串了起来。下面我们用表格进一步细化每个节点的责任、文件、格式和风险。

## 4. 节点责任表

| 步骤 | 负责人 | 写入/读取的文件 | 数据格式 | 关键设计决策 |
| --- | --- | --- | --- | --- |
| 启动会话 | `ProjectCreationService.startSession` | `data/sessions/project-creation/{sessionId}.json` | `ProjectCreationSession`（含 `data`、`extractedData`） | `sessionId` 用 UUID，`projectId` 预生成 |
| 提交答案 | `ProjectCreationService.submitAnswer` | 同上 | 更新后的 `ProjectCreationSession` | 按 step 提取不同信息，step 不匹配抛错 |
| 完成创建 | `ProjectCreationService.completeCreation` | `data/projects/{projectId}/project.json`<br/>`data/taste/projects/{projectId}/profile.json`<br/>`data/ontologies/{projectId}/ontology.json` | 纯 JSON（无 `DataFile` 封装） | `type` 硬编码，`color` 硬编码为 `#3B82F6` |
| 直接创建 API | `ProjectServiceReal.createProject` | `data/projects/{projectId}/project.json`<br/>及子目录 | 纯 JSON | 自动生成子目录，随机颜色 |
| 项目初始化 | `ProjectInitializationService.initializeProject` | `data/projects/{projectId}/{reference,skills,output,sessions,files}/`<br/>`Agent.md`、`Tool.md`、`business-model.json` | 纯文本 + JSON | 基于访谈业务模型，复制模板文件 |
| Skill 发现 | `SkillService.getSkills` | `.claude/skills/`<br/>`data/skills/`<br/>`templates/skills/` | `SKILL.md` + 目录 | 5 秒缓存，支持多源加载 |

## 5. 失败路径复盘

让我们沿着调用链，逐个检查可能的失败点。

### 5.1 会话阶段

| 失败场景 | 抛出错误 | 后果 |
| --- | --- | --- |
| 会话不存在 | `SESSION_NOT_FOUND` | 用户答案无法提交 |
| 会话已过期 | `SESSION_NOT_ACTIVE` | 用户需要重新创建 |
| step 不匹配 | `INVALID_STEP` | 防重放/乱序 |
| 第一个问题获取失败 | `Error('Failed to get first question')` | 创建流程直接失败 |

这些失败路径在 `project-creation-service.ts` 里有显式处理，但没有单元测试覆盖。

### 5.2 项目文件写入阶段

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| 目录创建失败 | `ensureDir` 静默忽略 | 项目文件或 taste/ontology 文件可能写不进去 |
| `project.json` 写入失败 | 抛错 | `completeCreation` 整体失败 |
| 时间戳类型不一致 | 无处理 | 创建流程写字符串，服务期望数字，后续读取可能出错 |
| `ontologyId` 格式不一致 | 无处理 | `ontology_${id}` vs `ontology-${id}` 可能导致路径错误 |

### 5.3 初始化阶段

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| 模板文件不存在 | `try/catch` 跳过 | `Agent.md` 缺失，Agent 无法正常启动 |
| 业务模型缺少实体 | API 层 400 返回 | 初始化被拒绝 |
| Agent 会话初始化失败 | 抛错 | 项目目录已创建，但 Agent 不可用 |

### 5.4 Skill 发现阶段

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| 缓存过期 | 重新加载 | 5 秒内可能读到旧 Skill 列表 |
| Skill 目录结构不合法 | `validateSkillDirectory` 返回错误 | 不阻止加载，只提供诊断 |
| 多源加载冲突 | 后者覆盖或追加 | 同名 Skill 行为不确定 |

## 6. 测试覆盖复盘

| 能力 | 测试位置 | 覆盖状态 |
| --- | --- | --- |
| `ProjectCreationService` 全生命周期 | 无 | ❌ 未覆盖 |
| `ProjectService`（桶文件导出） | 无 | ❌ 未覆盖 |
| `ProjectServiceReal` CRUD | `packages/web/src/app/api/projects/__tests__/project-service.test.ts` | ⚠️ 集成测试覆盖基本路径 |
| `ProjectServiceReal` import/export/stats | 同上 | ⚠️ 基本路径 |
| `ProjectInitializationService` | 无 | ❌ 未覆盖 |
| `SkillService` 缓存与格式化 | 无 | ❌ 未覆盖 |
| `SkillLauncher` 回退策略 | `packages/core/src/lib/features/services/launcher/__tests__/skill-launcher.test.ts` | ✅ 覆盖 |
| `skills/service.getSkillContent` | `packages/core/src/lib/features/skills/__tests__/service.test.ts` | ✅ 覆盖 |

## 7. 工作坊练习

### 练习一：画出调用链

请拿一张纸或打开一个白板工具，不看书稿，画出以下调用链：

1. 小王点击“创建项目”。
2. 系统创建会话并返回第一个问题。
3. 小王回答三个问题。
4. 系统完成创建，写入项目文件。
5. 小王调用初始化 API，生成 Agent 工作目录。
6. 小王调用 Skill 列表 API，发现可用 Skill。

要求：
- 每个箭头标注调用的函数/方法名。
- 每个节点标注写入或读取的文件路径。
- 在每个节点旁边写出一个可能的失败场景。

### 练习二：找出格式不一致

请对比以下两个文件：

- `packages/core/src/lib/features/project/project-creation-service.ts` 的 `completeCreation`
- `packages/core/src/lib/features/services/project-service-real.ts` 的 `createProject`

列出至少三处不一致：

| 维度 | 创建流程 | 服务实现 |
| --- | --- | --- |
| `createdAt` 类型 | 字符串（ISO） | 数字（timestamp） |
| `type` 默认值 | `web-application` | `generic` |
| `color` 默认值 | `#3B82F6` | `from-{color}-500` |
| `ontologyId` 格式 | `ontology_${id}` | `''` 或传入值 |
| 子目录创建 | 仅 `files/` | `reference/`, `skills/`, `output/`, `sessions/`, `files/` |

### 练习三：补测试计划

假设你只能补三个测试，你会优先补哪三个？请说明理由。

参考答案（不唯一）：

1. **`ProjectCreationService.completeCreation` 写出字段类型测试**
   - 理由：默认值和时间戳类型不一致，是现有代码中最大的隐性 bug 来源。

2. **`ProjectInitializationService.initializeProject` 成功路径测试**
   - 理由：项目能否真正可用，取决于初始化是否成功。无测试意味着 Agent 无法启动的风险无法提前发现。

3. **`services/index.ts` 导出一致性测试**
   - 理由：桶文件与生产深导入不一致，会导致新开发者选错导入路径，引发数据格式混乱。

## 8. 口头验收

完成本单元后，应能不看书稿回答：

1. 从“小王点击创建”到“项目可用”，中间经历了哪几个主要阶段？每个阶段由哪个服务负责？
2. `ProjectCreationService` 和 `ProjectServiceReal` 写的 `project.json` 有什么区别？
3. `project/index.ts` 和 `services/index.ts` 各自导出了什么？哪个生产实现不在桶文件里？
4. 项目服务体系里哪些核心能力目前没有单元测试？风险最高的是哪个？
5. 如果你要修复“创建流程写出的项目文件格式不统一”问题，你会先改哪里？需要同步改哪些地方？

## 9. 章节收束

本单元（G01—G10）围绕“小王创建社区咖啡馆项目”这一业务场景，拆解了 OriginOS 的项目创建与服务体系。

我们学到的核心认知：

- **项目创建是一个多步骤流程**，由 `ProjectCreationService` 通过会话状态机驱动。
- **项目长期 CRUD 不在 `project` feature 里**，而在 `services` feature 的多个实现中。
- **存在两套项目服务**：`project-service.ts`（桶文件导出，基于 `jsonStore` + `DataFile`）和 `project-service-real.ts`（生产使用，基于直接文件系统操作）。
- **项目初始化是另一条“项目出生”路径**：`ProjectInitializationService` 负责生成 Agent 工作目录和初始文件。
- **Skill 发现服务为项目提供可用能力列表**：`SkillService` 负责多源加载和缓存。
- **公共 API 边界不清晰**：`services/index.ts` 和 `project/index.ts` 都没有完整导出生产实际使用的实现。
- **测试覆盖薄弱**：核心服务缺少单元测试，很多边界行为依赖人工审计。

下一单元（G11—G18）我们将进入**访谈流程**，看看系统如何通过问答收集咖啡馆的业务信息，并把访谈结果转换成项目数据和本体。

---

**本单元到此结束。**
