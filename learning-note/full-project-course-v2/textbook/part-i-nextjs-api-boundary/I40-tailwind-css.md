# I40：Tailwind CSS：样式引擎的工作原理

上一节课看了 `page.tsx`。这节课看 Tailwind CSS 如何工作。

## 1. 文件用途

Tailwind CSS 是 OriginOS 的样式引擎，包括：

- 工具类生成
- 响应式设计
- 主题定制

## 2. 核心实现

打开 `tailwind.config.ts`：

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0070f3',
      },
    },
  },
  plugins: [],
}

export default config
```

## 3. 核心逻辑

### 3.1 工具类生成

Tailwind CSS 通过扫描 `content` 指定的文件，自动生成工具类。

```ts
content: [
  './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  './src/app/**/*.{js,ts,jsx,tsx,mdx}',
]
```

### 3.2 响应式设计

Tailwind CSS 提供响应式前缀：

| 前缀 | 断点 | 说明 |
| --- | --- | --- |
| `sm:` | 640px | 小屏幕 |
| `md:` | 768px | 中等屏幕 |
| `lg:` | 1024px | 大屏幕 |
| `xl:` | 1280px | 超大屏幕 |

### 3.3 主题定制

通过 `theme.extend` 扩展默认主题：

```ts
theme: {
  extend: {
    colors: {
      primary: '#0070f3',
    },
  },
}
```

## 4. 失败路径

### 4.1 配置文件错误

如果 `tailwind.config.ts` 配置错误，样式可能无法生成。

### 4.2 工具类未使用

如果工具类未在 `content` 指定的文件中使用，样式不会被生成。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 样式一定正确 |
| 代码阅读 | 逻辑清晰 | 所有浏览器兼容 |

## 6. 小实验

不运行项目，回答：

1. Tailwind CSS 如何生成工具类？
2. `content` 配置的作用是什么？
3. 如何扩展默认主题？

参考答案：

1. 通过扫描 `content` 指定的文件，自动生成工具类。
2. 指定 Tailwind CSS 扫描的文件路径。
3. 通过 `theme.extend` 扩展默认主题。

## 7. 章节收束

本节课看了 Tailwind CSS 的实现：工具类生成、响应式设计、主题定制。Tailwind CSS 是 OriginOS 的样式引擎。

下一节课会看 CSS 变量如何定义和使用。
