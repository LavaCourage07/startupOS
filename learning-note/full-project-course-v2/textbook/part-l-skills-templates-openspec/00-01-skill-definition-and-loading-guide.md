# 单元一导读：Skill 是什么——定义、分类与加载

> 本单元共 10 节（L01–L10）。
> 核心问题：OriginOS 的 Skill 系统如何让用户“安装一个技能”就像安装一个应用？

## 小林的问题

小林想在 OriginOS 里做一个“旅行规划助手”。她知道系统里有“技能”这个概念，但不知道：

- 一个技能长什么样？是代码？是配置？还是文档？
- 技能放在哪里？`.codex/skills/` 和 `templates/skills/` 有什么区别？
- 技能怎么被加载到 Agent 里？运行时看到的是 Skill 文件本身，还是它的拷贝？
- 技能的 frontmatter 和 body 各自承担什么职责？
- 一个技能可以带哪些“资产”？references、scripts、assets 分别做什么？

本单元就是围绕这些问题展开的。学完本单元，你应该能：

1. 拿到任何一个 `SKILL.md`，能判断它属于哪类技能、有哪些资产、如何被加载。
2. 区分系统级 Skill（`.codex/skills/`）和业务级 Skill（`templates/skills/`）的职责边界。
3. 理解 Skill 的 frontmatter 字段语义，以及 body 的结构化约定。
4. 追踪 Skill 从磁盘定义到运行时内存的完整加载链路。
5. 识别 Skill 加载过程中的失败路径：路径错位、版本不匹配、权限不足、配置缺失。

## 本单元学习路线

| 阶段 | 重点问题 | 对应章节 |
| --- | --- | --- |
| 建立直觉 | Skill 是什么？和“应用”有什么区别？ | L01 |
| 分类对比 | `.codex/skills/` vs `templates/skills/` | L02 |
| 精读定义 | frontmatter 字段语义、body 结构化约定 | L03–L04 |
| 理解资产 | references、scripts、assets 的分工 | L05 |
| 理解评测 | evals、evolution.json 的作用 | L06 |
| 追踪加载 | 从磁盘到内存的完整链路 | L07–L08 |
| 综合归类 | 30 个技能的分类与定位 | L09 |
| 复盘验收 | 给定一个 Skill 定义，独立完成分析 | L10 |

## 本单元涉及的核心文件

| 文件路径 | 类型 | 教学责任 |
| --- | --- | --- |
| `.codex/skills/openspec-propose/SKILL.md` | 系统级 Skill 定义 | 理解系统级 Skill 的格式和边界 |
| `templates/skills/project-initialization/SKILL.md` | 业务级 Skill 定义 | 精读 frontmatter + body 的完整结构 |
| `templates/skills/info-query/SKILL.md` | 工具调用型 Skill | 理解工具声明和调用约定 |
| `templates/skills/bmad-agent-builder/SKILL.md` | BMAD 框架入口 | 理解复杂 Skill 的模块化组织 |
| `templates/skills/bmad-agent-builder/references/` | 参考文档 | 理解 references/ 的职责 |
| `templates/skills/bmad-agent-builder/scripts/` | Python 脚本 | 理解 scripts/ 的职责 |
| `templates/skills/bmad-agent-builder/assets/` | 模板资产 | 理解 assets/ 的职责 |
| `templates/skills/project-skill-creator/eval-viewer/` | 评测可视化 | 理解 Skill 质量评估机制 |
| `templates/skills/role-agent-creator/evolution.json` | 演化追踪 | 理解 Skill 版本演化 |
| `packages/core/src/lib/features/skills/bundled/**/SKILL.md` | 运行时副本 | 理解模板与运行时副本的关系 |

## 与后续单元的衔接

- **单元二（L11–L22）**：深入 BMAD 技能家族，理解 Agent/Skill 构建框架的组件协作。
- **单元三（L23–L32）**：理解元技能（创建 Skill 的 Skill）和 Skill 生态的演化机制。
- **单元四（L33–L40）**：理解项目访谈模板，六维模型如何协作产生结构化输出。
- **单元五（L41–L50）**：理解 OpenSpec 变更工作流，Skill 定义本身如何被提案、设计、验证和归档。

## 阅读建议

1. 先通读本导读，建立问题意识。
2. 每节课开始前，先问自己“这节课要解决什么问题”，再进入正文。
3. 遇到源码窗口时，不要跳过——即使你已经熟悉 Markdown，也要关注 frontmatter 的字段语义和 body 的结构化约定。
4. 单元小结课（L10）是强制性的，不要跳过。它是检验你是否真正理解本单元核心问题的关键。

## 单元小结课预告

L10 工作坊将给你一个真实的 `SKILL.md` 文件（可能是 `project-initialization` 或 `info-query`），要求你：

- 判断它属于哪类技能
- 列出它的所有资产
- 画出它的加载路径
- 指出至少两个失败路径
- 口头验收：能独立回答“这个 Skill 的 frontmatter 和 body 各自承担什么职责”
