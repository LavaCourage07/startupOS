# Part G：Core 业务功能

> 共 72 节。Part G 讲 OriginOS 的产品能力如何落在 `packages/core/src/lib/features/` 的业务 feature 中：项目、访谈、本体、数据存储、文档、Skill、动画、系统功能、Taste、Culture 等。

## 范围边界

### 本 Part 覆盖

| 子目录 | 主题 |
| --- | --- |
| `features/animations/` | 动画与动效 Hooks |
| `features/api-clients/` | API 客户端封装 |
| `features/culture/` | 文化/工作方式检测 |
| `features/document/` | 文档解析与 Office ZIP |
| `features/interview/` | 项目访谈流程 |
| `features/ontology/` | 本体构建服务 |
| `features/ontology-data-store/` | 本体实例数据存储 |
| `features/project/` | 项目创建服务 |
| `features/sandbox/` | 应用沙箱扫描与路径解析 |
| `features/services/`（不含 `launcher/`） | 项目初始化、项目服务、Skill 服务 |
| `features/skills/bundled/**/handler.ts` + `SKILL.md` | 内置业务 Skill 的具体实现 |
| `features/system/` | 错误边界、性能、快捷键 |
| `features/taste/` | TASTE 偏好检测与质量门 |
| `features/user-config/` | 用户配置 |
| `features/user-registry/` | 用户注册表 |

### 本 Part 不覆盖（归相邻 Part）

| 内容 | 归属 Part | 原因 |
| --- | --- | --- |
| `features/agent/**` | Part F | RoleAgent / ProjectAgent 定义与注册 |
| `features/services/launcher/**` | Part F | Agent / Skill / RoleAgent 启动器 |
| `features/skills/` 中除 `bundled/handlers` 外的部分（registry/executor/service/decision/project-initialization） | Part F | Skill 基础设施 |
| `modules/collaboration-runtime/**` | Part H | 多 Agent 协作运行时 |
| `modules/memory-core/**` | Part H | Memory Core |
| `modules/scheduler/`、`neural-channel/` 等 | Part H | 其他 Core Modules |
| `web/src/app/api/**` | Part I | API 路由边界 |
| `web/src/components/**` | Part J | Web 交互组件 |

## 主线案例：小王开社区咖啡馆

本 Part 用同一案例贯穿各单元：

> 小王想在小区楼下开一家社区咖啡馆。他打开 OriginOS，创建“社区咖啡馆”项目，回答系统提出的访谈问题，系统自动生成“商品、供应商、客户、订单”等本体概念；小王再录入具体的商品实例、上传供应商报价单，并调用任务管理 Skill 生成开店待办清单。

这个案例能自然覆盖：项目创建、访谈、本体、数据存储、文档、Skill、Taste、系统功能等 Part G 的核心主题。

## 课程分段

| 单元 | 课号 | 总问题 | 导读 |
| --- | --- | --- | --- |
| 一、项目创建与服务层 | G01–G10 | 小王点击“开咖啡馆项目”后，系统如何生成项目并初始化？ | [00-01-project-creation-and-services-guide.md](00-01-project-creation-and-services-guide.md) |
| 二、访谈流程 | G11–G18 | 系统如何通过访谈收集咖啡馆信息？ | [00-02-interview-flow-guide.md](00-02-interview-flow-guide.md) |
| 三、本体构建 | G19–G26 | 访谈结果如何变成“商品、供应商、订单”等概念？ | [00-03-ontology-construction-guide.md](00-03-ontology-construction-guide.md) |
| 四、本体数据存储 | G27–G38 | 概念下的具体实例如何被增删改查、建立关系？ | [00-04-ontology-data-store-guide.md](00-04-ontology-data-store-guide.md) |
| 五、文档、API 与沙箱 | G39–G46 | 咖啡馆的文档怎么读、外部应用怎么识别？ | [00-05-document-api-sandbox-guide.md](00-05-document-api-sandbox-guide.md) |
| 六、动画、系统、Taste、Culture | G47–G60 | 体验层能力如何落在 Core？ | [00-06-animation-system-taste-culture-guide.md](00-06-animation-system-taste-culture-guide.md) |
| 七、内置 Skills、用户配置与注册 | G61–G72 | 内置 Skill 如何被调用？用户偏好如何支撑业务？ | [00-07-skills-user-config-registry-guide.md](00-07-skills-user-config-registry-guide.md) |

## 与相邻 Part 的衔接

- **前置**：建议先完成 Part D（Core 基础设施）和 Part E（Pi Agent 基础运行时），因为本 Part 会用到 `jsonStore`、类型合同、Agent 会话等前置概念。
- **并行/后续**：Part F（RoleAgent / ProjectAgent / 认知系统）会从 Agent 视角重新访问项目、Skill、记忆等主题；Part I / J 会从 Web 页面和组件视角访问同一批 Core API。
- **边界说明**：本 Part 只讲 Core 业务逻辑本身，不讲 Web 页面如何调用、不讲 Electron 主进程如何转发、不讲多 Agent 如何协作。这些分别进入 Part I / J / K / H。

## 编号规则

- `G01` 表示 Part G 第 1 节正式课，文件名以 `G01-` 开头。
- 每个单元有一篇 `00-xx-...-guide.md` 导读，不占用正式课号。
- 每个单元最后一节是单元小结课（workshop），沿用连续课号，例如 `G10`、 `G18`、`G26` 等。

## 质量要求

每节课遵循 [03-sample-unit-writing-sop.md](../../03-sample-unit-writing-sop.md)，并以 [E02](../part-e-pi-agent-runtime/E02-the-configuration-that-starts-a-trip-agent.md) 和 [E06](../part-e-pi-agent-runtime/E06-from-history-to-model-context.md) 为最低深度线：必须包含真实源码窗口、调用链、失败路径、测试证据与可验收练习。
