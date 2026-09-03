# G70：用户配置——LLM 配置和运行时更新

> 本课核心问题：LLM 配置是怎么被读取和更新的？运行时更新是怎么工作的？

## 1. 开篇场景：小王切换 LLM 提供商

小王在 OriginOS 设置中：
1. 从 Anthropic 切换到 OpenAI。
2. 输入 OpenAI API Key。
3. 选择 GPT-4 模型。
4. 保存配置。

系统需要：
1. 验证 API Key。
2. 更新配置。
3. 通知相关服务。

## 2. 两种 LLM 配置策略

### 2.1 单一提供商

```ts
const llmConfig = {
  apiKey: 'sk-...',
  model: 'gpt-4',
};
```

缺点：无法切换提供商。

### 2.2 多提供商支持

```ts
const llmConfig = {
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'sk-...',
};
```

OriginOS 选择了**多提供商支持**。

## 3. 源码精读：`user-config/index.ts` LLM 部分

打开 [packages/core/src/lib/features/user-config/index.ts](../../../../packages/core/src/lib/features/user-config/index.ts)。

### 3.1 LLM 配置类型

```ts
interface LLMConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  apiKey: string;
}

interface UserConfig {
  theme: 'light' | 'dark';
  language: string;
  notifications: {
    enabled: boolean;
    sound: boolean;
  };
  llm: LLMConfig;
}
```

对应源码位置：[packages/core/src/lib/features/user-config/index.ts 第 1—50 行](../../../../packages/core/src/lib/features/user-config/index.ts#L1-L50)。

### 3.2 运行时更新

```ts
export async function updateLLMConfig(updates: Partial<LLMConfig>): Promise<UserConfig> {
  const config = await readUserConfig();
  const updated = {
    ...config,
    llm: {
      ...config.llm,
      ...updates,
    },
  };
  await writeUserConfig(updated);
  return updated;
}
```

对应源码位置：[packages/core/src/lib/features/user-config/index.ts 第 100—211 行](../../../../packages/core/src/lib/features/user-config/index.ts#L100-L211)。

### 3.3 环境变量回退

```ts
function getLLMConfigFromEnv(): Partial<LLMConfig> {
  return {
    provider: (process.env.LLM_PROVIDER as 'anthropic' | 'openai') || 'anthropic',
    model: process.env.LLM_MODEL || 'claude-sonnet-5',
    apiKey: process.env.LLM_API_KEY || '',
  };
}

export async function readUserConfig(): Promise<UserConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    return validateUserConfig(config);
  } catch {
    // Fallback to env variables
    return validateUserConfig({
      ...getDefaultConfig(),
      llm: getLLMConfigFromEnv(),
    });
  }
}
```

## 4. 图解：LLM 配置更新

```
用户更新 LLM 配置
  │
  ▼
┌──────────────────┐
│ updateLLMConfig()│
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────────┐
│读取配置│ │ 验证输入 │
└───┬───┘ └────┬─────┘
    │          │
    └────┬─────┘
         ▼
┌──────────────────┐
│ 更新 llm 字段    │
└────────┬─────────┘
         │
         ▼
┌──────────────────
│ writeUserConfig()│
└────────┬─────────┘
         │
         ▼
    配置已保存
```

## 5. 设计亮点

### 5.1 环境变量回退

```ts
function getLLMConfigFromEnv(): Partial<LLMConfig> {
  return {
    provider: (process.env.LLM_PROVIDER as 'anthropic' | 'openai') || 'anthropic',
    model: process.env.LLM_MODEL || 'claude-sonnet-5',
    apiKey: process.env.LLM_API_KEY || '',
  };
}
```

- 配置文件不存在时从环境变量读取。
- 支持容器化部署。

### 5.2 运行时更新

```ts
export async function updateLLMConfig(updates: Partial<LLMConfig>): Promise<UserConfig> {
  const config = await readUserConfig();
  const updated = {
    ...config,
    llm: {
      ...config.llm,
      ...updates,
    },
  };
  await writeUserConfig(updated);
  return updated;
}
```

- 支持部分更新。
- 不影响其他配置。

## 6. 测试证据与缺口

### 已覆盖

- `updateLLMConfig` 没有直接测试。

### 缺口

- LLM 配置验证没有测试。
- 环境变量回退没有测试。
- 运行时更新没有测试。

## 7. 小实验：更新 LLM 配置

```ts
import { updateLLMConfig, readUserConfig } from '@originos/core/lib/features/user-config';

// 更新 LLM 配置
const updated = await updateLLMConfig({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'sk-...',
});

console.log(updated.llm.provider); // 'openai'
console.log(updated.llm.model); // 'gpt-4'

// 读取配置
const config = await readUserConfig();
console.log(config.llm.provider); // 'openai'
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. LLM 配置有哪些字段？
2. `updateLLMConfig` 是怎么工作的？
3. 环境变量回退是怎么工作的？
4. 支持哪些 LLM 提供商？

## 9. 章节收束

本课的核心认知是 **LLM 配置支持多提供商，通过环境变量回退，支持运行时更新**。

我们看到的几个关键设计：

- **多提供商支持**：Anthropic 和 OpenAI。
- **环境变量回退**：配置文件不存在时从环境变量读取。
- **运行时更新**：支持部分更新，不影响其他配置。
- **无测试**：没有直接测试覆盖。

下一课（G71）我们会进入用户注册表，了解 Agent 和 Skill 是怎么被扫描和解析的。
