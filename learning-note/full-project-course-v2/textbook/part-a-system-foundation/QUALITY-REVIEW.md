# Part A 质量复审台账

本文件记录 Part A 的源码覆盖、教学闭环与验证边界，不属于课程正文。复审基准为 [`03-sample-unit-writing-sop.md`](../../03-sample-unit-writing-sop.md)，并逐章对照 [E02](../part-e-pi-agent-runtime/E02-the-configuration-that-starts-a-trip-agent.md) 与 [E06](../part-e-pi-agent-runtime/E06-from-history-to-model-context.md) 的源码讲解密度。

## 复审结论

| 复审层级 | 状态 | 结论与证据 |
| --- | --- | --- |
| 格式预检 | 通过 | 相对链接与源码行号、Markdown 表格、代码围栏和差异空白均已机械检查 |
| 源码覆盖验收 | 通过当前单元边界 | 首页配置、卡片回调、页面编排、窗口服务、原生窗口重建和会话 UI 停止边界均有真实代码窗口；大文件未被误记为整文件完成 |
| 教学深度验收 | 通过 | A01—A06 均包含问题、具体输入、源码执行、错误或反例、测试证据/缺口、纸面实验和不少于五个口头验收问题 |
| 新手可读验收 | 通过 | “头脑风暴”案例贯穿六章；package、架构层、进程、控制流、数据流和生命周期均先建立直觉，再给准确边界 |
| 运行验证 | 有缺口 | 本单元是架构阅读单元；没有进行浏览器或 Electron 端到端操作，依赖检查脚本也因扫描入口不匹配而跳过，正文未把这些项目写成已验证 |

“通过”只表示 Part A 在其声明的教学范围内达到样例级正文标准，不表示 Pi Agent、SSE、工具或真实桌面运行已经验收。

## 单章质量闸门

| 章节 | 真实输入与状态变化 | 失败路径或反例 | 测试证据/缺口 | 独立迁移动作 | 结果 |
| --- | --- | --- | --- | --- | --- |
| A01 | `HOME_APPS` 中的 Skill 配置被 `AppCard` 映射并触发 `onLaunch` | 卡片可见不等于会话已创建 | 缺少入口结构和组件点击测试 | 把 Skill 换成 action，重新划分责任 | 通过 |
| A02 | `skillName` 进入 `handleSkillLaunch`，再被翻译为窗口 id、props 与 metadata | 相同字符串的 window/project/entry id 不是同一资源 | 缺少 handler 与 `/window` 参数合同测试 | 替换 `initialMessage`，逐层计算实际值 | 通过 |
| A03 | workspace 依赖经公共出口进入 Web | 跨层导入、跨 feature 内部导入和循环依赖 | `agents:check` 实际跳过，不能证明依赖合规 | 把错误 import 重构为 Core 公共 API | 通过 |
| A04 | 同一窗口请求分别进入 Web store 或 Electron 原生窗口 | 不可序列化回调不能穿过 URL 查询参数 | 缺少双入口合同测试 | 加入 `onDone` 后判断在哪个边界停止 | 通过 |
| A05 | 给定放错在 route 的业务函数，按依赖层级下沉到 Core | “能运行”不能证明“放置正确” | 规约脚本没有覆盖当前目录形态 | 依照五步判案独立审查新文件 | 通过 |
| A06 | 从“卡片无响应”正向追踪到窗口状态，再反向按证据排除 | 只看 UI、只看文件名或只看静态脚本都会越界 | 明确区分源码事实、静态检查与运行证据 | 把案例替换为工作区入口并复用记录模板 | 通过 |

## 五项可复核结果

### 1. 正向追踪记录

本单元以“窗口状态已经写入”为当前范围内的最终副作用：

```text
HOME_APPS 中的 bmad-brainstorming
→ page.tsx 把配置传给 AppCard
→ AppCard.handleClick 调用 onLaunch(app)
→ page.tsx.handleSkillLaunch(app.skillName, app.initialMessage)
→ 生成 windowId = skill-bmad-brainstorming
→ AppWindowManager.openWindow(...)
→ Web 分支调用 appWindowStore.openWindow
→ 窗口集合新增或聚焦该 id
```

