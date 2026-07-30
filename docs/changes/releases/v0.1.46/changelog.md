# OriginOS CE v0.1.46 Changelog

发布日期：2026-07-30

## 修复

- 修复 Skill、Agent 和 RoleAgent 窗体点击历史会话无响应的问题。
- 恢复历史 Session 时同步还原可见消息、项目上下文、Agent 类型、工作目录、
  输出目录和模型配置，使后续消息继续在原 Session 中执行。
- 增加 Session ownership 校验与结构化错误，历史缺失、数据损坏或归属不匹配时
  保留当前会话并显示明确错误。
- 增加 request epoch、abort guard 和旧 stream 隔离，快速连续切换时只接受最后
  一次请求，迟到响应不能覆盖当前会话。
- 修复删除历史条目时事件冒泡触发切换，以及恢复空 Session 时重复发送欢迎消息。
- 补充 `session-restore` 的 `@originos/core` package subpath export，保证 Web 和
  Desktop 均通过公共包边界引用恢复契约。

## 验证

- Windows `desktop:dev` 历史会话人工验收通过。
- Session restore、Runtime 历史映射、AgentManager、Hook 隔离、UI transition、
  Electron adapter、SessionStore、长会话和 Completion Guard 共 90 项测试通过。
- 1,000 条历史消息的 schema 校验与 display projection 通过 `<500ms` 预算。
- Core/Web TypeScript 检查、Desktop build、Web lint 和 OpenSpec strict validation
  通过。

## 兼容性

- 新建会话、删除会话和普通流式消息行为保持兼容。
- 真实 Electron renderer 的 1,000 条历史首屏、滚动和内存指标作为发布后观察项。
