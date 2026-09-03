# 单元三导读与复盘：公共类型与界面外壳合同

本单元回答一个问题：Core 读回项目后，Web、Desktop 和 UI 外壳为什么能用同一套语言理解结果。

主线进入 `packages/core/src/types/index.ts`、`packages/core/src/lib/utils.ts` 和若干 UI 外壳类型。读者需要学会区分公共导出、编译期类型、运行时验证、样式合并工具和窗口/桌面/工作空间对象合同。

## 正式课

| 课次 | 作用 |
| --- | --- |
| D10 | 合并讲解公共出口、type-only export、别名和名称冲突。 |
| D11 | 合并讲解 TypeScript、Zod schema 和磁盘 JSON 的能力边界。 |
| D12 | 合并讲解 `cn()`、Acrylic、Spotlight、AppWindow、OS 和 Workspace 类型。 |
| D13 | 从恢复结果追到窗口显示，完成本单元小结。 |

## 小结课验收

读者必须能从一个恢复后的项目结果追到它被 UI 消费时依赖的公共类型，并指出哪些字段只是类型约束，哪些输入经过运行时验证。
