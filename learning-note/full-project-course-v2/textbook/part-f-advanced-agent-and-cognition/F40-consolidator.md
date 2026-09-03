# F40：`consolidator.ts` —— Token 预算触发式压缩

## 开篇场景

RoleAgent 运行久了，system prompt 会越来越长。当接近 LLM 的上下文窗口上限时，需要压缩历史消息。Consolidator 是一个预留接口，用于 token 预算触发式压缩。这节课看 `consolidator.ts`。

## 核心问题

**为什么需要 Consolidator？`shouldConsolidate` 的触发条件是什么？`CONSOLIDATOR_ARCHIVE_PROMPT` 的作用？**

## 概念阶梯

**ConsolidatorConfig**：配置上下文窗口 token 数和安全缓冲 token 数。

**shouldConsolidate**：判断当前 token 数是否超过阈值。

**CONSOLIDATOR_ARCHIVE_PROMPT**：归档 prompt 模板，用于 LLM 压缩对话历史。

## 源码精读

### 1. Consolidator 类

[packages/core/src/lib/integrations/pi-agent/role-agent/consolidator.ts 第 17—34 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/consolidator.ts#L17)

```typescript
export class Consolidator {
  private readonly contextWindowTokens: number;
  private readonly safetyBuffer: number;

  constructor(config?: ConsolidatorConfig) {
    this.contextWindowTokens = config?.contextWindowTokens ?? 128_000;
    this.safetyBuffer = config?.safetyBuffer ?? 10_000;
  }

  shouldConsolidate(currentTokens: number): boolean {
    const threshold = this.contextWindowTokens - this.safetyBuffer;
    return currentTokens > threshold;
  }
}
```

- 默认上下文窗口 128k tokens；
- 默认安全缓冲 10k tokens；
- 当 `currentTokens > 118_000` 时触发压缩。

### 2. CONSOLIDATOR_ARCHIVE_PROMPT

[packages/core/src/lib/integrations/pi-agent/role-agent/consolidator.ts 第 40—53 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/consolidator.ts#L40)

```typescript
export const CONSOLIDATOR_ARCHIVE_PROMPT = `将以下对话历史压缩为简洁摘要，保留：
- 核心请求和决策
- 重要的修改和配置变更
- 用户确认的方案和偏好

省略：
- 调试过程和试错
- 工具调用的详细参数
- 对话填充物和确认语句

输出格式：
## 对话摘要
- [关键请求/决策/修改]`;
```

## 真实调用链

1. 每轮对话后，系统估算当前 token 数；
2. 调用 `consolidator.shouldConsolidate(currentTokens)`；
3. 如果返回 true，构造 `CONSOLIDATOR_ARCHIVE_PROMPT`，调用 LLM 压缩；
4. 用压缩后的摘要替换原始历史。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| currentTokens 恰好等于阈值 | 不触发 | `>` 不是 `>=` |
| currentTokens 为负数 | 不触发 | 无意义输入 |

## 测试证据

- `consolidator.test.ts` 覆盖：
  - 低于阈值返回 false；
  - 超过阈值返回 true；
  - 恰好等于阈值返回 false。

## 练习与验收

1. **测试阈值**：构造不同 token 数，验证 `shouldConsolidate` 行为。
2. **测试配置**：使用自定义配置创建 Consolidator。

**验收标准**：能解释 Consolidator 的触发逻辑。

## 章节收束

Consolidator 是预留接口，目前未接入完整触发逻辑。下一节课（F41）看 `index.ts`，理解模块导出。
