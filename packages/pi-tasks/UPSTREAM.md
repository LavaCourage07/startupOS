# 上游基线

- package：`pi-tasks`
- version：`0.2.0`
- repository：`https://github.com/nczz/pi-tasks`
- license：MIT
- 基线入口 SHA-256：`3a99294bcc034cd63bc245132e7b3c429acf31fd0b2bd6058e4be85eb0b94136`
- 基线 reducer SHA-256：`53dc26325e818fec1841cb40a5736f67404adafd021171b7e0976ff7a1e5ea64`

OriginOS 差异仅限事务信封、重放/幂等、公共状态事件、公共 factory/type export，以及移除
强制完成旁路。领域 reducer 仍在本 package 内维持单一实现。

OriginOS 的 v2 持久化扩展另外区分真实 Session branch leaf 与 Task ledger cursor，校验 checkpoint receipt 完整性，并用 64KB 有界近期 receipt 窗口支持 compaction 后幂等恢复。这些属于宿主持久化契约，不改变上游 Task 领域事件语义。
