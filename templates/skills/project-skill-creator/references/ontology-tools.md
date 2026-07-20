# OriginOS 本体工具参考

在 OriginOS 中创建的 Agent/Skill 需要通过系统内置的本体工具来操作本体（Ontology）和本体实例数据（Instance Data）。创建面向业务领域的技能时，应在 SKILL.md 中指引 Agent 使用这些工具。

## 工具注册

系统内置两组本体工具，均通过 Tool 接口调用，Agent 在执行时可直接调用。

### 1. 本体结构工具（ontology-tools）

操作本体本身的结构（领域、概念、关系），共 4 个工具：

| 工具名 | 说明 | 参数 |
|--------|------|------|
| `query_ontology` | 查询指定的本体结构 | `ontologyId: string` |
| `create_domain` | 在本体中创建一个新领域层 | `ontologyId: string`, `domainName: string`, `description?: string` |
| `create_concept` | 在指定领域下创建一个概念对象 | `ontologyId: string`, `domainId: string`, `conceptName: string`, `conceptType: "entity" | "process" | "attribute" | "relation"`, `description?: string` |
| `search_ontology` | 在本体中搜索匹配的概念或领域 | `ontologyId: string`, `query: string` |

### 2. 本体数据工具（ontology-data-tools）

操作本体实例数据（创建/查询/更新/删除实例），共 7 个工具：

| 工具名 | 说明 | 参数 |
|--------|------|------|
| `create_instance` | 创建概念实例数据 | `ontologyId: string`, `domainId: string`, `conceptId: string`, `fields: Record<string, unknown>`, `createdBy?: "user" | "agent" | "skill"` |
| `get_instance` | 获取指定实例的完整数据 | `ontologyId: string`, `domainId: string`, `conceptId: string`, `instanceId: string` |
| `update_instance` | 更新实例字段数据 | `ontologyId: string`, `domainId: string`, `conceptId: string`, `instanceId: string`, `fields: Record<string, unknown>` |
| `delete_instance` | 删除指定实例 | `ontologyId: string`, `domainId: string`, `conceptId: string`, `instanceId: string` |
| `query_instances` | 查询实例列表，支持过滤/分页/排序 | `ontologyId: string`, `domainId: string`, `conceptId: string`, `filters?: Record<string, unknown>`, `page?: number`, `limit?: number`, `sortBy?: string`, `sortOrder?: "asc" | "desc"` |
| `get_concept_schema` | 获取概念字段定义和类型信息 | `ontologyId: string`, `conceptId: string` |
| `list_concepts` | 列出概念列表，可按领域过滤 | `ontologyId: string`, `domainId?: string` |

## 使用规范

### 创建面向业务数据的技能

当创建面向业务数据的技能（如订单处理、库存管理、客户管理等）时，应在 SKILL.md 中加入以下指引：

```markdown
## 本体数据操作

本 Agent 通过以下系统工具操作本体数据：

### 读取数据

- 使用 `query_instances` 查询指定概念的实例列表，支持过滤、分页、排序
- 使用 `get_instance` 获取单个实例的完整数据
- 使用 `get_concept_schema` 获取概念的字段定义，用于生成表单或校验
- 使用 `list_concepts` 获取当前本体中的概念列表

### 创建数据

- 使用 `create_instance` 创建新的概念实例
- 调用前应先通过 `get_concept_schema` 确认字段定义和必填项

### 更新数据

- 使用 `update_instance` 更新现有实例的字段

### 删除数据

- 使用 `delete_instance` 删除指定实例

### 本体结构操作

- 使用 `query_ontology` 查询本体整体结构
- 使用 `create_domain` 创建新的业务领域
- 使用 `create_concept` 在领域下添加新概念
- 使用 `search_ontology` 搜索本体中的概念或领域
```

### 工具调用示例

在 SKILL.md 中可以给出具体调用示例：

```markdown
### 查询订单实例

\`\`\`
调用 query_instances:
  ontologyId: "ontology-{projectId}"
  domainId: "domain-{domainId}"
  conceptId: "concept-{conceptId}"
  filters: { status: "pending" }
  limit: 50
\`\`\`

### 创建订单实例

1. 先调用 get_concept_schema 获取订单概念字段定义
2. 根据 schema 验证必填字段
3. 调用 create_instance 传入完整 fields 对象
```

## 注意事项

1. 所有操作均基于文件系统存储（`ontology.json` 和实例目录）
2. 工具会自动处理 ID 安全验证（防止路径遍历）
3. 创建实例前应通过 `get_concept_schema` 获取字段定义，确保数据格式正确
4. `query_instances` 返回的数据结构包含 `items`, `total`, `page`, `limit`, `totalPages` 字段
