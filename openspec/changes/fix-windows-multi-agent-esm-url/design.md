## Context

多 Agent Supervisor 与 Worker 由 `packages/core/src/modules/collaboration-runtime/sandbox/agent-spawner.ts` 在独立子进程中运行。桌面安装包通过 `extraResources` 发布 `agent-worker.mjs` 及其 bootstrap 依赖，并以 `ELECTRON_RUN_AS_NODE=1` 启动。Worker 的通用 runtime module loader 已将文件路径转换成 `file://` URL，但三个最早期 bootstrap 模块仍直接使用 `import(path.join(...))`。

Windows 的绝对路径以盘符开头，Node.js ESM loader 会把 `K:\...` 解析成 protocol `k:`；macOS/Linux 的 `/...` 路径不会暴露同一问题。修复必须位于共享 core runtime，desktop 仅负责校验打包产物，符合 `desktop -> core modules -> Node.js 标准库` 的单向依赖规则。

状态事实源、IPC、持久化和并发模型均不改变。该任务没有数据迁移。

## Goals / Non-Goals

**Goals:**

- 所有打包态 Worker 本地动态导入统一使用合法 ESM module specifier。
- 在非 Windows CI 上也能确定性验证 Windows 盘符路径和空格编码。
- 打包校验能够阻止重新引入裸路径 `import()`。
- 保持开发态 `.ts` / `.mts` 模块解析和现有 runtime loader 行为不变。

**Non-Goals:**

- 不调整 Supervisor DAG、Worker 工具、事件协议和模型配置。
- 不改变子进程启动命令、stdio JSON Line 协议或 Electron 进程隔离。
- 不引入自定义 ESM loader 或第三方 URL 库。

## Decisions

### Decision 1：统一通过 `pathToFileURL()` 生成本地模块 specifier

为 bootstrap 本地模块增加单一转换函数，接收绝对文件路径并返回 `pathToFileURL(path).href`。打包态三个早期动态导入和已有 `coreModulePath()` 共享该边界，避免调用方自行决定路径格式。

选择理由：`node:url` 能正确处理盘符、反斜杠、空格、Unicode 与 `app.asar` 路径，且与 Node.js ESM loader 的公共契约一致。

替代方案：

- 手工拼接 `file:///`：容易遗漏 URL 编码和 UNC 路径，不采用。
- 把 bootstrap 依赖静态 bundle 到单文件：影响构建和依赖排除策略，超出本 bugfix 范围。
- 修改 spawn 参数：错误发生在 worker 内部的二次动态导入，无法解决根因。

### Decision 2：把路径转换提取为可单测的纯函数

转换逻辑放在独立、无 Electron 依赖的 helper 中，并允许 Node.js 24 的 Windows 路径语义在 Linux CI 上测试。helper 保留已经合法的 URL specifier，防止未来调用方重复转换。

### Decision 3：静态打包校验与运行单测双重覆盖

- 单元测试验证 Windows 盘符、空格、Unicode、POSIX 路径和已有 URL。
- `verify-agent-worker-runtime.js` 检查 bootstrap 不再出现 `import(path.join(...))`，并确认编译后 worker 使用转换入口。
- Windows package verification 继续确认所有 worker 资源存在。

### Subagent 实施边界

- runtime task worktree：仅修改 `packages/core/src/modules/collaboration-runtime/sandbox/` 及其测试。
- packaging verification task：仅修改 `packages/desktop/scripts/verify-agent-worker-runtime.js`；如无需修改则由 runtime task 一并提供验证证据。
- proposal integration worktree：仅维护 `openspec/changes/fix-windows-multi-agent-esm-url/`、合并 task commit 和记录验证结果。

各写入范围不重叠，合并后由 proposal branch 统一执行完整验证。

## Risks / Trade-offs

- [Risk] `pathToFileURL` 在测试宿主与 Windows 运行时的路径语义不同 → 使用 Node.js 24 支持的 Windows path option 或可注入平台语义进行确定性测试，并保留 Windows package smoke 校验。
- [Risk] 只修复当前三个 import，后续又新增裸路径动态导入 → 在打包验证脚本中加入源码约束。
- [Risk] `app.asar` 中某些路径不存在 → 继续沿用现有 `existsSync` 候选解析并在导入前失败，错误信息保持可诊断。
- [Trade-off] 新增一个小型 helper 增加文件数量，但换取跨平台契约可测试且避免重复实现。

## Migration Plan

1. 合并 runtime 和测试 task 到 proposal branch。
2. 执行 core 单元测试、TypeScript 检查和 agent worker runtime 校验。
3. 构建 desktop 并执行 Windows package verification；CI Windows runner 验证实际安装包启动 Supervisor。
4. 合并 proposal 到 `dev`，随下一 desktop bugfix 版本发布。

回滚时回退 proposal 合并提交即可；无数据和协议迁移。

## Open Questions

无。Node.js 24 和 Electron 运行时均支持标准 `file://` module specifier。
