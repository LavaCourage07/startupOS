# Part D：Core 基础设施与公共合同

用户创建“课程助手”项目后，关闭窗口、退出应用，再次启动时仍应看到项目名称、领域、状态和工作文件。这个看似普通的产品要求，实际要求系统同时回答四类问题：路径落在哪里、数据怎样写入和恢复、跨层对象用什么合同描述、失败时怎样判断责任边界。

Part D 围绕这条连续主线展开：

```text
创建“课程助手”项目
  → 选择运行时数据根目录
  → 构造项目元数据路径与项目工作目录
  → 用 DataFile<Project> 写入 JSON
  → 关闭窗口和进程
  → 重新定位同一数据根目录
  → 读取、解析并恢复 Project
  → 用公共类型把结果交给 Web 或 Desktop
```

旧版 D01—D20 将多个大主题压缩在单章中，且存在重复 D11，不能满足逐文件精读、输入追踪、故障反推和测试证据要求。新版不继承旧章结构，改为八个小单元、三十三节正式课。每节课可以覆盖多个强相关源码点，但必须围绕同一个学习问题讲透；合并课次不删减源码责任，只把相邻概念放进同一条因果链。旧文件在对应新课覆盖前只作为历史草稿存在，不进入阅读顺序，也不能作为完成证据。

## 学完 Part D 后能够做什么

完成本 Part 后，读者应能独立完成以下任务：

1. 从 `DATA_ROOT`、Electron 注入和 monorepo fallback 推导当前进程会把数据写到哪里。
2. 区分项目元数据文件、项目工作目录、技能目录、Agent 目录和模板源目录。
3. 用一个具体 `Project` 输入逐步推演 `JsonStore` 的初始化、封装、写入、读取、更新和删除。
4. 区分缺失文件、损坏 JSON、权限或 I/O 失败，以及当前源码对它们的不同处理。
5. 判断 TypeScript 接口、Zod schema、运行时对象和磁盘 JSON 分别能保证什么。
6. 从 `@originos/core/types` 的公共出口追到真实定义，并识别同名类型、别名和重复合同。
7. 解释 shared port 如何让高层逻辑依赖稳定接口，而不是反向依赖具体实现。
8. 从“项目重启后消失”这一症状按证据顺序反查路径、写入、解析、映射和展示边界。

## 范围边界

本 Part 直接精读以下范围：

- `packages/core/src/lib/paths.ts`
- `packages/core/src/lib/utils.ts`
- `packages/core/src/lib/storage/**`
- `packages/core/src/lib/shared/**`
- `packages/core/src/types/**`

`ProjectService`、Web API、Electron service 和页面组件只在主线需要时作为调用者或消费者局部引用。它们的完整业务流程分别属于后续 Core Feature、Web 和 Desktop 单元。本 Part 不把“类型被某处导入”误写成“完整生产链路已经验证”。

作者侧源码状态、平行实现和证据缺口记录在 [Part D 源码范围与全局审查台账](../../04-part-d-source-coverage-audit.md) 中。

## 课程分段

> 每个小单元都先阅读对应的“单元导读与复盘”。导读不替代正式课；单元小结课也不另设独立编码，而是作为该单元最后一节正式课的工作坊完成，沿用连续 `Dxx` 编号。

| 范围 | 正式课号 | 单元导读与复盘 | 单元总问题 |
| --- | --- | --- | --- |
| 路径与数据根目录 | D01—D04 | [00-01-path-and-data-root-guide.md](00-01-path-and-data-root-guide.md) | 进程怎样稳定找到同一份运行时数据？ |
| JSON 存储生命周期 | D05—D09 | [00-02-json-storage-lifecycle-guide.md](00-02-json-storage-lifecycle-guide.md) | 一个项目怎样被可靠地封装、写入、读取和修改？ |
| 公共类型与界面外壳合同 | D10—D13 | [00-03-public-types-and-ui-shell-guide.md](00-03-public-types-and-ui-shell-guide.md) | 公共类型怎样成为跨包语言，又为什么不能替代运行时验证？ |
| 项目、访谈与本体合同 | D14—D18 | [00-04-project-interview-ontology-guide.md](00-04-project-interview-ontology-guide.md) | 项目、访谈与本体合同怎样描述同一业务对象的不同阶段？ |
| Agent、Skill 与 Sandbox 合同 | D19—D23 | [00-05-agent-skill-sandbox-guide.md](00-05-agent-skill-sandbox-guide.md) | Agent、Skill 与 Sandbox 合同怎样约束执行对象和过程状态？ |
| Solution 与 TASTE 合同 | D24—D27 | [00-06-solution-and-taste-guide.md](00-06-solution-and-taste-guide.md) | Solution 与 TASTE 合同怎样表达协作方案和偏好？ |
| Shared Ports 与依赖倒置 | D28—D30 | [00-07-shared-ports-guide.md](00-07-shared-ports-guide.md) | shared port 怎样隔离高层能力与具体实现？ |
| 证据、故障诊断与综合验收 | D31—D33 | [00-08-testing-and-core-acceptance-guide.md](00-08-testing-and-core-acceptance-guide.md) | 怎样用有限证据验收 Core 基础设施？ |

