## 1. Runtime 修复

- [ ] 1.1 `WIN-ESM-01-A`（串行）在 `task/fix-windows-multi-agent-esm-url-runtime` worktree 中实现统一 ESM module specifier 转换；依赖：无；写入范围：`packages/core/src/modules/collaboration-runtime/sandbox/`；负责角色：runtime subagent；必需测试：Windows 盘符、空格、Unicode、POSIX 和已有 URL；完成证据：测试输出与 task commit。
- [ ] 1.2 `WIN-ESM-01-B`（串行，依赖 1.1）将打包态 `paths.js`、`display-content.js`、`cognitive-session-end.js` 动态导入切换到统一入口；写入范围：`packages/core/src/modules/collaboration-runtime/sandbox/agent-worker.mts`；负责角色：runtime subagent；必需测试：worker bootstrap 单元/静态校验；完成证据：源码 diff 中不存在裸 `import(path.join(...))`。

## 2. 打包与回归验证

- [ ] 2.1 `WIN-ESM-01-C`（可与 1.2 后续测试并行）增强 Agent Worker runtime verification，发现 bootstrap 裸路径动态导入时失败；依赖：1.1；写入范围：`packages/desktop/scripts/verify-agent-worker-runtime.js`；负责角色：packaging verification subagent；必需测试：正向校验和故障注入/源码断言；完成证据：验证脚本成功输出。
- [ ] 2.2 `WIN-ESM-01-D`（串行，依赖 1.2、2.1）执行 core 定向测试、core typecheck、desktop worker runtime verification 和 Windows package verification 可执行部分；写入范围：无；负责角色：QA subagent；完成证据：命令、退出码、平台限制与剩余风险记录。

## 3. 集成与交付

- [ ] 3.1 `WIN-ESM-01-E`（串行，依赖 2.2）将 task branch commit 合并到 proposal integration branch，复核无越界依赖和无生成产物；写入范围：proposal worktree；负责角色：integration owner；完成证据：合并 commit 与干净状态。
- [ ] 3.2 `WIN-ESM-01-F`（串行，依赖 3.1）运行 `openspec validate fix-windows-multi-agent-esm-url --strict`，并建立 Story verification goal，目标为“通过 Story 9.6 中与 Windows 打包态多 Agent Worker 启动相关的测试 case”；写入范围：OpenSpec tasks/evidence；负责角色：QA owner；完成证据：strict validation 与 goal 验证结果。
- [ ] 3.3 `WIN-ESM-01-G`（串行，依赖 3.2）合并 proposal 到 `dev` 并清理本次 task/proposal worktree；写入范围：Git refs/worktrees；负责角色：integration owner；完成证据：`dev` commit、工作树状态和清理记录。
