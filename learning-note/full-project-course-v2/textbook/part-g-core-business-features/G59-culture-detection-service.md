# G59：Culture Detection Service——对话是怎么被分析提取品味的

> 本课核心问题：`CultureDetectionService` 是怎么分析对话历史、提取关键词、计算置信度的？

## 1. 开篇场景：小王的对话被分析了

小王和 OriginOS 的对话：

```
Q: 最近在做什么类型的项目？
A: 我在做一个 Web 应用，用 React 和 TypeScript。

Q: 在这个项目中，你主要负责哪个部分？
A: 前端开发，主要是组件设计和状态管理。

Q: 在开发这个项目时，你觉得什么样的做法或特点是你更关注的？
A: 我比较关注代码的可维护性和简洁性，不喜欢过度设计。
```

系统需要分析这段对话，提取小王的品味。

## 2. 两种分析策略

### 2.1 人工标注

```ts
const profile = {
  experience_topology: ['web-development'],
  taste_standards: { positive: ['可维护性', '简洁'] },
};
```

缺点：无法自动扩展。

### 2.2 关键词提取

```ts
const keywords = extractKeywords(dialogue);
const profile = buildProfile(keywords);
```

OriginOS 选择了**关键词提取**。

## 3. 源码精读：`CultureDetectionService.ts`

打开 [packages/core/src/lib/features/culture/services/CultureDetectionService.ts](../../../../packages/core/src/lib/features/culture/services/CultureDetectionService.ts)。

### 3.1 分析对话

```ts
async analyzeDialogue(sessionId: string): Promise<{
  tasteProfile: UserTasteProfile;
  cultureLayer: CultureLayerDetection;
  confidence: number;
  evidenceQuotes: string[];
  tasteDraftId: string;
}> {
  // Mark session as analyzing
  await this.sessionService.markAsAnalyzing(sessionId);

  // Get dialogue history
  const sessionData = await this.sessionService.getSessionForAnalysis(sessionId);

  // Phase 1: Use simulated LLM analysis
  const { analysis, confidence, evidenceQuotes } = await this.simulateLLMAnalysis(
    sessionData.dialogueHistory
  );

  // Build taste profile
  const tasteProfile = this.tasteBuilder.buildFromAnalysis(
    analysis,
    sessionData.userId,
    sessionId,
    sessionData.projectId
  );

  // Store result
  const tasteDraftId = await this.sessionService.storeAnalysisResult(
    sessionId,
    tasteProfile,
    confidence,
    evidenceQuotes
  );

  return { tasteProfile, cultureLayer, confidence, evidenceQuotes, tasteDraftId };
}
```

