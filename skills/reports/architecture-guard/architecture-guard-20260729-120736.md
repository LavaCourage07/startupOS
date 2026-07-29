# OriginOS 架构围栏检查报告

## 检查概况

- **时间：** 2026-07-29 12:07:36（Asia/Shanghai）
- **范围：** `dev...proposal/validate-pi-tasks-runtime-boundary` 与当前未提交 Proposal 文档
- **规约：** 根目录 `AGENTS.md`、OpenSpec change
  `validate-pi-tasks-runtime-boundary`
- **技术范围：** Pi integration contract tests、Agent package audit、Electron package
  verification scripts、OpenSpec 和 Story 文档

## 结论

**PASS，未发现 BLOCKER、HIGH、MEDIUM 或 LOW 架构违规。**

A-01 的 capability 结论为 Rejected，这是被测试正确识别的外部 runtime
兼容性门禁失败，不是本 Proposal 的架构违规。Story 9.41 已保持 Blocked，
没有继续引入产品 Task Runtime、UI、IPC 或 persistence。

## 检查项

### 依赖方向

- Core 新增内容仅位于
  `packages/core/src/lib/integrations/pi-agent/__tests__/`。
- 未发现 Core 对 `packages/web`、`packages/desktop`、
  `@originos/web` 或 `@originos/desktop` 的依赖。
- Desktop 变更只扩展打包验证脚本和 release verification step，
  未承载 Task 业务逻辑。

### 公共边界

- 未发现 `pi-tasks/src`、`pi-tasks/dist`、`pi-tasks/lib` 或
  `pi-tasks/internal` 私有路径导入。
- 测试中的 `task.snapshot` 是通过公开 extension lifecycle 观察到的
  custom entry 类型；测试未解析生产 Session 文件或伪造生产 state。
- 直接 `ToolDefinition.execute()` 只用于证明 stock API 缺口，ADR 明确禁止
  将其作为生产宿主调用边界。

### OpenSpec 与文档

- Proposal、design、tasks 和 capability spec 齐全。
- `openspec validate validate-pi-tasks-runtime-boundary --strict` 通过。
- ADR 包含精确版本、决策、证据、限制、后续所有权要求、迁移和回滚。
- Story 9.41 与 Epic 9 状态同步为 `Blocked（A-01）`。

### 产物与敏感信息

- 变更集中未发现 `.next`、`dist-electron`、`node_modules`、release 或 log
  产物。
- 机器可读报告不包含 prompt、task content、credential、用户 home path
  或完整 tool output。

### 测试

- Agent adapter audit：3/3 通过。
- Runtime contract：5/5 通过。
- Package verification contract：7/7 通过。
- Web TypeScript：通过。
- Web lint：0 errors，2764 条既有 warnings。
- `pnpm agents:check` exit code 为 0，但脚本因根目录没有 `src/` 而跳过，
  因此本报告使用实际 Proposal diff 和显式依赖扫描补足检查。

## 残余风险

- Windows x64、macOS x64 和 macOS arm64 的真实 package artifact smoke
  尚未执行。由于 P0 公共 mutation 边界已经失败，本次不触发 release 构建；
  verification step 已接入 workflow，后续边界获批后必须补齐。
- `pi-tasks@0.2.0` 保留为精确依赖以维持 audit 可重复性，但没有产品加载路径。
  如果不继续受控 adapter/fork 路线，应在独立清理变更中移除。
- `agents:check` 当前不能覆盖 monorepo package 目录，建议另开治理任务修正，
  不应把其 exit code 单独视作架构检查充分证据。
- `pnpm docs:index` 指向不存在的 `scripts/update-docs-index.js`。本次占位符与
  链接目标人工脚本检查通过，但文档索引自动化需要独立治理。
