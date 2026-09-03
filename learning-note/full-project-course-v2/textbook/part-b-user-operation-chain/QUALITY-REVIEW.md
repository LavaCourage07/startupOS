# Part B 质量复审台账

本文件记录 Part B 的源码覆盖、教学闭环和验证边界，不属于课程正文。复审基准为 [`03-sample-unit-writing-sop.md`](../../03-sample-unit-writing-sop.md)，并逐章对照 [E02](../part-e-pi-agent-runtime/E02-the-configuration-that-starts-a-trip-agent.md) 与 [E06](../part-e-pi-agent-runtime/E06-from-history-to-model-context.md) 的源码讲解密度。

## 复审结论

| 复审层级 | 状态 | 结论与证据 |
| --- | --- | --- |
| 格式预检 | 通过 | 相对链接与源码行号、表格、代码围栏、图片引用和差异空白均已机械检查 |
| 源码覆盖验收 | 通过当前单元边界 | 从首页配置到窗口、Skill 加载、prompt、会话、消息、Web SSE/Electron IPC、关闭和磁盘路径均登记了生产入口、适配层、Core 与测试状态 |
| 教学深度验收 | 通过 | B01—B12 均有具体输入、字段或状态变化、源码窗口、失败与恢复、证据边界、迁移实验和不少于五个口头验收问题 |
| 新手可读验收 | 通过 | 同一条“大学生学习 App 卖点”请求贯穿全单元；Web 与 Electron 只在真实分叉处拆开解释，图后均有逐箭头说明 |
| 自动化与端到端验证 | 有缺口 | Vitest 在当前环境不可解析，浏览器、SSE、Electron IPC、持久化和工具副作用未运行；正文只分析已有断言和待补测试，不声称运行通过 |

“通过”表示教材正文在声明范围内达到样例级标准；它不抹去实现中已经发现的合同缺口，也不把未执行的测试写成成功。

## 逐章质量闸门

| 章节 | 正向输入与状态变化 | 失败路径/边界 | 测试证据或缺口 | 迁移与验收 | 结果 |
| --- | --- | --- | --- | --- | --- |
| B01 | 配置字段变成卡片 props | 可见不等于可启动 | 配置结构与组件点击测试缺口 | 改字段并预测 UI/行为 | 通过 |
| B02 | `skillName` 经 handler 变成窗口 id、props、metadata | 相同 id 字符串不代表同一资源 | handler 与原生参数合同缺口 | 独立计算 `initialMessage` 和 id | 通过 |
| B03 | 窗口请求进入 Web store 或 Electron main | 重复 id 只聚焦；`closeAllWindows` 绕过逐窗 `onClose` | manager/store 双入口集成缺口 | 改 `entryType` 推导分支 | 通过 |
| B04 | transition token 决定新建/恢复结果是否仍可提交 | 慢请求晚到不能覆盖新目标 | 已精读 guard 测试；Dialog 集成仍缺 | 手算 A/B 乱序 | 通过 |
| B05 | Skill 名称经 Web route 或 IPC handler 到 Core service | HTTP 与 IPC 错误语义不同；类型断言不等于运行校验 | Core service 测试已分析、未执行；跨入口合同测试缺 | 替换 bundled/project/user 来源 | 通过 |
| B06 | Skill 内容、名称与目录按顺序拼入 system prompt | 空内容、frontmatter 和目录缺失影响不同 | builder 直接测试缺口 | 改身份字段并写出 prompt 变化 | 通过 |
| B07 | initialize 经 Web 或 Electron 创建/复用会话 | 两端只是字段意图相近，并非共享同一 request type；LLM 配置合并不同 | route/IPC 跨入口合同缺口 | 对照 200/201 与两端配置 | 通过 |
| B08 | restore → add message → prompt | 所有权、历史恢复、运行时创建各有独立错误 | restore 顺序测试已分析、未执行；IPC 分支测试缺 | 交换顺序解释后果 | 通过 |
| B09 | runtime event 经 Web SSE 或 Electron IPC 更新 React state | 重复片段、残帧、旧流和两端 abort 语义不同 | dedupe/scheduler 测试已分析、未执行；跨入口流测试缺 | 手算重叠 delta/final | 通过 |
| B10 | 关闭窗口销毁 runtime，但不等于删除磁盘会话 | project-scoped 删除缺 `projectId`；批量关闭不逐窗回调 | 生命周期、project delete 和批量关闭测试缺 | 对照 close/destroy/delete | 通过 |
| B11 | working directory 经工具上下文和路径解析器约束副作用 | 相对路径、绝对越界、软链接和 data root 不能混为一谈 | working-directory 测试已分析、未执行；真实工具 E2E 缺 | 推导三类路径 | 通过 |
| B12 | 全链正向接力到会话/流式结果 | 按症状反查入口、平台、所有权和持久化层 | 汇总生产与测试差异 | 并发、关闭和重开综合推演 | 通过 |

