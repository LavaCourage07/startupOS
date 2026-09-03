# F.5 单元导学：认知系统（Cognitive System）

## 本单元学习目标

F.5 单元深入 OriginOS 的认知系统（Epic C）。认知系统让 Agent 在服务用户的过程中**积累知识、沉淀经验、持续进化**。这是 OriginOS 区别于普通 AI 助手的关键能力。

## 核心文件

| 文件 | 职责 |
|---|---|
| `cognitive/manager.ts` | 认知管理器，编排多个 CognitiveProvider |
| `cognitive/practice-logger.ts` | 实践日志记录，每 turn 自动记录结构化数据 |
| `cognitive/knowledge-provider.ts` | 知识库 Provider，从对话中提取实体和事实 |
| `cognitive/pattern-provider.ts` | 经验模式 Provider，从实践中提炼最佳路径 |
| `cognitive/unified-ontology.ts` | 统一本体模型，Entity/Attribute/Relation/Rule |
| `cognitive/rule-engine.ts` | 规则引擎，混合模式（结构化 + 自然语言） |
| `cognitive/sleep-compute.ts` | 睡眠计算调度器，异步执行重量操作 |
| `cognitive/knowledge-ingest.ts` | 知识来源 Ingest，导入业务模型 |
| `cognitive/types.ts` | 认知系统类型定义 |
| `cognitive/index.ts` | 统一导出 |

## 核心架构

```
CognitiveManager
├── PracticeLogger  ──→ practice/turns/turn-{N}.json
├── KnowledgeProvider ──→ knowledge/ontology.json + wiki/ + Knowledge.md
├── PatternProvider   ──→ patterns/registry.json + Patterns.md + episodic-memory/
└── RuleEngine        ──→ 结构化规则验证 + Agent prompt 生成
```

## 生命周期

```
on_turn_end     → PracticeLogger.sync_turn → 写入 JSONL
              → KnowledgeProvider.sync_turn → 提取实体 → 写入 ontology.json
              → PatternProvider.sync_turn → 检测工具链模式 → 更新 registry

on_session_end → PatternProvider.on_session_end → 批量分析 → 沉淀模式
               → CognitiveManager.build_snapshot_prompt → 生成 Frozen Snapshot

sleep_tasks   → SleepComputeScheduler → 异步执行记忆整理/知识提取/模式挖掘
```

## 本单元课程安排（16 课）

| 课程 | 主题 | 文件 |
|---|---|---|
| F56 | 认知系统架构总览 | `manager.ts` + `types.ts` |
| F57 | `CognitiveManager` 生命周期管理 | `manager.ts` |
| F58 | `PracticeLogger`：实践日志记录 | `practice-logger.ts` |
| F59 | `UnifiedOntology`：统一本体模型 | `unified-ontology.ts` |
| F60 | `KnowledgeProvider`：知识提取与存储 | `knowledge-provider.ts` |
| F61 | `PatternProvider`：模式识别与沉淀 | `pattern-provider.ts`（上） |
| F62 | `PatternProvider`：失败反思与 Reflexion | `pattern-provider.ts`（下） |
| F63 | `RuleEngine`：混合模式规则引擎 | `rule-engine.ts` |
| F64 | `SleepComputeScheduler`：睡眠计算 | `sleep-compute.ts` |
| F65 | `KnowledgeIngest`：业务模型导入 | `knowledge-ingest.ts` |
| F66 | Frozen Snapshot 模式 | `knowledge-provider.ts` + `pattern-provider.ts` |
| F67 | 认知系统与 RoleAgent 集成 | `role-agent/` + `cognitive/` |
| F68 | 认知系统与 ProjectAgent 集成 | `project-agent/` + `cognitive/` |
| F69 | 认知系统测试策略 | `__tests__/` |
| F70 | 性能优化与边界 | 全模块 |
| F71 | F.5 单元小结 Workshop | — |

## 前置知识

- F.3 单元：RoleAgent 的 MemoryTracker 和 Dream（理解记忆系统）
- F.4 单元：ProjectAgent 的上下文加载（理解项目目录结构）
- B 单元：文件系统操作和 JSON 存储

## 学习路径建议

1. **先读架构**（F56）：理解认知系统的整体设计和三个核心组件
2. **再读本体**（F59）：UnifiedOntology 是所有认知数据的基础结构
3. **逐个深入**（F57-F65）：按生命周期顺序理解每个 Provider
4. **看集成**（F66-F68）：认知系统如何与 Agent 结合
5. **做实验**（F69-F71）：测试、优化、总结

## 关键概念速查

| 概念 | 含义 | 对应文件 |
|---|---|---|
| **CognitiveProvider** | 认知提供者接口，所有 Provider 必须实现 | `types.ts` |
| **TurnCognitiveData** | 每轮对话的结构化数据（用户消息、工具调用、结果等） | `types.ts` |
| **UnifiedOntology** | 统一本体，包含 Entity/Attribute/Relation/Rule | `unified-ontology.ts` |
| **Frozen Snapshot** | 启动时加载到 system prompt 的快照，保持 prefix cache 稳定 | `knowledge-provider.ts` |
| **Reflexion** | 失败反思机制，从错误中学习 | `pattern-provider.ts` |
| **Sleep Compute** | 异步执行重量计算任务 | `sleep-compute.ts` |
| **Episodic Memory** | 情景记忆，存储失败反思 | `pattern-provider.ts` |
| **Jaccard Similarity** | 标签相似度计算，用于去重 | `pattern-provider.ts` |

## 下一步

F56 开始，从认知系统架构总览讲起。
