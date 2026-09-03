# L02：Project Interview 模板里的六个角色文件

上一课建立了 Skill 定义的基本判断。本课进入 `templates/project-interview/`：这里没有 TypeScript 函数，也没有 React 组件，却定义了 Project Interview Agent 被初始化时需要的一组工作目录文件。

本课只解决一个问题：六个模板文件怎样分工，为什么不能把身份、记忆、知识、经验、口味和工具授权混成一份“提示词”。

## 1. 一个访谈 Agent 需要的不只是身份介绍

小林创建一个“毕业旅行策划项目”时，项目访谈助手不仅要知道自己叫什么，还要知道怎样提问、哪些工具可用、记忆写在哪里、什么是知识、什么是经验模式、对话风格应该怎样保持。

```mermaid
flowchart TB
    A[Agent.md 身份与流程] --> G[Project Interview 工作目录]
    B[Tool.md 工具授权说明] --> G
    C[MEMORY.md 访谈记忆] --> G
    D[Knowledge.md 知识索引] --> G
    E[Patterns.md 经验模式] --> G
    F[Taste.md 表达风格] --> G
```

这张图回答的是模板目录的组成问题。六个文件都进入同一个工作目录概念，但每个文件的职责不同。把它们混在一起，会让后续排查变得困难：回答风格问题不应去改工具授权，工具失败也不应去改 `Taste.md`。

## 2. `Agent.md`：身份、职责和阶段判断

