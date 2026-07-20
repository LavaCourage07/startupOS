# Story AG.5: 自动化围栏（ESLint 边界 + dead-code 工具 + any 预算 + CI 接入）

**Epic:** AG — 架构治理与围栏对齐
**状态:** 📋 Planning
**优先级:** 🟡 Medium（治理「再发生」的护栏，需在 AG.1~AG.4 落地后再启用 error 级）
**估计工时:** 2 天

---

## Story 概览

> 作为 OriginOS 维护者，我需要把 CLAUDE.md 中的架构围栏从「人工评审」升级为「CI 自动拦截」。当前没有 ESLint `no-restricted-imports` 全局规则、没有 dead-code 工具、没有 `any` 预算门 — 任何穿透模块边界、`any` 滥用、未使用导出都依赖人工 PR review 把关。本 Story 接入工具链，让违规在 CI 阶段被拦截在合入前。

---

## 快速导航

- [需求规格](./requirements.md) - 用户故事、功能需求、验收标准
- [架构设计](./architecture.md) - 技术栈、数据结构、模块设计
- [测试策略](./testing.md) - 测试用例、验收标准测试

---

## 核心问题

当前 OriginOS 缺少自动化架构治理工具，所有架构围栏依赖人工 PR review 把关，容易遗漏。

---

## 目标架构

### ESLint 边界规则

- 📋 在 `.eslintrc.json` 中追加 `overrides` 段，按目录注入 `no-restricted-imports`
- 📋 渐进式启用：Week 1 warn → Week 2 PR diff error → Week 3+ 全量 error

### Dead-code 检查

- 📋 默认采用 **knip**（现代化、配置友好、支持 monorepo / Next.js）
- 📋 渐进式接入：Week 1 收集基线 → Week 2 新增 fail → Week 3+ 基线收敛

### any 预算脚本

- 📋 新建 `scripts/any-budget.mjs` 统计 any 使用
- 📋 预算目标：`src/modules/**` ≤ 30、`src/lib/**` ≤ 60

### 循环依赖检查

- 📋 使用 `madge` 检测循环依赖
- 📋 CI 中必须输出 `No circular dependency found`

### CI 集成

- 📋 新增 `.github/workflows/architecture-guardrails.yml`
- 📋 包含 TypeScript check、ESLint boundaries、Dead-code check、any budget、Circular dependencies

---

## 依赖关系

- **前置依赖：** AG.1 / AG.2 / AG.3（迁移完成后再接 lint）；AG.4（CLAUDE.md 条款落地后规则措辞才稳定）

---

## 相关文档

- [需求规格](./requirements.md)
- [架构设计](./architecture.md)
- [测试策略](./testing.md)
- [Epic AG README](../README.md)
