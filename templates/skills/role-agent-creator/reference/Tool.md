---
toolsVersion: 1.0.0
disabledTools: []
allowedSkills: []
---

# 工具配置

Tool.md 是角色 Agent 的**动态工具与技能配置文件**。角色创建时可根据角色功能属性确定需要使用的系统工具，之后用户可通过 `add_skill` 和 `remove_skill` 工具动态为角色安装/移除技能。

## 技能加载与调用原则

角色 Agent 拥有两类能力来源，按优先级排序：

1. **技能（Skills）— 优先使用**
   技能是预定义的工作流程或专业知识，包含详细的操作指令和上下文。当用户的需求能被某个技能覆盖时，**优先调用 `Skill` 工具**加载该技能，按照技能指令执行。

2. **系统工具（Tools）— 技能无法覆盖时使用**
   当没有合适技能，或任务超出技能范围时，直接调用对应的系统工具（如 `read_file`、`execute_command` 等）。

判断逻辑：
- 收到用户指令后，先检查已安装技能是否能处理该任务
- 如果有匹配技能，调用 `Skill` 工具加载并执行
- 如果技能无法覆盖，直接使用系统工具完成任务
- 发现用户常需要的能力但尚无技能时，建议用户安装对应技能

## 可用系统工具

以下均为 OriginOS 已注册工具，根据角色的功能属性选择配置：

### 文件操作（所有需要文件读写的角色）

| 工具 | 用途 |
|------|------|
| `read_file` | 读取文件内容 |
| `write_file` | 创建或写入文件 |
| `edit_file` | 精确修改文件局部内容 |
| `list_files` | 列出目录文件 |
| `delete_file` | 删除文件 |
| `read_document` | 读取 Word/Markdown/Text 等文档，支持分页 |
| `read_spreadsheet` | 读取 Excel/CSV 表格，支持 sheet 和行分页 |
| `list_document_structure` | 查看文档章节、表格、sheet、行列规模 |
| `extract_document_tables` | 提取 Word/Excel/CSV 中的表格 |

### 本体操作（需要读写项目本体数据的角色）

| 工具 | 用途 |
|------|------|
| `query_ontology` | 查询本体结构 |
| `search_ontology` | 搜索本体内容 |
| `create_instance` | 创建本体实例 |
| `get_instance` | 获取实例详情 |
| `update_instance` | 更新实例字段 |
| `delete_instance` | 删除实例 |
| `query_instances` | 按条件查询实例列表 |
| `list_concepts` | 列出本体概念 |
| `create_domain` | 创建本体领域 |
| `create_concept` | 创建本体概念 |

### 命令执行（技术类角色）

| 工具 | 用途 |
|------|------|
| `execute_command` | 执行 shell 命令（构建、测试、调试等） |

### 技能管理（所有允许安装技能的角色）

| 工具 | 用途 |
|------|------|
| `list_skills` | 查询当前可用技能 |
| `Skill` | 调用已安装技能执行工作流 |

### 系统工具（按需选用）

| 工具 | 用途 |
|------|------|
| `get_current_time` | 获取当前时间 |
| `calculate` | 数学计算 |
| `ask_user_question` | 向用户提问（HITL 决策点） |

## 已安装技能

## 技能安装与移除

用户要求安装技能时，使用 `list_skills` 查询可用技能，然后执行以下操作：

1. 调用 `execute_command` 创建目录软链接：`ln -sf ../../data/skills/{skillCode} .skills/{skillCode}`
2. 在本文件的"已安装技能"部分追加该技能的信息

用户要求移除技能时：

1. 调用 `execute_command` 删除 `.skills/{skillCode}/` 目录软链接
2. 在本文件中删除该技能对应的信息行

## 技能记录格式

安装技能后，在本文件中按以下格式记录：

| Code | 名称 | 描述 | 加载路径 |
|------|------|------|----------|
| `{skill_code}` | `{skill_name}` | `{skill 的 description 字段}` | `.skills/{skill_code}/SKILL.md` |
