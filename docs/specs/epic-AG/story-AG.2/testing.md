# 测试策略 - Story AG.2

**Story:** 模块边界修复 — DI 接口扩展 + UI 解耦 + shared 层
**Epic:** AG — 架构治理与围栏对齐
**最后更新:** 2026-07-17

---

## 测试策略

本 Story 的测试分为**静态验证**（grep 扫描确认越界 import 清零）和**动态验证**（TypeScript 编译 + 协作运行时 e2e 测试）。变更应拆分为至少 3 个 PR（shared 建立 / collaboration-runtime 修复 / memory-core 修复），每个 PR 独立通过验证。

### 测试前置条件

- AG.1 清场作业已完成
- 协作运行时 4 项核心 e2e 在当前基线上已通过

---

## 验收测试用例

### TC-1: modules 层 `@/lib` 越界 import 清零

**验证目标：** `src/modules/**` 中不存在任何直接 import `@/lib/**`（shared 除外）

```bash
grep -rn "from ['\"]@/lib" src/modules/ | wc -l
```

**预期结果：** 输出 `0`

---

### TC-2: modules 层 `@/components` 越界 import 清零

**验证目标：** `src/modules/**` 中不存在任何直接 import `@/components/**`

```bash
grep -rn "from ['\"]@/components" src/modules/ | wc -l
```

**预期结果：** 输出 `0`

---

### TC-3: shared 层目录结构完整

**验证目标：** `src/lib/shared/` 目录已建立，含 `agent/`、`cognitive/`、`model/` 三个子目录

**检查项：**
- `src/lib/shared/agent/` 存在且含 `persistent-agent.ts` + `index.ts`
- `src/lib/shared/cognitive/` 存在且含 `types.ts` + `index.ts`
- `src/lib/shared/model/` 存在且含 `factory.ts` + `index.ts`
- `src/lib/shared/index.ts` barrel 文件存在

---

### TC-4: CollaborationRuntimeDeps 扩展字段注入验证

**验证目标：** `modelFactory` 字段已在所有调用方组装 deps 时传入

**检查项：**
- `src/app/api/collaboration/sessions/**` 路由中 `createCollaborationRuntime()` 调用含 `modelFactory` 参数
- `npx tsc --noEmit` 无 missing property error

---

### TC-5: MemoryCoreDeps 扩展验证

**验证目标：** 若 `MemoryCoreDeps` 已存在，`modelFactory` 字段已在调用方注入；若不存在 DI 入口，已顺势补齐

**检查项：**
- `MemoryCoreDeps` 接口含 `modelFactory` 字段
- 所有创建 memory-core 实例的位置传入了 `modelFactory`

---

### TC-6: TypeScript 编译通过

**验证目标：** 所有类型搬移和 DI 扩展未引入类型错误

```bash
npx tsc --noEmit
```

**预期结果：** 0 error

---

### TC-7: 协作运行时核心 e2e 通过

**验证目标：** DI 改造后运行时行为不受影响

**测试用例：**
1. HITL recovery — 人在回路中断恢复
2. DAG execution — 工作流 DAG 执行
3. Supervisor mode — 主管模式任务分发
4. User message routing — 用户消息路由

**预期结果：** 全部 4 项通过

---

### TC-8: 多 PR 拆分完整性

**验证目标：** 变更拆分为至少 3 个独立 PR，便于精准 revert

**检查项：**
- PR 1: `src/lib/shared/` 建立
- PR 2: `collaboration-runtime` 越界修复
- PR 3: `memory-core` 越界修复
- 每个 PR 独立通过 CI
