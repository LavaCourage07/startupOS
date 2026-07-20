# {AgentName} 数据模型

## 本体对象

### {OntologyObjectName}

- **操作类型**: {read | create | update | delete | validate | query}
- **描述**: {该本体对象的业务含义}

#### 关键字段

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| {field} | {string/number/boolean/object} | {required/optional, 格式约束} | {默认值} | {业务含义} |

#### 数据约束

{列出该本体对象的业务级约束规则，如字段间依赖关系、枚举值限制等}

#### 与其他 Agent 的数据边界

{说明哪些字段是本 Agent 独占写入的，哪些是只读共享的}

---

{如有更多本体对象，重复上述结构}