若处于 Electron 原生窗口分支，`AppWindowManager` 会把可序列化字段放入 URL，由 `/window` 页面重新构造 `SkillDialog`；`metadata.projectId` 并不会作为 `SkillDialog` 的 projectId 属性原样透传。会话创建是 Part B 的下一段链路，不在这里提前宣称。

### 2. 反向故障诊断记录

症状：用户看得到“头脑风暴”卡片，点击后没有窗口。

1. 先观察卡片点击是否触发 `onLaunch`，排除只有配置、没有事件接线。
2. 再记录 `handleSkillLaunch` 接收的 `skillName` 和算出的 `windowId`，排除字段翻译错误。
3. 检查 `AppWindowManager` 实际选择 Web store 还是 Electron 原生分支，不能把两条入口混查。
4. Web 分支检查 store 中是否已有同 id 窗口；已有时会聚焦而不是新建，不能把“没有第二个窗口”误判成失败。
5. Electron 分支检查 URL 查询参数和 `/window` 重建；无法序列化的回调本来就不会进入该边界。

这条证据链可以定位到“配置—事件—页面翻译—窗口边界”中的责任层，但不能证明 Agent runtime 是否可用，因为 runtime 尚未启动。

### 3. 覆盖差异表

| 类别 | 已精读 | 仅作背景或停止边界 | 后续范围 |
| --- | --- | --- | --- |
| 生产源码 | `homeApps.ts`、`AppCard.tsx`、`page.tsx` 的 Skill handler、`AppWindowManager.ts` 的打开分支、`app/window/page.tsx` 的 Skill 重建 | `appWindowStore.ts` 的窗口集合语义、`SkillDialog.tsx` 的 props/Hook 入口 | store 全部交互、会话初始化、消息与流式处理 |
| 辅助源码 | workspace/package 配置、`check-agents-compliance.js`、ESLint 依赖规则 | 其他构建和发布脚本 | Part C 的完整仓库与构建边界 |
| 入口文件 | 首页 Skill 配置入口、Web 页面入口、Electron `/window` 重建入口 | 其他 home app 类型和其他原生窗口类型 | 后续按具体业务链学习 |
| 测试文件 | 本单元引用的断言只用于说明验证方法 | 没有把未运行测试记为通过 | Part B/E 的具体服务、恢复、流式与工具测试 |

### 4. 证据边界表

| 已经证明 | 尚未证明 | 明确不在 Part A 范围内 |
| --- | --- | --- |
| Skill 首页入口由配置驱动；点击经过页面 handler；窗口存在 Web 与 Electron 两种打开形态；架构规约要求单向依赖 | 浏览器点击是否成功；Electron 原生窗口是否真实打开；依赖检查是否覆盖全部源码；运行时性能 | 模型调用、SSE/IPC 事件细节、会话恢复、工具执行、认知系统内部算法 |
| `metadata.projectId` 和 `SkillDialog` 内部计算出的 projectId 属于不同责任步骤 | 两者未来是否应收敛为统一合同 | 修改现有产品合同或实现缺口 |

### 5. 零基础学习者通读返工记录

| 模拟轮次 | 首次通读暴露的问题 | 返工位置 | 返工后的可观察结果 |
| --- | --- | --- | --- |
| 术语首现 | 容易把 package、架构层和运行进程当成同一件事 | A03、A04 | 三个维度分别定义，并用同一文件在不同运行形态中的位置做对照 |
| 正向追踪 | `metadata.projectId` 曾被误写成会话初始化的直接输入 | A02 | 增加 `/window` 源码窗口，明确原生重建只传 `skillName` 和 `initialMessage` |
| 反向诊断 | “没有窗口”只有原因列表，没有排除顺序 | A06 | 改为先事件、再字段、再平台分支、最后状态所有者的证据顺序 |
| 相邻迁移 | 方法只会解释 Skill 卡片 | A01、A06 | 加入 action 入口和工作区入口迁移，要求重新判断停止边界 |

## 验证记录

- 本地 Markdown 链接与源码 `#L` 行号机械检查：通过。
- Markdown 表格列数与代码围栏检查：通过。
- `git diff --check`：通过。
- `pnpm agents:check`：命令退出 0，但输出“`src/` 目录不存在，跳过检查”；没有形成有效依赖扫描证据。
- 未运行浏览器或 Electron；相关判断均保持为源码事实、纸面推演或待运行验证。
