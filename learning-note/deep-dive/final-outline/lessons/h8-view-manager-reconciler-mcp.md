# H8. View manager / reconciler / mcp-in-browser

> 类型：源码课大纲
> 状态：待审阅，确认后扩写为完整版课件。

## 本节定位

- 问题：视图管理和浏览器 MCP 如何接入？
- 覆盖：`view-manager`、`view-reconciler`、`mcp-in-browser`
- 图解：view host and reconciler adapters
- 验收：能说明 iframe、micro-app、qiankun 等适配边界。

---

## I. Desktop / Electron / 发布

## 完整版课件要求

- 使用固定结构：问题 -> 图解 -> 源码入口 -> 调用链 -> 关键类型 -> 测试入口 -> 练习 -> 验收。
- 至少包含 1 张 Mermaid 图。
- 如本节涉及核心概念、复杂心智模型或阶段总结，需要加入 Xiaohei 配图。
- 源码入口必须写真实路径，不能只写模块名。
- 调用链必须能从入口追到下一层实现或明确说明边界。
- 测试入口必须写真实测试路径；没有测试时要说明缺口。

## 审阅时请看

- 本节是否值得单独成课。
- 覆盖文件是否太粗或太细。
- 图解方向是否能帮助新手理解。
- 验收标准是否能判断真的学会。
