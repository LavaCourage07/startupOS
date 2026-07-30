# Story OS.20 验证记录

## 验证目标

通过 Story OS.20 `testing.md` 中定义的测试 case，证明 Skill、Agent 与
RoleAgent 窗体可以恢复历史 Session 的消息和执行上下文，且不存在跨 Session
串写、迟到覆盖或无声失败。

## 自动化结果

| 范围 | 结果 | 证据 |
|---|---:|---|
| Session restore、ownership、错误映射 | 15/15 | `session-restore.test.ts` |
| Runtime 历史模型映射 | 2/2 | `runtime-history-restore.test.ts` |
| AgentManager restore 串行化 | 3/3 | `agent-manager.test.ts` |
| Hook epoch、restore 与 stream 隔离 | 10/10 | `client-hooks-session-isolation.test.ts` |
| UI Session transition guard | 5/5 | `session-transition-guard.test.ts` |
| Electron service/stream adapter | 4/4 | `agent-session.test.ts`、`agent-session-stream.test.ts` |
| SessionStore 新建、读取、删除和大数组 | 39/39 | `session-store.test.ts` |
| 长会话稳定性 | 4/4 | `long-session-stability.test.ts` |
| Chat Completion Guard/Judge | 8/8 | `completion-guard.test.ts`、`completion-judge.test.ts` |

自动化测试总计 90/90 通过。

## 构建与静态检查

| 命令 | 结果 |
|---|---|
| `pnpm exec tsc --noEmit -p packages/core/tsconfig.json` | PASS |
| `pnpm --filter @originos/web type-check` | PASS |
| `pnpm --filter @originos/desktop build` | PASS |
| `pnpm --filter @originos/web lint` | PASS |
| `openspec validate fix-window-session-history-restore --strict` | PASS |
| `git diff --check dev...HEAD` | PASS |

`pnpm agents:check` 返回 0，但脚本只扫描根目录 `src/`，本仓库源码实际位于
`packages/*/src/`，因此其输出为“src/ 目录不存在，跳过检查”，不计作有效证据。
架构依赖已按 `AGENTS.md` 对全部变更文件执行人工检查，未发现 Core 反向依赖
Web/Desktop、跨 feature 内部导入、私有 Pi Session 解析或生成物入库。

## AC 与测试映射

| 验收标准 | 自动化证据 | 状态 |
|---|---|---|
| AC1 历史条目可以切换 | Hook restore + UI transition guard + Windows `desktop:dev` 人工验收 | 通过 |
| AC2 消息和上下文一致恢复 | Session restore + AgentManager + Runtime mapper | 通过 |
| AC3 禁止跨 Session 串写 | Hook stream isolation + ownership | 通过 |
| AC4 最后请求生效 | initialize/restore shared epoch tests | 通过 |
| AC5 失败保留当前状态 | structured errors + failed restore hook test | 通过 |
| AC6 三类窗体一致 | Skill/Agent/RoleAgent 共享 restore action + Windows `desktop:dev` 人工验收 | 通过 |

## 性能证据

QA task `ba64b32` 使用 1,000 条可见 user、assistant 和 toolResult 消息验证
restore schema 校验与 display projection。测试要求低层处理 `<500ms`，执行通过。
该测试不代替 renderer 首屏、滚动和内存稳定性检查。

## Windows 人工验收

用户于 2026-07-30 在 Windows `desktop:dev` 验证历史会话功能，确认历史条目点击、
消息恢复和上下文续接已生效，可以进入发布流程。验收流程覆盖以下核心路径：

1. 创建 Session A、B，并在两者中形成不同历史。
2. 从 A 点击 B，确认出现 switching、B 消息完整显示且不重发欢迎语。
3. 在 B 发送新消息，确认只写入 B。
4. 快速点击 A、B、A，确认最终只显示最后选择的 Session。
5. 删除非当前 Session，确认不触发 restore；删除当前 Session，确认创建空 Session。
6. 关闭并重开窗体，再次选择 B，确认历史和工作目录恢复。
1,000 条历史的 schema 校验与 display projection 已自动化通过 `<500ms` 预算。
真实 Electron renderer 的首屏、滚动和往返切换内存未独立采样，作为发布后残余
观察项保留，不将其记为已完成的性能测量。

## Goal 门禁

尝试创建本 Story 的自动化验证 Goal 时，当前线程已有 paused 的旧性能 Goal，
Goal runtime 按单 Goal 约束拒绝创建第二个 Goal。本 Proposal 未擅自完成或覆盖
旧 Goal。自动化命令与 AC/TC 映射已完整执行并记录，用户又完成 Windows 人工
验收并明确批准合并发布，因此本次采用“等价验证证据 + 显式发布批准”豁免新建
Goal。该记录不声称创建过独立 Goal。