对应源码位置：[packages/core/src/lib/features/culture/services/CultureDetectionService.ts 第 193—256 行](../../../../packages/core/src/lib/features/culture/services/CultureDetectionService.ts#L193-L256)。

### 3.2 关键词提取

```ts
private extractKeywords(text: string): Record<string, unknown> {
  const experienceKeywords = this.extractExperienceKeywords(text);
  const tasteKeywords = this.extractTasteKeywords(text);
  const tensionKeywords = this.extractTensionKeywords(text);

  return {
    experience: experienceKeywords,
    taste: tasteKeywords,
    tension: tensionKeywords,
  };
}
```

对应源码位置：[packages/core/src/lib/features/culture/services/CultureDetectionService.ts 第 366—375 行](../../../../packages/core/src/lib/features/culture/services/CultureDetectionService.ts#L366-L375)。

### 3.3 经验拓扑关键词

```ts
private extractExperienceKeywords(text: string): string[] {
  const experiencePatterns: Record<string, RegExp[]> = {
    'web-development': [/web/i, /frontend/i, /网页/i, /前端/i, /react/i, /vue/i],
    'mobile-development': [/mobile/i, /app/i, /ios/i, /android/i, /flutter/i],
    'enterprise-systems': [/enterprise/i, /企业/i, /management/i, /管理/i],
    'data-platform': [/data/i, /analytics/i, /数据/i, /分析/i],
    'testing': [/test/i, /quality/i, /质量/i, /qa/i],
    'backend': [/backend/i, /后端/i, /api/i, /server/i],
    'fullstack': [/fullstack/i, /全栈/i],
  };

  const found: string[] = [];
  Object.entries(experiencePatterns).forEach(([domain, patterns]) => {
    if (patterns.some(pattern => pattern.test(text))) {
      found.push(domain);
    }
  });

  return found;
}
```

对应源码位置：[packages/core/src/lib/features/culture/services/CultureDetectionService.ts 第 371—391 行](../../../../packages/core/src/lib/features/culture/services/CultureDetectionService.ts#L371-L391)。

### 3.4 品味标准关键词

```ts
private extractTasteKeywords(text: string): { positive: string[]; negative: string[] } {
  const positivePatterns: Record<string, RegExp> = {
    '可维护性': /maintainable|可维护|maintain/i,
    '简洁': /clean|clean code|简洁|simplicity|simple/i,
    '性能': /fast|performance|性能|speed|efficient/i,
    '可读性': /readable|可读|readability/i,
    '测试覆盖': /test coverage|测试覆盖|unit test/i,
  };

  const negativePatterns: Record<string, RegExp> = {
    '过度设计': /complex|复杂|over-engineered|过度设计/i,
    '紧耦合': /tightly coupled|紧耦合/i,
    '硬编码': /hardcoded|硬编码/i,
    '重复代码': /duplicate|重复|redundant/i,
  };

  // ... 匹配逻辑 ...
}
```

对应源码位置：[packages/core/src/lib/features/culture/services/CultureDetectionService.ts 第 396—431 行](../../../../packages/core/src/lib/features/culture/services/CultureDetectionService.ts#L396-L431)。

### 3.5 置信度计算

```ts
private calculateConfidence(
  dialogueHistory: DialogueTurn[] | CultureDetectionMessage[],
  analysis: Record<string, unknown>
): number {
  const turnCount = Array.isArray(dialogueHistory) ? dialogueHistory.length : 0;
  const extractedCount =
    ((analysis['experience_topology'] as string[])?.length ?? 0) +
    ((analysis['taste_standards'] as Record<string, any>)?.['development']?.positive_vibes?.length ?? 0);

  const turnScore = Math.min(turnCount / 4, 1);
  const contentScore = Math.min(extractedCount / 5, 1);

  return Math.round((turnScore * 0.6 + contentScore * 0.4) * 100) / 100;
}
```

对应源码位置：[packages/core/src/lib/features/culture/services/CultureDetectionService.ts 第 496—509 行](../../../../packages/core/src/lib/features/culture/services/CultureDetectionService.ts#L496-L509)。

## 4. 图解：分析流程

```
Dialogue History
  │
  ▼
──────────────────┐
│ simulateLLM     │
│ Analysis         │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────────┐
│ extract│ │ build    │
│Keywords│ │ Analysis │
└───┬────┘ └────┬─────┘
    │           │
    ▼           ▼
┌──────────────────┐
│ calculateConfidence│
└────────┬─────────┘
         │
         ▼
┌──────────────────
│ buildFromAnalysis │
│ → UserTasteProfile│
└──────────────────┘
```

## 5. 设计亮点

### 5.1 关键词模式匹配

```ts
const experiencePatterns: Record<string, RegExp[]> = {
  'web-development': [/web/i, /frontend/i, /react/i, /vue/i],
  'mobile-development': [/mobile/i, /app/i, /ios/i, /android/i],
};
```

### 5.2 置信度加权

```ts
const turnScore = Math.min(turnCount / 4, 1);        // 60% 权重
const contentScore = Math.min(extractedCount / 5, 1); // 40% 权重
return turnScore * 0.6 + contentScore * 0.4;
```

### 5.3 未来扩展

```ts
// Phase 1: Simplified implementation using keyword matching
// Phase 1.5: Integrate pi-agent LLM API
```

## 6. 测试证据与缺口

### 已覆盖

- `CultureDetectionService` 没有直接测试。

### 缺口

- 关键词提取没有测试。
- 置信度计算没有测试。
- 分析流程没有测试。

## 7. 小实验：分析对话

```ts
import { CultureDetectionService } from '@originos/core/lib/features/culture';

const service = new CultureDetectionService();

// 需要先创建会话并添加消息
// const result = await service.analyzeDialogue(sessionId);
// console.log(result.tasteProfile);
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `analyzeDialogue` 的流程是什么？
2. 关键词提取是怎么工作的？
3. 置信度是怎么计算的？
4. 为什么叫 `simulateLLMAnalysis`？
5. 品味标准有哪些正面和负面关键词？

## 9. 章节收束

本课的核心认知是 **`CultureDetectionService` 通过关键词模式匹配提取对话中的品味信号，计算置信度，生成 TASTE Profile**。

我们看到的几个关键设计：

- **关键词提取**：正则表达式匹配经验拓扑、品味标准、张力位置。
- **置信度计算**：轮次得分（60%）+ 内容得分（40%）。
- **Phase 1 简化**：关键词匹配，未来集成 LLM。
- **无测试**：没有直接测试覆盖。

下一课（G60）是单元小结课，我们会画出"动画 → 系统 → Taste → Culture"的完整调用链。