## 单元一：路径与数据根目录（D01—D04）

| 课次 | 正式课题 | 核心源码责任 |
| --- | --- | --- |
| D01 | 关闭窗口之后，内存里的课程助手还剩下什么 | 建立内存、文件、窗口、进程四个生命周期，说明为什么持久化必须从路径开始 |
| D02 | 运行时数据根目录如何被确定 | `getMonorepoRoot()`、`getDataRoot()`、`DATA_ROOT`、Electron 注入和 monorepo fallback |
| D03 | 项目、Agent、Skill 和模板目录为什么必须分开 | `getProjectDataDir()`、Agent/Skill/template path helpers 与只读技能源边界 |
| D04 | 路径工作坊：为三种运行环境推导真实落盘地址 | 汇总路径优先级、产物目录边界、输入追踪、失败反推和口头验收 |

## 单元二：JSON 存储生命周期（D05—D09）

| 课次 | 正式课题 | 核心源码责任 |
| --- | --- | --- |
| D05 | `DataFile<T>` 与 `JsonStore` 单例共同保存了什么 | `DataFile` 外壳、版本时间戳、泛型 payload、私有构造器、静态实例和初始化状态 |
| D06 | 第一次写入课程助手项目时发生了什么 | `ensureInitialized()`、`initializeDirectories()`、`write()`、目录创建、JSON 序列化和副作用 |
| D07 | 读取、损坏和系统错误为什么必须分开处理 | `read()` 的 `ENOENT`、`SyntaxError`、其他 I/O 异常，以及恢复时的返回语义 |
| D08 | 更新、删除、存在性检查和列表为什么不是同一种失败合同 | `update()`、`delete()`、`exists()`、`listFiles()`、浅合并、幂等删除与吞错边界 |
| D09 | 存储工作坊：保存、损坏、恢复课程助手 | typed path helpers、项目持久化调用链、绝对/相对路径风险、测试证据和验收 |

## 单元三：公共类型与界面外壳合同（D10—D13）

| 课次 | 正式课题 | 核心源码责任 |
| --- | --- | --- |
| D10 | `types/index.ts` 如何成为跨包公共语言入口 | barrel export、type-only export、别名、同名类型和导入路径稳定性 |
| D11 | TypeScript 类型、Zod schema 和磁盘 JSON 分别能保证什么 | 编译期合同、运行时验证、JSON 解析、`project-creation.ts` 与 `taste.ts` 对照 |
| D12 | UI 外壳类型如何接住恢复后的项目结果 | `acrylic.ts`、`spotlight.ts`、`app-window.ts`、`os.ts`、`workspace.ts` 与消费者边界 |
| D13 | 公共类型工作坊：从恢复结果追到窗口显示 | 公共出口、类型消费、运行时空洞、迁移风险和验收 |

## 单元四：项目、访谈与本体合同（D14—D18）

