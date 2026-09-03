# G69：用户配置——`readUserConfig` 和 `writeUserConfig`

> 本课核心问题：用户配置是怎么被读取和写入的？

## 1. 开篇场景：小王修改主题

小王在 OriginOS 设置中选择"深色主题"。

系统需要：
1. 读取当前配置。
2. 更新主题设置。
3. 写入到配置文件。
4. 通知 UI 更新。

## 2. 两种配置策略

### 2.1 硬编码配置

```ts
const config = {
  theme: 'dark',
  language: 'zh-CN',
};
```

缺点：无法持久化，重启后丢失。

### 2.2 JSON 文件配置

```ts
const config = await readUserConfig();
config.theme = 'dark';
await writeUserConfig(config);
```

OriginOS 选择了**JSON 文件配置**。

## 3. 源码精读：`user-config/index.ts`

打开 [packages/core/src/lib/features/user-config/index.ts](../../../../packages/core/src/lib/features/user-config/index.ts)。

### 3.1 读取配置

```ts
export async function readUserConfig(): Promise<UserConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    return validateUserConfig(config);
  } catch (error) {
    // Return default config if file doesn't exist
    return getDefaultConfig();
  }
}
```

对应源码位置：[packages/core/src/lib/features/user-config/index.ts 第 1—100 行](../../../../packages/core/src/lib/features/user-config/index.ts#L1-L100)。

### 3.2 写入配置

```ts
export async function writeUserConfig(config: UserConfig): Promise<void> {
  const validated = validateUserConfig(config);
  await fs.writeFile(CONFIG_PATH, JSON.stringify(validated, null, 2));
}
```

对应源码位置：[packages/core/src/lib/features/user-config/index.ts 第 101—150 行](../../../../packages/core/src/lib/features/user-config/index.ts#L101-L150)。

### 3.3 更新配置

```ts
export async function updateUserConfig(updates: Partial<UserConfig>): Promise<UserConfig> {
  const config = await readUserConfig();
  const updated = { ...config, ...updates };
  await writeUserConfig(updated);
  return updated;
}
```

对应源码位置：[packages/core/src/lib/features/user-config/index.ts 第 151—211 行](../../../../packages/core/src/lib/features/user-config/index.ts#L151-L211)。

## 4. 图解：配置读写

```
readUserConfig()
  │
  ▼
──────────────────┐
│ fs.readFile()    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ JSON.parse()     │
└────────┬─────────┘
         │
         ▼
──────────────────┐
│ validateUserConfig│
└────────┬─────────┘
         │
         ▼
    UserConfig

writeUserConfig()
  │
  ▼
──────────────────┐
│ validateUserConfig│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ JSON.stringify() │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ fs.writeFile()   │
└──────────────────┘
```

## 5. 设计亮点

### 5.1 默认值

```ts
function getDefaultConfig(): UserConfig {
  return {
    theme: 'light',
    language: 'zh-CN',
    notifications: {
      enabled: true,
      sound: true,
    },
    llm: {
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      apiKey: '',
    },
  };
}
```

### 5.2 验证

```ts
function validateUserConfig(config: unknown): UserConfig {
  // Validate required fields
  if (!config || typeof config !== 'object') {
    return getDefaultConfig();
  }

  const c = config as Record<string, unknown>;

  return {
    theme: c.theme === 'dark' ? 'dark' : 'light',
    language: typeof c.language === 'string' ? c.language : 'zh-CN',
    notifications: {
      enabled: c.notifications?.enabled !== false,
      sound: c.notifications?.sound !== false,
    },
    llm: {
      provider: c.llm?.provider === 'openai' ? 'openai' : 'anthropic',
      model: typeof c.llm?.model === 'string' ? c.llm.model : 'claude-sonnet-5',
      apiKey: typeof c.llm?.apiKey === 'string' ? c.llm.apiKey : '',
    },
  };
}
```

## 6. 测试证据与缺口

### 已覆盖

- `readUserConfig` 没有直接测试。

### 缺口

- 配置读写没有测试。
- 验证逻辑没有测试。
- 默认值没有测试。

## 7. 小实验：读写配置

```ts
import { readUserConfig, writeUserConfig, updateUserConfig } from '@originos/core/lib/features/user-config';

// 读取配置
const config = await readUserConfig();
console.log(config.theme);

// 写入配置
await writeUserConfig({
  ...config,
  theme: 'dark',
});

// 更新配置
const updated = await updateUserConfig({
  theme: 'dark',
});
console.log(updated.theme);
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `readUserConfig` 是怎么工作的？
2. `writeUserConfig` 是怎么工作的？
3. `updateUserConfig` 是怎么工作的？
4. 如果配置文件不存在，返回什么？

## 9. 章节收束

本课的核心认知是 **用户配置通过 JSON 文件持久化，支持读取、写入和更新**。

我们看到的几个关键设计：

- **JSON 文件**：简单持久的配置存储。
- **默认值**：文件不存在时返回默认配置。
- **验证**：读取和写入时验证配置。
- **无测试**：没有直接测试覆盖。

下一课（G70）我们会看 LLM 配置和运行时更新。
