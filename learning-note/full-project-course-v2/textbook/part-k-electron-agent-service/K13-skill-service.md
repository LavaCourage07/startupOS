# K13 · SkillService：技能列表、执行与流式执行

> **课号** K13 · **轨道** T13 · **文件** `packages/desktop/src/main/services/skill-service.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

桌面版怎样获取技能列表？`skill:execution:start` 怎样执行技能？流式执行和非流式执行有什么区别？

## 概念阶梯

### 第一层：技能列表

技能列表通过 `skill:list` 通道获取，返回所有可用技能的元数据（名称、描述、图标等）。

```textnrenderer → IPC skill:list → SkillService.getSkills()
  → 读取 .claude/skills/ 目录
  → 解析 skill.md 文件
  → 返回技能列表
```

### 第二层：技能执行

技能执行通过 `skill:execution:start` 通道触发，支持两种模式：

| 模式 | 特点 | 适用场景 |
| --- | --- | --- |
| 非流式 | 等待完整结果后返回 | 简单技能 |
| 流式 | 实时推送执行进度 | 复杂技能、需要实时反馈 |

### 第三层：流式执行

流式执行通过 `skill:execution:start:stream` 通道触发，实时推送执行进度和结果。

```textnrenderer → IPC skill:execution:start:stream → SkillService.executeSkillStream()
  → 创建 Agent 会话
  → 执行技能
  → 实时推送 text_delta
  → 返回最终结果
```

## 源码窗口

### 窗口 1：技能列表（第 1–60 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.SKILL_LIST,
  async (): Promise<IpcResponse<Skill[]>> => {
    try {
      const skills = await skillService.getSkills();
      return { success: true, data: skills };
    } catch (error) {
      return { success: false, error: { code: 'SKILL_LIST_FAILED', message: String(error) } };
    }
  }
);
```

### 窗口 2：技能执行（第 61–120 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.SKILL_EXECUTION_START,
  async (_event, request): Promise<IpcResponse<unknown>> => {
    try {
      const result = await skillService.executeSkill(request.skillName, request.params);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: { code: 'SKILL_EXECUTION_FAILED', message: String(error) } };
    }
  }
);
```

### 窗口 3：流式执行（第 121–265 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.SKILL_EXECUTION_START_STREAM,
  async (event, request): Promise<IpcResponse<unknown>> => {
    const sender = event.sender;
    
    // 创建 StreamEventBatcher
    const batcher = new StreamEventBatcher({
      onFlush: (events) => {
        sender.send(IPC_CHANNELS.AGENT_EVENT, {
          type: 'batch_events',
          data: { events },
        });
      },
    });

    try {
      const result = await skillService.executeSkillStream(
        request.skillName,
        request.params,
        {
          onTextDelta: (delta) => {
            batcher.push({ type: 'text_delta', data: { delta } });
          },
          onComplete: (result) => {
            batcher.flush();
            sender.send(IPC_CHANNELS.AGENT_EVENT, {
              type: 'skill_complete',
              data: { result },
            });
          },
        }
      );
      return { success: true, data: { started: true } };
    } catch (error) {
      return { success: false, error: { code: 'SKILL_EXECUTION_FAILED', message: String(error) } };
    }
  }
);
```

## 失败路径

### 失败 1：技能不存在

如果 `skillName` 不存在，`executeSkill()` 抛出异常，返回 `SKILL_NOT_FOUND` 错误。

### 失败 2：参数无效

如果 `params` 缺少必需字段，`executeSkill()` 抛出异常，返回 `INVALID_PARAMS` 错误。

### 失败 3：流式执行中断

如果用户关闭窗口，流式执行中断。`sender.isDestroyed()` 检查 renderer 是否还在。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么技能执行需要流式模式？
2. `StreamEventBatcher` 在流式执行中的作用是什么？

<details>
<summary>参考答案</summary>

1. 复杂技能执行时间长，流式模式实时推送进度，用户体验更好。

2. 合并连续 `text_delta` 事件，减少 IPC 调用次数。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "`SkillService` 处理技能列表和执行。`skill:list` 返回所有可用技能，`skill:execution:start` 执行技能并返回结果，`skill:execution:start:stream` 流式执行并实时推送进度。流式执行使用 `StreamEventBatcher` 合并事件，减少 IPC 调用。"

## 下一课预告

K13 讲了技能服务。K14 会看 `ProjectService` 怎样处理项目 CRUD 和初始化。