| 课次 | 正式课题 | 核心源码责任 |
| --- | --- | --- |
| D14 | `Project` 如何描述课程助手的长期身份 | `project.ts` 的实体字段、生命周期、创建/更新/列表/查询合同 |
| D15 | 项目创建合同为什么同时需要请求、会话和运行时验证 | `api.ts`、`project-creation.ts`、Zod schema、session factory 与进度函数 |
| D16 | 访谈合同如何记录从问题到结论的过程 | `interview.ts` 的 flow、question、answer、result 和 status |
| D17 | 本体合同如何把课程助手拆成领域、概念、实例和关系 | `ontology.ts` 的核心实体、图谱实体、关系类型和平行定义边界 |
| D18 | 项目合同工作坊：从创建请求推演到可恢复本体 | 字段变化、验证失败、映射边界、数据恢复和验收 |

## 单元五：Agent、Skill 与 Sandbox 合同（D19—D23）

| 课次 | 正式课题 | 核心源码责任 |
| --- | --- | --- |
| D19 | 三种 Agent 类型为什么不能混用 | `agent.ts`、`agent-host.ts`、`agent-object.ts` 的对象边界、状态、展示元数据和 Hook 返回合同 |
| D20 | 会话、Thinking 和 tool call 为什么是过程合同 | session config、message、stream data、thinking step、tool call info 和统计信息 |
| D21 | Skill 合同如何连接加载、路由、工具和执行结果 | `skill.ts` 的 metadata、context、registry、router、tool、result |
| D22 | Sandbox 合同如何描述受控执行和报告结果 | `sandbox.ts` 的 request、scenario、step、gap、report、store state |
| D23 | 执行合同工作坊：为课程助手推演一次技能调用 | 正常结果、工具失败、状态残留、边界验收和迁移练习 |

## 单元六：Solution 与 TASTE 合同（D24—D27）

| 课次 | 正式课题 | 核心源码责任 |
| --- | --- | --- |
| D24 | Solution 为什么不是一个 Agent 配置文件 | `solution.ts` 的状态、方案结构、Skill 输入输出、SOP 步骤和协作拓扑 |
| D25 | Manifest bundle 如何描述可交付的方案文件集合 | `solution-manifest.ts` 的 core、agents、skills、bundle 和 version contract |
| D26 | TASTE Profile 为什么必须有运行时 schema | `taste.ts` 的 profile、metadata、来源、validator、merge 和 progress |
| D27 | 偏好合同工作坊：创建、合并并判断方案与偏好是否可用 | 解决方案视图、偏好检测会话、失败输入、分析就绪和验收 |

## 单元七：Shared Ports 与依赖倒置（D28—D30）

| 课次 | 正式课题 | 核心源码责任 |
| --- | --- | --- |
| D28 | Core 为什么需要 shared port，而不是共享所有实现 | 依赖方向、port/adapter 模型、shared 根出口和子目录出口 |
| D29 | Agent、Model、Cognitive 三组 port 分别抽离了什么变化 | `AgentDefinitionParser`、`ModelFactory`、`CognitiveProvider`、`MemoryBlock`、turn data |
| D30 | 依赖倒置工作坊：替换实现而不改上层合同 | fake adapter、调用方向、类型通过、运行验证和依赖违规检查 |

## 单元八：证据、故障诊断与综合验收（D31—D33）

| 课次 | 正式课题 | 核心源码责任 |
| --- | --- | --- |
| D31 | 源码存在、类型通过和行为已测试为何是三种证据 | 证据等级、path/workspace 测试、Zod validator 测试和消费者测试证明上限 |
| D32 | 正向追踪与反向诊断如何定位“重启后项目消失” | 从请求到恢复结果的输入、状态、分支、副作用、输出和排错顺序 |
| D33 | Core 基础设施总验收工作坊 | 最小修复实验、回归证据、口头验收、证据边界和 Part E 衔接 |

## 阅读与完成规则

1. 先读每个单元的 `00-xx` 导读，再按课号阅读正式章节。
2. 正式章节必须达到 [V2 样例单元搭建 SOP](../../03-sample-unit-writing-sop.md) 的单章质量闸门。
3. 一节课只有在源码精读、运行或纸面推演、练习和口头验收都有证据后，才可标记完成。
4. 每个单元的最后一节正式课都是单元小结工作坊，使用普通 `Dxx` 编号，不另设 `D-Sxx`、`summary-xx` 或其他独立编码。
5. 单元导读负责建立地图和复盘，不能替代 D01—D33 的正式正文。
6. D33 完成后仍要对整个 Part 执行术语首现、正向追踪、反向诊断和相邻迁移四轮复审。
