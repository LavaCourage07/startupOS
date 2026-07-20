# Story AG.2: 模块边界修复 — DI 接口扩展 + UI 解耦 + shared 层

**Epic:** AG — 架构治理与围栏对齐
**状态:** 📋 Planning
**优先级:** 🔴 Critical
**估计工时:** 3–4 天
**依赖:** AG.1（清场作业完成后再做边界改动）

## 概述

修复 `src/modules/**` 中所有越界 import（共 11 处），使模块成为真正可独立装拔的业务单元。`collaboration-runtime` 模块有 5 处越界（supervisor-dag 直接 import server-config、facade 穿透到 persistent-agent、UI 直接 import shadcn 组件和 hooks），`memory-core` 有 4 处越界（consolidator 直接 import server-config、多处 import cognitive types）。

核心策略：扩展 `CollaborationRuntimeDeps` 和 `MemoryCoreDeps` 的 DI 接口，新建 `src/lib/shared/` Layer 0 存放跨层共享的纯类型定义，通过依赖注入替代直接 import，实现模块与基础设施层的解耦。

## 文档导航

| 文档 | 内容 |
|------|------|
| [requirements.md](./requirements.md) | 用户故事、验收标准、风险与回滚、相关文档 |
| [architecture.md](./architecture.md) | 必做项（A-E）、shared 层结构、重定向链路、DI 实现示例 |
| [testing.md](./testing.md) | 测试策略、验收测试用例 |

## 状态

- [ ] 需求确认
- [ ] 架构设计
- [ ] 开发实施
- [ ] 测试验证
