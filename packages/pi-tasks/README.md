# @originos/pi-tasks

OriginOS 维护的受控 `pi-tasks` fork。包内保留上游 Task、Step、Criterion、Evidence、
Blocker 与 reducer 规则，并增加 branch-safe revision/cursor、requestId 幂等、CAS、
mutation receipt 与不可绕过的 Evidence Gate。

该 package 是 Task 领域状态的唯一事实源；OriginOS Adapter 不得复制 reducer 或直接读取
其私有 store。
