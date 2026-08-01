# @originos/pi-tasks

OriginOS 维护的受控 `pi-tasks` fork。包内保留上游 Task、Step、Criterion、Evidence、
Blocker 与 reducer 规则，并增加 branch-safe revision/cursor、requestId 幂等、CAS、
mutation receipt 与不可绕过的 Evidence Gate。

该 package 是 Task 领域状态的唯一事实源；OriginOS Adapter 不得复制 reducer 或直接读取
其私有 store。

## Ledger 与 Session Cursor

- `expectedCursor`、receipt 的 `cursorBefore` 和 envelope 的 `parentCursor` 都表示调用前真实 Session branch leaf。
- receipt 的 `cursorAfter` 与 state-event scope cursor 表示新写入的 Task Session entry。
- store metadata 的 `cursor` 只表示最近 Task ledger entry；Task revision/ledger cursor 负责 Task 事件顺序，不能替代 Session leaf CAS。
- 已提交 request 的幂等重试先验证当前 branch 是否包含原 mutation receipt；跨 branch 不复用 receipt。

## Compaction 幂等窗口

Checkpoint payload 上限为 64KB，receipt 使用 `latest_revision_window` 策略，最多保留最近 128 条，并在接近上限时继续从最旧记录开始缩减。仅从单个 checkpoint 恢复时，窗口内 requestId 保持幂等；已被窗口淘汰的旧 requestId 不再提供幂等保证。该边界由 `receiptWindow` 的 retained/omitted 数量和 revision 范围明确记录。
