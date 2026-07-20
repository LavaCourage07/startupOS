---
name: task-manager
description: 任务管理技能，帮助用户通过对话式界面管理项目中的任务
version: 1.0.0
type: COMPOSITE
author: OriginOS
tags:
  - task
  - management
  - project
reads:
  - task
  - project
writes:
  - task
  - project
prerequisites: []
dependencies:
  - ontology-editor
---

# 任务管理

本技能帮助你通过对话式界面管理项目中的任务。

## 功能

- 创建新任务
- 更新任务状态
- 分配任务给人员
- 设置任务优先级
- 查询和筛选任务
- 分析任务分布

## 使用方式

你可以用自然语言描述你的操作，例如：

- "创建一个新任务：重构登录页面"
- "将 task_123 标记为进行中"
- "把 task_456 分配给张三"
- "列出所有高优先级任务"
- "显示项目的任务统计"

## 任务状态

- `open` - 待处理
- `in_progress` - 进行中
- `blocked` - 被阻塞
- `done` - 已完成
- `cancelled` - 已取消

## 优先级级别

- `critical` - 紧急
- `high` - 高
- `medium` - 中
- `low` - 低

## 执行指导

处理用户请求时：

1. **理解意图**：分析用户的自然语言输入，确定要执行的操作类型
2. **识别操作类型**：
   - 创建：包含"创建"、"新建"、"添加"、"create"、"new"、"add"等关键词
   - 更新状态：包含"标记为"、"设为"、"改为"、"update"、"change"等关键词
   - 分配人员：包含"分配给"、"指派给"、"assign"等关键词
   - 查询：包含"列出"、"显示"、"查询"、"list"、"show"、"query"等关键词
   - 统计：包含"统计"、"分析"、"stats"、"analysis"等关键词

3. **提取参数**：
   - 任务标题：从"任务：xxx"、"create task: xxx"模式中提取
   - 任务ID：匹配 pattern `task_[a-z0-9]+`
   - 状态关键词：
     - "进行中"/"doing"/"in_progress" → in_progress
     - "完成"/"finished"/"done" → done
     - "阻塞"/"blocked" → blocked
     - "取消"/"cancel" → cancelled
     - "待处理"/"todo"/"open" → open
   - 优先级关键词：
     - "紧急"/"critical" → critical
     - "高"/"high" → high
     - "中"/"medium" → medium
     - "低"/"low" → low

4. **提供流式响应**：
   - 首先确认用户的意图
   - 逐步显示执行进度
   - 提供中间状态更新
   - 最终确认结果

## 响应示例

**创建任务**：
```
好的，我来帮你创建一个新任务：重构登录页面

✓ 正在创建任务...
✓ 任务已创建成功！

任务信息：
- 标题：重构登录页面
- 状态：待处理
- 优先级：中等
- ID：task_abc123
```

**更新任务状态**：
```
收到！正在更新任务状态...

找到任务：task_123
当前状态：待处理

✓ 状态已更新为：进行中
```

**查询任务**：
```
正在查询高优先级任务...

找到 3 个高优先级任务：

1. task_001 - 修复安全漏洞 [进行中]
2. task_002 - 性能优化 [待处理]
3. task_003 - 数据库迁移 [被阻塞]
```

让我知道你想要管理哪些任务！