## 五项可复核结果

### 1. 正向追踪记录

```text
HOME_APPS[bmad-brainstorming]
→ AppCard.onLaunch
→ page.tsx.handleSkillLaunch
→ AppWindowManager 打开 Web 窗口或 Electron 原生窗口
→ SkillDialog 加载 Skill 内容并构建 system prompt
→ usePiAgent.initialize
→ Web POST /api/agent/sessions 或 Electron IPC create
→ Core AgentSessionService 创建/复用 project-scoped session JSON
→ 用户消息经 Web message route 或 Electron send/stream handler
→ 校验 owner scope，恢复 runtime，先持久化用户消息，再 prompt
→ runtime 事件经 SSE 或 IPC 回到 client-hooks
→ delta/final 去重并提交 React 消息状态
→ 窗口关闭时销毁 runtime；磁盘会话默认保留
```

这条链刻意不写成“所有平台都走 fetch + SSE”。普通 Web 入口通过 HTTP/SSE，Electron renderer 通过 preload 暴露的 IPC 服务和事件通道。工具产物只有在模型实际调用工具时才出现，不能从“收到回答”推断必然生成 Markdown 文件。

### 2. 反向故障诊断记录

症状：用户消息已经出现在窗口中，但回答一直不出现。

1. 先确认当前平台：Web 检查 message POST 和 SSE 响应；Electron 检查 IPC send/stream 调用与事件订阅。
2. 查看请求是否携带正确的 `sessionId`、`entryType` 和 `entryId`，以区分传输失败与 owner scope 拒绝。
3. 检查用户消息是否已经写入 session JSON。已写入说明问题发生在恢复、prompt 或事件返回之后；未写入则继续检查请求校验和会话定位。
4. 检查 runtime 是否成功恢复/创建，以及错误是在 prompt 前还是 prompt 中出现。
5. 有 runtime 事件但 UI 不更新时，再检查 stream identity、dedupe、scheduler 和 final commit；没有事件时不应先改 React 渲染。
6. 最后区分“界面 abort”与“主进程任务终止”：Web AbortController 可中止当前 fetch，Electron renderer 停止接收并不自动证明 main 中的 prompt 已被取消。

这一顺序能缩小责任层，但没有真实运行日志时不能确认某一次现场故障的唯一根因。

### 3. 覆盖差异表

