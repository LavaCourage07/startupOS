# F44：RoleAgent 边界与扩展点

## 开篇场景

RoleAgent 已经实现了角色上下文加载、状态机、7 层 prompt、Memory Block、Dream 等核心功能。但还有一些边界问题和扩展点需要关注。

## 核心问题

**RoleAgent 有哪些已知限制？未来可以扩展什么？**

## 已知限制

### 1. 状态机解析

- 当前使用简易 YAML 解析器，不支持嵌套结构；
- `determinePhase` 只扫描 `[PHASE:xxx]` 标记，不验证转换规则。

### 2. Dream 触发

- Phase 1 的 LLM 调用由 Launcher 层完成，Dream 类只负责 Phase 2；
- 如果 LLM 输出格式错误，`parseDreamInstructions` 可能返回空数组。

### 3. Memory Block

- `parseBlocksFromMarkdown` 使用正则匹配，对复杂格式敏感；
- Memory Core 的底层实现属于 Part H，本单元只讲调用合同。

### 4. Consolidator

- 预留接口，未接入完整触发逻辑；
- 需要前端 token 计数支持。

## 扩展点

### 1. 多角色协作

- 未来可以支持多个 RoleAgent 协作；
- 需要定义角色间通信协议。

### 2. 动态技能市场

- 当前技能安装需要手动操作；
- 未来可以支持自动发现和安装。

### 3. 可视化状态机

- 当前状态机是文本定义；
- 未来可以支持图形化编辑。

## 练习与验收

1. **分析限制**：找出至少 3 个已知限制。
2. **设计扩展**：为“多角色协作”设计通信协议。

**验收标准**：能分析 RoleAgent 的限制和扩展点。

## 章节收束

边界与扩展点讲完了。下一节课（F45）是 F.3 单元小结 Workshop。
