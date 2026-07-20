# 需求文档 - Story AG.2

**Story:** 模块边界修复 — DI 接口扩展 + UI 解耦 + shared 层
**Epic:** AG — 架构治理与围栏对齐
**最后更新:** 2026-07-17

---

## 用户故事

> 作为 OriginOS 维护者，我需要让 `src/modules/**` 的所有越界 import（11 处）回归通过依赖注入或 shared 层取得，让模块成为真正可独立装拔的业务单元，符合 CLAUDE.md §模块依赖规约 #9。

---

## 验收标准

1. - [ ] `grep -rn "from ['\"]@/lib" src/modules/ | wc -l` 输出 `0`
2. - [ ] `grep -rn "from ['\"]@/components" src/modules/ | wc -l` 输出 `0`
3. - [ ] `src/lib/shared/` 目录建立，包含 `agent/ cognitive/ model/` 三个初始子目录
4. - [ ] `CollaborationRuntimeDeps` 扩展字段 `modelFactory` 已在所有调用方组装时传入
5. - [ ] `MemoryCoreDeps`（如已存在）扩展同上；若尚不存在依赖注入入口，本 Story 顺势补齐
6. - [ ] `npx tsc --noEmit` 0 error
7. - [ ] 协作运行时 4 项核心 e2e 通过（HITL recovery / DAG execution / Supervisor mode / user message routing）
8. - [ ] 至少 3 个变更 PR（shared 建立 / collaboration-runtime 修复 / memory-core 修复），便于精准 revert

---

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| `modelFactory` 注入后 supervisor-dag 拿不到模型实例 | 在每个调用方都跑一次冒烟会话；保留 `createAutoModel` 旧导出至本 Epic 完成才删 |
| UI deps 注入改动影响 `MultiAgentLauncher` 渲染层级 | 改动 PR 中包含 storybook 或最小手动验证截图；只走 props 注入而不改组件签名 |
| shared 类型搬移后某 import 路径未更新导致 type 不兼容 | tsc 兜底；分批 PR 控制 blast radius |
| `useFileUpload` hook 通过 shared 跨层共享被视为「hook 不能在 shared」 | hook 实现保留在 `src/lib/hooks/`，shared 仅放 hook 的「函数签名 type」用于 props 注入，避免在 shared 出现 React 运行时依赖 |

---

## 相关文档

- [Epic AG README](../README.md) — 决策点 #3「shared 层位置」
- [Story 9.27 — ARCH-RT-01](../../epic-9/story-9.27/README.md) — 协作运行时 DI 接口的先例
- [CLAUDE.md §模块依赖规约 / 依赖层级定义](../../../../CLAUDE.md)
