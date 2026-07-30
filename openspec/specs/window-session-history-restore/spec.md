# 窗体会话历史恢复

## Purpose

定义 Skill、Agent 和 RoleAgent 窗体恢复历史 Session 时的消息、执行上下文、
并发隔离、错误处理和性能契约。

## Requirements

### Requirement: 历史条目触发真实 Session restore
系统 SHALL 在 Skill、Agent 和 RoleAgent 窗体点击非当前历史条目时恢复目标
Session，而不是只修改 renderer 的 active Session ID。

#### Scenario: 成功选择历史 Session
- **WHEN** 用户点击属于当前 entry 的非当前历史 Session
- **THEN** 系统进入 switching 状态、恢复目标 Session，并在成功后将其设为 active

#### Scenario: 点击当前 Session
- **WHEN** 用户点击已经 active 的历史 Session
- **THEN** 系统 SHALL 幂等关闭历史列表，不重复恢复或清空消息

### Requirement: 原子恢复消息与执行上下文
系统 MUST 从 canonical Session persistence 恢复可见消息、project context、
Agent 类型、CWD、outputDir、LLM config 和公开 runtime 恢复状态，并在完整校验
成功后原子更新 renderer。

#### Scenario: 恢复完整历史
- **WHEN** 目标 Session 保存了消息和执行上下文
- **THEN** UI 按原顺序显示可见消息，下一轮调用使用目标 Session 的工作目录和配置

#### Scenario: 恢复空 Session
- **WHEN** 目标 Session 没有可见消息
- **THEN** 系统显示合法空状态，且不得自动发送欢迎消息或首轮 prompt

#### Scenario: 过滤内部消息
- **WHEN** 历史包含 system、thinking 或仅用于内部 recovery 的内容
- **THEN** display DTO MUST 过滤内部内容，同时保留可展示的 user、assistant 和 tool 结果

### Requirement: Session ownership 隔离
系统 MUST 在返回历史消息正文前校验目标 Session 属于当前 project 和
Skill/Agent/RoleAgent entry。

#### Scenario: ownership 匹配
- **WHEN** Session 的 project/entry scope 与当前窗体匹配
- **THEN** restore 可以继续读取并返回目标历史

#### Scenario: ownership 不匹配
- **WHEN** 用户请求恢复其他 Skill、Agent 或 project 的 Session
- **THEN** 系统返回结构化 `OWNERSHIP_MISMATCH`，且不得返回消息正文或切换 active Session

### Requirement: 并发切换与迟到事件隔离
系统 MUST 使用单调递增 request epoch 和 Session identity，保证快速连续选择时
只有最新 restore 结果与最新 Session 的 stream events 可以更新 UI。

#### Scenario: restore 乱序完成
- **WHEN** 用户依次选择 A、B，且 A 在 B 之后完成
- **THEN** A 的迟到结果被丢弃，最终 active Session 和消息保持为 B

#### Scenario: 旧 stream 迟到
- **WHEN** 已切换到 B 后收到 A 的 delta、message_end 或 agent_end
- **THEN** 旧事件不得修改 B 的消息、thinking 或 running 状态

#### Scenario: 切换期间发送消息
- **WHEN** restore 尚未完成
- **THEN** 输入与发送 MUST 暂时禁用，消息不能写入旧 Session 或未确认的目标 Session

### Requirement: 恢复失败保留当前会话
系统 MUST 在目标 Session 缺失、损坏、不兼容或 runtime restore 失败时保留切换前
Session 的消息和可用状态，并向用户展示结构化、脱敏的错误。

#### Scenario: Session 不存在
- **WHEN** 用户选择的历史 Session 已被删除
- **THEN** 系统保留当前 Session、刷新历史列表并显示 `NOT_FOUND`

#### Scenario: Session 数据损坏
- **WHEN** 目标 Session 无法通过 schema 校验
- **THEN** 系统显示 `CORRUPT_SESSION`，结束 switching 状态且不提交部分快照

#### Scenario: runtime 无法完全恢复
- **WHEN** 消息和 context 可读取但 runtime 公开边界不能恢复必要状态
- **THEN** 系统 MUST 返回明确 warning 或 `RESTORE_FAILED`，不得声称已完整恢复

### Requirement: 新消息延续目标 Session
restore 成功后，系统 MUST 将后续消息、工具调用和持久化更新限定在目标 Session。

#### Scenario: 恢复后继续对话
- **WHEN** 用户在已恢复的 Session B 中发送下一条消息
- **THEN** 消息只追加到 B，并使用 B 的历史、CWD、outputDir 和 LLM config

#### Scenario: 原 Session 不被修改
- **WHEN** 用户从 A 切换到 B 并在 B 中继续对话
- **THEN** A 的 messages、updatedAt 和 runtime context 不因 B 的操作而变化

### Requirement: 新建与删除行为保持兼容
系统 SHALL 保持现有新建和删除 Session 行为，并防止删除操作冒泡触发 restore。

#### Scenario: 删除历史 Session
- **WHEN** 用户点击历史条目的删除按钮
- **THEN** 系统只执行删除，不触发该条目的 restore

#### Scenario: 新建 Session
- **WHEN** 用户点击新建会话
- **THEN** 系统创建无历史消息的新 Session，并清理旧 restore epoch 和 runtime binding

### Requirement: 恢复性能与安全诊断
系统 MUST 在 500ms 内展示 switching 反馈，使用有界消息投影，并且日志不得包含
完整消息正文、system prompt、凭据或工具输出。

#### Scenario: 长历史恢复
- **WHEN** 目标 Session 包含 1,000 条可见消息
- **THEN** 系统一次性提交稳定消息投影，避免逐条 O(n²) 更新和持续 1 秒以上主线程卡顿

#### Scenario: restore 日志
- **WHEN** restore 成功或失败
- **THEN** 日志只记录脱敏 Session identity、entry type、阶段、消息数、耗时和错误码