| 类别 | 已精读窗口 | 辅助或边界引用 | 未纳入/后续范围 |
| --- | --- | --- | --- |
| 生产源码 | home 配置与点击；窗口 manager/store/原生重建；Skill 内容 Web/IPC/Core；session create Web/IPC/Core；message/stream Web/IPC；destroy/delete；tool path | `SkillDialog` 仅初始化、恢复和 prompt 责任；`client-hooks` 仅当前链路；runtime 仅恢复与事件边界 | 模型循环全部内部、所有工具实现、认知系统算法、其他 home app |
| 辅助源码 | transition guard、prompt builder、renderer adapters、preload 暴露、路径工具 | package/config 只用于解释入口差异 | 构建、发布和打包全链属于 Part C |
| 入口文件 | 首页、Next API routes、Electron IPC handlers、`/window` 重建 | 管理 API 只在关闭/删除处引用 | 其他路由、Dock、拖拽缩放和系统应用 |
| 测试文件 | Skill service、transition guard、session restore、stream dedupe/scheduler、working directory 的目标断言已精读 | 这些断言均未在当前环境执行 | 缺少 Web/IPC 对称合同、project delete、批量关闭、真实 SSE/IPC E2E |

### 4. 证据边界表

| 已经证明 | 尚未证明 | 明确不在 Part B 范围内 |
| --- | --- | --- |
| 源码中存在 Web HTTP/SSE 与 Electron IPC 两条入口；session 创建会进入 Core service；消息路径先处理所有权/恢复再 prompt；窗口关闭与删除会话是不同动作 | 当前依赖快照下测试是否通过；浏览器和 Electron 中链路是否真实可用；性能是否满足规约；实际 LLM 是否返回 | 修改这些实现缺口、模型选择算法、上下文裁剪完整机制、全部工具安全策略 |
| project-scoped session 的定位需要 projectId，而当前 Web/Desktop delete 调用只传 sessionId | 该缺口在所有部署形态下的具体用户表现 | 在教程任务中直接修复生产代码 |
| `closeWindow` 可执行单窗 `onClose`，而 `closeAllWindows` 直接清空集合 | 产品是否有其他上层逻辑补做批量清理 | 完整窗口系统交互验收 |

### 5. 零基础学习者通读返工记录

| 模拟轮次 | 首次通读暴露的问题 | 返工位置 | 返工后的可观察结果 |
| --- | --- | --- | --- |
| 术语首现 | 容易把 windowId、projectId、sessionId 和 entryId 当成同一个 id | README、B02、B07、B08 | 每个 id 都写明所有者、生成时机和校验责任 |
| 正向追踪 | 早稿把 Web 与 Electron 都概括成 fetch/SSE | B05、B07、B08、B09、B12 | 内容、创建、消息和事件四处都分开画出 HTTP 与 IPC 分支 |
| 反向诊断 | “消息无回答”只有原因清单，无法判断先查哪里 | B08、B09、B12 | 增加平台识别、owner scope、磁盘落盘、runtime 事件和 UI 提交的证据顺序 |
| 相邻迁移 | 关闭窗口被等同于删除会话 | B03、B10、B12 | 加入 close/destroy/delete 三分法，并揭示 projectId 删除缺口与批量关闭旁路 |

## 自动化与结构验证记录

尝试执行：

```bash
pnpm --filter @originos/core exec vitest run \
  src/lib/features/skills/__tests__/service.test.ts \
  src/lib/integrations/pi-agent/__tests__/session-restore.test.ts \
  src/lib/integrations/pi-agent/__tests__/client-hooks-session-isolation.test.ts \
  src/lib/integrations/pi-agent/__tests__/stream-dedupe.test.ts \
  src/lib/integrations/pi-agent/__tests__/stream-render-scheduler.test.ts \
  src/lib/integrations/pi-agent/tools/__tests__/working-directory.test.ts
```

当前环境返回：

```text
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vitest" not found
```

因此测试没有启动，不能记录为通过或失败。剩余验证需要在依赖完整、可解析 `vitest` 的环境中重跑。

- 本地 Markdown 链接、源码 `#L` 行号、表格和代码围栏机械检查：通过。
- `git diff --check`：通过。
- `pnpm agents:check` 退出 0，但因根目录不存在脚本期待的 `src/` 而跳过扫描，不能视为依赖规约已验证。
- 浏览器点击、真实 SSE、Electron 原生窗口、IPC、磁盘持久化和工具副作用尚未执行端到端验证。