[templates/project-interview/Agent.md 第 1 行](../../../../templates/project-interview/Agent.md#L1) 的 frontmatter 先声明：

```yaml
agentId: project-initialization-agent
agentType: interview
version: 1.0.0
name: Oracle - 项目访谈助手
```

这说明它不是任意聊天助手，而是 interview 类型的项目初始化 Agent。正文在 [templates/project-interview/Agent.md 第 10 行](../../../../templates/project-interview/Agent.md#L10) 给出身份：Oracle 是业务经验访谈师，任务是通过结构化对话把用户的业务实践沉淀为基于本体的业务模型。

真正关键的是 [templates/project-interview/Agent.md 第 61 行](../../../../templates/project-interview/Agent.md#L61) 之后的不可妥协规则。这里规定一次一个问题、每次回复前读取当前阶段的 `SKILL.md`、静默写入、使用业务语言、增量更新 `output/business-model.json`。这不是普通自我介绍，而是行为合同。

阶段判断在 [templates/project-interview/Agent.md 第 97 行](../../../../templates/project-interview/Agent.md#L97) 开始。它先检查 `output/business-model.json`，再根据 `entities`、`properties`、`lifecycle`、`relationships`、`businessRules`、`constraints` 的完整度决定 Phase 1、Phase 2 或 Phase 3。这里体现了模板的教学价值：读者不用先读运行时代码，也能看出这个 Agent 预期怎样推进访谈。

## 3. `MEMORY.md`：当前项目的访谈记忆

[templates/project-interview/MEMORY.md 第 1 行](../../../../templates/project-interview/MEMORY.md#L1) 是一个初始记忆模板：

```markdown
# MEMORY - 项目访谈记忆

## 当前项目信息

- 项目名称: （待识别）
- 行业领域: （待识别）
- 访谈阶段: Phase 1: 领域发现
```

它保存的是访谈过程中的当前上下文，例如项目名称、行业领域、访谈阶段、已识别实体、关系、关键决策、待确认问题和访谈笔记。它不是知识库，也不是最终业务模型。它更像访谈助手的短中期工作笔记。

如果小林说“我们这次旅行重点是轻松，不赶路”，这条偏好可能进入记忆；但最终的行程结构、预算表或路线文件，不应该直接塞进 `MEMORY.md`。

## 4. `Knowledge.md` 与 `Patterns.md`：事实索引和经验模式

[templates/project-interview/Knowledge.md 第 1 行](../../../../templates/project-interview/Knowledge.md#L1) 当前只有空白结构：

```markdown
# Knowledge

## 知识来源

（暂无，待积累）
```

这个文件的存在告诉读者：项目访谈 Agent 预留了知识索引位置，但初始模板没有编造知识。对教材来说，这是一个重要边界。不能因为文件名叫 `Knowledge.md`，就写成“系统已经拥有项目知识库”；当前源码只能证明模板预留了知识文件。

[templates/project-interview/Patterns.md 第 1 行](../../../../templates/project-interview/Patterns.md#L1) 同样是空白经验模式：

```markdown
# Experience Patterns

（尚无经验模式，待积累）
```

经验模式不是聊天摘要。它应该来自多次实践后的可复用方法、反模式或判断原则。初始为空，反而说明模板没有把尚未发生的经验写成事实。

## 5. `Taste.md`：风格偏好不是业务规则

[templates/project-interview/Taste.md 第 1 行](../../../../templates/project-interview/Taste.md#L1) 声明文件类型是 taste。正文在 [templates/project-interview/Taste.md 第 9 行](../../../../templates/project-interview/Taste.md#L9) 描述核心理念，在 [templates/project-interview/Taste.md 第 13 行](../../../../templates/project-interview/Taste.md#L13) 进入语言风格，在 [templates/project-interview/Taste.md 第 55 行](../../../../templates/project-interview/Taste.md#L55) 描述 OriginOS 特有品味。

它影响表达方式和判断倾向，例如简洁、具体、主动、业务语言、访谈问题要引发思考。它不应该承担工具授权，也不应该记录项目事实。若用户觉得 Oracle 说话太机械，应优先检查 `Taste.md` 或 prompt 组合；若工具不能写文件，应检查 `Tool.md` 或运行时工具注册。

## 6. `Tool.md`：工具授权说明与实际工具注册不同

[templates/project-interview/Tool.md 第 1 行](../../../../templates/project-interview/Tool.md#L1) 的 frontmatter 包含 `allowedTools`：

```yaml
allowedTools: [write_file, read_file, edit_file, list_files, delete_file, read_document, read_spreadsheet, list_document_structure, extract_document_tables, execute_command, query_ontology, create_domain, create_concept, search_ontology, get_current_time]
```

这是一份模板层的工具授权说明。正文从 [templates/project-interview/Tool.md 第 10 行](../../../../templates/project-interview/Tool.md#L10) 开始逐个解释文件工具、文档读取工具、本体工具和系统工具。它能帮助 Agent 或读者理解“允许使用哪些工具以及何时使用”。

但它不是工具实现。`write_file` 是否存在、参数怎样被运行时校验、路径怎样被限制，要回到 Part E 的工具系统和 Part F 的 Agent 启动链查证。本课只能说模板声明了这些工具，不应直接说运行时已经注册成功。

源码还有一个细节：[templates/project-interview/Tool.md 第 154 行](../../../../templates/project-interview/Tool.md#L154) 出现了一个孤立的 `l`。这很可能是残留字符。教材中应把它作为模板质量风险记录，而不是悄悄忽略；但本课不直接修改源码，因为当前任务是写教材。

## 7. 测试证据与缺口

本课的证据是模板文件精读，不是运行时测试。它能证明 `templates/project-interview/` 当前包含六个初始化模板，也能证明 `Agent.md` 与 `Tool.md` 写下了阶段、写入和工具说明。但它不能证明 Project Agent 启动时一定加载这些文件，也不能证明 `allowedTools` 中的每个工具都已经注册。

后续若要验证运行链，需要回到 Part F 的 Project Agent context loader、prompt builder 和 persistent agent manager；若要验证工具可执行性，需要回到 Part E 的工具注册与路径边界测试。

## 8. 小实验与口头验收

给小林的“毕业旅行策划项目”设计一个 Project Interview 工作目录，回答以下问题：

1. 哪个文件负责说明 Oracle 的身份和阶段推进？
2. 哪个文件记录“预算不超过 6 000 元”这种访谈中得到的偏好？
3. 哪个文件应该保持为空，直到系统真的积累知识或经验？
4. 如果 Oracle 说话太技术化，应优先检查哪个文件？
5. 如果 Agent 无法写 `output/business-model.json`，为什么不能只修改 `Agent.md`？
6. `Tool.md` 的 `allowedTools` 为什么不能直接证明工具实现存在？

合上本课后，应能用一句话概括：`templates/project-interview/` 是工作目录模板，不是运行时本身；六个文件分别承担身份、工具、记忆、知识、经验和风格责任。下一课会把视角缩小到更简单的 `SKILL.md`，学习最小 Skill 定义怎样表达任务边界。
