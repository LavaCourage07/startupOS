## Why

Windows 安装包启动多 Agent Supervisor 时，打包态 `agent-worker.mjs` 将 `K:\...` 形式的绝对路径直接传给 ESM `import()`，Node.js 24 将盘符 `k:` 识别为不支持的 URL scheme，导致 Supervisor 子进程在初始化阶段退出。该问题阻断 Windows 用户的全部多 Agent 运行流程，需要立即修复并建立跨平台回归约束。

可追溯信息：

- epic-id：`9`
- story-id：`9.6`
- task-id：`WIN-ESM-01`
- owner：`Codex`
- 来源 Story：`docs/specs/epic-9/story-9.6/README.md`

## What Changes

- 为打包态 Agent Worker 的本地模块动态导入建立统一的 ESM module specifier 转换入口。
- Windows 盘符路径、包含空格的资源路径以及 `app.asar` 路径在传给 `import()` 前转换为合法 `file://` URL。
- 已是 `file:`、`data:`、`node:` 或 `electron:` URL 的 specifier 保持不变，避免重复转换。
- 补充 Windows 路径单元测试、worker 源码/编译产物校验和打包资源校验。
- 不改变 Supervisor DAG、Agent 生命周期、IPC 协议、模型配置或多 Agent 用户交互。

非目标：

- 不重构多 Agent 调度和 Worker 进程模型。
- 不调整 Electron 签名、自动更新和发布策略。
- 不修改普通 Agent、RoleAgent 或单 Agent 会话行为。

上线方案：随下一次 Windows desktop 安装包构建发布，并由包校验脚本确认 worker 入口和依赖存在。

回滚方案：回退该 Proposal 的单一合并提交，恢复原有 Worker bootstrap；不涉及数据迁移或持久化格式回滚。

## Capabilities

### New Capabilities

- `windows-packaged-multi-agent-worker-bootstrap`: 约束 Windows 打包态多 Agent Worker 必须使用合法 ESM URL 加载本地运行时模块，并在 Supervisor 启动前完成 bootstrap。

### Modified Capabilities

无。

## Impact

- 受影响 package：`packages/core`、`packages/desktop`。
- 主要源码：`packages/core/src/modules/collaboration-runtime/sandbox/agent-worker.mts`。
- 验证脚本：`packages/desktop/scripts/verify-agent-worker-runtime.js` 及相关测试。
- public API：无变更。
- IPC、persistence：无变更。
- platform packaging：仅影响 Windows 打包态 `extraResources/agent-worker` 的 ESM bootstrap；macOS/Linux 行为保持兼容。
- 依赖：仅使用 Node.js 24 标准库 `node:url`，不新增第三方依赖。
